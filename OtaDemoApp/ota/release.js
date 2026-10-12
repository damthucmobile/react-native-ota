#!/usr/bin/env node

const { execSync } = require("child_process");
const path = require("path");

const platformArg = process.argv[2];
const version = process.argv[3];
const releaseNotes = process.argv.slice(4).join(" ") || "Bản cập nhật OTA";

if (!platformArg || !version) {
  console.log(`
\x1b[33m⚡ CÁCH DÙNG:\x1b[0m
  yarn ota \x1b[36m<platform>\x1b[0m \x1b[32m<version>\x1b[0m [ghi chú]

\x1b[33m📌 VÍ DỤ:\x1b[0m
  yarn ota ios 1.0.2
  yarn ota android 1.0.2
  yarn ota all 1.0.2 "Sửa màu giao diện và tối ưu hiệu năng"
`);
  process.exit(1);
}

const platforms = platformArg === "all" ? ["android", "ios"] : [platformArg.toLowerCase()];

for (const p of platforms) {
  if (!["android", "ios"].includes(p)) {
    console.error(`\x1b[31m❌ Nền tảng không hợp lệ: "${p}". Chỉ chấp nhận: android, ios, all\x1b[0m`);
    process.exit(1);
  }
}

const rootDir = path.resolve(__dirname, "..");
const serverUrl = process.env.OTA_SERVER || "http://localhost:4500";

console.log("\x1b[35m====================================================\x1b[0m");
console.log(`🚀 BẮT ĐẦU ĐÓNG GÓI & PHÁT HÀNH OTA: \x1b[1m${version}\x1b[0m`);
console.log(`📡 OTA Server: \x1b[36m${serverUrl}\x1b[0m`);
console.log(`📝 Ghi chú: ${releaseNotes}`);
console.log("\x1b[35m====================================================\x1b[0m");

for (const p of platforms) {
  const startTime = Date.now();
  console.log(`\n\x1b[34m[${p.toUpperCase()}]\x1b[0m 1/3: Đang bundle JS qua Metro...`);

  try {
    execSync(`node ota/build-ota.js ${p} ${version}`, {
      cwd: rootDir,
      stdio: "inherit",
      env: {
        ...process.env,
        RELEASE_NOTES: releaseNotes
      }
    });

    console.log(`\x1b[34m[${p.toUpperCase()}]\x1b[0m 2/3: Đang nén file update.zip...`);
    execSync(`node ota/package-ota.js ${p} ${version}`, {
      cwd: rootDir,
      stdio: "inherit"
    });

    console.log(`\x1b[34m[${p.toUpperCase()}]\x1b[0m 3/3: Đang publish lên OTA server...`);
    execSync(`node ota/publish-ota.js ${p} ${version}`, {
      cwd: rootDir,
      stdio: "inherit",
      env: {
        ...process.env,
        OTA_SERVER: serverUrl
      }
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\x1b[32m✔ [${p.toUpperCase()}] Đã phát hành OTA v${version} thành công trong ${elapsed}s!\x1b[0m`);
  } catch (error) {
    console.error(`\x1b[31m✖ [${p.toUpperCase()}] Thất bại:\x1b[0m`, error.message);
    process.exit(1);
  }
}

console.log("\n\x1b[32m🎉 TẤT CẢ ĐÃ HOÀN TẤT! Bạn có thể vào App và bấm 'Check OTA' ngay.\x1b[0m\n");
