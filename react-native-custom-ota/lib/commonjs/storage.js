"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEMP_DIR = exports.BACKUP_DIR = exports.CURRENT_DIR = exports.OTA_ROOT = void 0;
exports.ensureOTADirs = ensureOTADirs;
exports.readState = readState;
exports.writeState = writeState;
const react_native_fs_1 = __importDefault(require("react-native-fs"));
exports.OTA_ROOT = `${react_native_fs_1.default.DocumentDirectoryPath}/ota`;
exports.CURRENT_DIR = `${exports.OTA_ROOT}/current`;
exports.BACKUP_DIR = `${exports.OTA_ROOT}/backup`;
exports.TEMP_DIR = `${exports.OTA_ROOT}/temp`;
const STATE_FILE = `${exports.OTA_ROOT}/state.json`;
async function ensureOTADirs() {
    await react_native_fs_1.default.mkdir(exports.OTA_ROOT).catch(() => { });
    await react_native_fs_1.default.mkdir(exports.TEMP_DIR).catch(() => { });
}
async function readState() {
    await ensureOTADirs();
    if (!(await react_native_fs_1.default.exists(STATE_FILE))) {
        return {
            currentVersion: "0.0.0",
            previousVersion: null,
            nativeVersion: "0.0.0",
            pending: false,
            ready: true,
            failedVersions: []
        };
    }
    try {
        const content = await react_native_fs_1.default.readFile(STATE_FILE, "utf8");
        return JSON.parse(content);
    }
    catch {
        return {
            currentVersion: "0.0.0",
            previousVersion: null,
            nativeVersion: "0.0.0",
            pending: false,
            ready: true,
            failedVersions: []
        };
    }
}
async function writeState(state) {
    await ensureOTADirs();
    await react_native_fs_1.default.writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}
