import { Image, Platform, NativeModules } from "react-native";

let getAndroidResourceIdentifier: ((asset: any) => string) | null = null;
try {
  getAndroidResourceIdentifier =
    require("@react-native/asset-utils")?.getAndroidResourceIdentifier;
} catch (e) {
  try {
    getAndroidResourceIdentifier =
      require("react-native/Libraries/Image/AssetSourceResolver")?.getAndroidResourceIdentifier;
  } catch (e2) {}
}

let localAssetsSet: Set<string> | null = null;
let isInitialized = false;

function getLocalAssets(): Set<string> {
  if (isInitialized && localAssetsSet !== null) {
    return localAssetsSet;
  }
  try {
    const list = NativeModules.OTAUpdater?.getLocalAssets?.();
    if (Array.isArray(list)) {
      localAssetsSet = new Set(list);
    } else {
      localAssetsSet = new Set();
    }
  } catch (e) {
    localAssetsSet = new Set();
  }
  isInitialized = true;
  return localAssetsSet;
}

let cachedMainBundleURL: string | null = null;
function getMainBundleURL(): string | null {
  if (cachedMainBundleURL !== null) {
    return cachedMainBundleURL;
  }
  try {
    const fromConst = NativeModules.OTAUpdater?.mainBundleURL;
    if (typeof fromConst === "string" && fromConst.length > 0) {
      cachedMainBundleURL = fromConst.endsWith("/") ? fromConst : fromConst + "/";
      return cachedMainBundleURL;
    }
    const fromMethod = NativeModules.OTAUpdater?.getMainBundleURL?.();
    if (typeof fromMethod === "string" && fromMethod.length > 0) {
      cachedMainBundleURL = fromMethod.endsWith("/") ? fromMethod : fromMethod + "/";
      return cachedMainBundleURL;
    }
  } catch (e) {}
  return null;
}

/**
 * Thiết lập bộ chuyển đổi phân giải Asset (hình ảnh, biểu tượng) cho React Native.
 * Khi ứng dụng chạy bundle từ bản cập nhật OTA (thư mục lưu trên máy):
 * - Nếu ảnh mới nằm trong gói OTA tải về -> Nạp từ thư mục bundle của OTA.
 * - Nếu ảnh không có trong gói OTA (vd: chế độ bundle-only siêu nhẹ ~1MB):
 *   + Trên Android: Tự động fallback về APK Resource (res/drawable) qua resourceIdentifierWithoutScale().
 *   + Trên iOS: Tự động fallback về main application bundle gốc ([NSBundle mainBundle]) qua mainBundleURL.
 * Ngăn chặn triệt để tình trạng MẤT ẢNH trên cả 2 nền tảng iOS & Android!
 */
export function setupAssetResolver(): void {
  let resolveAssetSource: any = (Image as any)?.resolveAssetSource;
  if (!resolveAssetSource) {
    try {
      resolveAssetSource = require("react-native/Libraries/Image/resolveAssetSource");
    } catch (e) {}
  }

  const setCustomSourceTransformer =
    resolveAssetSource?.setCustomSourceTransformer ||
    resolveAssetSource?.addCustomSourceTransformer;

  if (typeof setCustomSourceTransformer !== "function") {
    return;
  }

  setCustomSourceTransformer((resolver: any) => {
    // Nếu ứng dụng đang chạy ở chế độ Debug hoặc chưa nạp OTA (bundle mặc định trong APK / IPA):
    if (!resolver.isLoadedFromFileSystem || !resolver.isLoadedFromFileSystem()) {
      return resolver.defaultAsset();
    }

    const asset = resolver.asset;
    if (!asset) {
      return resolver.defaultAsset();
    }

    const localAssets = getLocalAssets();

    // 1. Xử lý trên Android
    if (Platform.OS === "android") {
      // 1.1. Nếu gói OTA có chứa file asset mới này:
      if (localAssets && localAssets.size > 0) {
        const resId = getAndroidResourceIdentifier
          ? getAndroidResourceIdentifier(asset)
          : asset.name;
        const targetFileName = `${resId}.${asset.type}`;
        const simpleFileName = `${asset.name}.${asset.type}`;

        let foundInOTA = false;
        for (const item of localAssets) {
          if (item.endsWith(targetFileName) || item.endsWith(simpleFileName)) {
            foundInOTA = true;
            break;
          }
        }

        if (foundInOTA) {
          return resolver.drawableFolderInBundle();
        }
      }

      // 1.2. Nếu file asset không có trong gói OTA (hoặc khi phát hành bản cập nhật bundle-only),
      // fallback về resourceIdentifierWithoutScale để Android nạp ảnh trực tiếp từ tài nguyên APK (res/drawable)!
      return resolver.resourceIdentifierWithoutScale();
    }

    // 2. Xử lý trên iOS
    if (Platform.OS === "ios") {
      const relSource = resolver.scaledAssetPath ? resolver.scaledAssetPath() : null;
      const relativeUri = (relSource?.uri || "").replace(/\.\.\//g, "_");

      // 2.1. Nếu gói OTA có chứa file asset mới này:
      if (localAssets && localAssets.size > 0 && relativeUri) {
        let foundInOTA = false;
        const simpleFileName = `${asset.name}.${asset.type}`;
        for (const item of localAssets) {
          if (item.endsWith(relativeUri) || item.endsWith(simpleFileName)) {
            foundInOTA = true;
            break;
          }
        }

        if (foundInOTA) {
          return resolver.scaledAssetURLNearBundle();
        }
      }

      // 2.2. Nếu file asset không có trong gói OTA (hoặc khi release bundle-only),
      // fallback nạp trực tiếp ảnh từ main app bundle gốc trong IPA!
      const mainBundleURL = getMainBundleURL();
      if (mainBundleURL && relativeUri) {
        const fullUri = mainBundleURL + relativeUri;
        if (typeof resolver.fromSource === "function") {
          return resolver.fromSource(fullUri);
        }
        return {
          ...relSource,
          uri: fullUri
        };
      }
    }

    return resolver.defaultAsset();
  });
}
