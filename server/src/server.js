require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const { supabaseAdmin, isSupabaseConfigured, SUPABASE_URL, SUPABASE_ANON_KEY } = require("./supabase");
const { isR2Configured, uploadToR2, deleteFromR2, getR2DownloadUrl } = require("./r2");
const { generateApiKey, hashApiKey, requireApiKey, requireDashboardAuth } = require("./auth");

const app = express();
const PORT = Number(process.env.PORT || 4500);

const RELEASE_DIR = path.resolve(__dirname, "..", "releases");
const APPS_FILE = path.join(RELEASE_DIR, "apps.json");
const BACKUPS_DIR = path.resolve(__dirname, "..", "backups");
const PUBLIC_DIR = path.resolve(__dirname, "..", "public");

const DEFAULT_APP_ID = "com.otademoapp";

if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}
if (!fs.existsSync(RELEASE_DIR)) {
  fs.mkdirSync(RELEASE_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: "500mb" }));
app.use(express.static(PUBLIC_DIR));

// Serve release bundle zip files
app.use(
  "/releases",
  express.static(RELEASE_DIR, {
    fallthrough: true,
    maxAge: "1h"
  })
);

// ==========================================
// DATA ACCESS & HELPERS
// ==========================================

function readApps() {
  if (!fs.existsSync(APPS_FILE)) {
    if (isSupabaseConfigured()) return [];
    const initial = [
      {
        id: DEFAULT_APP_ID,
        name: "OTA Demo App",
        description: "Ứng dụng Demo React Native Custom OTA",
        createdAt: new Date().toISOString()
      }
    ];
    fs.writeFileSync(APPS_FILE, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
  try {
    return JSON.parse(fs.readFileSync(APPS_FILE, "utf8"));
  } catch (e) {
    return [];
  }
}

function writeApps(apps) {
  fs.writeFileSync(APPS_FILE, JSON.stringify(apps, null, 2), "utf8");
}

function sanitizeVersion(ver) {
  return String(ver || "").trim().replace(/[^a-zA-Z0-9._-]/g, "");
}

function resolveAppId(rawId) {
  if (!rawId || rawId === "default") {
    const apps = readApps();
    return apps[0]?.id || DEFAULT_APP_ID;
  }
  return String(rawId).trim().replace(/[^a-zA-Z0-9._-]/g, "");
}

function getAppDir(appId) {
  const safeId = resolveAppId(appId);
  const dir = path.join(RELEASE_DIR, safeId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function readVersions(appId) {
  const safeId = resolveAppId(appId);
  const appDir = getAppDir(safeId);
  const versionsFile = path.join(appDir, "versions.json");

  if (!fs.existsSync(versionsFile)) {
    return {
      android: { latest: null },
      ios: { latest: null }
    };
  }

  try {
    return JSON.parse(fs.readFileSync(versionsFile, "utf8"));
  } catch (e) {
    return {
      android: { latest: null },
      ios: { latest: null }
    };
  }
}

function writeVersions(appId, data) {
  const safeId = resolveAppId(appId);
  const appDir = getAppDir(safeId);
  const versionsFile = path.join(appDir, "versions.json");
  fs.writeFileSync(versionsFile, JSON.stringify(data, null, 2), "utf8");
}

function parseSemver(ver) {
  if (!ver) return [0, 0, 0];
  const cleaned = String(ver).trim().replace(/^[vV]/, "");
  const parts = cleaned.split(".").map(p => {
    const num = parseInt(p, 10);
    return isNaN(num) ? 0 : num;
  });
  while (parts.length < 3) parts.push(0);
  return parts.slice(0, 3);
}

function compareSemver(v1, v2) {
  const p1 = parseSemver(v1);
  const p2 = parseSemver(v2);
  for (let i = 0; i < 3; i++) {
    if (p1[i] > p2[i]) return 1;
    if (p1[i] < p2[i]) return -1;
  }
  return 0;
}

function compareVersion(a, b) {
  return compareSemver(a, b);
}

function matchesTargetBinaryVersion(nativeVersion, targetBinary, minNativeVersion, maxNativeVersion) {
  if (!nativeVersion) return false;

  // 1. Kiểm tra minNativeVersion và maxNativeVersion nếu có
  if (minNativeVersion && compareSemver(nativeVersion, minNativeVersion) < 0) {
    return false;
  }
  if (maxNativeVersion && compareSemver(nativeVersion, maxNativeVersion) > 0) {
    return false;
  }

  if (!targetBinary || targetBinary === "*" || targetBinary.trim() === "") {
    return true;
  }

  const target = targetBinary.trim();

  // 2. Wildcard dạng "3.9.*", "3.9.x", "3.09.*", "3.09.x"
  if (target.endsWith(".*") || target.endsWith(".x") || target.endsWith(".X")) {
    const prefix = target.slice(0, -2);
    const cleanNative = String(nativeVersion).trim().replace(/^[vV]/, "");
    if (cleanNative === prefix || cleanNative.startsWith(prefix + ".")) {
      return true;
    }
    const targetParts = prefix.split(".").map(Number);
    const nativeParts = cleanNative.split(".").map(Number);
    return targetParts.every((part, idx) => nativeParts[idx] === part);
  }

  // 3. Dải phiên bản "3.9.0 - 3.9.99"
  if (target.includes(" - ")) {
    const [minV, maxV] = target.split(" - ").map(s => s.trim());
    return compareSemver(nativeVersion, minV) >= 0 && compareSemver(nativeVersion, maxV) <= 0;
  }

  // 4. Tilde "~3.9.0" -> [3.9.0, 3.10.0)
  if (target.startsWith("~")) {
    const base = target.slice(1).trim();
    const p = parseSemver(base);
    const upper = `${p[0]}.${p[1] + 1}.0`;
    return compareSemver(nativeVersion, base) >= 0 && compareSemver(nativeVersion, upper) < 0;
  }

  // 5. Caret "^3.9.0" -> [3.9.0, 4.0.0)
  if (target.startsWith("^")) {
    const base = target.slice(1).trim();
    const p = parseSemver(base);
    const upper = `${p[0] + 1}.0.0`;
    return compareSemver(nativeVersion, base) >= 0 && compareSemver(nativeVersion, upper) < 0;
  }

  // 6. Phiên bản chính xác (Exact match)
  const exactTarget = target.replace(/^[=vV]/, "").trim();
  const exactNative = String(nativeVersion).trim().replace(/^[vV]/, "");
  return exactTarget === exactNative || compareSemver(nativeVersion, exactTarget) === 0;
}

function isVersionAtLeast(version, minimum) {
  if (!minimum) return true;
  return compareSemver(version, minimum) >= 0;
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getBaseUrl(req) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = forwardedProto ? forwardedProto.split(",")[0].trim() : (req.protocol || "http");
  const host = req.get("host") || "localhost:4500";
  return `${proto}://${host}`;
}

async function getActiveVersions(appId) {
  const safeId = resolveAppId(appId);
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabaseAdmin
        .from("releases")
        .select("platform, ota_version")
        .eq("app_id", safeId)
        .eq("is_active", true);

      if (!error && data && data.length > 0) {
        const res = { android: { latest: null }, ios: { latest: null } };
        data.forEach(r => {
          if (res[r.platform]) res[r.platform].latest = r.ota_version;
        });
        return res;
      }
    } catch (e) { }
  }
  return readVersions(safeId);
}

async function getAllReleasesForPlatform(appId, platform) {
  const safeId = resolveAppId(appId);

  // 1. Ưu tiên đọc dữ liệu trực tiếp từ Supabase Database nếu có cấu hình
  if (isSupabaseConfigured()) {
    try {
      const { data: dbReleases, error } = await supabaseAdmin
        .from("releases")
        .select("*")
        .eq("app_id", safeId)
        .eq("platform", platform)
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(dbReleases)) {
        return dbReleases.map(r => {
          let extra = {};
          if (r.release_notes && r.release_notes.startsWith("{")) {
            try { extra = JSON.parse(r.release_notes); } catch (e) { }
          }
          return {
            appId: safeId,
            version: r.ota_version,
            platform: r.platform,
            isLatest: Boolean(r.is_active),
            size: Number(r.file_size || 0),
            sizeFormatted: formatBytes(Number(r.file_size || 0)),
            manifest: {
              appId: safeId,
              otaVersion: r.ota_version,
              bundle: r.bundle_name,
              channel: r.channel,
              mandatory: r.mandatory,
              minNativeVersion: r.min_native_version,
              targetBinaryVersion: r.target_binary_version || extra.targetBinaryVersion || "*",
              maxNativeVersion: r.max_native_version || extra.maxNativeVersion || null,
              releaseNotes: extra.notes || r.release_notes || "",
              sha256: r.file_hash,
              size: Number(r.file_size || 0),
              isDelta: extra.isDelta || false,
              baseVersion: extra.baseVersion || null,
              patchUrl: extra.patchUrl || null,
              patchSize: extra.patchSize || null,
              patchSha256: extra.patchSha256 || null
            },
            downloadUrl: r.download_url,
            createdAt: r.created_at
          };
        }).sort((a, b) => compareVersion(b.version, a.version));
      }
    } catch (e) {
      console.warn("Lỗi load releases từ Supabase, fallback sang local files:", e.message);
    }
  }

  // 2. Fallback đọc từ thư mục local
  const appDir = getAppDir(safeId);
  const platformDir = path.join(appDir, platform);

  if (!fs.existsSync(platformDir)) return [];

  const versions = readVersions(safeId);
  const currentLatest = versions[platform]?.latest || null;

  const entries = fs.readdirSync(platformDir, { withFileTypes: true });
  const list = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const ver = entry.name;
    const verDir = path.join(platformDir, ver);
    const manifestFile = path.join(verDir, "manifest.json");
    const zipFile = path.join(verDir, "update.zip");

    let manifest = null;
    if (fs.existsSync(manifestFile)) {
      try {
        manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
      } catch (e) { }
    }

    let size = manifest?.size || 0;
    if (fs.existsSync(zipFile)) {
      size = fs.statSync(zipFile).size;
    }

    list.push({
      appId: safeId,
      version: ver,
      platform,
      isLatest: ver === currentLatest,
      size,
      sizeFormatted: formatBytes(size),
      manifest,
      downloadUrl: isR2Configured()
        ? getR2DownloadUrl(`bundles/${safeId}/${platform}/${ver}/update.zip`)
        : `/releases/${safeId}/${platform}/${ver}/update.zip`,
      createdAt: manifest?.createdAt || (fs.existsSync(zipFile) ? fs.statSync(zipFile).mtime.toISOString() : null)
    });
  }

  list.sort((a, b) => compareVersion(b.version, a.version));
  return list;
}

async function createBackupSnapshot(tag, appId) {
  const safeId = appId ? resolveAppId(appId) : null;
  const apps = readApps();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${safeId || "global"}-${tag || "manual"}-${timestamp}.json`;
  const backupPath = path.join(BACKUPS_DIR, filename);

  const appsSnapshot = {};
  const targetApps = safeId ? apps.filter(a => a.id === safeId) : apps;

  for (const app of targetApps) {
    const androidRels = await getAllReleasesForPlatform(app.id, "android");
    const iosRels = await getAllReleasesForPlatform(app.id, "ios");
    appsSnapshot[app.id] = {
      name: app.name,
      versions: await getActiveVersions(app.id),
      releases: {
        android: androidRels.map(r => ({ version: r.version, isLatest: r.isLatest, manifest: r.manifest })),
        ios: iosRels.map(r => ({ version: r.version, isLatest: r.isLatest, manifest: r.manifest }))
      }
    };
  }

  const snapshot = {
    createdAt: new Date().toISOString(),
    tag: tag || "manual",
    appId: safeId || "all",
    appsList: apps,
    appsData: appsSnapshot
  };

  fs.writeFileSync(backupPath, JSON.stringify(snapshot, null, 2), "utf8");
  return { filename, snapshot };
}

// ==========================================
// 1. HEALTH & CORE OTA ENDPOINTS
// ==========================================
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "custom-ota-server-multi-tenant",
    multiAppSupported: true,
    time: new Date().toISOString()
  });
});

/**
 * Endpoint phát hành bản build OTA mới:
 * Hỗ trợ cả 2 dạng URL:
 * - /admin/publish/:appId/:platform/:version (Mới - Multi-App)
 * - /admin/publish/:platform/:version (Cũ - Tương thích ngược với DEFAULT_APP_ID)
 */
async function handlePublish(req, res) {
  const appId = resolveAppId(req.params.appId || req.body?.appId || DEFAULT_APP_ID);
  const platform = String(req.params.platform || "").toLowerCase();
  const version = sanitizeVersion(req.params.version);

  // 1. Kiểm tra xác thực (X-OTA-API-KEY với quyền push hoặc X-OTA-ADMIN-TOKEN)
  const apiKeyHeader = req.header("X-OTA-API-KEY") || req.query.apiKey || "";
  const adminTokenHeader = req.header("X-OTA-ADMIN-TOKEN") || "";
  const expectedAdminToken = process.env.OTA_ADMIN_TOKEN || "demo-secret";

  let isAuthorized = false;

  if (apiKeyHeader) {
    const keyHash = hashApiKey(apiKeyHeader);
    if (isSupabaseConfigured()) {
      const { data: keyRecord } = await supabaseAdmin
        .from("api_keys")
        .select("*")
        .eq("key_hash", keyHash)
        .eq("is_active", true)
        .maybeSingle();

      if (keyRecord && ["push", "full"].includes(keyRecord.key_type)) {
        const isExpired = keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date();
        if (!isExpired && (!keyRecord.app_id || keyRecord.app_id === appId || keyRecord.key_type === "full")) {
          isAuthorized = true;
        }
      }
    } else {
      isAuthorized = true;
    }
  } else if (adminTokenHeader && adminTokenHeader === expectedAdminToken) {
    isAuthorized = true;
  }

  if (!isAuthorized) {
    return res.status(401).json({
      error: "Không được phép! Vui lòng cung cấp API Key hợp lệ (Push Key) hoặc Admin Token.",
      code: "UNAUTHORIZED"
    });
  }
  const { manifest, zipBase64, patchBase64, baseVersion } = req.body || {};

  if (!["android", "ios"].includes(platform)) {
    return res.status(400).json({ message: "invalid platform (must be android or ios)" });
  }

  if (!manifest || !zipBase64) {
    return res.status(400).json({ message: "manifest and zipBase64 are required" });
  }

  if (manifest.otaVersion !== version) {
    return res.status(400).json({ message: "manifest version mismatch" });
  }

  const zipBuffer = Buffer.from(zipBase64, "base64");
  const crypto = require("crypto");
  const actualZipSha256 = crypto.createHash("sha256").update(zipBuffer).digest("hex");
  manifest.sha256 = actualZipSha256;
  manifest.size = zipBuffer.length;

  // Xử lý bản vá vi sai (Differential Patch) nếu CLI gửi lên
  let patchBuffer = null;
  let patchFileName = null;
  if (patchBase64 && baseVersion) {
    try {
      patchBuffer = Buffer.from(patchBase64, "base64");
      patchFileName = `patch-${baseVersion}-to-${version}.bin`;
      const patchSha256 = crypto.createHash("sha256").update(patchBuffer).digest("hex");
      manifest.isDelta = true;
      manifest.baseVersion = baseVersion;
      manifest.patchSize = patchBuffer.length;
      manifest.patchSha256 = patchSha256;
      manifest.patchFile = patchFileName;

      if (!manifest.deltas) manifest.deltas = {};
      manifest.deltas[baseVersion] = {
        patchFile: patchFileName,
        patchSize: patchBuffer.length,
        patchSha256
      };
      console.log(`[Delta] Đã chuẩn bị bản vá vi sai v${baseVersion}->v${version} (${patchBuffer.length} bytes)`);
    } catch (deltaErr) {
      console.warn("[Delta] Lỗi parse file patch:", deltaErr.message);
    }
  }

  // 1. Upload lên Cloudflare R2 nếu có cấu hình (Cloud Storage)
  let r2DownloadUrl = null;
  const r2StorageKey = `bundles/${appId}/${platform}/${version}/update.zip`;
  if (isR2Configured()) {
    try {
      r2DownloadUrl = await uploadToR2(r2StorageKey, zipBuffer, "application/zip");
      console.log(`[R2] Đã upload bundle v${version} của ${appId} lên R2: ${r2DownloadUrl}`);

      // Upload file patch lên R2
      if (patchBuffer && patchFileName) {
        const patchR2Key = `bundles/${appId}/${platform}/${version}/${patchFileName}`;
        const patchR2Url = await uploadToR2(patchR2Key, patchBuffer, "application/octet-stream");
        manifest.patchUrl = patchR2Url;
        if (manifest.deltas && manifest.deltas[baseVersion]) {
          manifest.deltas[baseVersion].patchUrl = patchR2Url;
        }
        console.log(`[R2] Đã upload patch vi sai v${baseVersion}->v${version} lên R2: ${patchR2Url}`);
      }
    } catch (r2Err) {
      console.error(`[R2 Error] Không thể upload lên R2:`, r2Err.message);
    }
  }

  // 2. Lưu bản sao cục bộ chỉ khi CHƯA có Cloudflare R2 hoặc Supabase (Chế độ Local Offline)
  if (!isR2Configured() || !isSupabaseConfigured()) {
    const apps = readApps();
    if (!apps.some(a => a.id === appId)) {
      apps.push({
        id: appId,
        name: manifest.appName || appId,
        description: `Tự động tạo khi publish v${version}`,
        createdAt: new Date().toISOString()
      });
      writeApps(apps);
    }

    const appDir = getAppDir(appId);
    const releaseDir = path.join(appDir, platform, version);
    fs.mkdirSync(releaseDir, { recursive: true });

    if (!isR2Configured()) {
      fs.writeFileSync(path.join(releaseDir, "update.zip"), zipBuffer);
      if (patchBuffer && patchFileName) {
        fs.writeFileSync(path.join(releaseDir, patchFileName), patchBuffer);
      }
    }

    if (!manifest.patchUrl && patchFileName) {
      manifest.patchUrl = `/releases/${appId}/${platform}/${version}/${patchFileName}`;
      if (manifest.deltas && manifest.deltas[baseVersion]) {
        manifest.deltas[baseVersion].patchUrl = manifest.patchUrl;
      }
    }

    fs.writeFileSync(path.join(releaseDir, "manifest.json"), JSON.stringify({ ...manifest, appId, sha256: actualZipSha256, size: zipBuffer.length }, null, 2));

    const versions = readVersions(appId);
    if (!versions[platform]) versions[platform] = {};
    versions[platform].latest = version;
    writeVersions(appId, versions);

    await createBackupSnapshot(`auto-publish-${platform}-${version}`, appId);
  }

  // 3. Đồng bộ vào Supabase Database nếu có cấu hình
  if (isSupabaseConfigured()) {
    try {
      await supabaseAdmin.from("apps").upsert({
        id: appId,
        name: manifest.appName || appId,
        description: `Tự động tạo khi publish v${version}`
      });

      await supabaseAdmin
        .from("releases")
        .update({ is_active: false })
        .eq("app_id", appId)
        .eq("platform", platform);

      const finalDownloadUrl = r2DownloadUrl || `${getBaseUrl(req)}/releases/${appId}/${platform}/${version}/update.zip`;

      const extraMetadata = {
        notes: manifest.releaseNotes || "",
        targetBinaryVersion: manifest.targetBinaryVersion || "*",
        maxNativeVersion: manifest.maxNativeVersion || null,
        isDelta: Boolean(manifest.isDelta),
        baseVersion: manifest.baseVersion || null,
        patchUrl: manifest.patchUrl || null,
        patchSize: manifest.patchSize || null,
        patchSha256: manifest.patchSha256 || null,
        bundleSha256: manifest.bundleSha256 || manifest.bundleHash || null,
        bundleHash: manifest.bundleSha256 || manifest.bundleHash || null
      };

      await supabaseAdmin.from("releases").upsert({
        app_id: appId,
        platform,
        ota_version: version,
        min_native_version: manifest.minNativeVersion || "1.0.0",
        channel: manifest.channel || "production",
        mandatory: Boolean(manifest.mandatory),
        bundle_name: manifest.bundle || "main.jsbundle",
        file_hash: manifest.sha256 || "",
        file_size: zipBuffer.length,
        r2_storage_key: r2StorageKey,
        download_url: finalDownloadUrl,
        release_notes: JSON.stringify(extraMetadata),
        is_active: true
      });
      console.log(`[Supabase] Đã lưu release v${version} vào bảng releases`);
    } catch (sbErr) {
      console.error(`[Supabase Error] Lỗi ghi dữ liệu vào Supabase:`, sbErr.message);
    }
  }

  return res.json({
    ok: true,
    appId,
    platform,
    version,
    storage: isR2Configured() ? "cloudflare_r2" : "local",
    database: isSupabaseConfigured() ? "supabase" : "local_file"
  });
}

app.post("/admin/publish/:appId/:platform/:version", handlePublish);
app.post("/admin/publish/:platform/:version", handlePublish);

/**
 * Endpoint lấy thông tin bản bundle active mới nhất để CLI tự động sinh Delta Patch (Cập nhật vi sai)
 * Kể cả khi CLI chạy trên máy mới hoặc CI/CD chưa có cache local.
 */
app.get("/ota/latest-bundle", async (req, res) => {
  const appId = resolveAppId(req.query.appId || req.query.app_id || DEFAULT_APP_ID);
  const platform = String(req.query.platform || "").toLowerCase();

  if (!["android", "ios"].includes(platform)) {
    return res.status(400).json({ error: "Platform must be android or ios" });
  }

  // 1. Kiểm tra trên Supabase
  if (isSupabaseConfigured()) {
    try {
      const { data: release } = await supabaseAdmin
        .from("releases")
        .select("*")
        .eq("app_id", appId)
        .eq("platform", platform)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (release) {
        return res.json({
          found: true,
          version: release.ota_version,
          downloadUrl: release.download_url,
          bundleName: release.bundle_name
        });
      }
    } catch (e) {
      console.warn("[latest-bundle] Lỗi truy vấn Supabase:", e.message);
    }
  }

  // 2. Fallback kiểm tra trên local
  const versions = readVersions(appId);
  const latestVer = versions[platform]?.latest;
  if (latestVer) {
    return res.json({
      found: true,
      version: latestVer,
      downloadUrl: `${getBaseUrl(req)}/releases/${appId}/${platform}/${latestVer}/update.zip`,
      bundleName: platform === "ios" ? "main.jsbundle" : "index.android.bundle"
    });
  }

  return res.json({ found: false, version: null });
});

/**
 * Endpoint kiểm tra bản cập nhật OTA từ Client App:
 * Nhận query: appId, platform, nativeVersion, otaVersion, channel
 * Hỗ trợ xác thực qua API Key (X-OTA-API-KEY hoặc apiKey query)
 */
app.get("/ota/check", async (req, res) => {
  const appId = resolveAppId(req.query.appId || req.query.app_id || DEFAULT_APP_ID);
  const platform = String(req.query.platform || "").toLowerCase();
  const nativeVersion = String(req.query.nativeVersion || "0.0.0");
  const otaVersion = sanitizeVersion(req.query.otaVersion || "0.0.0");
  const channel = String(req.query.channel || "production");

  if (!["android", "ios"].includes(platform)) {
    return res.status(400).json({ message: "platform must be android or ios" });
  }

  console.log(`📡 [OTA Check] Incoming: appId="${appId}", platform="${platform}", nativeVersion="${nativeVersion}", otaVersion="${otaVersion}", channel="${channel}"`);

  // 1. Kiểm tra API Key nếu Supabase đã cấu hình (bảo vệ quyền truy cập pull OTA)
  if (isSupabaseConfigured()) {
    const rawApiKey = req.header("X-OTA-API-KEY") || req.header("X-OTA-ADMIN-TOKEN") || req.query.apiKey || "";
    const expectedAdminToken = process.env.OTA_ADMIN_TOKEN || "demo-secret";

    if (rawApiKey === expectedAdminToken) {
      // Cho phép Admin token bypass
    } else {
      if (!rawApiKey) {
        return res.status(401).json({
          error: "Yêu cầu API Key (Pull Key) để kiểm tra cập nhật ứng dụng!",
          code: "API_KEY_REQUIRED"
        });
      }

      const keyHash = hashApiKey(rawApiKey);
      const { data: keyRecord } = await supabaseAdmin
        .from("api_keys")
        .select("*")
        .eq("key_hash", keyHash)
        .eq("is_active", true)
        .maybeSingle();

      const isExpired = keyRecord?.expires_at && new Date(keyRecord.expires_at) < new Date();
      if (!keyRecord || isExpired || (keyRecord.app_id && keyRecord.app_id !== appId && keyRecord.key_type !== "full") || !["pull", "push", "full"].includes(keyRecord.key_type)) {
        return res.status(403).json({
          error: isExpired ? "API Key đã hết hạn sử dụng!" : "API Key không hợp lệ hoặc không có quyền tải bản cập nhật (Pull) cho ứng dụng này!",
          code: isExpired ? "EXPIRED_API_KEY" : "INVALID_API_KEY"
        });
      }
    }
  }

  // 2. Tra cứu release từ Supabase nếu có
  if (isSupabaseConfigured()) {
    try {
      const { data: activeReleases } = await supabaseAdmin
        .from("releases")
        .select("*")
        .eq("app_id", appId)
        .eq("platform", platform)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (activeReleases && activeReleases.length > 0) {
        // Tìm release phù hợp với channel và target binary version
        const activeRelease = activeReleases.find(rel => {
          if (rel.channel && rel.channel !== channel) return false;
          let extra = {};
          if (rel.release_notes && rel.release_notes.startsWith("{")) {
            try { extra = JSON.parse(rel.release_notes); } catch (e) { }
          }
          const targetBin = rel.target_binary_version || extra.targetBinaryVersion;
          const maxNative = rel.max_native_version || extra.maxNativeVersion;

          return matchesTargetBinaryVersion(
            nativeVersion,
            targetBin,
            rel.min_native_version,
            maxNative
          );
        });

        if (!activeRelease) {
          console.log(`⚠️ [OTA Check] No matching native version for nativeVersion="${nativeVersion}" (App: ${appId}, Platform: ${platform})`);
          return res.json({
            updateAvailable: false,
            reason: "no_matching_native_version",
            nativeVersion,
            appId
          });
        }

        if (compareSemver(activeRelease.ota_version, otaVersion) <= 0) {
          console.log(`ℹ️ [OTA Check] Already latest: current otaVersion="${otaVersion}" >= release "${activeRelease.ota_version}"`);
          return res.json({ updateAvailable: false, reason: "already_latest", appId });
        }

        console.log(`🎯 [OTA Check] Update available! Target OTA: v${activeRelease.ota_version} (Client otaVersion: ${otaVersion})`);

        const baseUrl = getBaseUrl(req);
        let isDelta = false;
        let deltaInfo = {};

        // 1. Kiểm tra metadata delta từ chính bản ghi Supabase (extra)
        let extra = {};
        if (activeRelease.release_notes && activeRelease.release_notes.startsWith("{")) {
          try { extra = JSON.parse(activeRelease.release_notes); } catch (e) { }
        }

        if (extra.isDelta && extra.baseVersion === otaVersion && extra.patchUrl) {
          const fullPatchUrl = extra.patchUrl.startsWith("http")
            ? extra.patchUrl
            : `${baseUrl}${extra.patchUrl.startsWith("/") ? "" : "/"}${extra.patchUrl}`;
          isDelta = true;
          deltaInfo = {
            isDelta: true,
            baseVersion: otaVersion,
            patchUrl: fullPatchUrl,
            patchSize: extra.patchSize || 0,
            patchSha256: extra.patchSha256 || null
          };
        } else {
          // 2. Kiểm tra xem có bản vá vi sai từ local manifest nếu có
          try {
            const localManifestFile = path.join(getAppDir(appId), platform, activeRelease.ota_version, "manifest.json");
            if (fs.existsSync(localManifestFile)) {
              const localManifest = JSON.parse(fs.readFileSync(localManifestFile, "utf8"));
              const candidate = localManifest.deltas?.[otaVersion] ||
                (localManifest.isDelta && localManifest.baseVersion === otaVersion ? localManifest : null);

              if (candidate && candidate.patchUrl) {
                const fullPatchUrl = candidate.patchUrl.startsWith("http")
                  ? candidate.patchUrl
                  : `${baseUrl}${candidate.patchUrl.startsWith("/") ? "" : "/"}${candidate.patchUrl}`;
                isDelta = true;
                deltaInfo = {
                  isDelta: true,
                  baseVersion: otaVersion,
                  patchUrl: fullPatchUrl,
                  patchSize: candidate.patchSize || 0,
                  patchSha256: candidate.patchSha256 || null
                };
              }
            }
          } catch (e) { }
        }

        return res.json({
          updateAvailable: true,
          appId,
          platform,
          otaVersion: activeRelease.ota_version,
          bundle: activeRelease.bundle_name,
          sha256: activeRelease.file_hash,
          channel: activeRelease.channel,
          targetBinaryVersion: activeRelease.target_binary_version || extra.targetBinaryVersion || "*",
          minNativeVersion: activeRelease.min_native_version,
          maxNativeVersion: activeRelease.max_native_version || extra.maxNativeVersion || null,
          mandatory: activeRelease.mandatory,
          releaseNotes: extra.notes || activeRelease.release_notes,
          createdAt: activeRelease.created_at,
          size: activeRelease.file_size,
          downloadUrl: activeRelease.download_url,
          isDelta,
          bundleSha256: extra.bundleSha256 || extra.bundleHash || null,
          bundleHash: extra.bundleHash || extra.bundleSha256 || null,
          ...deltaInfo
        });
      }
    } catch (e) {
      console.warn("Lỗi tra cứu Supabase releases, fallback sang local file:", e.message);
    }
  }

  // 3. Fallback đọc file local
  const appDir = getAppDir(appId);
  const platformDir = path.join(appDir, platform);

  if (!fs.existsSync(platformDir)) {
    return res.json({ updateAvailable: false, reason: "no_release", appId });
  }

  const versionDirs = fs.readdirSync(platformDir).filter(f => {
    return fs.existsSync(path.join(platformDir, f, "manifest.json"));
  });

  if (versionDirs.length === 0) {
    return res.json({ updateAvailable: false, reason: "no_release", appId });
  }

  // Sắp xếp các bản phát hành theo semver mới nhất trước
  versionDirs.sort((a, b) => compareSemver(b, a));

  const allManifests = [];
  for (const v of versionDirs) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(platformDir, v, "manifest.json"), "utf8"));
      allManifests.push(m);
    } catch (e) { }
  }

  // Tìm release khớp với channel và target binary version
  const manifest = allManifests.find(m => {
    if (m.channel && m.channel !== channel) return false;
    return matchesTargetBinaryVersion(
      nativeVersion,
      m.targetBinaryVersion,
      m.minNativeVersion,
      m.maxNativeVersion
    );
  });

  if (!manifest) {
    return res.json({
      updateAvailable: false,
      reason: "no_matching_native_version",
      nativeVersion,
      appId
    });
  }

  if (compareSemver(manifest.otaVersion, otaVersion) <= 0) {
    return res.json({ updateAvailable: false, reason: "already_latest", appId });
  }

  const baseUrl = getBaseUrl(req);
  const downloadUrl = isR2Configured()
    ? getR2DownloadUrl(`bundles/${appId}/${platform}/${manifest.otaVersion}/update.zip`)
    : `${baseUrl}/releases/${appId}/${platform}/${manifest.otaVersion}/update.zip`;

  // Kiểm tra bản vá vi sai (Differential Patch) phù hợp với phiên bản client đang cài đặt
  let isDelta = false;
  let deltaInfo = {};
  const candidateDelta = manifest.deltas?.[otaVersion] ||
    (manifest.isDelta && manifest.baseVersion === otaVersion ? manifest : null);

  if (candidateDelta && candidateDelta.patchUrl) {
    const fullPatchUrl = candidateDelta.patchUrl.startsWith("http")
      ? candidateDelta.patchUrl
      : `${baseUrl}${candidateDelta.patchUrl.startsWith("/") ? "" : "/"}${candidateDelta.patchUrl}`;
    isDelta = true;
    deltaInfo = {
      isDelta: true,
      baseVersion: otaVersion,
      patchUrl: fullPatchUrl,
      patchSize: candidateDelta.patchSize || 0,
      patchSha256: candidateDelta.patchSha256 || null
    };
  }

  return res.json({
    updateAvailable: true,
    appId,
    ...manifest,
    downloadUrl,
    isDelta,
    ...deltaInfo
  });
});

// ==========================================
// 2. CONFIG & API KEYS MANAGEMENT APIs
// ==========================================

// Config công khai cho Web Dashboard kết nối Supabase
app.get("/api/config", (_req, res) => {
  res.json({
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
    isSupabaseConfigured: isSupabaseConfigured(),
    isR2Configured: isR2Configured()
  });
});

// Lấy danh sách API Keys của 1 App
app.get("/api/apps/:appId/api-keys", requireDashboardAuth, async (req, res) => {
  const appId = resolveAppId(req.params.appId);
  if (!isSupabaseConfigured()) {
    return res.json({
      keys: [
        {
          id: "local-demo-pull-key",
          app_id: appId,
          name: "Default Demo Pull Key",
          key_prefix: "ota_pull_live_",
          key_type: "pull",
          is_active: true,
          created_at: new Date().toISOString()
        },
        {
          id: "local-demo-push-key",
          app_id: appId,
          name: "Default Demo Push Key (CI/CD)",
          key_prefix: "ota_push_live_",
          key_type: "push",
          is_active: true,
          created_at: new Date().toISOString()
        }
      ]
    });
  }

  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, app_id, name, key_prefix, key_type, is_active, created_at, expires_at")
    .eq("app_id", appId)
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ keys: data || [] });
});

// Tạo API Key mới
app.post("/api/apps/:appId/api-keys", requireDashboardAuth, async (req, res) => {
  const appId = resolveAppId(req.params.appId);
  const { name, keyType = "pull", expiresInDays } = req.body || {};

  if (!name) {
    return res.status(400).json({ error: "Tên API Key không được để trống!" });
  }

  const keyGen = generateApiKey(keyType);
  let expiresAt = null;
  if (expiresInDays && Number(expiresInDays) > 0) {
    expiresAt = new Date(Date.now() + Number(expiresInDays) * 86400000).toISOString();
  }

  if (!isSupabaseConfigured()) {
    return res.json({
      ok: true,
      apiKey: {
        id: "local-" + Date.now(),
        app_id: appId,
        name,
        fullKey: keyGen.fullKey,
        keyPrefix: keyGen.keyPrefix,
        keyType,
        expiresAt,
        createdAt: new Date().toISOString()
      }
    });
  }

  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .insert({
      app_id: appId,
      name,
      key_prefix: keyGen.keyPrefix,
      key_hash: keyGen.keyHash,
      key_type: keyType,
      created_by: req.user?.id || null,
      expires_at: expiresAt
    })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({
    ok: true,
    apiKey: {
      ...data,
      fullKey: keyGen.fullKey // Trả về 1 lần duy nhất cho người dùng copy!
    }
  });
});

// Xóa hoặc thu hồi API Key
app.delete("/api/apps/:appId/api-keys/:keyId", requireDashboardAuth, async (req, res) => {
  const { keyId } = req.params;

  if (!isSupabaseConfigured()) {
    return res.json({ ok: true, message: "Đã thu hồi API Key thành công (Local Demo Mode)!" });
  }

  const { error } = await supabaseAdmin
    .from("api_keys")
    .delete()
    .eq("id", keyId);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ ok: true, message: "Đã thu hồi API Key thành công!" });
});

// ==========================================
// 3. MULTI-APP MANAGEMENT APIs
// ==========================================

// Helper: Lấy danh sách app mà user sở hữu hoặc là thành viên
async function getUserAllowedApps(userId) {
  if (isSupabaseConfigured()) {
    try {
      if (userId === "local-admin") {
        const { data: allApps } = await supabaseAdmin.from("apps").select("*");
        if (allApps && allApps.length > 0) return allApps;
      }

      const { data: memberRows } = await supabaseAdmin
        .from("app_members")
        .select("app_id")
        .eq("user_id", userId);

      const memberAppIds = (memberRows || []).map(m => m.app_id);

      let query = supabaseAdmin.from("apps").select("*");
      if (memberAppIds.length > 0) {
        query = query.or(`owner_id.eq.${userId},id.in.(${memberAppIds.map(id => `"${id}"`).join(",")})`);
      } else {
        query = query.eq("owner_id", userId);
      }

      const { data: userApps, error } = await query;
      if (!error && userApps && userApps.length > 0) {
        return userApps;
      }
    } catch (err) {
      console.error("Lỗi getUserAllowedApps:", err.message);
    }
  }

  return readApps();
}

// Helper: Kiểm tra quyền của user đối với 1 app
async function verifyUserAppAccess(userId, appId) {
  if (!isSupabaseConfigured() || userId === "local-admin") {
    return { allowed: true, role: "owner" };
  }

  try {
    const { data: app, error } = await supabaseAdmin
      .from("apps")
      .select("owner_id")
      .eq("id", appId)
      .maybeSingle();

    if (error || !app) {
      return { allowed: false, error: "Ứng dụng không tồn tại hoặc bạn không có quyền truy cập!" };
    }

    if (app.owner_id === userId) {
      return { allowed: true, role: "owner" };
    }

    const { data: member } = await supabaseAdmin
      .from("app_members")
      .select("role")
      .eq("app_id", appId)
      .eq("user_id", userId)
      .maybeSingle();

    if (member) {
      return { allowed: true, role: member.role };
    }

    return { allowed: false, error: "Bạn không có quyền truy cập vào ứng dụng này!" };
  } catch (err) {
    return { allowed: false, error: "Lỗi kiểm tra quyền truy cập ứng dụng" };
  }
}

// ==========================================
// 3. MULTI-APP MANAGEMENT APIs (SECURED BY USER)
// ==========================================

// Danh sách các ứng dụng: CHỈ TRẢ VỀ CÁC APP MÀ USER HIỆN TẠI SỞ HỮU / CÓ QUYỀN
app.get("/api/apps", requireDashboardAuth, async (req, res) => {
  const allowedApps = await getUserAllowedApps(req.user.id);

  const list = await Promise.all(allowedApps.map(async app => {
    const versions = await getActiveVersions(app.id);
    const androidReleases = await getAllReleasesForPlatform(app.id, "android");
    const iosReleases = await getAllReleasesForPlatform(app.id, "ios");

    let totalBytes = 0;
    [...androidReleases, ...iosReleases].forEach(r => { totalBytes += (r.size || 0); });

    return {
      id: app.id,
      name: app.name,
      description: app.description || "",
      createdAt: app.created_at || app.createdAt,
      ownerId: app.owner_id || null,
      activeVersions: versions,
      totalReleases: androidReleases.length + iosReleases.length,
      androidCount: androidReleases.length,
      iosCount: iosReleases.length,
      storageUsed: formatBytes(totalBytes),
      storageBytes: totalBytes
    };
  }));

  res.json({ apps: list });
});

// Tạo ứng dụng mới: GẮN QUYỀN SỞ HỮU (owner_id) CHO USER ĐANG ĐĂNG NHẬP
app.post("/api/apps", requireDashboardAuth, async (req, res) => {
  const { id, name, description } = req.body || {};
  const cleanId = String(id || "").trim();
  const cleanName = String(name || "").trim();
  const userId = req.user.id;

  if (!cleanId || !cleanName) {
    return res.status(400).json({ error: "App ID và Tên ứng dụng không được để trống!" });
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(cleanId)) {
    return res.status(400).json({ error: "App ID chỉ được chứa chữ cái, số, dấu chấm (.), gạch dưới (_) hoặc gạch ngang (-)" });
  }

  if (isSupabaseConfigured() && userId !== "local-admin") {
    const { data: existingApp } = await supabaseAdmin.from("apps").select("id").eq("id", cleanId).maybeSingle();
    if (existingApp) {
      return res.status(400).json({ error: `Ứng dụng với ID '${cleanId}' đã tồn tại trên hệ thống!` });
    }

    const { data: newApp, error: insertErr } = await supabaseAdmin.from("apps").insert({
      id: cleanId,
      name: cleanName,
      description: String(description || "").trim(),
      owner_id: userId
    }).select().single();

    if (insertErr) {
      return res.status(500).json({ error: `Lỗi tạo app trên Supabase: ${insertErr.message}` });
    }

    await supabaseAdmin.from("app_members").insert({
      app_id: cleanId,
      user_id: userId,
      role: "owner"
    });

    getAppDir(cleanId);
    writeVersions(cleanId, { android: { latest: null }, ios: { latest: null } });
    createBackupSnapshot(`created-app-${cleanId}`, cleanId);

    return res.json({ ok: true, app: newApp });
  }

  const apps = readApps();
  if (apps.some(a => a.id.toLowerCase() === cleanId.toLowerCase())) {
    return res.status(400).json({ error: `Ứng dụng với ID '${cleanId}' đã tồn tại!` });
  }

  const newApp = {
    id: cleanId,
    name: cleanName,
    description: String(description || "").trim(),
    createdAt: new Date().toISOString()
  };

  apps.push(newApp);
  writeApps(apps);

  getAppDir(cleanId);
  writeVersions(cleanId, {
    android: { latest: null },
    ios: { latest: null }
  });

  createBackupSnapshot(`created-app-${cleanId}`, cleanId);
  res.json({ ok: true, app: newApp });
});

// Xóa ứng dụng: CHỈ OWNER MỚI ĐƯỢC XÓA
app.delete("/api/apps/:appId", requireDashboardAuth, async (req, res) => {
  const targetId = req.params.appId;
  const access = await verifyUserAppAccess(req.user.id, targetId);
  if (!access.allowed || access.role !== "owner") {
    return res.status(403).json({ error: "Chỉ người sở hữu (Owner) mới có quyền xóa ứng dụng này!" });
  }

  if (isSupabaseConfigured() && req.user.id !== "local-admin") {
    await supabaseAdmin.from("apps").delete().eq("id", targetId);
  } else {
    const apps = readApps();
    const index = apps.findIndex(a => a.id === targetId);
    if (index !== -1) {
      apps.splice(index, 1);
      writeApps(apps);
    }
  }

  createBackupSnapshot(`before-delete-app-${targetId}`, targetId);

  const appDir = path.join(RELEASE_DIR, targetId);
  if (fs.existsSync(appDir)) {
    fs.rmSync(appDir, { recursive: true, force: true });
  }

  res.json({ ok: true, message: `Đã xóa ứng dụng ${targetId} thành công!` });
});

// ==========================================
// 3. DASHBOARD MANAGEMENT APIs (THEO APP)
// ==========================================

// Overview stats (kiểm tra quyền xem app)
app.get("/api/overview", requireDashboardAuth, async (req, res) => {
  const userApps = await getUserAllowedApps(req.user.id);
  if (userApps.length === 0) {
    return res.json({
      hasApps: false,
      appId: null,
      appsCount: 0,
      activeVersions: { android: { latest: null }, ios: { latest: null } },
      totalAndroidReleases: 0,
      totalIosReleases: 0,
      totalStorageUsed: "0 B",
      globalStorageUsed: "0 B",
      globalReleasesCount: 0,
      backupsCount: 0,
      recentBackups: []
    });
  }

  let requestedAppId = req.query.appId ? resolveAppId(req.query.appId) : userApps[0].id;
  // Nếu appId yêu cầu không nằm trong apps của user, fallback về app đầu tiên user có quyền
  if (!userApps.some(a => a.id === requestedAppId)) {
    requestedAppId = userApps[0].id;
  }
  const appId = requestedAppId;

  const access = await verifyUserAppAccess(req.user.id, appId);
  if (!access.allowed) {
    return res.status(403).json({ error: access.error });
  }
  const versions = await getActiveVersions(appId);
  const androidReleases = await getAllReleasesForPlatform(appId, "android");
  const iosReleases = await getAllReleasesForPlatform(appId, "ios");

  let appBytes = 0;
  [...androidReleases, ...iosReleases].forEach(r => { appBytes += (r.size || 0); });

  let userTotalBytes = 0;
  let userTotalReleases = 0;
  await Promise.all(userApps.map(async a => {
    const aReleases = [...(await getAllReleasesForPlatform(a.id, "android")), ...(await getAllReleasesForPlatform(a.id, "ios"))];
    userTotalReleases += aReleases.length;
    aReleases.forEach(r => { userTotalBytes += (r.size || 0); });
  }));

  const backups = fs.existsSync(BACKUPS_DIR)
    ? fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.endsWith(".json"))
      .map(f => {
        const p = path.join(BACKUPS_DIR, f);
        const stat = fs.statSync(p);
        return {
          filename: f,
          createdAt: stat.mtime.toISOString(),
          size: stat.size,
          sizeFormatted: formatBytes(stat.size)
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    : [];

  res.json({
    appId,
    appsCount: userApps.length,
    activeVersions: versions,
    totalAndroidReleases: androidReleases.length,
    totalIosReleases: iosReleases.length,
    totalStorageUsed: formatBytes(appBytes),
    globalStorageUsed: formatBytes(userTotalBytes),
    globalReleasesCount: userTotalReleases,
    backupsCount: backups.length,
    recentBackups: backups.slice(0, 5)
  });
});

// Lấy danh sách release theo platform và appId (kiểm tra quyền)
app.get("/api/releases/:platform", requireDashboardAuth, async (req, res) => {
  const { platform } = req.params;
  const appId = resolveAppId(req.query.appId);

  if (!["android", "ios"].includes(platform)) {
    return res.status(400).json({ error: "Invalid platform" });
  }

  const access = await verifyUserAppAccess(req.user.id, appId);
  if (!access.allowed) {
    return res.status(403).json({ error: access.error });
  }

  const releases = await getAllReleasesForPlatform(appId, platform);
  const versions = await getActiveVersions(appId);

  res.json({
    appId,
    platform,
    latestVersion: versions[platform]?.latest || null,
    releases
  });
});

// Chuyển Active Version / Rollback cho 1 App (kiểm tra quyền)
app.post("/api/set-active", requireDashboardAuth, async (req, res) => {
  const { appId: rawAppId, platform, version } = req.body || {};
  const appId = resolveAppId(rawAppId);

  if (!["android", "ios"].includes(platform)) {
    return res.status(400).json({ error: "Invalid platform" });
  }

  const access = await verifyUserAppAccess(req.user.id, appId);
  if (!access.allowed || access.role === "viewer") {
    return res.status(403).json({ error: "Bạn không có quyền chuyển đổi phiên bản cho ứng dụng này!" });
  }

  // 1. Cập nhật trạng thái is_active trên Supabase Database
  if (isSupabaseConfigured()) {
    try {
      await supabaseAdmin
        .from("releases")
        .update({ is_active: false })
        .eq("app_id", appId)
        .eq("platform", platform);

      await supabaseAdmin
        .from("releases")
        .update({ is_active: true })
        .eq("app_id", appId)
        .eq("platform", platform)
        .eq("ota_version", version);
      console.log(`[Supabase] Đã kích hoạt v${version} làm bản active cho ${appId} (${platform})`);
    } catch (sbErr) {
      console.warn("Lỗi cập nhật is_active trên Supabase:", sbErr.message);
    }
  }

  // 2. Cập nhật local versions.json làm cache backup
  const versions = readVersions(appId);
  const previousLatest = versions[platform]?.latest;

  await createBackupSnapshot(`rollback-${platform}-from-${previousLatest}-to-${version}`, appId);

  versions[platform].latest = version;
  writeVersions(appId, versions);

  res.json({
    ok: true,
    appId,
    platform,
    previousLatest,
    currentLatest: version,
    message: `Đã chuyển đổi active version cho ${appId} (${platform}) sang v${version} thành công!`
  });
});

// Xóa 1 release của app (kiểm tra quyền)
app.delete("/api/releases", requireDashboardAuth, async (req, res) => {
  const { appId: rawAppId, platform, version } = req.body || {};
  const appId = resolveAppId(rawAppId);

  if (!["android", "ios"].includes(platform)) {
    return res.status(400).json({ error: "Invalid platform" });
  }

  const access = await verifyUserAppAccess(req.user.id, appId);
  if (!access.allowed || access.role === "viewer") {
    return res.status(403).json({ error: "Bạn không có quyền xoá bản phát hành của ứng dụng này!" });
  }

  const currentVersions = await getActiveVersions(appId);
  if (currentVersions[platform]?.latest === version) {
    return res.status(400).json({ error: "Không thể xoá phiên bản đang là Latest/Active!" });
  }

  // 1. Xóa bản ghi trên Supabase Database & Cloudflare R2
  if (isSupabaseConfigured()) {
    try {
      const { data: relRecord } = await supabaseAdmin
        .from("releases")
        .select("r2_storage_key")
        .eq("app_id", appId)
        .eq("platform", platform)
        .eq("ota_version", version)
        .maybeSingle();

      if (relRecord?.r2_storage_key && isR2Configured()) {
        await deleteFromR2(relRecord.r2_storage_key).catch(() => { });
        console.log(`[R2] Đã xóa file bundle trên R2: ${relRecord.r2_storage_key}`);
      }

      await supabaseAdmin
        .from("releases")
        .delete()
        .eq("app_id", appId)
        .eq("platform", platform)
        .eq("ota_version", version);
      console.log(`[Supabase] Đã xóa release v${version} của ${appId} (${platform}) khỏi database`);
    } catch (sbErr) {
      console.warn("Lỗi xoá release trên Supabase/R2:", sbErr.message);
    }
  }

  // 2. Xóa thư mục local nếu có
  const appDir = getAppDir(appId);
  const targetDir = path.join(appDir, platform, version);
  await createBackupSnapshot(`before-delete-${platform}-${version}`, appId);

  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }

  res.json({ ok: true, appId, message: `Đã xoá release ${platform} v${version} của app ${appId}` });
});

// Backups API
app.get("/api/backups", requireDashboardAuth, (req, res) => {
  const targetAppId = req.query.appId ? resolveAppId(req.query.appId) : null;

  const files = fs.readdirSync(BACKUPS_DIR)
    .filter(f => f.endsWith(".json"))
    .map(filename => {
      const p = path.join(BACKUPS_DIR, filename);
      const stat = fs.statSync(p);
      let content = null;
      try {
        content = JSON.parse(fs.readFileSync(p, "utf8"));
      } catch (e) { }
      return {
        filename,
        createdAt: stat.mtime.toISOString(),
        tag: content?.tag || "manual",
        appId: content?.appId || "legacy",
        sizeFormatted: formatBytes(stat.size)
      };
    })
    .filter(b => {
      if (!targetAppId) return true;
      return b.appId === "all" || b.appId === targetAppId || b.appId === "legacy";
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({ backups: files });
});

app.post("/api/backups/create", requireDashboardAuth, (req, res) => {
  const tag = (req.body?.tag || "").trim() || "manual-snapshot";
  const appId = req.body?.appId ? resolveAppId(req.body.appId) : null;
  const { filename, snapshot } = createBackupSnapshot(tag, appId);
  res.json({ ok: true, filename, snapshot });
});

app.post("/api/backups/restore/:filename", requireDashboardAuth, (req, res) => {
  const filename = req.params.filename;
  const backupPath = path.join(BACKUPS_DIR, filename);

  if (!fs.existsSync(backupPath)) {
    return res.status(404).json({ error: "Backup file not found" });
  }

  try {
    const snapshot = JSON.parse(fs.readFileSync(backupPath, "utf8"));

    createBackupSnapshot("before-restore");

    // Nếu snapshot dạng multi-tenant mới
    if (snapshot.appsData) {
      if (snapshot.appsList && Array.isArray(snapshot.appsList)) {
        writeApps(snapshot.appsList);
      }
      for (const [id, data] of Object.entries(snapshot.appsData)) {
        if (data.versions) {
          writeVersions(id, data.versions);
        }
      }
    } else if (snapshot.versions) {
      // Snapshot cũ trước khi có multi-tenant
      writeVersions(DEFAULT_APP_ID, snapshot.versions);
    }

    res.json({
      ok: true,
      message: `Đã phục hồi cấu hình versions thành công từ ${filename}!`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Custom OTA Multi-App Server listening on 0.0.0.0:${PORT}`);
  console.log(`Web Dashboard: http://localhost:${PORT}`);
});
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.timeout = 10 * 60 * 1000;
