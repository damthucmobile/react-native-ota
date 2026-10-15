# react-native-custom-ota ⚡

Thư viện cập nhật ứng dụng từ xa qua mạng (Over-The-Air - OTA) tự host dành cho React Native, hoạt động tương tự như **`react-native-code-push`**, hỗ trợ đầy đủ New Architecture (Fabric/TurboModules), mã băm SHA-256 toàn vẹn, cơ chế **Target Binary Version** chuẩn xác và **Tự phục hồi (Startup Rollback)** khi bản cập nhật bị crash.

---

## 🌟 Tính năng nổi bật

- 🔄 **Đồng bộ 1 chạm (CodePush-like API)**: Hỗ trợ `CustomOTA.sync()` và HOC `CustomOTA.wrap(App)`.
- ⚡ **Cập nhật vi sai (Differential Patch Update)**: Tự động phát hiện và sinh bản vá vi sai giữa 2 phiên bản bằng thuật toán `OTAPATCH` nén Zlib. **Giảm dung lượng tải từ ~64MB xuống chỉ còn 100KB - 500KB (tiết kiệm 95% - 99% băng thông)**. Tự động kiểm tra mã băm SHA-256 và fallback về full bundle nếu cần.
- 📶 **Tải phân đoạn & Tiếp tục khi mất mạng (Chunked & Resumable Download)**: Chia nhỏ file tải thành từng đoạn 4MB qua HTTP `Range`. Nếu mạng chập chờn hoặc rớt kết nối, ứng dụng tự động tiếp tục tải từ phân đoạn dang dở mà **không phải tải lại từ đầu**.
- 🚀 **Khởi động lại & Thay thế code mới tức thì (Immediate Replacement)**: Tự động khởi động lại và nạp code mới ngay lập tức trên cả **Android** (tự động kill process và restart Activity để giải phóng singleton `ReactHost`) và **iOS** mà người dùng không cần phải vuốt tắt app.
- 🎯 **Target Binary Version (Chuẩn CodePush)**: Chỉ định dải phiên bản Native tương thích (vd: `3.9.x`, `~3.9.0`, `3.9.0 - 3.9.99`). Tuyệt đối không gây downgrade khi bản Native cao hơn bản OTA.
- 🧹 **Tự động dọn dẹp Cache khi App cập nhật từ Store**: Khi người dùng nâng cấp app qua Google Play / App Store (vd: `3.09` lên `3.10`), Native Resolver sẽ tự động phát hiện và dọn sạch toàn bộ bundle OTA cũ còn sót lại để app nạp bundle gốc mới nhất từ file APK/IPA.
- 📊 **Theo dõi tiến độ tải thời gian thực**: Cung cấp component `<OTAProgressModal />`, Hook `useCustomOTA()`, hiển thị chi tiết % và dung lượng byte (`received / total`).
- 🛡️ **Cơ chế Rollback an toàn 2-Stage Boot**: Nếu bản cập nhật bị crash ở tầng JS trước khi gọi `markReady()`, Native Resolver sẽ tự động phát hiện ở lần khởi động kế tiếp và khôi phục về bản backup ổn định trước đó.
- 📦 **Tích hợp Native cực kỳ đơn giản**: Chỉ cần thêm 1 dòng code ở Android và iOS (Hỗ trợ React Native Autolinking).
- 🛠️ **Tích hợp CLI phát hành nhanh**: `npx custom-ota release` tự động tạo bundle, sinh patch vi sai, đóng gói và upload lên server chỉ trong tích tắc.
- 🚀 **Tương thích cả Old Architecture & New Architecture** (React Native 0.70+ đến 0.87+).

---

## 📦 Cài đặt

Trong dự án React Native của bạn:

```bash
# Cài đặt qua Yarn
yarn add react-native-custom-ota react-native-fs

# Hoặc qua NPM
npm install react-native-custom-ota react-native-fs
```

Đối với **iOS**, cài đặt CocoaPods:
```bash
cd ios && pod install && cd ..
```

---

## ⚙️ Cấu hình Native (Android & iOS)

### 1. Android
Mở file `android/app/src/main/java/.../MainApplication.kt` (hoặc `MainApplication.java`):

#### Cách 1: React Native 0.73 - 0.75 (DefaultReactNativeHost kết hợp DefaultReactHost / New Arch Hybrid)
Bổ sung `getJSBundleFile()` và tùy chỉnh `getUseDeveloperSupport()` bên trong `DefaultReactNativeHost`:

```kotlin
import com.customota.CustomOTABundleResolver // <-- 1. Import OTA Resolver

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Thêm các package thủ công nếu có
            }

        override fun getJSMainModuleName(): String = "index"

        // <-- 2. Ưu tiên nạp bundle OTA nếu có
        override fun getJSBundleFile(): String? {
          return CustomOTABundleResolver.getBundleFile(applicationContext) ?: super.getJSBundleFile()
        }

        // <-- 3. Nếu có bundle OTA thì tắt dev support để load OTA thay vì lấy từ Metro
        override fun getUseDeveloperSupport(): Boolean =
            CustomOTABundleResolver.getBundleFile(applicationContext) == null && BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(applicationContext, reactNativeHost)

  // ...
}
```

#### Cách 2: React Native 0.76+ (New Architecture thuần)
```kotlin
import com.customota.CustomOTABundleResolver

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    val otaBundle = CustomOTABundleResolver.getBundleFile(applicationContext)

    getDefaultReactHost(
      context = applicationContext,
      packageList = PackageList(this).packages,
      jsBundleFilePath = otaBundle, // <-- Thêm dòng này
      useDevSupport = otaBundle == null && BuildConfig.DEBUG
    )
  }
}
```

> [!TIP]
> **Cơ chế tự động xóa Cache khi cập nhật Store**: `CustomOTABundleResolver.getBundleFile(context)` sẽ tự động lấy `versionName` hiện tại của APK so sánh với phiên bản Native lúc cài đặt OTA. Nếu app vừa được update từ Google Play lên bản mới hơn, thư mục OTA cũ sẽ tự động được dọn sạch và nạp bundle gốc từ APK!

---

### 2. iOS
Mở file `ios/.../AppDelegate.swift` (hoặc `AppDelegate.mm`):

```swift
import RNCustomOTA

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func bundleURL() -> URL? {
    // 1. Kiểm tra bản OTA trước tiên (tự động xóa cache cũ nếu app vừa update từ App Store):
    if let otaURL = CustomOTABundleResolver.currentBundleURL() {
      return otaURL
    }

    // 2. Mặc định fallback về bundle gốc:
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
```

---

## 🎯 Cơ chế Target Binary Version (Tương thích phiên bản Native)

### Vấn đề:
Khi bạn phát hành bản app Native **3.10** lên Store, nếu trên server OTA vẫn còn bản vá cũ **3.09.11**, các máy 3.10 không được phép tải bản 3.09.11 về đè lên (tránh làm mất tính năng mới).

### Cách giải quyết:
1. **Target Binary Range**: Khi phát hành OTA, bạn chỉ định bản OTA này chỉ dành cho dải phiên bản nào (ví dụ: `-b "3.9.x"`). Các máy `3.10` gọi lên server sẽ nhận được phản hồi không có bản cập nhật.
2. **Chặn Downgrade**: Cả Server và Mobile SDK đều tích hợp sẵn logic semver: Nếu `nativeVersion >= otaVersion`, hệ thống sẽ tự động hủy cập nhật.
3. **Các định dạng Target Binary được hỗ trợ**:
   - `3.9.x` hoặc `3.9.*`: Áp dụng cho mọi bản native `3.9.0`, `3.9.1`, `3.9.2`...
   - `3.9.0 - 3.9.99`: Dải phiên bản từ 3.9.0 đến 3.9.99.
   - `~3.9.0`: Tương đương `[3.9.0, 3.10.0)`.
   - `^3.9.0`: Tương đương `[3.9.0, 4.0.0)`.
   - `*`: Áp dụng cho tất cả các phiên bản native.
   - `3.9.0`: Khớp chính xác phiên bản 3.9.0.

---

## 🚀 Cách sử dụng phía React Native (JS / TS)

> [!NOTE]
> **Bảo mật API Key**: Khi server bật xác thực bảo mật, bạn cần truyền `apiKey` (loại **Pull Key**, bắt đầu bằng `ota_pull_live_...`). Nếu không có key hợp lệ, server sẽ từ chối với mã lỗi `API_KEY_REQUIRED` (HTTP 401).

### Cách 1: Sử dụng HOC (Tương tự CodePush - Khuyên dùng)

Bọc component gốc `App` bằng HOC `CustomOTA.wrap`:

```tsx
import React from "react";
import { View, Text } from "react-native";
import CustomOTA, { CheckFrequency } from "react-native-custom-ota";

function App() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Ứng dụng của tôi</Text>
    </View>
  );
}

export default CustomOTA.wrap({
  serverUrl: "http://my-ota-server.com:4500",
  apiKey: "ota_pull_live_xxxx", // API Key có quyền Pull để tải bản cập nhật
  appId: "com.otademoapp",      // Định danh ứng dụng (tuỳ chọn)
  nativeVersion: "3.10.0",      // Phiên bản Native hiện tại của App
  checkFrequency: CheckFrequency.ON_APP_RESUME, // Tự động check khi mở app hoặc resume
  updateDialog: true,           // Tự động hiện popup hỏi người dùng khi có bản mới
  showProgressModal: true,      // Hiển thị modal tiến độ tải % và byte
})(App);
```

---

### Cách 2: Gọi `CustomOTA.sync()` linh hoạt

Tự gọi đồng bộ bất cứ lúc nào (ví dụ trong `useEffect` hoặc khi người dùng bấm nút):

```tsx
import CustomOTA, { SyncStatus } from "react-native-custom-ota";

CustomOTA.sync({
  serverUrl: "http://my-ota-server.com:4500",
  apiKey: "ota_pull_live_xxxx", // Pull API Key
  appId: "com.otademoapp",
  nativeVersion: "3.10.0",      // Phiên bản native hiện tại
  updateDialog: {
    title: "Có bản cập nhật mới!",
    optionalUpdateMessage: "Bạn có muốn cài đặt ngay bây giờ?",
    optionalInstallButtonLabel: "Cài đặt ngay",
    optionalIgnoreButtonLabel: "Để sau",
    showProgressModal: true
  }
}, (status) => {
  switch (status) {
    case SyncStatus.CHECKING_FOR_UPDATE:
      console.log("Đang kiểm tra cập nhật...");
      break;
    case SyncStatus.DOWNLOADING_PACKAGE:
      console.log("Đang tải bản cập nhật...");
      break;
    case SyncStatus.UPDATE_INSTALLED:
      console.log("Đã cài xong!");
      break;
    case SyncStatus.UP_TO_DATE:
      console.log("Ứng dụng đang ở bản mới nhất");
      break;
  }
}, (progress) => {
  console.log(`Tiến độ: ${progress.percentage}% (${progress.receivedBytes}/${progress.totalBytes} bytes)`);
});
```

---

### Cách 3: Điều khiển thủ công từng bước

```tsx
import CustomOTA from "react-native-custom-ota";

async function manualCheck() {
  // 1. Kiểm tra update
  const update = await CustomOTA.checkForUpdate({
    serverUrl: "http://my-ota-server.com:4500",
    apiKey: "ota_pull_live_xxxx",
    appId: "com.otademoapp",
    nativeVersion: "3.10.0",
    channel: "production"
  });

  if (update && update.updateAvailable) {
    // 2. Tải và cài đặt
    await CustomOTA.downloadAndInstall(update, (progress) => {
      console.log(`Tiến độ: ${progress.percentage}%`);
    });

    // 3. Khởi động lại ứng dụng để áp dụng ngay
    await CustomOTA.restartApp();
  }
}
```

---

## ⚡ Cập nhật vi sai (Differential Patch Update) & Tải phân đoạn (Chunked Resumable Download)

### 1. Cơ chế Cập nhật vi sai (Differential Patch Update)
- **Vấn đề**: Thông thường mỗi lần bạn sửa một vài dòng code JS, gói cập nhật bundle vẫn nặng từ **~50MB đến ~70MB**, gây tốn băng thông CDN và thời gian tải lâu trên mạng 4G/5G.
- **Giải pháp**: `react-native-custom-ota` tích hợp thuật toán sinh và ghép bản vá vi sai `OTAPATCH` (kết hợp block-matching và nén Zlib/Deflate).
  - Khi bạn chạy lệnh `npx custom-ota release`, CLI tự so sánh bundle mới với bundle đã phát hành trước đó (lưu tại `.ota_cache/<appId>/<platform>/`).
  - File patch sinh ra chỉ chứa các byte khác biệt, **giảm dung lượng tải từ ~64MB xuống chỉ còn 100KB - 500KB (tiết kiệm ~95% đến 99% băng thông mạng)**.
  - Phía Mobile App: Module Native (`OTAUpdaterModule.kt` trên Android và `OTAUpdater.swift` trên iOS) tự động stream và ghép patch vào bundle hiện tại trong vài mili-giây.
  - **Cơ chế Fallback an toàn**: Sau khi ghép, hệ thống luôn kiểm tra mã băm SHA-256 của file đích. Nếu file patch bị lỗi mạng hoặc SHA-256 không khớp, SDK tự động chuyển sang tải full bundle zip mà không gây gián đoạn hay crash app.

### 2. Cơ chế Tải phân đoạn tiếp tục (Chunked & Resumable Download)
- Toàn bộ các lượt tải (cả gói đầy đủ lẫn bản vá vi sai) được chia nhỏ thành các phân đoạn **4MB** thông qua HTTP Header `Range: bytes=start-end`.
- Các phân đoạn tải về được lưu thành các file tạm `.part`.
- **Khôi phục khi rớt mạng**: Nếu kết nối mạng bị chập chờn hoặc rớt giữa chừng, lần tiếp theo app mở lên hoặc gọi lại `sync()`, SDK sẽ kiểm tra các chunk đã hoàn thành và **tiếp tục tải từ phân đoạn dang dở, tuyệt đối không tải lại từ 0%**.

### 3. Khởi động lại & Thay thế code mới tức thì trên Android (Process Kill)
- Với **React Native New Architecture** (Fabric/TurboModules), `DefaultReactHost` và `ReactNativeHost` là các singleton tĩnh nằm trong bộ nhớ RAM của tiến trình Linux.
- Hàm `restartApp()` của thư viện đã được nâng cấp: Tự động khởi chạy Intent Activity mới với `FLAG_ACTIVITY_NEW_TASK | FLAG_ACTIVITY_CLEAR_TASK`, sau đó gọi ngay `Runtime.getRuntime().exit(0)`.
- Nhờ vậy, bộ nhớ RAM cũ được giải phóng hoàn toàn, khi mở lại app sẽ nạp ngay mã JS mới lập tức mà người dùng **không cần phải vuốt tắt app**.
- Hàm `CustomOTA.sync()` mặc định sử dụng `InstallMode.IMMEDIATE`.

---

## 🛠️ Công cụ CLI: Phát hành bản cập nhật mới

Sau khi sửa code trong dự án React Native, bạn dùng lệnh `npx custom-ota release` để phát hành.

CLI đã được tích hợp cơ chế **tự động nhận diện cấu hình thông minh từ file `.env` và dự án**:
- Tự động nạp file `.env` / `.env.local` ở thư mục dự án.
- **`-a`**: Tự động phát hiện App ID từ `build.gradle` / `app.json` / `.env`.
- **`-k`**: Tự động lấy API Key từ `OTA_API_KEY` trong `.env`.
- **`-s`**: Tự động lấy Server URL từ `OTA_SERVER` trong `.env` (mặc định: `http://localhost:4500`).
- **`-p`**: Mặc định là `all` (phát hành đồng thời cho cả Android & iOS).
- **`-b`**: Mặc định là `*` (áp dụng cho tất cả các phiên bản Native).

```bash
# 1. Phát hành SIÊU NGẮN GỌN (tự lấy appId, server, apiKey từ .env, build cho cả iOS & Android):
npx custom-ota release -v 3.09.15 -m "Sửa tiêu đề đăng nhập" -o

# 2. Phát hành kèm dải phiên bản Native cụ thể (vd: chỉ cho native 3.09.x):
npx custom-ota release -v 3.09.15 -b "3.09.x" -m "Vá lỗi nhánh 3.09" -o

# 3. Phát hành riêng lẻ cho một nền tảng (nếu không muốn dùng mặc định "all"):
npx custom-ota release -p android -v 3.09.15 -m "Bản vá Android" -o
```

### Bảng các cờ tùy chỉnh:
| Cờ | Tên dài | Ý nghĩa | Mặc định thông minh |
| :--- | :--- | :--- | :--- |
| `-v` | `--version` | Phiên bản OTA (**Bắt buộc**, ví dụ: `3.09.15`) | |
| `-m` | `--notes` | Ghi chú phát hành | `"OTA update"` |
| `-o` | `--bundle-only` | **Chỉ đóng gói JS Bundle (~1MB, bỏ qua assets tĩnh để siêu nhẹ)** | `false` |
| `-p` | `--platform` | Nền tảng: `android`, `ios`, `all` | **`all`** (Cả 2 nền tảng) |
| `-a` | `--app-id` | Mã định danh ứng dụng | **Tự đọc từ `build.gradle` / `app.json` / `.env`** |
| `-b` | `--target-binary` | Dải phiên bản Native áp dụng (vd: `"3.09.x"`, `"*"`)| **`*`** (Tất cả bản Native) |
| `-k` | `--api-key` | Push API Key | **Tự đọc `OTA_API_KEY` trong `.env`** |
| `-s` | `--server` | Địa chỉ OTA Server | **Tự đọc `OTA_SERVER` trong `.env`** (`http://localhost:4500`) |
| `-t` | `--token` | Admin secret token bypass | `demo-secret` |
| `--min-native` | `--minNativeVersion` | Phiên bản Native tối thiểu hỗ trợ | `1.0.0` |
| `--max-native` | `--maxNativeVersion` | Phiên bản Native tối đa hỗ trợ | `null` |

---

## ☁️ Kiến trúc Server: Cloudflare R2 & Supabase

Hệ thống OTA Server đi kèm được thiết kế tối ưu hóa cho môi trường Production:
1. **Lưu trữ CDN Cloudflare R2**: Toàn bộ gói bundle `update.zip` và các bản vá `patch.bin` được lưu trữ trực tiếp trên Cloudflare R2, tận dụng mạng lưới CDN toàn cầu miễn phí egress bandwidth. Server không cần lưu file zip 60MB trên ổ cứng cục bộ.
2. **Cơ sở dữ liệu Supabase (PostgreSQL)**:
   - Bảng `releases`: Quản lý lịch sử phát hành, trạng thái `is_active`, link CDN, dung lượng và hash SHA-256.
   - Bảng `api_keys`: Xác thực an toàn với quyền `pull` (cho Mobile App) và `push` (cho CI/CD).
   - Bảng `apps` & `app_members`: Hỗ trợ quản lý nhiều ứng dụng trên cùng một Web Dashboard.
3. **Web Dashboard quản trị trực quan**: Theo dõi danh sách phiên bản, chuyển đổi Active Version (Rollback 1 chạm) và xoá bản phát hành trực tiếp từ Supabase và Cloudflare R2.

---

## 📄 License
MIT
