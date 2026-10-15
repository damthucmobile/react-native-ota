#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const http = require("http");
const https = require("https");

// Tự động nạp cấu hình từ file .env / .env.local ở thư mục dự án nếu có
function loadDotenv() {
  const root = process.cwd();
  const envFiles = [".env.local", ".env", ".env.production"];
  for (const file of envFiles) {
    const fullPath = path.join(root, file);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, "utf8");
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      } catch (e) { }
    }
  }
}
loadDotenv();

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === "--help" || command === "help") {
  console.log(`
\x1b[35m⚡ REACT NATIVE CUSTOM OTA CLI\x1b[0m

\x1b[33mCú pháp:\x1b[0m
  npx custom-ota release -v <version> [-m <notes>] [-o] [-p <platform>] [-b <targetBinary>]

\x1b[33mTham số:\x1b[0m
  -v, --version        Phiên bản OTA (Bắt buộc, ví dụ: 3.09.15)
  -m, --notes          Ghi chú phát hành (Mặc định: "OTA update")
  -o, --bundle-only    Chỉ đóng gói JS Bundle (~1MB, bỏ qua assets tĩnh để siêu nhẹ)
  -p, --platform       Hệ điều hành: android, ios, all (Mặc định: all)
  -a, --app-id         Mã định danh App (Mặc định: tự động quét từ build.gradle / app.json / .env)
  -b, --target-binary  Dải phiên bản Native áp dụng (Mặc định: "*" - tất cả bản Native)
  -k, --api-key        Push API Key (Mặc định: đọc từ OTA_API_KEY trong file .env)
  -s, --server         Địa chỉ OTA Server (Mặc định: đọc OTA_SERVER trong .env hoặc http://localhost:4500)
  -t, --token          Admin secret token (Mặc định: demo-secret)
  --min-native         Phiên bản native tối thiểu (Mặc định: 1.0.0)
  --max-native         Phiên bản native tối đa (Tùy chọn)

\x1b[33mVí dụ phát hành siêu nhanh (đã tự nhận diện các tham số từ .env và project):\x1b[0m
  \x1b[32mnpx custom-ota release -v 3.09.15 -m "Sửa giao diện đăng nhập" -o\x1b[0m
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

  // 1. Kiểm tra biến môi trường .env
  if (process.env.OTA_APP_ID || process.env.APP_ID) {
    return process.env.OTA_APP_ID || process.env.APP_ID;
  }

  // 2. Tự động đọc từ android/app/build.gradle
  const gradlePath = path.join(root, "android", "app", "build.gradle");
  if (fs.existsSync(gradlePath)) {
    try {
      const gradle = fs.readFileSync(gradlePath, "utf8");
      const appIdMatch = gradle.match(/applicationId\s+["']([^"']+)["']/);
      if (appIdMatch && appIdMatch[1] && !appIdMatch[1].includes("${")) {
        return appIdMatch[1].trim();
      }
      const nsMatch = gradle.match(/namespace\s+["']([^"']+)["']/);
      if (nsMatch && nsMatch[1]) {
        return nsMatch[1].trim();
      }
    } catch (e) { }
  }

  // 3. Tự động đọc từ AndroidManifest.xml
  const manifestPath = path.join(root, "android", "app", "src", "main", "AndroidManifest.xml");
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = fs.readFileSync(manifestPath, "utf8");
      const pkgMatch = manifest.match(/package\s*=\s*["']([^"']+)["']/);
      if (pkgMatch && pkgMatch[1]) {
        return pkgMatch[1].trim();
      }
    } catch (e) { }
  }

  // 4. Tự động đọc từ app.json
  const appJsonPath = path.join(root, "app.json");
  if (fs.existsSync(appJsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
      if (data.appId) return String(data.appId).trim();
      if (data.expo?.android?.package) return String(data.expo.android.package).trim();
      if (data.expo?.ios?.bundleIdentifier) return String(data.expo.ios.bundleIdentifier).trim();
      if (data.name) return String(data.name).toLowerCase();
    } catch (e) { }
  }

  // 5. Tự động đọc từ package.json
  const pkgJsonPath = path.join(root, "package.json");
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
      if (data.appId) return String(data.appId).trim();
      if (data.name) return String(data.name).toLowerCase();
    } catch (e) { }
  }

  return "com.otademoapp";
}

const appId = getArgValue("-a", "--app-id", detectAppId());
const platformArg = getArgValue("-p", "--platform", "all");
const version = getArgValue("-v", "--version");
const serverUrl = getArgValue("-s", "--server", process.env.OTA_SERVER_URL || process.env.OTA_SERVER || "http://localhost:4500");
const releaseNotes = getArgValue("-m", "--notes", "OTA update");
const adminToken = getArgValue("-t", "--token", process.env.OTA_ADMIN_TOKEN || "demo-secret");
const apiKey = getArgValue("-k", "--api-key", process.env.OTA_API_KEY || process.env.OTA_PUSH_KEY || process.env.CUSTOM_OTA_API_KEY || "");
const minNativeVersion = getArgValue("--min-native", "--minNativeVersion", "1.0.0");
const maxNativeVersion = getArgValue("--max-native", "--maxNativeVersion", null);
const targetBinaryVersion = getArgValue("-b", "--target-binary", null) || getArgValue("--targetBinaryVersion", null) || process.env.OTA_TARGET_BINARY || "*";
const bundleOnly = args.includes("-o") || args.includes("--bundle-only") || args.includes("--code-only");

if (!version) {
  console.error("\x1b[31m❌ Thiếu tham số phiên bản: -v <version> (ví dụ: -v 1.0.1)!\x1b[0m");
  process.exit(1);
}

const platforms = platformArg === "all" ? ["android", "ios"] : [platformArg.toLowerCase()];
const root = process.cwd();

console.log(`\n\x1b[35m==================================================\x1b[0m`);
console.log(`⚡ \x1b[1mCUSTOM OTA RELEASE CONFIGURATION\x1b[0m`);
console.log(`  • App ID:        \x1b[36m${appId}\x1b[0m`);
console.log(`  • Nền tảng:      \x1b[36m${platformArg.toUpperCase()}\x1b[0m (${platforms.join(", ")})`);
console.log(`  • Phiên bản OTA: \x1b[32mv${version}\x1b[0m`);
console.log(`  • Target Native: \x1b[33m${targetBinaryVersion}\x1b[0m`);
console.log(`  • Server:        \x1b[36m${serverUrl}\x1b[0m`);
console.log(`  • API Key:       \x1b[36m${apiKey ? (apiKey.slice(0, 16) + "...") : "(Không có / dùng Admin token)"}\x1b[0m`);
console.log(`  • Chế độ:        \x1b[36m${bundleOnly ? "Bundle-only (-o, siêu nhẹ)" : "Đầy đủ Assets tĩnh"}\x1b[0m`);
console.log(`  • Ghi chú:       \x1b[37m"${releaseNotes}"\x1b[0m`);
console.log(`\x1b[35m==================================================\x1b[0m`);

function findHermesc() {
  const osFolder = process.platform === "darwin" ? "osx-bin" : process.platform === "win32" ? "win64-bin" : "linux64-bin";
  const binaryName = process.platform === "win32" ? "hermesc.exe" : "hermesc";

  const searchPaths = [
    path.join(root, "node_modules", "hermes-compiler", "hermesc", osFolder, binaryName),
    path.join(root, "node_modules", "react-native", "sdks", "hermesc", osFolder, binaryName),
    path.join(root, "node_modules", "hermes-engine", "destroot", "bin", binaryName),
    path.join(root, "ios", "Pods", "hermes-engine", "destroot", "bin", binaryName),
  ];

  for (const sp of searchPaths) {
    if (fs.existsSync(sp)) return sp;
  }

  // Tra cứu thư mục cha (hỗ trợ monorepo)
  let curr = path.dirname(root);
  for (let i = 0; i < 3; i++) {
    const candidate = path.join(curr, "node_modules", "hermes-compiler", "hermesc", osFolder, binaryName);
    if (fs.existsSync(candidate)) return candidate;
    curr = path.dirname(curr);
  }

  // Tra cứu system PATH
  try {
    const whichCmd = process.platform === "win32" ? "where hermesc" : "which hermesc";
    const res = execSync(whichCmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim().split("\n")[0];
    if (res && fs.existsSync(res)) return res;
  } catch (e) { }

  return null;
}

function downloadFileHelper(urlStr, targetPath) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const client = parsed.protocol === "https:" ? https : http;
    const req = client.get(urlStr, { timeout: 30000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith("http")) {
          redirectUrl = new URL(redirectUrl, urlStr).toString();
        }
        return downloadFileHelper(redirectUrl, targetPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const fileStream = fs.createWriteStream(targetPath);
      res.pipe(fileStream);
      fileStream.on("finish", () => {
        fileStream.close();
        resolve();
      });
      fileStream.on("error", reject);
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout khi tải bundle")); });
  });
}

async function buildAndPublish(p) {
  console.log(`\n\x1b[36m==================================================\x1b[0m`);
  console.log(`🚀 Đang đóng gói OTA [${p.toUpperCase()}] v${version}...`);
  if (bundleOnly) {
    console.log(`⚡ [Tối ưu hóa] Chế độ BUNDLE-ONLY: chỉ đóng gói JS bundle (~1MB), bỏ qua assets tĩnh.`);
  }
  console.log(`\x1b[36m==================================================\x1b[0m`);

  const outDir = path.join(root, ".ota_temp", p, version);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const bundleFile = p === "android" ? "index.android.bundle" : "main.jsbundle";
  const bundlePath = path.join(outDir, bundleFile);

  // 1. Metro Bundle
  console.log(`📦 [1/3] Đang chạy Metro Bundle...`);
  const bundleCmdParts = [
    "npx react-native bundle",
    `--platform ${p}`,
    "--dev false",
    "--minify true",
    "--entry-file index.js",
    `--bundle-output "${bundlePath}"`
  ];

  if (!bundleOnly) {
    const testBrokenAssets =
      process.env.TEST_BROKEN_ASSETS === "true" ||
      args.includes("--broken-assets");
    const assetsDir = testBrokenAssets ? path.join(outDir, "assets") : outDir;
    bundleCmdParts.push(`--assets-dest "${assetsDir}"`);
  }

  const bundleCmd = bundleCmdParts.join(" ");
  execSync(bundleCmd, { cwd: root, stdio: "inherit" });

  let bundleSize = fs.statSync(bundlePath).size;
  console.log(`✔ [Metro] File JS thô hoàn tất: ${(bundleSize / (1024 * 1024)).toFixed(2)} MB`);

  // 1.5. Tự động biên dịch sang Hermes Bytecode (HBC) nếu Hermes được bật
  const noHermes = args.includes("--no-hermes");
  const forceHermes = args.includes("--hermes");
  const hermescPath = findHermesc();
  const shouldCompileHermes = !noHermes && (forceHermes || hermescPath != null);

  if (shouldCompileHermes && hermescPath) {
    console.log(`⚡ [Hermes] Phát hiện hermesc tại: ${hermescPath}`);
    console.log(`⚡ [Hermes] Đang biên dịch JS Bundle sang Hermes Bytecode (HBC)...`);
    const hbcPath = bundlePath + ".hbc";
    try {
      execSync(`"${hermescPath}" -emit-binary -out "${hbcPath}" "${bundlePath}"`, { stdio: "inherit" });
      if (fs.existsSync(hbcPath) && fs.statSync(hbcPath).size > 0) {
        fs.unlinkSync(bundlePath);
        fs.renameSync(hbcPath, bundlePath);
        bundleSize = fs.statSync(bundlePath).size;
        console.log(`✔ [Hermes] Đã chuyển đổi thành công sang Hermes Bytecode (HBC)! Kích thước: ${(bundleSize / (1024 * 1024)).toFixed(2)} MB`);
      }
    } catch (hErr) {
      console.warn(`⚠️ [Hermes] Biên dịch HBC thất bại, giữ nguyên Plain JS:`, hErr.message);
    }
  } else if (!hermescPath && !noHermes) {
    console.log(`ℹ️ [Hermes] Không tìm thấy hermesc, phát hành dạng Plain JavaScript.`);
  }

  // Tính mã hash SHA-256 chính xác của file bundle (JS hoặc HBC)
  const bundleBuffer = fs.readFileSync(bundlePath);
  const bundleSha256 = crypto
    .createHash("sha256")
    .update(bundleBuffer)
    .digest("hex");

  // Quét danh sách assets thực tế có trong thư mục đóng gói (loại trừ file bundle và manifest)
  const collectedAssets = [];
  function scanAssets(dir, relPath = "") {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    for (const item of items) {
      if (item === bundleFile || item === "manifest.json") continue;
      const full = path.join(dir, item);
      const rel = relPath ? `${relPath}/${item}` : item;
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        scanAssets(full, rel);
      } else {
        collectedAssets.push(rel);
      }
    }
  }
  scanAssets(outDir);

  const manifest = {
    appId,
    platform: p,
    otaVersion: version,
    bundle: bundleFile,
    bundleSha256,
    bundleHash: bundleSha256,
    sha256: bundleSha256, // Sẽ được cập nhật thành hash của file ZIP sau khi nén
    assets: collectedAssets,
    channel: "production",
    targetBinaryVersion: targetBinaryVersion || "*",
    minNativeVersion,
    maxNativeVersion: maxNativeVersion || undefined,
    mandatory: false,
    releaseNotes,
    createdAt: new Date().toISOString()
  };

  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  // 2. Package ZIP
  console.log(`🗜️  [2/3] Đang nén file update.zip...`);
  const zipPath = path.join(root, ".ota_temp", `${p}-${version}.zip`);
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  if (fs.existsSync(zipPath)) {
    try { fs.unlinkSync(zipPath); } catch (e) { }
  }

  let zipSuccess = false;
  try {
    let rawArchiver = null;
    try { rawArchiver = require("archiver"); } catch (e) {
      try { rawArchiver = require(path.join(__dirname, "..", "node_modules", "archiver")); } catch (e2) { }
    }

    if (rawArchiver) {
      const archive = typeof rawArchiver === "function"
        ? rawArchiver("zip", { zlib: { level: 9 } })
        : (rawArchiver.ZipArchive ? new rawArchiver.ZipArchive({ zlib: { level: 9 } }) : null);

      if (archive) {
        await new Promise((resolve, reject) => {
          const output = fs.createWriteStream(zipPath);
          output.on("close", resolve);
          archive.on("error", reject);
          archive.pipe(output);
          archive.directory(outDir, false);
          archive.finalize();
        });
        zipSuccess = fs.existsSync(zipPath) && fs.statSync(zipPath).size > 0;
      }
    }
  } catch (err) {
    console.warn(`[Archiver] Không dùng được archiver module (${err.message}), dùng lệnh zip hệ thống...`);
  }

  if (!zipSuccess) {
    if (process.platform === "win32") {
      execSync(`powershell -command "Compress-Archive -Path '${outDir}/*' -DestinationPath '${zipPath}' -Force"`, { stdio: "ignore" });
    } else {
      execSync(`cd "${outDir}" && zip -r -q "${zipPath}" .`, { stdio: "ignore" });
    }
  }

  const zipBuffer = fs.readFileSync(zipPath);
  const zipSha256 = crypto.createHash("sha256").update(zipBuffer).digest("hex");
  manifest.size = zipBuffer.length;
  manifest.zipSha256 = zipSha256;
  manifest.sha256 = zipSha256;
  manifest.bundleSha256 = bundleSha256;
  manifest.bundleHash = bundleSha256;
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`✔ [ZIP] Kích thước gói update.zip: ${(zipBuffer.length / (1024 * 1024)).toFixed(2)} MB (${zipBuffer.length} bytes)`);

  // 2.5 Tạo bản vá vi sai (Delta Patch)
  const cacheDir = path.join(root, ".ota_cache", appId, p);
  fs.mkdirSync(cacheDir, { recursive: true });
  const lastBundlePath = path.join(cacheDir, "last_bundle.bin");
  const lastVersionPath = path.join(cacheDir, "last_version.txt");

  // Nếu chưa có cache cục bộ (máy mới hoặc CI/CD), tự động lấy bản bundle active trên server về làm base
  if (!fs.existsSync(lastBundlePath) || !fs.existsSync(lastVersionPath)) {
    try {
      console.log(`🔍 [Delta Auto-Sync] Kiểm tra phiên bản active trên server để tạo bản vá vi sai...`);
      const checkUrl = new URL(`/ota/latest-bundle?appId=${encodeURIComponent(appId)}&platform=${p}`, serverUrl);
      const client = checkUrl.protocol === "https:" ? https : http;

      const latestInfo = await new Promise((resolve) => {
        const req = client.get(checkUrl, { timeout: 8000 }, (res) => {
          let raw = "";
          res.on("data", c => raw += c);
          res.on("end", () => {
            try { resolve(JSON.parse(raw)); } catch { resolve(null); }
          });
        });
        req.on("error", () => resolve(null));
        req.on("timeout", () => { req.destroy(); resolve(null); });
      });

      if (latestInfo && latestInfo.found && latestInfo.version && latestInfo.downloadUrl && latestInfo.version !== version) {
        console.log(`⬇️  [Delta Auto-Sync] Phát hiện release v${latestInfo.version}. Đang tải bundle gốc về làm base vi sai...`);
        let dlUrl = latestInfo.downloadUrl;
        if (!dlUrl.startsWith("http")) {
          dlUrl = new URL(dlUrl, serverUrl).toString();
        }

        const prevZipPath = path.join(cacheDir, `temp_prev_${latestInfo.version}.zip`);
        await downloadFileHelper(dlUrl, prevZipPath);

        const extractDir = path.join(cacheDir, `temp_prev_${latestInfo.version}`);
        fs.mkdirSync(extractDir, { recursive: true });

        if (process.platform === "win32") {
          execSync(`powershell -command "Expand-Archive -Path '${prevZipPath}' -DestinationPath '${extractDir}' -Force"`, { stdio: "ignore" });
        } else {
          execSync(`unzip -o -q "${prevZipPath}" -d "${extractDir}"`, { stdio: "ignore" });
        }

        const candidateBundle = path.join(extractDir, bundleFile);
        if (fs.existsSync(candidateBundle)) {
          fs.copyFileSync(candidateBundle, lastBundlePath);
          fs.writeFileSync(lastVersionPath, latestInfo.version, "utf8");
          console.log(`✔ [Delta Auto-Sync] Đã sẵn sàng base bundle v${latestInfo.version}!`);
        }

        fs.rmSync(prevZipPath, { force: true });
        fs.rmSync(extractDir, { recursive: true, force: true });
      }
    } catch (fetchErr) {
      console.warn(`[Delta Auto-Sync] Không thể tải base bundle tự động:`, fetchErr.message);
    }
  }

  let patchBase64 = null;
  let baseVersion = null;

  if (fs.existsSync(lastBundlePath) && fs.existsSync(lastVersionPath)) {
    try {
      baseVersion = fs.readFileSync(lastVersionPath, "utf8").trim();
      if (baseVersion && baseVersion !== version) {
        console.log(`⚡ [Delta] Đang tạo bản vá vi sai từ v${baseVersion} -> v${version}...`);
        const { createDelta } = require("./delta");
        const baseBuf = fs.readFileSync(lastBundlePath);
        const newBuf = fs.readFileSync(bundlePath);
        const patchBuf = createDelta(baseBuf, newBuf);
        patchBase64 = patchBuf.toString("base64");
        manifest.patchSize = patchBuf.length;
        manifest.patchSha256 = crypto.createHash("sha256").update(patchBuf).digest("hex");
        manifest.baseVersion = baseVersion;
        manifest.isDelta = true;
        const savedPercent = ((1 - patchBuf.length / zipBuffer.length) * 100).toFixed(1);
        console.log(`✔ [Delta Thành công] Dung lượng bản vá vi sai: ${(patchBuf.length / 1024).toFixed(1)} KB (Tiết kiệm ~${savedPercent}% băng thông!)`);
      }
    } catch (deltaErr) {
      console.warn("Không thể tạo delta patch:", deltaErr.message);
    }
  } else {
    console.log(`ℹ️  [Delta] Chưa có bản base trước đó. Đây là bản phát hành đầu tiên (Full Bundle).`);
  }

  // Cập nhật cache cho lần publish tiếp theo
  try {
    fs.copyFileSync(bundlePath, lastBundlePath);
    fs.writeFileSync(lastVersionPath, version, "utf8");
  } catch (e) { }

  // 3. Publish to OTA Server
  console.log(`📡 [3/3] Đang upload lên server: ${serverUrl} (App: ${appId})...`);

  const url = new URL(`/admin/publish/${appId}/${p}/${version}`, serverUrl);
  const payload = Buffer.from(
    JSON.stringify({
      manifest,
      zipBase64: zipBuffer.toString("base64"),
      patchBase64,
      baseVersion
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
          "X-OTA-ADMIN-TOKEN": adminToken,
          ...(apiKey ? { "X-OTA-API-KEY": apiKey } : {})
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
