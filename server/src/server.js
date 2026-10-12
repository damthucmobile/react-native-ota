const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

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
    // Fallback nếu thư mục root có versions.json cũ
    const rootVersionsFile = path.join(RELEASE_DIR, "versions.json");
    if (safeId === DEFAULT_APP_ID && fs.existsSync(rootVersionsFile)) {
      try {
        const rootData = JSON.parse(fs.readFileSync(rootVersionsFile, "utf8"));
        fs.writeFileSync(versionsFile, JSON.stringify(rootData, null, 2), "utf8");
        return rootData;
      } catch (e) { }
    }

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

  // Đồng bộ cả versions.json ở root nếu là app mặc định
  if (safeId === DEFAULT_APP_ID) {
    fs.writeFileSync(path.join(RELEASE_DIR, "versions.json"), JSON.stringify(data, null, 2), "utf8");
  }
}

function compareVersion(a, b) {
  const pa = String(a || "0").split(".").map(Number);
  const pb = String(b || "0").split(".").map(Number);
  const n = Math.max(pa.length, pb.length);

  for (let i = 0; i < n; i += 1) {
    const x = Number.isFinite(pa[i]) ? pa[i] : 0;
    const y = Number.isFinite(pb[i]) ? pb[i] : 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }

  return 0;
}

function isVersionAtLeast(version, minimum) {
  if (!minimum) return true;
  return compareVersion(version, minimum) >= 0;
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

function getAllReleasesForPlatform(appId, platform) {
  const safeId = resolveAppId(appId);
  const appDir = getAppDir(safeId);
  let platformDir = path.join(appDir, platform);

  // Fallback đọc từ root releases/:platform nếu chưa có trong appDir
  if (!fs.existsSync(platformDir) && safeId === DEFAULT_APP_ID) {
    const rootPlatformDir = path.join(RELEASE_DIR, platform);
    if (fs.existsSync(rootPlatformDir)) {
      platformDir = rootPlatformDir;
    }
  }

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

    let size = 0;
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
      downloadUrl: `/releases/${safeId}/${platform}/${ver}/update.zip`,
      createdAt: manifest?.createdAt || (fs.existsSync(zipFile) ? fs.statSync(zipFile).mtime.toISOString() : null)
    });
  }

  list.sort((a, b) => compareVersion(b.version, a.version));
  return list;
}

function createBackupSnapshot(tag, appId) {
  const safeId = appId ? resolveAppId(appId) : null;
  const apps = readApps();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${safeId || "global"}-${tag || "manual"}-${timestamp}.json`;
  const backupPath = path.join(BACKUPS_DIR, filename);

  const appsSnapshot = {};
  const targetApps = safeId ? apps.filter(a => a.id === safeId) : apps;

  for (const app of targetApps) {
    appsSnapshot[app.id] = {
      name: app.name,
      versions: readVersions(app.id),
      releases: {
        android: getAllReleasesForPlatform(app.id, "android").map(r => ({ version: r.version, isLatest: r.isLatest, manifest: r.manifest })),
        ios: getAllReleasesForPlatform(app.id, "ios").map(r => ({ version: r.version, isLatest: r.isLatest, manifest: r.manifest }))
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
function handlePublish(req, res) {
  const token = req.header("X-OTA-ADMIN-TOKEN") || "";
  const expected = process.env.OTA_ADMIN_TOKEN || "demo-secret";

  if (token !== expected) {
    return res.status(401).json({ message: "invalid admin token" });
  }

  const appId = resolveAppId(req.params.appId || req.body?.appId || DEFAULT_APP_ID);
  const platform = String(req.params.platform || "").toLowerCase();
  const version = sanitizeVersion(req.params.version);
  const { manifest, zipBase64 } = req.body || {};

  if (!["android", "ios"].includes(platform)) {
    return res.status(400).json({ message: "invalid platform (must be android or ios)" });
  }

  if (!manifest || !zipBase64) {
    return res.status(400).json({ message: "manifest and zipBase64 are required" });
  }

  if (manifest.otaVersion !== version) {
    return res.status(400).json({ message: "manifest version mismatch" });
  }

  // Tự động thêm app vào apps.json nếu chưa tồn tại
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

  const zipPath = path.join(releaseDir, "update.zip");
  const manifestPath = path.join(releaseDir, "manifest.json");

  fs.writeFileSync(zipPath, Buffer.from(zipBase64, "base64"));
  fs.writeFileSync(manifestPath, JSON.stringify({ ...manifest, appId }, null, 2));

  // Tự động tạo snapshot backup trước khi update versions.json
  createBackupSnapshot(`auto-publish-${platform}-${version}`, appId);

  const versions = readVersions(appId);
  if (!versions[platform]) versions[platform] = {};
  versions[platform].latest = version;
  writeVersions(appId, versions);

  // Nếu là default app, đồng bộ thêm vào thư mục root cũ để tương thích ngược
  if (appId === DEFAULT_APP_ID) {
    const legacyDir = path.join(RELEASE_DIR, platform, version);
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(path.join(legacyDir, "update.zip"), Buffer.from(zipBase64, "base64"));
    fs.writeFileSync(path.join(legacyDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  }

  return res.json({ ok: true, appId, platform, version });
}

app.post("/admin/publish/:appId/:platform/:version", handlePublish);
app.post("/admin/publish/:platform/:version", handlePublish);

/**
 * Endpoint kiểm tra bản cập nhật OTA từ Client App:
 * Nhận query: appId, platform, nativeVersion, otaVersion, channel
 */
app.get("/ota/check", (req, res) => {
  const appId = resolveAppId(req.query.appId || req.query.app_id || DEFAULT_APP_ID);
  const platform = String(req.query.platform || "").toLowerCase();
  const nativeVersion = String(req.query.nativeVersion || "0.0.0");
  const otaVersion = sanitizeVersion(req.query.otaVersion || "0.0.0");
  const channel = String(req.query.channel || "production");

  if (!["android", "ios"].includes(platform)) {
    return res.status(400).json({ message: "platform must be android or ios" });
  }

  const versions = readVersions(appId);
  const latest = versions[platform]?.latest;

  if (!latest) {
    return res.json({ updateAvailable: false, reason: "no_release", appId });
  }

  // Tìm manifest trong thư mục app
  let manifestPath = path.join(getAppDir(appId), platform, latest, "manifest.json");
  if (!fs.existsSync(manifestPath) && appId === DEFAULT_APP_ID) {
    manifestPath = path.join(RELEASE_DIR, platform, latest, "manifest.json");
  }

  if (!fs.existsSync(manifestPath)) {
    return res.status(404).json({ message: "latest manifest not found", appId });
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  if (manifest.channel && manifest.channel !== channel) {
    return res.json({ updateAvailable: false, reason: "channel_mismatch", appId });
  }

  if (!isVersionAtLeast(nativeVersion, manifest.minNativeVersion)) {
    return res.json({
      updateAvailable: false,
      reason: "native_version_too_old",
      requiredNativeVersion: manifest.minNativeVersion,
      appId
    });
  }

  if (compareVersion(manifest.otaVersion, otaVersion) <= 0) {
    return res.json({ updateAvailable: false, reason: "already_latest", appId });
  }

  const baseUrl = getBaseUrl(req);
  return res.json({
    updateAvailable: true,
    appId,
    ...manifest,
    downloadUrl: `${baseUrl}/releases/${appId}/${platform}/${manifest.otaVersion}/update.zip`
  });
});

// ==========================================
// 2. MULTI-APP MANAGEMENT APIs
// ==========================================

// Danh sách các ứng dụng
app.get("/api/apps", (_req, res) => {
  const apps = readApps();
  const list = apps.map(app => {
    const versions = readVersions(app.id);
    const androidReleases = getAllReleasesForPlatform(app.id, "android");
    const iosReleases = getAllReleasesForPlatform(app.id, "ios");

    let totalBytes = 0;
    [...androidReleases, ...iosReleases].forEach(r => { totalBytes += (r.size || 0); });

    return {
      id: app.id,
      name: app.name,
      description: app.description || "",
      createdAt: app.createdAt,
      activeVersions: versions,
      totalReleases: androidReleases.length + iosReleases.length,
      androidCount: androidReleases.length,
      iosCount: iosReleases.length,
      storageUsed: formatBytes(totalBytes),
      storageBytes: totalBytes
    };
  });

  res.json({ apps: list });
});

// Tạo ứng dụng mới
app.post("/api/apps", (req, res) => {
  const { id, name, description } = req.body || {};
  const cleanId = String(id || "").trim();
  const cleanName = String(name || "").trim();

  if (!cleanId || !cleanName) {
    return res.status(400).json({ error: "App ID và Tên ứng dụng không được để trống!" });
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(cleanId)) {
    return res.status(400).json({ error: "App ID chỉ được chứa chữ cái, số, dấu chấm (.), gạch dưới (_) hoặc gạch ngang (-)" });
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

  // Tạo sẵn thư mục lưu trữ và versions.json rỗng
  getAppDir(cleanId);
  writeVersions(cleanId, {
    android: { latest: null },
    ios: { latest: null }
  });

  createBackupSnapshot(`created-app-${cleanId}`, cleanId);

  res.json({ ok: true, app: newApp });
});

// Xóa ứng dụng
app.delete("/api/apps/:appId", (req, res) => {
  const targetId = req.params.appId;
  const apps = readApps();

  if (apps.length <= 1) {
    return res.status(400).json({ error: "Không thể xóa ứng dụng cuối cùng trong hệ thống!" });
  }

  const index = apps.findIndex(a => a.id === targetId);
  if (index === -1) {
    return res.status(404).json({ error: "Ứng dụng không tồn tại!" });
  }

  createBackupSnapshot(`before-delete-app-${targetId}`, targetId);

  // Xóa thư mục releases của app
  const appDir = path.join(RELEASE_DIR, targetId);
  if (fs.existsSync(appDir)) {
    fs.rmSync(appDir, { recursive: true, force: true });
  }

  apps.splice(index, 1);
  writeApps(apps);

  res.json({ ok: true, message: `Đã xóa ứng dụng ${targetId} thành công!` });
});

// ==========================================
// 3. DASHBOARD MANAGEMENT APIs (THEO APP)
// ==========================================

// Overview stats (theo app hoặc toàn bộ)
app.get("/api/overview", (req, res) => {
  const appId = resolveAppId(req.query.appId);
  const apps = readApps();
  const versions = readVersions(appId);
  const androidReleases = getAllReleasesForPlatform(appId, "android");
  const iosReleases = getAllReleasesForPlatform(appId, "ios");

  let appBytes = 0;
  [...androidReleases, ...iosReleases].forEach(r => { appBytes += (r.size || 0); });

  // Global total stats
  let totalServerBytes = 0;
  let totalServerReleases = 0;
  apps.forEach(a => {
    const aReleases = [...getAllReleasesForPlatform(a.id, "android"), ...getAllReleasesForPlatform(a.id, "ios")];
    totalServerReleases += aReleases.length;
    aReleases.forEach(r => { totalServerBytes += (r.size || 0); });
  });

  const backups = fs.readdirSync(BACKUPS_DIR)
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
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({
    appId,
    appsCount: apps.length,
    activeVersions: versions,
    totalAndroidReleases: androidReleases.length,
    totalIosReleases: iosReleases.length,
    totalStorageUsed: formatBytes(appBytes),
    globalStorageUsed: formatBytes(totalServerBytes),
    globalReleasesCount: totalServerReleases,
    backupsCount: backups.length,
    recentBackups: backups.slice(0, 5)
  });
});

// Lấy danh sách release theo platform và appId
app.get("/api/releases/:platform", (req, res) => {
  const { platform } = req.params;
  const appId = resolveAppId(req.query.appId);

  if (!["android", "ios"].includes(platform)) {
    return res.status(400).json({ error: "Invalid platform" });
  }

  const releases = getAllReleasesForPlatform(appId, platform);
  const versions = readVersions(appId);

  res.json({
    appId,
    platform,
    latestVersion: versions[platform]?.latest || null,
    releases
  });
});

// Chuyển Active Version / Rollback cho 1 App
app.post("/api/set-active", (req, res) => {
  const { appId: rawAppId, platform, version } = req.body || {};
  const appId = resolveAppId(rawAppId);

  if (!["android", "ios"].includes(platform)) {
    return res.status(400).json({ error: "Invalid platform" });
  }

  const appDir = getAppDir(appId);
  const platformDir = path.join(appDir, platform, version);
  if (!fs.existsSync(platformDir)) {
    return res.status(404).json({ error: `Release ${platform} v${version} của app ${appId} không tồn tại` });
  }

  const versions = readVersions(appId);
  const previousLatest = versions[platform]?.latest;

  // Snapshot trước khi đổi
  createBackupSnapshot(`rollback-${platform}-from-${previousLatest}-to-${version}`, appId);

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

// Xóa 1 release của app
app.delete("/api/releases", (req, res) => {
  const { appId: rawAppId, platform, version } = req.body || {};
  const appId = resolveAppId(rawAppId);

  if (!["android", "ios"].includes(platform)) {
    return res.status(400).json({ error: "Invalid platform" });
  }

  const versions = readVersions(appId);
  if (versions[platform]?.latest === version) {
    return res.status(400).json({ error: "Không thể xoá phiên bản đang là Latest/Active!" });
  }

  const appDir = getAppDir(appId);
  const targetDir = path.join(appDir, platform, version);
  if (!fs.existsSync(targetDir)) {
    return res.status(404).json({ error: "Release not found" });
  }

  createBackupSnapshot(`before-delete-${platform}-${version}`, appId);
  fs.rmSync(targetDir, { recursive: true, force: true });

  res.json({ ok: true, appId, message: `Đã xoá release ${platform} v${version} của app ${appId}` });
});

// Backups API
app.get("/api/backups", (req, res) => {
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

app.post("/api/backups/create", (req, res) => {
  const tag = (req.body?.tag || "").trim() || "manual-snapshot";
  const appId = req.body?.appId ? resolveAppId(req.body.appId) : null;
  const { filename, snapshot } = createBackupSnapshot(tag, appId);
  res.json({ ok: true, filename, snapshot });
});

app.post("/api/backups/restore/:filename", (req, res) => {
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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Custom OTA Multi-App Server listening on 0.0.0.0:${PORT}`);
  console.log(`Web Dashboard: http://localhost:${PORT}`);
});
