const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const http = require("http");
const https = require("https");

const platform = process.argv[2];
const otaVersion = process.argv[3];
const serverUrl =
  process.env.OTA_SERVER || "http://localhost:4500";
const apiKey =
  process.env.OTA_API_KEY || "ota_push_live_ae843ed1410b89580e192bb601e238c3e0c5f3e87b0eb1b2";

if (!platform || !otaVersion) {
  console.error(
    "Usage: OTA_SERVER=http://localhost:4500 node ota/publish-ota.js android 1.0.1"
  );
  process.exit(1);
}

const root = process.cwd();

const packagePath = path.join(
  root,
  "ota",
  "packages",
  platform,
  otaVersion,
  "update.zip"
);

const buildManifestPath = path.join(
  root,
  "ota",
  "build",
  platform,
  otaVersion,
  "manifest.json"
);

if (
  !fs.existsSync(packagePath) ||
  !fs.existsSync(buildManifestPath)
) {
  throw new Error("Build/package not found");
}

const zip = fs.readFileSync(packagePath);
const sha256 = crypto
  .createHash("sha256")
  .update(zip)
  .digest("hex");

const manifest = JSON.parse(
  fs.readFileSync(buildManifestPath, "utf8")
);

manifest.sha256 = sha256;
manifest.size = zip.length;

const appId = manifest.appId || process.env.OTA_APP_ID || "com.otademoapp";
const url = new URL(
  `/admin/publish/${appId}/${platform}/${otaVersion}`,
  serverUrl
);

const payload = Buffer.from(
  JSON.stringify({
    manifest,
    zipBase64: zip.toString("base64")
  })
);

const client =
  url.protocol === "https:" ? https : http;

const req = client.request(
  {
    method: "POST",
    hostname: url.hostname,
    port: url.port || undefined,
    path: url.pathname,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": payload.length,
      "X-OTA-API-KEY": apiKey,
      "X-OTA-ADMIN-TOKEN":
        process.env.OTA_ADMIN_TOKEN || "demo-secret"
    }
  },
  (res) => {
    let body = "";

    res.on("data", (chunk) => {
      body += chunk;
    });

    res.on("end", () => {
      console.log(res.statusCode, body);
      if (res.statusCode < 200 || res.statusCode >= 300) {
        process.exit(1);
      }
    });
  }
);

req.on("error", (err) => {
  console.error(err);
  process.exit(1);
});

req.write(payload);
req.end();
