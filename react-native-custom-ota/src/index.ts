import { CustomOTAManager } from "./manager";
import { withCustomOTA } from "./hoc";
import { OTAProgressModal } from "./ProgressModal";
import { useCustomOTA } from "./useCustomOTA";
import { setupAssetResolver } from "./assetResolver";

export * from "./types";
export * from "./manager";
export * from "./hoc";
export * from "./storage";
export * from "./ProgressModal";
export * from "./useCustomOTA";
export * from "./downloader";
export * from "./assetResolver";

// Tự động kích hoạt cơ chế bảo vệ và nạp tài nguyên hình ảnh an toàn
setupAssetResolver();

const CustomOTA = {
  sync: CustomOTAManager.sync.bind(CustomOTAManager),
  checkForUpdate: CustomOTAManager.checkForUpdate.bind(CustomOTAManager),
  downloadAndInstall: CustomOTAManager.downloadAndInstall.bind(CustomOTAManager),
  restartApp: CustomOTAManager.restartApp.bind(CustomOTAManager),
  getUpdateMetadata: CustomOTAManager.getUpdateMetadata.bind(CustomOTAManager),
  markReady: CustomOTAManager.markReady.bind(CustomOTAManager),
  notifyAppReady: CustomOTAManager.notifyAppReady.bind(CustomOTAManager),
  addProgressListener: CustomOTAManager.addProgressListener.bind(CustomOTAManager),
  addDetailedStatusListener: CustomOTAManager.addDetailedStatusListener.bind(CustomOTAManager),
  wrap: withCustomOTA,
  ProgressModal: OTAProgressModal,
  useCustomOTA: useCustomOTA
};

export default CustomOTA;
