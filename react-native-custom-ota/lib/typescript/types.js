"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstallMode = exports.CheckFrequency = exports.SyncStatus = void 0;
var SyncStatus;
(function (SyncStatus) {
    SyncStatus[SyncStatus["UP_TO_DATE"] = 0] = "UP_TO_DATE";
    SyncStatus[SyncStatus["UPDATE_AVAILABLE"] = 1] = "UPDATE_AVAILABLE";
    SyncStatus[SyncStatus["DOWNLOADING_PACKAGE"] = 2] = "DOWNLOADING_PACKAGE";
    SyncStatus[SyncStatus["INSTALLING_UPDATE"] = 3] = "INSTALLING_UPDATE";
    SyncStatus[SyncStatus["UPDATE_INSTALLED"] = 4] = "UPDATE_INSTALLED";
    SyncStatus[SyncStatus["ERROR"] = -1] = "ERROR";
})(SyncStatus || (exports.SyncStatus = SyncStatus = {}));
var CheckFrequency;
(function (CheckFrequency) {
    CheckFrequency["ON_APP_START"] = "ON_APP_START";
    CheckFrequency["ON_APP_RESUME"] = "ON_APP_RESUME";
    CheckFrequency["MANUAL"] = "MANUAL";
})(CheckFrequency || (exports.CheckFrequency = CheckFrequency = {}));
var InstallMode;
(function (InstallMode) {
    InstallMode["IMMEDIATE"] = "IMMEDIATE";
    InstallMode["ON_NEXT_RESTART"] = "ON_NEXT_RESTART";
})(InstallMode || (exports.InstallMode = InstallMode = {}));
