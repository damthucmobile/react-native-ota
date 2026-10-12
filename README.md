# Custom OTA React Native Demo

Hệ thống OTA tự host hoàn chỉnh cho React Native (hỗ trợ cả **Android** và **iOS**):

- **Server (`server/`)**: Node.js Express lưu trữ và quản lý release, checksum SHA-256, API check update.
- **Client App (`OtaDemoApp/`)**: Ứng dụng React Native đã tích hợp sẵn Native Bundle Resolver, Native Unzip, Quản lý trạng thái và Cơ chế tự phục hồi (Startup Rollback).
- **Bộ công cụ phát hành (`OtaDemoApp/ota/`)**: Script 1 chạm tự động đóng gói qua Metro và đẩy lên server trong 1~2 giây.

---

## 📁 Cấu trúc dự án gọn gàng

```text
custom-ota-rn-demo/
├── react-native-custom-ota/    # 📦 Thư viện NPM độc lập (dùng cho nhiều dự án khác như CodePush)
│   ├── android/                # Native Android Module + Package + Resolver
│   ├── ios/                    # Native iOS Module + Podspec + Resolver
│   ├── src/                    # API: CustomOTA.sync(), withCustomOTA(App), rollback
│   ├── bin/                    # CLI tool: npx custom-ota release
│   └── README.md
│
├── server/                     # 🌐 OTA Server backend & Web Dashboard (Port 4500)
│   ├── src/server.js
│   ├── public/                 # Web Dashboard Console
│   └── releases/               # Thư mục lưu các gói update.zip và manifest
│
└── OtaDemoApp/                 # 📱 Ứng dụng React Native mẫu hoàn chỉnh
    ├── android/
    ├── ios/
    ├── App.tsx
    └── package.json
```

---

## 🚀 Hướng dẫn nhanh

### 1. Khởi động OTA Server & Web Dashboard
```bash
cd server
npm install
npm start
```
- **Web Dashboard quản lý Version & Rollback:** [http://localhost:4500](http://localhost:4500)
- **API Health:** `http://localhost:4500/health`

---

### 2. Chạy ứng dụng React Native

- **Android (Emulator / Máy thật)**:
  ```bash
  cd OtaDemoApp
  yarn android
  ```

- **iOS (Simulator / Máy thật)**:
  ```bash
  cd OtaDemoApp
  yarn ios
  ```

---

### 3. Phát hành bản cập nhật OTA mới (Chỉ 1 lệnh)

Tại thư mục `OtaDemoApp`:

- **Cho iOS**:
  ```bash
  yarn ota ios 1.0.3 "Ghi chú cập nhật"
  ```

- **Cho Android**:
  ```bash
  yarn ota android 1.0.3 "Ghi chú cập nhật"
  ```

- **Đồng thời cả iOS & Android**:
  ```bash
  yarn ota all 1.0.3 "Bản cập nhật đồng bộ 2 nền tảng"
  ```

---

### 4. Kiểm tra cập nhật trên ứng dụng

1. Mở ứng dụng `OtaDemoApp`.
2. Bấm nút **⚡ Kiểm tra & Cập nhật OTA**.
3. Chờ tiến trình tải 100% $\to$ Bấm **Khởi động lại ngay**.
4. Ứng dụng sẽ nạp ngay phiên bản mới mà không cần build lại APK / IPA!

---

### 5. Cơ chế Rollback khi có sự cố
Nếu bản OTA mới xảy ra lỗi crash ở tầng JS trước khi gọi `markReady()`:
- Ở lần mở tiếp theo, Native Resolver sẽ phát hiện cờ `pending == true`.
- Native code tự động xóa bản OTA lỗi và khôi phục bản backup trước đó để người dùng không bị kẹt hay văng ứng dụng.
