import { Alert, Platform } from "react-native";
import RNFS from "react-native-fs";
import { OTAUpdater } from "./native";
import { BACKUP_DIR, CURRENT_DIR, TEMP_DIR, ensureOTADirs, readState, writeState } from "./storage";
import { InstallMode, SyncStatus } from "./types";
export class CustomOTAManager {
    /**
     * Đánh dấu bản build OTA hiện tại đã khởi động thành công.
     * Xóa bản backup trước đó và tắt cờ pending.
     */
    static async markReady() {
        try {
            const state = await readState();
            state.pending = false;
            state.ready = true;
            state.trial = false;
            await writeState(state);
        }
        catch (e) {
            console.warn("[CustomOTA] Error updating state in markReady:", e);
        }
        if (OTAUpdater?.markReady) {
            try {
                await OTAUpdater.markReady();
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
        if (OTAUpdater?.restart) {
            await OTAUpdater.restart();
        }
    }
    /**
     * Lấy thông tin phiên bản OTA hiện hành trên máy.
     */
    static async getUpdateMetadata() {
        return readState();
    }
    /**
     * Kiểm tra xem server có bản cập nhật mới hay không.
     */
    static async checkForUpdate(options) {
        await ensureOTADirs();
        const state = await readState();
        const platform = Platform.OS === "ios" ? "ios" : "android";
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
        const zipPath = `${TEMP_DIR}/update-${version}.zip`;
        await RNFS.unlink(zipPath).catch(() => { });
        // Download zip file
        const downloadRes = RNFS.downloadFile({
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
        const actualHash = await RNFS.hash(zipPath, "sha256");
        if (actualHash.toLowerCase() !== update.sha256.toLowerCase()) {
            await RNFS.unlink(zipPath).catch(() => { });
            throw new Error(`SHA-256 Checksum mismatch! Expected ${update.sha256}, got ${actualHash}`);
        }
        // Unpack temp directory
        const tempDir = `${TEMP_DIR}/${version}`;
        await RNFS.unlink(tempDir).catch(() => { });
        await RNFS.mkdir(tempDir);
        await OTAUpdater.unzip(zipPath, tempDir);
        const bundleName = Platform.OS === "ios" ? "main.jsbundle" : "index.android.bundle";
        const bundleFile = `${tempDir}/${bundleName}`;
        if (!(await RNFS.exists(bundleFile))) {
            throw new Error(`Bundle missing after unzip: ${bundleName}`);
        }
        // Atomic move & backup
        await RNFS.unlink(BACKUP_DIR).catch(() => { });
        if (await RNFS.exists(CURRENT_DIR)) {
            await RNFS.moveFile(CURRENT_DIR, BACKUP_DIR);
        }
        await RNFS.moveFile(tempDir, CURRENT_DIR);
        // Save state
        const oldState = await readState();
        await writeState({
            currentVersion: version,
            previousVersion: oldState.currentVersion !== "0.0.0" ? oldState.currentVersion : null,
            pending: true,
            ready: false,
            trial: false,
            failedVersions: oldState.failedVersions || []
        });
        await RNFS.unlink(zipPath).catch(() => { });
        if (installMode === InstallMode.IMMEDIATE) {
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
                syncStatusCallback?.(SyncStatus.UP_TO_DATE);
                return SyncStatus.UP_TO_DATE;
            }
            syncStatusCallback?.(SyncStatus.UPDATE_AVAILABLE);
            const proceedWithInstall = async () => {
                syncStatusCallback?.(SyncStatus.DOWNLOADING_PACKAGE);
                const serverUrlClean = options.serverUrl.replace(/\/$/, "");
                const fullDownloadUrl = update.downloadUrl?.startsWith("http")
                    ? update.downloadUrl
                    : `${serverUrlClean}${update.downloadUrl}`;
                await this.downloadAndInstall({ ...update, downloadUrl: fullDownloadUrl }, downloadProgressCallback);
                syncStatusCallback?.(SyncStatus.INSTALLING_UPDATE);
                syncStatusCallback?.(SyncStatus.UPDATE_INSTALLED);
                const effectiveInstallMode = (update.mandatory && options.mandatoryInstallMode)
                    ? options.mandatoryInstallMode
                    : (options.installMode || InstallMode.ON_NEXT_RESTART);
                if (effectiveInstallMode === InstallMode.ON_NEXT_RESTART) {
                    return SyncStatus.UPDATE_INSTALLED;
                }
                // Restart immediate
                await this.restartApp();
                return SyncStatus.UPDATE_INSTALLED;
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
                Alert.alert(dialogOpts.title || "Cập nhật ứng dụng", message, buttons, {
                    cancelable: !isMandatory
                });
                return SyncStatus.UPDATE_AVAILABLE;
            }
            // Tự động tải ngầm không hiện dialog
            return await proceedWithInstall();
        }
        catch (error) {
            console.error("[react-native-custom-ota] Sync error:", error);
            syncStatusCallback?.(SyncStatus.ERROR);
            return SyncStatus.ERROR;
        }
    }
}
CustomOTAManager.defaultDialog = {
    title: "Có bản cập nhật mới",
    optionalUpdateMessage: "Đã có bản cập nhật ứng dụng mới. Bạn có muốn cài đặt ngay bây giờ?",
    mandatoryUpdateMessage: "Đã có bản cập nhật bắt buộc. Vui lòng cài đặt để tiếp tục sử dụng.",
    optionalInstallButtonLabel: "Cập nhật",
    optionalIgnoreButtonLabel: "Để sau"
};
