# react-native-custom-ota ⚡

Thư viện cập nhật ứng dụng từ xa qua mạng (Over-The-Air - OTA) tự host dành cho React Native, hoạt động tương tự như **`react-native-code-push`**, hỗ trợ đầy đủ New Architecture (Fabric/TurboModules), mã băm SHA-256 toàn vẹn và cơ chế **Tự phục hồi (Startup Rollback)** khi bản cập nhật bị crash.

---

## 🌟 Tính năng nổi bật

- 🔄 **Đồng bộ 1 chạm (CodePush-like API)**: Hỗ trợ `CustomOTA.sync()` và HOC `withCustomOTA(App)`.
- 🛡️ **Cơ chế Rollback an toàn**: Nếu bản cập nhật bị crash ở tầng JS trước khi boot thành công, Native Resolver sẽ tự động phát hiện và khôi phục về bản backup ổn định trước đó.
- 📦 **Tích hợp Native cực kỳ đơn giản**: Chỉ cần thêm 1 dòng code ở Android và 1 dòng ở iOS (Hỗ trợ React Native Autolinking).
- 🛠️ **Tích hợp CLI phát hành nhanh**: `npx custom-ota release` tự động chạy Metro, nén zip và upload lên server chỉ trong 1-2 giây.
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

## ⚙️ Cấu hình Native (Chỉ 1 dòng mỗi nền tảng)

### 1. Android
Mở file `android/app/src/main/java/.../MainApplication.kt` (hoặc `MainApplication.java`):

```kotlin
import com.customota.CustomOTABundleResolver

class MainApplication : Application(), ReactApplication {

  // New Architecture (RN 0.76+):
  override val reactHost: ReactHost by lazy {
    val otaBundle = CustomOTABundleResolver.getBundleFile(applicationContext)

    getDefaultReactHost(
      context = applicationContext,
      packageList = PackageList(this).packages,
      jsBundleFilePath = otaBundle, // <-- Thêm dòng này
      useDevSupport = otaBundle == null && BuildConfig.DEBUG
    )
  }

  // Hoặc với Old Architecture (ReactNativeHost):
  override fun getJSBundleFile(): String? {
    return CustomOTABundleResolver.getBundleFile(applicationContext) ?: super.getJSBundleFile()
  }
}
```

---

### 2. iOS
Mở file `ios/.../AppDelegate.swift` (hoặc `AppDelegate.mm`):

```swift
import RNCustomOTA

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func bundleURL() -> URL? {
    // 1. Kiểm tra bản OTA trước tiên:
    if let otaURL = CustomOTABundleResolver.currentBundleURL() {
      return otaURL
    }

    // 2. Mặc định fallback:
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
```

---

## 🚀 Cách sử dụng phía React Native (JS / TS)

### Cách 1: Sử dụng HOC (Tương tự CodePush - Khuyên dùng)

Bọc component gốc `App` bằng HOC `withCustomOTA`:

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
  checkFrequency: CheckFrequency.ON_APP_RESUME, // Tự động check khi mở app hoặc resume
  updateDialog: true, // Tự động hiện popup hỏi người dùng khi có bản mới
})(App);
```

---

### Cách 2: Gọi `CustomOTA.sync()` linh hoạt

Tự gọi đồng bộ bất cứ lúc nào (ví dụ trong `useEffect` hoặc khi người dùng bấm nút):

```tsx
import CustomOTA, { SyncStatus } from "react-native-custom-ota";

// Gọi đồng bộ tự động:
CustomOTA.sync({
  serverUrl: "http://my-ota-server.com:4500",
  updateDialog: {
    title: "Có bản cập nhật mới!",
    optionalUpdateMessage: "Bạn có muốn cài đặt ngay bây giờ?",
    optionalInstallButtonLabel: "Cài đặt ngay",
    optionalIgnoreButtonLabel: "Để sau"
  }
}, (status) => {
  switch (status) {
    case SyncStatus.DOWNLOADING_PACKAGE:
      console.log("Đang tải bản cập nhật...");
      break;
    case SyncStatus.UPDATE_INSTALLED:
      console.log("Đã cài xong!");
      break;
  }
}, (progress) => {
  console.log(`Tiến độ: ${Math.round(progress * 100)}%`);
});
```

---

### Cách 3: Điều khiển thủ công từng bước

```tsx
import CustomOTA from "react-native-custom-ota";

async function manualCheck() {
  // 1. Kiểm tra update
  const update = await CustomOTA.checkForUpdate({
    serverUrl: "http://my-ota-server.com:4500"
  });

  if (update.updateAvailable) {
    // 2. Tải và cài đặt
    await CustomOTA.downloadAndInstall(update, (progress) => {
      console.log("Progress:", progress);
    });

    // 3. Khởi động lại ứng dụng
    await CustomOTA.restartApp();
  }
}
```

---

## 🛠️ Công cụ CLI: Phát hành bản cập nhật mới

Sau khi sửa code trong dự án React Native, bạn có thể dùng CLI đi kèm thư viện:

```bash
# Phát hành cho iOS
npx custom-ota release -p ios -v 1.0.4 -m "Sửa lỗi font giao diện" -s http://localhost:4500

# Phát hành cho Android
npx custom-ota release -p android -v 1.0.4 -s http://localhost:4500

# Phát hành cùng lúc cả iOS và Android
npx custom-ota release -p all -v 1.0.4 -s http://localhost:4500
```

---

## 📄 License
MIT
