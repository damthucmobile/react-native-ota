#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const http = require("http");
const https = require("https");

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === "--help" || command === "help") {
  console.log(`
\x1b[35m⚡ REACT NATIVE CUSTOM OTA CLI\x1b[0m

\x1b[33mCú pháp:\x1b[0m
  npx custom-ota release -p <platform> -v <version> [-a <appId>] [-s <serverUrl>] [-m <notes>]

\x1b[33mTham số:\x1b[0m
  -a, --app-id     Mã định danh App (Mặc định: đọc từ app.json / com.otademoapp)
  -p, --platform   Hệ điều hành: android, ios, all (Bắt buộc)
  -v, --version    Phiên bản OTA: ví dụ 1.0.4 (Bắt buộc)
  -s, --server     Địa chỉ OTA Server (Mặc định: http://localhost:4500)
  -m, --notes      Ghi chú phát hành (Mặc định: "OTA update")
  -t, --token      Admin secret token (Mặc định: demo-secret)
  --min-native     Phiên bản native tối thiểu (Mặc định: 1.0.0)

\x1b[33mVí dụ:\x1b[0m
  npx custom-ota release -a com.company.shop -p ios -v 1.0.4 -m "Fix UI lỗi font"
  npx custom-ota release -a com.company.rider -p android -v 1.0.4
  npx custom-ota release -p all -v 1.0.4 -s http://192.168.1.10:4500
`);
  process.exit(0);
}

if (command !== "release") {
  console.error(`\x1b[31mLệnh không hợp lệ: "${command}". Hãy dùng "release" hoặc "--help"\x1b[0m`);
  process.exit(1);
}

function getArgValue(shortKey, longKey, defaultValue = null) {
  const shortIndex = args.indexOf(shortKey);
  if (shortIndex !== -1 && args[shortIndex + 1]) return args[shortIndex + 1];
  const longIndex = args.indexOf(longKey);
  if (longIndex !== -1 && args[longIndex + 1]) return args[longIndex + 1];
  return defaultValue;
}

function detectAppId() {
  const root = process.cwd();
  const appJsonPath = path.join(root, "app.json");
  if (fs.existsSync(appJsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
      if (data.name) return String(data.name).toLowerCase();
    } catch (e) {}
  }

  const pkgJsonPath = path.join(root, "package.json");
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
      if (data.name) return String(data.name).toLowerCase();
    } catch (e) {}
  }

  return "com.otademoapp";
}

const appId = getArgValue("-a", "--app-id", detectAppId());
const platformArg = getArgValue("-p", "--platform");
const version = getArgValue("-v", "--version");
const serverUrl = getArgValue("-s", "--server", process.env.OTA_SERVER || "http://localhost:4500");
const releaseNotes = getArgValue("-m", "--notes", "OTA update");
const adminToken = getArgValue("-t", "--token", process.env.OTA_ADMIN_TOKEN || "demo-secret");
const minNativeVersion = getArgValue("--min-native", "--minNativeVersion", "1.0.0");

if (!platformArg || !version) {
  console.error("\x1b[31m❌ Thiếu tham số -p <platform> hoặc -v <version>!\x1b[0m");
  process.exit(1);
}

const platforms = platformArg === "all" ? ["android", "ios"] : [platformArg.toLowerCase()];
const root = process.cwd();

async function buildAndPublish(p) {
  console.log(`\n\x1b[36m==================================================\x1b[0m`);
  console.log(`🚀 Đang đóng gói OTA [${p.toUpperCase()}] v${version}...`);
  console.log(`\x1b[36m==================================================\x1b[0m`);

  const outDir = path.join(root, ".ota_temp", p, version);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const bundleFile = p === "android" ? "index.android.bundle" : "main.jsbundle";
  const bundlePath = path.join(outDir, bundleFile);
  const assetsDir = path.join(outDir, "assets");

  // 1. Metro Bundle
  console.log(`📦 [1/3] Đang chạy Metro Bundle...`);
  const bundleCmd = [
    "npx react-native bundle",
    `--platform ${p}`,
    "--dev false",
    "--minify true",
    "--entry-file index.js",
    `--bundle-output "${bundlePath}"`,
    `--assets-dest "${assetsDir}"`
  ].join(" ");

  execSync(bundleCmd, { cwd: root, stdio: "inherit" });

  const sha256 = crypto
    .createHash("sha256")
    .update(fs.readFileSync(bundlePath))
    .digest("hex");

  const manifest = {
    appId,
    platform: p,
    otaVersion: version,
    bundle: bundleFile,
    sha256,
    channel: "production",
    minNativeVersion,
    mandatory: false,
    releaseNotes,
    createdAt: new Date().toISOString()
  };

  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  // 2. Package ZIP
  console.log(`🗜️  [2/3] Đang nén file update.zip...`);
  const zipPath = path.join(root, ".ota_temp", `${p}-${version}.zip`);

  try {
    const archiver = require("archiver");
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });
      output.on("close", resolve);
      archive.on("error", reject);
      archive.pipe(output);
      archive.directory(outDir, false);
      archive.finalize();
    });
  } catch (err) {
    // Fallback sang công cụ nén zip có sẵn của hệ điều hành
    if (process.platform === "win32") {
      execSync(`powershell -command "Compress-Archive -Path '${outDir}/*' -DestinationPath '${zipPath}' -Force"`, { stdio: "ignore" });
    } else {
      execSync(`cd "${outDir}" && zip -r -q "${zipPath}" .`, { stdio: "ignore" });
    }
  }

  // 3. Publish to OTA Server
  console.log(`📡 [3/3] Đang upload lên server: ${serverUrl} (App: ${appId})...`);
  const zipBuffer = fs.readFileSync(zipPath);
  manifest.size = zipBuffer.length;

  const url = new URL(`/admin/publish/${appId}/${p}/${version}`, serverUrl);
  const payload = Buffer.from(
    JSON.stringify({
      manifest,
      zipBase64: zipBuffer.toString("base64")
    })
  );

  const client = url.protocol === "https:" ? https : http;

  await new Promise((resolve, reject) => {
    const req = client.request(
      {
        method: "POST",
        hostname: url.hostname,
        port: url.port || undefined,
        path: url.pathname,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": payload.length,
          "X-OTA-ADMIN-TOKEN": adminToken
        }
      },
      (res) => {
        let body = "";
        res.on("data", chunk => { body += chunk; });
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`\x1b[32m✔ [${p.toUpperCase()}] Phát hành thành công v${version}!\x1b[0m`);
            resolve();
          } else {
            reject(new Error(`Server response ${res.statusCode}: ${body}`));
          }
        });
      }
    );

    req.on("error", reject);
    req.write(payload);
    req.end();
  });

  // Cleanup temp files
  fs.rmSync(path.join(root, ".ota_temp"), { recursive: true, force: true });
}

(async () => {
  for (const p of platforms) {
    await buildAndPublish(p);
  }
  console.log("\n\x1b[32m🎉 TẤT CẢ PHIÊN BẢN ĐÃ PHÁT HÀNH THÀNH CÔNG!\x1b[0m\n");
})();
