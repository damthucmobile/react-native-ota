if (!global.WebSocket) {
  try {
    global.WebSocket = require("ws");
  } catch (e) {}
}

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || "").trim();

function isSupabaseConfigured() {
  return Boolean(
    SUPABASE_URL &&
    SUPABASE_URL.startsWith("https://") &&
    SUPABASE_SERVICE_ROLE_KEY &&
    !SUPABASE_SERVICE_ROLE_KEY.includes("your-")
  );
}

// Supabase client với Service Role Key để thao tác backend toàn quyền (bảo mật, không expose ra client)
let supabaseAdmin = null;
if (isSupabaseConfigured()) {
  try {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  } catch (err) {
    console.error("Lỗi khởi tạo Supabase Client:", err.message);
  }
}

/**
 * Xác thực JWT token từ người dùng đăng nhập Dashboard
 */
async function verifyUserToken(token) {
  if (!isSupabaseConfigured() || !supabaseAdmin) {
    return { ok: false, error: "Supabase chưa được cấu hình" };
  }
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      return { ok: false, error: error?.message || "Token không hợp lệ" };
    }
    return { ok: true, user: data.user };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  isSupabaseConfigured,
  supabaseAdmin,
  verifyUserToken
};
