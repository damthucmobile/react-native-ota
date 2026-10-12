"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomOTAManager = void 0;
const react_native_1 = require("react-native");
const react_native_fs_1 = __importDefault(require("react-native-fs"));
const native_1 = require("./native");
const storage_1 = require("./storage");
const types_1 = require("./types");
class CustomOTAManager {
    /**
     * Đánh dấu bản build OTA hiện tại đã khởi động thành công.
     * Xóa bản backup trước đó và tắt cờ pending.
     */
    static async markReady() {
        try {
            const state = await (0, storage_1.readState)();
            state.pending = false;
            state.ready = true;
            state.trial = false;
            await (0, storage_1.writeState)(state);
        }
        catch (e) {
            console.warn("[CustomOTA] Error updating state in markReady:", e);
        }
        if (native_1.OTAUpdater?.markReady) {
            try {
                await native_1.OTAUpdater.markReady();
            }
            catch (e) {
                console.warn("[CustomOTA] Error calling native markReady:", e);
            }
        }
    }
    /**
     * Khởi động lại ứng dụng để nạp ngay bản OTA mới.
     */
    static async restartApp() {
        if (native_1.OTAUpdater?.restart) {
            await native_1.OTAUpdater.restart();
        }
    }
    /**
     * Lấy thông tin phiên bản OTA hiện hành trên máy.
     */
    static async getUpdateMetadata() {
        return (0, storage_1.readState)();
    }
    /**
     * Kiểm tra xem server có bản cập nhật mới hay không.
     */
    static async checkForUpdate(options) {
        await (0, storage_1.ensureOTADirs)();
        const state = await (0, storage_1.readState)();
        const platform = react_native_1.Platform.OS === "ios" ? "ios" : "android";
        const nativeVersion = options.nativeVersion || "1.0.0";
        const channel = options.channel || "production";
        const params = new URLSearchParams({
            platform,
            nativeVersion,
            otaVersion: state.currentVersion,
            channel
        });
        if (options.appId) {
            params.append("appId", options.appId);
        }
        const response = await fetch(`${options.serverUrl.replace(/\/$/, "")}/ota/check?${params}`);
        if (!response.ok) {
            throw new Error(`OTA Check failed: HTTP ${response.status}`);
        }
        const rawData = await response.json();
        if (!rawData.updateAvailable) {
            return null;
        }
        const targetVersion = rawData.otaVersion || rawData.version;
        // Không báo cập nhật nếu phiên bản đã được cài đặt trên máy
        if (targetVersion && state.currentVersion === targetVersion) {
            return null;
        }
        // Không báo cập nhật nếu phiên bản này từng bị crash và tự rollback
        if (targetVersion && state.failedVersions?.includes(targetVersion)) {
            return null;
        }
        const serverUrlClean = options.serverUrl.replace(/\/$/, "");
        const rawUrl = rawData.downloadUrl || "";
        const fullDownloadUrl = rawUrl.startsWith("http")
            ? rawUrl
            : `${serverUrlClean}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
        const data = {
            ...rawData,
            updateAvailable: true,
            version: targetVersion,
            otaVersion: targetVersion,
            downloadUrl: fullDownloadUrl,
            mandatory: Boolean(rawData.mandatory || rawData.isMandatory),
            isMandatory: Boolean(rawData.mandatory || rawData.isMandatory)
        };
        return data;
    }
    /**
     * Tải và cài đặt bản cập nhật.
     */
    static async downloadAndInstall(update, onProgress, installMode) {
        const version = update.otaVersion || update.version;
        if (!update.downloadUrl || !version || !update.sha256) {
            const missingFields = [
                !update.downloadUrl && "downloadUrl",
                !version && "version",
                !update.sha256 && "sha256"
            ].filter(Boolean).join(", ");
            throw new Error(`Invalid update package metadata: missing ${missingFields}`);
        }
        const zipPath = `${storage_1.TEMP_DIR}/update-${version}.zip`;
        await react_native_fs_1.default.unlink(zipPath).catch(() => { });
        // Download zip file
        const downloadRes = react_native_fs_1.default.downloadFile({
            fromUrl: update.downloadUrl.startsWith("http") ? update.downloadUrl : `${update.downloadUrl}`,
            toFile: zipPath,
            progressDivider: 1,
            progress: ({ bytesWritten, contentLength }) => {
                if (contentLength > 0 && onProgress) {
                    onProgress(bytesWritten / contentLength);
                }
            }
        });
        const res = await downloadRes.promise;
        if (res.statusCode < 200 || res.statusCode >= 300) {
            throw new Error(`Download failed with status ${res.statusCode}`);
        }
        // SHA-256 verification
        const actualHash = await react_native_fs_1.default.hash(zipPath, "sha256");
        if (actualHash.toLowerCase() !== update.sha256.toLowerCase()) {
            await react_native_fs_1.default.unlink(zipPath).catch(() => { });
            throw new Error(`SHA-256 Checksum mismatch! Expected ${update.sha256}, got ${actualHash}`);
        }
        // Unpack temp directory
        const tempDir = `${storage_1.TEMP_DIR}/${version}`;
        await react_native_fs_1.default.unlink(tempDir).catch(() => { });
        await react_native_fs_1.default.mkdir(tempDir);
        await native_1.OTAUpdater.unzip(zipPath, tempDir);
        const bundleName = react_native_1.Platform.OS === "ios" ? "main.jsbundle" : "index.android.bundle";
        const bundleFile = `${tempDir}/${bundleName}`;
        if (!(await react_native_fs_1.default.exists(bundleFile))) {
            throw new Error(`Bundle missing after unzip: ${bundleName}`);
        }
        // Atomic move & backup
        await react_native_fs_1.default.unlink(storage_1.BACKUP_DIR).catch(() => { });
        if (await react_native_fs_1.default.exists(storage_1.CURRENT_DIR)) {
            await react_native_fs_1.default.moveFile(storage_1.CURRENT_DIR, storage_1.BACKUP_DIR);
        }
        await react_native_fs_1.default.moveFile(tempDir, storage_1.CURRENT_DIR);
        // Save state
        const oldState = await (0, storage_1.readState)();
        await (0, storage_1.writeState)({
            currentVersion: version,
            previousVersion: oldState.currentVersion !== "0.0.0" ? oldState.currentVersion : null,
            pending: true,
            ready: false,
            trial: false,
            failedVersions: oldState.failedVersions || []
        });
        await react_native_fs_1.default.unlink(zipPath).catch(() => { });
        if (installMode === types_1.InstallMode.IMMEDIATE) {
            await this.restartApp();
        }
        return true;
    }
    /**
     * Phương thức đồng bộ tự động như CodePush.sync()
     */
    static async sync(options, syncStatusCallback, downloadProgressCallback) {
        try {
            // 1. Tự động markReady khi khởi động
            await this.markReady();
            // 2. Kiểm tra update
            const update = await this.checkForUpdate({
                serverUrl: options.serverUrl,
                appId: options.appId,
                nativeVersion: options.nativeVersion,
                channel: options.channel
            });
            if (!update || !update.updateAvailable) {
                syncStatusCallback?.(types_1.SyncStatus.UP_TO_DATE);
                return types_1.SyncStatus.UP_TO_DATE;
            }
            syncStatusCallback?.(types_1.SyncStatus.UPDATE_AVAILABLE);
            const proceedWithInstall = async () => {
                syncStatusCallback?.(types_1.SyncStatus.DOWNLOADING_PACKAGE);
                const serverUrlClean = options.serverUrl.replace(/\/$/, "");
                const fullDownloadUrl = update.downloadUrl?.startsWith("http")
                    ? update.downloadUrl
                    : `${serverUrlClean}${update.downloadUrl}`;
                await this.downloadAndInstall({ ...update, downloadUrl: fullDownloadUrl }, downloadProgressCallback);
                syncStatusCallback?.(types_1.SyncStatus.INSTALLING_UPDATE);
                syncStatusCallback?.(types_1.SyncStatus.UPDATE_INSTALLED);
                const effectiveInstallMode = (update.mandatory && options.mandatoryInstallMode)
                    ? options.mandatoryInstallMode
                    : (options.installMode || types_1.InstallMode.ON_NEXT_RESTART);
                if (effectiveInstallMode === types_1.InstallMode.ON_NEXT_RESTART) {
                    return types_1.SyncStatus.UPDATE_INSTALLED;
                }
                // Restart immediate
                await this.restartApp();
                return types_1.SyncStatus.UPDATE_INSTALLED;
            };
            // 3. Nếu cấu hình hiển thị Update Dialog
            if (options.updateDialog) {
                const dialogOpts = typeof options.updateDialog === "object"
                    ? { ...this.defaultDialog, ...options.updateDialog }
                    : this.defaultDialog;
                const isMandatory = Boolean(update.mandatory);
                const message = isMandatory
                    ? `${dialogOpts.mandatoryUpdateMessage}\n\nPhiên bản: ${update.otaVersion}\n${update.releaseNotes || ""}`
                    : `${dialogOpts.optionalUpdateMessage}\n\nPhiên bản: ${update.otaVersion}\n${update.releaseNotes || ""}`;
                const buttons = [];
                if (!isMandatory) {
                    buttons.push({
                        text: dialogOpts.optionalIgnoreButtonLabel,
                        style: "cancel"
                    });
                }
                buttons.push({
                    text: dialogOpts.optionalInstallButtonLabel,
                    onPress: () => {
                        proceedWithInstall();
                    }
                });
                react_native_1.Alert.alert(dialogOpts.title || "Cập nhật ứng dụng", message, buttons, {
                    cancelable: !isMandatory
                });
                return types_1.SyncStatus.UPDATE_AVAILABLE;
            }
            // Tự động tải ngầm không hiện dialog
            return await proceedWithInstall();
        }
        catch (error) {
            console.error("[react-native-custom-ota] Sync error:", error);
            syncStatusCallback?.(types_1.SyncStatus.ERROR);
            return types_1.SyncStatus.ERROR;
        }
    }
}
exports.CustomOTAManager = CustomOTAManager;
CustomOTAManager.defaultDialog = {
    title: "Có bản cập nhật mới",
    optionalUpdateMessage: "Đã có bản cập nhật ứng dụng mới. Bạn có muốn cài đặt ngay bây giờ?",
    mandatoryUpdateMessage: "Đã có bản cập nhật bắt buộc. Vui lòng cài đặt để tiếp tục sử dụng.",
    optionalInstallButtonLabel: "Cập nhật",
    optionalIgnoreButtonLabel: "Để sau"
};
