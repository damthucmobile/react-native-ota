"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
const manager_1 = require("./manager");
const hoc_1 = require("./hoc");
const ProgressModal_1 = require("./ProgressModal");
const useCustomOTA_1 = require("./useCustomOTA");
const assetResolver_1 = require("./assetResolver");
__exportStar(require("./types"), exports);
__exportStar(require("./manager"), exports);
__exportStar(require("./hoc"), exports);
__exportStar(require("./storage"), exports);
__exportStar(require("./ProgressModal"), exports);
__exportStar(require("./useCustomOTA"), exports);
__exportStar(require("./downloader"), exports);
__exportStar(require("./assetResolver"), exports);
// Tự động kích hoạt cơ chế bảo vệ và nạp tài nguyên hình ảnh an toàn
(0, assetResolver_1.setupAssetResolver)();
const CustomOTA = {
    sync: manager_1.CustomOTAManager.sync.bind(manager_1.CustomOTAManager),
    checkForUpdate: manager_1.CustomOTAManager.checkForUpdate.bind(manager_1.CustomOTAManager),
    downloadAndInstall: manager_1.CustomOTAManager.downloadAndInstall.bind(manager_1.CustomOTAManager),
    restartApp: manager_1.CustomOTAManager.restartApp.bind(manager_1.CustomOTAManager),
    getUpdateMetadata: manager_1.CustomOTAManager.getUpdateMetadata.bind(manager_1.CustomOTAManager),
    markReady: manager_1.CustomOTAManager.markReady.bind(manager_1.CustomOTAManager),
    notifyAppReady: manager_1.CustomOTAManager.notifyAppReady.bind(manager_1.CustomOTAManager),
    addProgressListener: manager_1.CustomOTAManager.addProgressListener.bind(manager_1.CustomOTAManager),
    addDetailedStatusListener: manager_1.CustomOTAManager.addDetailedStatusListener.bind(manager_1.CustomOTAManager),
    wrap: hoc_1.withCustomOTA,
    ProgressModal: ProgressModal_1.OTAProgressModal,
    useCustomOTA: useCustomOTA_1.useCustomOTA
};
exports.default = CustomOTA;
