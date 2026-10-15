# Hướng dẫn Phát hành OTA & Cấu hình Bảo mật (Server Guide) 🚀

Tài liệu hướng dẫn cấu hình máy chủ, phân quyền bảo mật API Key và quy trình phát hành bản cập nhật Over-The-Air (OTA) cho hệ thống React Native Custom OTA.

---

## 1. Kiến trúc Bảo mật & Hệ thống API Key

Hệ thống hỗ trợ phân quyền chặt chẽ thông qua các loại khóa xác thực sau:

| Loại Khóa | Tiền tố (Prefix) | Quyền hạn (Scope) | Nơi sử dụng |
| :--- | :--- | :--- | :--- |
| **Pull Key** | `ota_pull_live_...` | Chỉ đọc / Tải bản cập nhật (`pull`) | Cấu hình trong source code Mobile App (`checkForUpdate`, `sync`) |
| **Push Key** | `ota_push_live_...` | Chỉ đẩy / Phát hành bản mới (`push`) | Dùng trong CI/CD (GitHub Actions, GitLab CI) hoặc lệnh build của Dev |
| **Full Key** | `ota_full_live_...` | Toàn quyền (`pull` + `push`) | Dành cho tài khoản nội bộ / Master |
| **Admin Token** | Chuỗi bí mật | Toàn quyền chế độ local dev | `X-OTA-ADMIN-TOKEN` (Fallback khi chưa kết nối Supabase) |

> [!IMPORTANT]
> - **Nguyên tắc bảo mật**: Server chỉ lưu mã băm **SHA-256** của API Key trong cơ sở dữ liệu Supabase, không bao giờ lưu key gốc dạng văn bản thô.
> - **Khóa riêng cho từng App**: Mỗi API Key được gắn chặt với một `app_id` cụ thể (ví dụ: `com.otademoapp`). Key của App này không thể pull/push cho App khác.
> - **Bắt buộc có Key**: Khi server đã cấu hình Supabase, mọi request kiểm tra cập nhật (`/ota/check`) không có API Key hợp lệ sẽ bị từ chối với HTTP `401 API_KEY_REQUIRED` hoặc `403 INVALID_API_KEY`.

---

## 2. Cấu hình Môi trường Server (`server/.env`)

Tạo file `.env` trong thư mục `server/` dựa trên mẫu dưới đây:

```env
PORT=4500
NODE_ENV=production

# 1. Admin Token (Dùng cho môi trường dev cục bộ)
OTA_ADMIN_TOKEN=demo-secret

# 2. Supabase (Xác thực người dùng, Quản lý App, API Keys & Releases)
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# 3. Cloudflare R2 (Lưu trữ và phân phối file update.zip tốc độ cao)
R2_ACCOUNT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_ACCESS_KEY_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_BUCKET_NAME=my-ota-bucket
R2_PUBLIC_URL=https://pub-xxxxxxxx.r2.dev
```

Khởi động server:
```bash
cd server
npm start
# Hoặc chế độ tự động reload khi sửa code:
node --watch src/server.js
```

Web Console quản lý tại: `http://localhost:4500`

---

## 3. Quy trình Phát hành Bản cập nhật (Push OTA)

### Cách 1: Sử dụng CLI `custom-ota release` (Khuyên dùng cho CI/CD)

Cú pháp lệnh:
```bash
# Phát hành cho iOS
npx custom-ota release -a com.otademoapp -p ios -v 1.0.8 -s http://localhost:4500 -k ota_push_live_xxxx -m "Nội dung cập nhật"

# Phát hành cho Android
npx custom-ota release -a com.otademoapp -p android -v 1.0.8 -s http://localhost:4500 -k ota_push_live_xxxx -m "Nội dung cập nhật"

# Phát hành cả 2 nền tảng cùng lúc qua biến môi trường
OTA_API_KEY=ota_push_live_xxxx \
npx custom-ota release -a com.otademoapp -p all -v 1.0.8 -s http://localhost:4500 -m "Bản phát hành chính thức"
```

**Danh sách tham số CLI:**
* `-a`, `--app-id`: Mã định danh App (ví dụ `com.otademoapp`).
* `-p`, `--platform`: Nền tảng: `ios`, `android`, hoặc `all`.
* `-v`, `--version`: Phiên bản OTA (ví dụ `1.0.8`).
* `-k`, `--api-key`: Push API Key (`ota_push_live_...`).
* `-s`, `--server`: URL của OTA Server (mặc định `http://localhost:4500`).
* `-m`, `--notes`: Ghi chú phát hành.
* `--min-native`: Phiên bản Native tối thiểu hỗ trợ (mặc định `1.0.0`).

---

### Cách 2: Sử dụng Script trong dự án Demo (`OtaDemoApp`)

Trong thư mục `OtaDemoApp/`, chạy lệnh phát hành nhanh:

```bash
# Phát hành cho iOS
yarn ota ios 1.0.8 "Sửa giao diện trang chủ"

# Phát hành cho Android
yarn ota android 1.0.8 "Tối ưu hiệu năng"

# Phát hành đồng thời cả 2 nền tảng
yarn ota all 1.0.8 "Phát hành bản v1.0.8 mới nhất"
```

> [!TIP]
> Script `yarn ota` đã được cấu hình mặc định sẵn Push API Key (`OTA_API_KEY`). Nếu bạn muốn ghi đè bằng một key khác, chỉ cần truyền biến môi trường:
> ```bash
> OTA_API_KEY=ota_push_live_xxxx yarn ota all 1.0.9
> ```

---

## 4. Kiểm tra Cập nhật từ Mobile Client (Pull Update)

### Kiểm tra bằng lệnh `curl`:

1. **Khi không có API Key (Bị chặn 401)**:
   ```bash
   curl -s "http://localhost:4500/ota/check?appId=com.otademoapp&platform=ios"
   # Kết quả:
   # {"error":"Yêu cầu API Key (Pull Key) để kiểm tra cập nhật ứng dụng!","code":"API_KEY_REQUIRED"}
   ```

2. **Khi dùng API Key có quyền Pull hợp lệ (Thành công 200)**:
   ```bash
   # Cách 1: Truyền qua query param apiKey
   curl -s "http://localhost:4500/ota/check?appId=com.otademoapp&platform=ios&nativeVersion=1.0.0&otaVersion=1.0.0&apiKey=ota_pull_live_xxxx"

   # Cách 2: Truyền qua Header X-OTA-API-KEY
   curl -s -H "X-OTA-API-KEY: ota_pull_live_xxxx" \
     "http://localhost:4500/ota/check?appId=com.otademoapp&platform=ios&nativeVersion=1.0.0&otaVersion=1.0.0"
   ```

   **Phản hồi khi có bản cập nhật mới:**
   ```json
   {
     "updateAvailable": true,
     "appId": "com.otademoapp",
     "platform": "ios",
     "otaVersion": "1.0.8",
     "bundle": "main.jsbundle",
     "sha256": "071bb29986376734cac012c3b6b3cab48239da7b82a12c6b5f9ebca14490c3bb",
     "channel": "production",
     "minNativeVersion": "1.0.0",
     "mandatory": false,
     "releaseNotes": "Fix lỗi kiểm tra phiên bản mới nhất",
     "downloadUrl": "https://pub-xxxxxxxx.r2.dev/bundles/com.otademoapp/ios/1.0.8/update.zip"
   }
   ```

---

## 5. Quản lý Đa Ứng Dụng & Cấu trúc Dữ liệu

### Trên Cloudflare R2 (Lưu trữ Bundle):
```text
bundles/
  com.otademoapp/
    ios/
      1.0.8/update.zip
    android/
      1.0.8/update.zip
  com.company.shopping/
    ...
```

### Trên Server Local (Thư mục `releases/` & `backups/`):
```text
releases/
  apps.json                       # Danh sách ứng dụng
  com.otademoapp/
    versions.json                 # Phiên bản đang active trên từng nền tảng
    ios/
      1.0.8/update.zip
      1.0.8/manifest.json
    android/
      1.0.8/update.zip
      1.0.8/manifest.json
backups/                          # Điểm khôi phục snapshot tự động tạo khi publish
```
