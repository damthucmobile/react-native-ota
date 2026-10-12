const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

const platform = process.argv[2];
const otaVersion = process.argv[3];

if (!platform || !otaVersion) {
  console.error("Usage: node ota/package-ota.js android 1.0.1");
  process.exit(1);
}

const root = process.cwd();

const sourceDir = path.join(
  root,
  "ota",
  "build",
  platform,
  otaVersion
);

const packageDir = path.join(
  root,
  "ota",
  "packages",
  platform,
  otaVersion
);

if (!fs.existsSync(sourceDir)) {
  throw new Error(`Build not found: ${sourceDir}`);
}

fs.mkdirSync(packageDir, { recursive: true });

const outputPath = path.join(
  packageDir,
  "update.zip"
);

const output = fs.createWriteStream(outputPath);

let archive;
if (typeof archiver === "function") {
  archive = archiver("zip", { zlib: { level: 9 } });
} else if (archiver && archiver.ZipArchive) {
  archive = new archiver.ZipArchive({ zlib: { level: 9 } });
} else {
  throw new Error("Cannot instantiate archiver");
}

output.on("close", () => {
  console.log(`Created: ${outputPath}`);
  const size = typeof archive.pointer === "function" ? archive.pointer() : fs.statSync(outputPath).size;
  console.log(`Bytes: ${size}`);
});

archive.on("error", (err) => {
  throw err;
});

archive.pipe(output);
archive.directory(sourceDir, false);
archive.finalize();
