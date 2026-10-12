import { CustomOTAManager } from "./manager";
import { withCustomOTA } from "./hoc";
export * from "./types";
export * from "./manager";
export * from "./hoc";
export * from "./storage";
declare const CustomOTA: {
    sync: typeof CustomOTAManager.sync;
    checkForUpdate: typeof CustomOTAManager.checkForUpdate;
    downloadAndInstall: typeof CustomOTAManager.downloadAndInstall;
    restartApp: typeof CustomOTAManager.restartApp;
    getUpdateMetadata: typeof CustomOTAManager.getUpdateMetadata;
    markReady: typeof CustomOTAManager.markReady;
    wrap: typeof withCustomOTA;
};
export default CustomOTA;
