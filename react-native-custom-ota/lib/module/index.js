import { CustomOTAManager } from "./manager";
import { withCustomOTA } from "./hoc";
export * from "./types";
export * from "./manager";
export * from "./hoc";
export * from "./storage";
const CustomOTA = {
    sync: CustomOTAManager.sync.bind(CustomOTAManager),
    checkForUpdate: CustomOTAManager.checkForUpdate.bind(CustomOTAManager),
    downloadAndInstall: CustomOTAManager.downloadAndInstall.bind(CustomOTAManager),
    restartApp: CustomOTAManager.restartApp.bind(CustomOTAManager),
    getUpdateMetadata: CustomOTAManager.getUpdateMetadata.bind(CustomOTAManager),
    markReady: CustomOTAManager.markReady.bind(CustomOTAManager),
    wrap: withCustomOTA
};
export default CustomOTA;
