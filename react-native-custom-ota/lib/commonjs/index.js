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
__exportStar(require("./types"), exports);
__exportStar(require("./manager"), exports);
__exportStar(require("./hoc"), exports);
__exportStar(require("./storage"), exports);
const CustomOTA = {
    sync: manager_1.CustomOTAManager.sync.bind(manager_1.CustomOTAManager),
    checkForUpdate: manager_1.CustomOTAManager.checkForUpdate.bind(manager_1.CustomOTAManager),
    downloadAndInstall: manager_1.CustomOTAManager.downloadAndInstall.bind(manager_1.CustomOTAManager),
    restartApp: manager_1.CustomOTAManager.restartApp.bind(manager_1.CustomOTAManager),
    getUpdateMetadata: manager_1.CustomOTAManager.getUpdateMetadata.bind(manager_1.CustomOTAManager),
    markReady: manager_1.CustomOTAManager.markReady.bind(manager_1.CustomOTAManager),
    wrap: hoc_1.withCustomOTA
};
exports.default = CustomOTA;
