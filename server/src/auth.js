const crypto = require("crypto");
const { supabaseAdmin, isSupabaseConfigured, verifyUserToken } = require("./supabase");

/**
 * Tạo API Key mới với tiền tố rõ ràng và mã hash SHA-256
 * @param {'pull' | 'push' | 'full'} type
 */
function generateApiKey(type = "pull") {
  const prefix = `ota_${type}_live_`;
  const randomBytes = crypto.randomBytes(24).toString("hex");
  const fullKey = `${prefix}${randomBytes}`;
  const keyHash = hashApiKey(fullKey);

  return {
    fullKey,
    keyPrefix: prefix,
    keyHash,
    keyType: type
  };
}

/**
 * Hash API Key bằng thuật toán SHA-256 an toàn
 */
function hashApiKey(rawKey) {
  return crypto.createHash("sha256").update(String(rawKey).trim()).digest("hex");
}

/**
 * Middleware xác thực API Key từ Client (Mobile App Pull hoặc CI/CD Push)
 * @param {'pull' | 'push' | 'any'} requiredScope
 */
function requireApiKey(requiredScope = "any") {
  return async (req, res, next) => {
    // 1. Lấy API Key từ Header hoặc Query
    let apiKey = req.header("X-OTA-API-KEY") || "";
    if (!apiKey) {
      const authHeader = req.header("Authorization") || "";
      if (authHeader.startsWith("Bearer ") && authHeader.includes("_live_")) {
        apiKey = authHeader.replace("Bearer ", "").trim();
      }
    }

    // Nếu không có API Key trong header, kiểm tra query param (tiện cho mobile SDK)
    if (!apiKey && req.query.apiKey) {
      apiKey = req.query.apiKey;
    }

    // FALLBACK: Nếu Supabase chưa được cấu hình, hỗ trợ kiểm tra Admin Token cũ (để dev cục bộ)
    if (!isSupabaseConfigured()) {
      const adminToken = req.header("X-OTA-ADMIN-TOKEN") || req.header("X-ADMIN-TOKEN");
      const expectedToken = process.env.OTA_ADMIN_TOKEN || "demo-secret";
      if (adminToken === expectedToken) {
        req.apiKeyInfo = { app_id: req.params.appId || req.query.appId, key_type: "full" };
        return next();
      }
      // Với request Pull từ app client nếu chưa có Supabase thì tạm cho qua ở chế độ demo local
      if (requiredScope === "pull" && !apiKey) {
        req.apiKeyInfo = { app_id: req.query.appId, key_type: "pull", isDemoMode: true };
        return next();
      }
      return res.status(401).json({
        error: "Yêu cầu API Key hoặc hệ thống Supabase chưa cấu hình!",
        code: "UNAUTHORIZED"
      });
    }

    // Đã có Supabase: Kiểm tra API Key bắt buộc
    if (!apiKey) {
      return res.status(401).json({
        error: "Thiếu API Key xác thực. Vui lòng gửi header 'X-OTA-API-KEY'!",
        code: "MISSING_API_KEY"
      });
    }

    const keyHash = hashApiKey(apiKey);
    const targetAppId = req.params.appId || req.query.appId;

    try {
      const { data: keyRecord, error } = await supabaseAdmin
        .from("api_keys")
        .select("id, app_id, name, key_type, is_active, expires_at")
        .eq("key_hash", keyHash)
        .single();

      if (error || !keyRecord || !keyRecord.is_active) {
        return res.status(401).json({
          error: "API Key không hợp lệ hoặc đã bị vô hiệu hóa!",
          code: "INVALID_API_KEY"
        });
      }

      // Kiểm tra ngày hết hạn
      if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
        return res.status(401).json({
          error: "API Key đã hết hạn!",
          code: "EXPIRED_API_KEY"
        });
      }

      // Kiểm tra app_id
      if (targetAppId && keyRecord.app_id !== targetAppId) {
        return res.status(403).json({
          error: `API Key này không có quyền truy cập vào app '${targetAppId}'!`,
          code: "FORBIDDEN_APP_MISMATCH"
        });
      }

      // Kiểm tra scope (quyền hạn pull / push)
      if (requiredScope === "pull" && !["pull", "push", "full"].includes(keyRecord.key_type)) {
        return res.status(403).json({
          error: "API Key này không có quyền Pull/Download bản cập nhật!",
          code: "INSUFFICIENT_SCOPE"
        });
      }

      if (requiredScope === "push" && !["push", "full"].includes(keyRecord.key_type)) {
        return res.status(403).json({
          error: "API Key này không có quyền Push/Publish bản cập nhật!",
          code: "INSUFFICIENT_SCOPE"
        });
      }

      req.apiKeyInfo = keyRecord;
      return next();
    } catch (err) {
      console.error("Lỗi xác thực API Key:", err);
      return res.status(500).json({ error: "Lỗi hệ thống xác thực API Key" });
    }
  };
}

/**
 * Middleware xác thực người dùng đăng nhập Dashboard (Web Console)
 */
async function requireDashboardAuth(req, res, next) {
  // Nếu Supabase chưa cấu hình -> Chế độ demo local
  if (!isSupabaseConfigured()) {
    req.user = { id: "local-admin", email: "admin@local.demo", role: "owner" };
    return next();
  }

  const authHeader = req.header("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Vui lòng đăng nhập để truy cập tính năng này",
      code: "AUTH_REQUIRED"
    });
  }

  const token = authHeader.replace("Bearer ", "").trim();
  const verify = await verifyUserToken(token);

  if (!verify.ok || !verify.user) {
    return res.status(401).json({
      error: verify.error || "Phiên đăng nhập đã hết hạn",
      code: "INVALID_SESSION"
    });
  }

  req.user = verify.user;
  next();
}

module.exports = {
  generateApiKey,
  hashApiKey,
  requireApiKey,
  requireDashboardAuth
};
