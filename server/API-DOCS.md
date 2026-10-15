# 📖 Tài liệu Đặc tả Toàn bộ API - Custom OTA Server

> **Phiên bản tài liệu:** 2.0.0  
> **Host mặc định:** `http://localhost:4500` (hoặc `http://10.0.2.2:4500` trên Android Emulator)  
> **Kiến trúc:** Node.js Express, hỗ trợ chế độ Multi-App (Đa ứng dụng), Cloudflare R2 Object Storage & Supabase Database / Local File Fallback.

---

## 📑 Mục lục

1. [Cơ chế Xác thực & Phân quyền (Authentication)](#1-cơ-chế-xác-thực--phân-quyền-authentication)
2. [Hệ thống & Kiểm tra Sức khỏe (System & Health)](#2-hệ-thống--kiểm-tra-sức-khỏe-system--health)
3. [Dành cho Client App (Check Update & Download)](#3-dành-cho-client-app-check-update--download)
4. [Phát hành Bản cập nhật (Publish OTA API)](#4-phát-hành-bản-cập-nhật-publish-ota-api)
5. [Quản lý Ứng dụng Đa khách hàng (Apps Management)](#5-quản-lý-ứng-dụng-đa-khách-hàng-apps-management)
6. [Quản lý Khóa API (API Keys Management)](#6-quản-lý-khóa-api-api-keys-management)
7. [Dashboard Console & Điều khiển Release (Release & Rollback)](#7-dashboard-console--điều-khiển-release-release--rollback)
8. [Sao lưu & Phục hồi Cấu hình (Backups & Snapshots)](#8-sao-lưu--phục-hồi-cấu-hình-backups--snapshots)

---

## 1. Cơ chế Xác thực & Phân quyền (Authentication)

Hệ thống cung cấp 3 cơ chế xác thực riêng biệt tuỳ theo đối tượng gọi API:

| Phương thức | Header / Param | Quyền hạn & Mục đích | Sử dụng tại API |
| :--- | :--- | :--- | :--- |
| **Pull Key** | `X-OTA-API-KEY: ota_pull_live_...`<br>hoặc `?apiKey=...` | Chỉ có quyền đọc/tải bản cập nhật (`pull`) | `GET /ota/check` |
| **Push Key** | `X-OTA-API-KEY: ota_push_live_...`<br>hoặc `X-OTA-ADMIN-TOKEN: demo-secret` | Có quyền đẩy/phát hành bản build (`push`) | `POST /admin/publish/...` |
| **Dashboard Token** | `Authorization: Bearer <supabase_jwt_token>` | Xác thực User quản trị trên Web Console | Toàn bộ các API tiền tố `/api/...` |

> [!NOTE]
> Khi hệ thống chạy ở chế độ **Local Demo (chưa cấu hình Supabase)**:
> - Các API Dashboard tự động nhận diện user là `local-admin`.
> - API Publish chấp nhận `X-OTA-ADMIN-TOKEN: demo-secret`.

---

## 2. Hệ thống & Kiểm tra Sức khỏe (System & Health)

### 2.1. Kiểm tra trạng thái máy chủ (`GET /health`)
- **Mục đích:** Kiểm tra server có đang hoạt động hay không (Liveness / Readiness probe).
- **Quyền hạn:** Công khai (Public).
- **Request:** Không yêu cầu tham số.

**Response `200 OK`:**
```json
{
  "ok": true,
  "service": "custom-ota-server-multi-tenant",
  "multiAppSupported": true,
  "time": "2026-10-13T09:00:00.000Z"
}
```

---

### 2.2. Lấy cấu hình công khai (`GET /api/config`)
- **Mục đích:** Cung cấp thông tin cấu hình cho Web Dashboard (Supabase Anon Key, trạng thái kết nối Cloudflare R2).
- **Quyền hạn:** Công khai (Public).

**Response `200 OK`:**
```json
{
  "supabaseUrl": "https://xxxx.supabase.co",
  "supabaseAnonKey": "eyJhbGciOi...",
  "isSupabaseConfigured": true,
  "isR2Configured": true
}
```

---

## 3. Dành cho Client App (Check Update & Download)

### 3.1. Kiểm tra cập nhật OTA (`GET /ota/check`)
- **Mục đích:** Ứng dụng di động (React Native) gọi lên để kiểm tra xem có bản cập nhật mới nào khả dụng hay không.
- **Quyền hạn:** Yêu cầu **Pull Key** (`ota_pull_live_...`) hoặc **Full Key**.

#### Request Headers:
| Header | Kiểu | Bắt buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `X-OTA-API-KEY` | string | Khuyên dùng | API Key cấp quyền Pull |

#### Query Parameters:
| Tham số | Kiểu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `appId` | string | Không | `com.otademoapp` | Mã định danh của app |
| `platform` | string | **Có** | - | Nền tảng: `android` hoặc `ios` |
| `nativeVersion` | string | Không | `0.0.0` | Phiên bản Native nhúng trong APK/IPA |
| `otaVersion` | string | Không | `0.0.0` | Phiên bản OTA hiện hành trên máy user |
| `channel` | string | Không | `production` | Kênh phát hành (vd: `production`, `staging`) |
| `apiKey` | string | Không | - | Truyền API Key qua Query nếu không dùng Header |

#### Response:

##### Trường hợp 1: Có bản cập nhật mới (`200 OK` - `updateAvailable: true`)
```json
{
  "updateAvailable": true,
  "appId": "com.otademoapp",
  "platform": "ios",
  "otaVersion": "1.1.1",
  "bundle": "main.jsbundle",
  "sha256": "d670c86dc0351ed4bd1523b2358c2aeeb3480b59d40a4384373cd749df1df5bc",
  "channel": "production",
  "minNativeVersion": "1.0.0",
  "mandatory": false,
  "releaseNotes": "Fix lỗi hiển thị tiến độ tải phần trăm trên iOS",
  "createdAt": "2026-10-13T09:22:00.000Z",
  "size": 1224297,
  "downloadUrl": "https://pub-xxxx.r2.dev/bundles/com.otademoapp/ios/1.1.1/update.zip"
}
```

##### Trường hợp 2: Đang ở bản mới nhất hoặc không có update (`200 OK`)
```json
{
  "updateAvailable": false,
  "reason": "already_latest",
  "appId": "com.otademoapp"
}
```
*Các lý do khác (`reason`): `no_release`, `native_version_too_old`, `channel_mismatch`.*

##### Mã lỗi có thể gặp:
- `400 Bad Request`: `{"message": "platform must be android or ios"}`
- `401 Unauthorized`: `{"error": "Yêu cầu API Key (Pull Key)...", "code": "API_KEY_REQUIRED"}`
- `403 Forbidden`: `{"error": "API Key đã hết hạn hoặc không có quyền...", "code": "INVALID_API_KEY"}`

---

### 3.2. Tải gói zip cập nhật (`GET /releases/:appId/:platform/:version/update.zip`)
- **Mục đích:** Tải file bundle `update.zip` trực tiếp từ server local (khi không bật Cloudflare R2).
- **Quyền hạn:** Public / Direct Download.
- **Response:** File nhị phân dạng `application/zip` kèm HTTP headers: `Content-Length`, `Content-Type`.

---

## 4. Phát hành Bản cập nhật (Publish OTA API)

### 4.1. Đẩy bản build OTA mới (`POST /admin/publish/:appId/:platform/:version`)
*Hỗ trợ URL cũ tương thích ngược:* `POST /admin/publish/:platform/:version`

- **Mục đích:** CI/CD pipeline hoặc CLI đẩy bundle zip và manifest lên server để kích hoạt phát hành bản mới.
- **Quyền hạn:** Yêu cầu **Push Key** (`ota_push_live_...`), **Full Key**, hoặc **Admin Token** (`X-OTA-ADMIN-TOKEN: demo-secret`).

#### Path Parameters:
| Tham số | Kiểu | Mô tả |
| :--- | :--- | :--- |
| `appId` | string | Mã app (ví dụ: `com.otademoapp`) |
| `platform` | string | `android` hoặc `ios` |
| `version` | string | Phiên bản OTA (ví dụ: `1.1.1`) |

#### Request Headers:
| Header | Giá trị |
| :--- | :--- |
| `Content-Type` | `application/json` |
| `X-OTA-API-KEY` | `ota_push_live_...` |
| *(Hoặc)* `X-OTA-ADMIN-TOKEN` | `demo-secret` (khi dev cục bộ) |

#### Request Body (`JSON`):
```json
{
  "manifest": {
    "appId": "com.otademoapp",
    "platform": "ios",
    "otaVersion": "1.1.1",
    "bundle": "main.jsbundle",
    "channel": "production",
    "minNativeVersion": "1.0.0",
    "mandatory": false,
    "releaseNotes": "Fix lỗi hiển thị tiến độ tải phần trăm trên iOS",
    "createdAt": "2026-10-13T09:22:00.000Z"
  },
  "zipBase64": "UEsDBBQAAAAIA..."
}
```

#### Response `200 OK`:
```json
{
  "ok": true,
  "appId": "com.otademoapp",
  "platform": "ios",
  "version": "1.1.1",
  "storage": "cloudflare_r2",
  "database": "supabase"
}
```

---

## 5. Quản lý Ứng dụng Đa khách hàng (Apps Management)

*Tất cả các API này yêu cầu Header `Authorization: Bearer <token>`.*

### 5.1. Lấy danh sách ứng dụng (`GET /api/apps`)
- **Mục đích:** Lấy danh sách các App mà User hiện tại sở hữu hoặc có quyền thành viên.
- **Response `200 OK`:**
```json
{
  "apps": [
    {
      "id": "com.otademoapp",
      "name": "OTA Demo App",
      "description": "Ứng dụng Demo React Native Custom OTA",
      "createdAt": "2026-10-13T03:00:00.000Z",
      "ownerId": "usr_xxxx",
      "activeVersions": {
        "android": { "latest": "1.0.3" },
        "ios": { "latest": "1.1.1" }
      },
      "totalReleases": 6,
      "androidCount": 3,
      "iosCount": 3,
      "storageUsed": "7.2 MB",
      "storageBytes": 7549740
    }
  ]
}
```

---

### 5.2. Tạo ứng dụng mới (`POST /api/apps`)
- **Request Body (`JSON`):**
```json
{
  "id": "com.mycompany.shop",
  "name": "Shop App",
  "description": "Ứng dụng bán hàng"
}
```
- **Ràng buộc:** `id` chỉ chứa chữ, số, dấu `.`, `_`, `-`.
- **Response `200 OK`:**
```json
{
  "ok": true,
  "app": {
    "id": "com.mycompany.shop",
    "name": "Shop App",
    "description": "Ứng dụng bán hàng",
    "owner_id": "usr_xxxx"
  }
}
```

---

### 5.3. Xóa ứng dụng (`DELETE /api/apps/:appId`)
- **Mục đích:** Xóa toàn bộ ứng dụng và dữ liệu releases liên quan. Chỉ **Owner** mới được phép thực hiện.
- **Path Parameter:** `appId` (Mã app cần xóa).
- **Response `200 OK`:**
```json
{
  "ok": true,
  "message": "Đã xóa ứng dụng com.mycompany.shop thành công!"
}
```

---

## 6. Quản lý Khóa API (API Keys Management)

*Yêu cầu Header `Authorization: Bearer <token>`.*

### 6.1. Danh sách API Keys của 1 App (`GET /api/apps/:appId/api-keys`)
- **Path Parameter:** `appId`.
- **Response `200 OK`:**
```json
{
  "keys": [
    {
      "id": "key_uuid_xxxx",
      "app_id": "com.otademoapp",
      "name": "Mobile App Pull Key",
      "key_prefix": "ota_pull_live_",
      "key_type": "pull",
      "is_active": true,
      "created_at": "2026-10-13T03:00:00.000Z",
      "expires_at": null
    }
  ]
}
```

---

### 6.2. Tạo API Key mới (`POST /api/apps/:appId/api-keys`)
- **Request Body (`JSON`):**
```json
{
  "name": "CI/CD GitHub Action Key",
  "keyType": "push",
  "expiresInDays": 90
}
```
*Các giá trị `keyType`: `pull` (chỉ đọc), `push` (chỉ phát hành), `full` (toàn quyền).*

- **Response `200 OK`:** *(Lưu ý: `fullKey` chỉ trả về **1 lần duy nhất** khi tạo để người dùng lưu lại an toàn)*
```json
{
  "ok": true,
  "apiKey": {
    "id": "key_uuid_yyyy",
    "app_id": "com.otademoapp",
    "name": "CI/CD GitHub Action Key",
    "key_prefix": "ota_push_live_",
    "key_type": "push",
    "expires_at": "2027-01-11T09:00:00.000Z",
    "fullKey": "ota_push_live_a1b2c3d4e5f678901234567890abcdef"
  }
}
```

---

### 6.3. Thu hồi / Xóa API Key (`DELETE /api/apps/:appId/api-keys/:keyId`)
- **Path Parameters:** `appId`, `keyId`.
- **Response `200 OK`:**
```json
{
  "ok": true,
  "message": "Đã thu hồi API Key thành công!"
}
```

---

## 7. Dashboard Console & Điều khiển Release (Release & Rollback)

*Yêu cầu Header `Authorization: Bearer <token>`.*

### 7.1. Lấy thông tin tổng quan Dashboard (`GET /api/overview?appId=...`)
- **Query Parameter:** `appId` (tùy chọn, mặc định lấy app đầu tiên user có quyền).
- **Response `200 OK`:**
```json
{
  "appId": "com.otademoapp",
  "appsCount": 2,
  "activeVersions": {
    "android": { "latest": "1.0.3" },
    "ios": { "latest": "1.1.1" }
  },
  "totalAndroidReleases": 3,
  "totalIosReleases": 4,
  "totalStorageUsed": "4.8 MB",
  "globalStorageUsed": "9.6 MB",
  "globalReleasesCount": 7,
  "backupsCount": 12,
  "recentBackups": []
}
```

---

### 7.2. Lấy danh sách Releases theo nền tảng (`GET /api/releases/:platform?appId=...`)
- **Path Parameter:** `platform` (`android` hoặc `ios`).
- **Query Parameter:** `appId`.
- **Response `200 OK`:**
```json
{
  "appId": "com.otademoapp",
  "platform": "ios",
  "latestVersion": "1.1.1",
  "releases": [
    {
      "version": "1.1.1",
      "isLatest": true,
      "size": 1224297,
      "sizeFormatted": "1.2 MB",
      "manifest": {
        "otaVersion": "1.1.1",
        "releaseNotes": "Fix lỗi hiển thị tiến độ tải phần trăm trên iOS",
        "createdAt": "2026-10-13T09:22:00.000Z"
      }
    },
    {
      "version": "1.1.0",
      "isLatest": false,
      "size": 1224236,
      "sizeFormatted": "1.2 MB",
      "manifest": {
        "otaVersion": "1.1.0",
        "releaseNotes": "Bản chuẩn có kèm test ảnh",
        "createdAt": "2026-10-13T08:55:00.000Z"
      }
    }
  ]
}
```

---

### 7.3. Đổi phiên bản Active / Rollback (`POST /api/set-active`)
- **Mục đích:** Chuyển phiên bản mới nhất đang phục vụ cho user về bản cũ (Rollback) hoặc chọn phiên bản cụ thể làm Active.
- **Request Body (`JSON`):**
```json
{
  "appId": "com.otademoapp",
  "platform": "ios",
  "version": "1.1.0"
}
```
- **Response `200 OK`:**
```json
{
  "ok": true,
  "appId": "com.otademoapp",
  "platform": "ios",
  "previousLatest": "1.1.1",
  "currentLatest": "1.1.0",
  "message": "Đã chuyển đổi active version cho com.otademoapp (ios) sang v1.1.0 thành công!"
}
```

---

### 7.4. Xóa một bản phát hành (`DELETE /api/releases`)
- **Mục đích:** Xóa hẳn 1 bản release khỏi server (Lưu ý: Không thể xóa bản đang là Active/Latest).
- **Request Body (`JSON`):**
```json
{
  "appId": "com.otademoapp",
  "platform": "ios",
  "version": "1.0.9"
}
```
- **Response `200 OK`:**
```json
{
  "ok": true,
  "appId": "com.otademoapp",
  "message": "Đã xoá release ios v1.0.9 của app com.otademoapp"
}
```

---

## 8. Sao lưu & Phục hồi Cấu hình (Backups & Snapshots)

*Yêu cầu Header `Authorization: Bearer <token>`.*

### 8.1. Danh sách file snapshot sao lưu (`GET /api/backups?appId=...`)
- **Query Parameter:** `appId` (tùy chọn).
- **Response `200 OK`:**
```json
{
  "backups": [
    {
      "filename": "backup-com.otademoapp-auto-publish-ios-1.1.1-2026-10-13T09-22-00-000Z.json",
      "createdAt": "2026-10-13T09:22:00.000Z",
      "tag": "auto-publish-ios-1.1.1",
      "appId": "com.otademoapp",
      "sizeFormatted": "1.4 KB"
    }
  ]
}
```

---

### 8.2. Tạo bản sao lưu thủ công (`POST /api/backups/create`)
- **Request Body (`JSON`):**
```json
{
  "appId": "com.otademoapp",
  "tag": "truoc-khi-nang-cap-lon"
}
```
- **Response `200 OK`:**
```json
{
  "ok": true,
  "filename": "backup-com.otademoapp-truoc-khi-nang-cap-lon-2026-10-13T09-30-00-000Z.json",
  "snapshot": { ... }
}
```

---

### 8.3. Khôi phục từ file sao lưu (`POST /api/backups/restore/:filename`)
- **Path Parameter:** `filename` (Tên file backup cần phục hồi).
- **Response `200 OK`:**
```json
{
  "ok": true,
  "message": "Đã phục hồi cấu hình versions thành công từ backup-xxxx.json!"
}
```

---

## 9. Bảng Mã Lỗi Chuẩn (Error Codes Reference)

| HTTP Status | Mã lỗi (`code`) | Ý nghĩa & Khắc phục |
| :--- | :--- | :--- |
| `400` | - | Sai tham số bắt buộc (`manifest version mismatch`, `invalid platform`,...) |
| `401` | `API_KEY_REQUIRED` | Thiếu header `X-OTA-API-KEY` khi gọi `/ota/check` |
| `401` | `UNAUTHORIZED` | Không có quyền phát hành (Push Key không hợp lệ) |
| `401` | `AUTH_REQUIRED` | Chưa đăng nhập Dashboard (thiếu Bearer token) |
| `401` | `INVALID_SESSION` | Phiên đăng nhập Dashboard đã hết hạn |
| `403` | `INVALID_API_KEY` | API Key không tồn tại hoặc đã bị tắt (`is_active = false`) |
| `403` | `EXPIRED_API_KEY` | API Key đã quá hạn sử dụng (`expires_at`) |
| `403` | `FORBIDDEN_APP_MISMATCH` | API Key thuộc app khác, không được dùng cho app này |
| `403` | `INSUFFICIENT_SCOPE` | Dùng Pull Key để Push, hoặc Push Key để Pull |
| `404` | - | Không tìm thấy Release / Manifest / Backup file |
| `500` | - | Lỗi máy chủ nội bộ hoặc lỗi kết nối Supabase/R2 |
