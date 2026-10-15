const { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");

const R2_ACCOUNT_ID = (process.env.R2_ACCOUNT_ID || "").trim();
const R2_ACCESS_KEY_ID = (process.env.R2_ACCESS_KEY_ID || "").trim();
const R2_SECRET_ACCESS_KEY = (process.env.R2_SECRET_ACCESS_KEY || "").trim();
const R2_BUCKET_NAME = (process.env.R2_BUCKET_NAME || "").trim();
let R2_PUBLIC_DOMAIN = (process.env.R2_PUBLIC_DOMAIN || "").trim();

if (R2_PUBLIC_DOMAIN && R2_PUBLIC_DOMAIN.endsWith("/")) {
  R2_PUBLIC_DOMAIN = R2_PUBLIC_DOMAIN.slice(0, -1);
}

function isR2Configured() {
  return Boolean(
    R2_ACCOUNT_ID &&
    R2_ACCESS_KEY_ID &&
    R2_SECRET_ACCESS_KEY &&
    R2_BUCKET_NAME &&
    !R2_ACCOUNT_ID.includes("your_")
  );
}

let s3Client = null;
if (isR2Configured()) {
  try {
    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY
      }
    });
  } catch (err) {
    console.error("Lỗi khởi tạo Cloudflare R2 Client:", err.message);
  }
}

/**
 * Upload bundle lên Cloudflare R2
 */
async function uploadToR2(storageKey, buffer, contentType = "application/zip") {
  if (!isR2Configured() || !s3Client) {
    throw new Error("Cloudflare R2 chưa được cấu hình trong .env");
  }

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: storageKey,
    Body: buffer,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable" // Cache CDN 1 năm vì version là immutable
  });

  await s3Client.send(command);
  return getR2DownloadUrl(storageKey);
}

/**
 * Xoá file trên Cloudflare R2
 */
async function deleteFromR2(storageKey) {
  if (!isR2Configured() || !s3Client) return;
  try {
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: storageKey
    });
    await s3Client.send(command);
  } catch (err) {
    console.error(`Lỗi xoá file ${storageKey} trên R2:`, err.message);
  }
}

/**
 * Lấy Public Download URL qua Cloudflare CDN
 */
function getR2DownloadUrl(storageKey) {
  if (R2_PUBLIC_DOMAIN) {
    return `${R2_PUBLIC_DOMAIN}/${storageKey}`;
  }
  // Nếu chưa cấu hình domain public tùy chỉnh, fallback về R2 endpoint
  return `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${storageKey}`;
}

module.exports = {
  isR2Configured,
  uploadToR2,
  deleteFromR2,
  getR2DownloadUrl
};
