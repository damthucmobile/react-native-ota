const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const crypto = require("crypto");

const platform = process.argv[2];
const otaVersion = process.argv[3];

if (!platform || !otaVersion) {
  console.error("Usage: node ota/build-ota.js android 1.0.1");
  process.exit(1);
}

if (!["android", "ios"].includes(platform)) {
  throw new Error("platform must be android or ios");
}

const root = process.cwd();
const outDir = path.join(
  root,
  "ota",
  "build",
  platform,
  otaVersion
);

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const bundleFile =
  platform === "android"
    ? "index.android.bundle"
    : "main.jsbundle";

const bundlePath = path.join(outDir, bundleFile);
const assetsDir = path.join(outDir, "assets");

const command = [
  "npx react-native bundle",
  `--platform ${platform}`,
  "--dev false",
  "--minify true",
  "--entry-file index.js",
  `--bundle-output "${bundlePath}"`,
  `--assets-dest "${assetsDir}"`
].join(" ");

console.log(command);
execSync(command, {
  cwd: root,
  stdio: "inherit"
});

const sha256 = crypto
  .createHash("sha256")
  .update(fs.readFileSync(bundlePath))
  .digest("hex");

const manifest = {
  appId: process.env.OTA_APP_ID || "com.otademoapp",
  platform,
  otaVersion,
  bundle: bundleFile,
  sha256,
  channel: process.env.OTA_CHANNEL || "production",
  minNativeVersion:
    process.env.MIN_NATIVE_VERSION || "1.0.0",
  mandatory:
    String(process.env.OTA_MANDATORY || "false") === "true",
  releaseNotes:
    process.env.RELEASE_NOTES || "OTA update",
  createdAt: new Date().toISOString()
};

fs.writeFileSync(
  path.join(outDir, "manifest.json"),
  JSON.stringify(manifest, null, 2)
);

console.log(`Built OTA ${platform} ${otaVersion}`);
console.log(`SHA256: ${sha256}`);
