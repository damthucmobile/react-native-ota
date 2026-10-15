"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomOTAManager = void 0;
exports.compareSemver = compareSemver;
exports.matchesTargetBinaryVersion = matchesTargetBinaryVersion;
const react_native_1 = require("react-native");
const react_native_fs_1 = __importDefault(require("react-native-fs"));
const native_1 = require("./native");
const storage_1 = require("./storage");
const downloader_1 = require("./downloader");
const types_1 = require("./types");
function parseSemver(ver) {
    if (!ver)
        return [0, 0, 0];
    const cleaned = String(ver).trim().replace(/^[vV]/, "");
    const parts = cleaned.split(".").map(p => {
        const num = parseInt(p, 10);
        return isNaN(num) ? 0 : num;
    });
    while (parts.length < 3)
        parts.push(0);
    return parts.slice(0, 3);
}
function compareSemver(v1, v2) {
    const p1 = parseSemver(v1);
    const p2 = parseSemver(v2);
    for (let i = 0; i < 3; i++) {
        if (p1[i] > p2[i])
            return 1;
        if (p1[i] < p2[i])
            return -1;
    }
    return 0;
}
function matchesTargetBinaryVersion(nativeVersion, targetBinary, minNativeVersion, maxNativeVersion) {
    if (!nativeVersion)
        return false;
    // 1. Kiểm tra minNativeVersion và maxNativeVersion nếu có
    if (minNativeVersion && compareSemver(nativeVersion, minNativeVersion) < 0) {
        return false;
    }
    if (maxNativeVersion && compareSemver(nativeVersion, maxNativeVersion) > 0) {
        return false;
    }
    if (!targetBinary || targetBinary === "*" || targetBinary.trim() === "") {
        return true;
    }
    const target = targetBinary.trim();
    // 2. Wildcard dạng "3.9.*", "3.9.x", "3.09.*", "3.09.x"
    if (target.endsWith(".*") || target.endsWith(".x") || target.endsWith(".X")) {
        const prefix = target.slice(0, -2);
        const cleanNative = String(nativeVersion).trim().replace(/^[vV]/, "");
        if (cleanNative === prefix || cleanNative.startsWith(prefix + ".")) {
            return true;
        }
        const targetParts = prefix.split(".").map(Number);
        const nativeParts = cleanNative.split(".").map(Number);
        return targetParts.every((part, idx) => nativeParts[idx] === part);
    }
    // 3. Dải phiên bản "3.9.0 - 3.9.99"
    if (target.includes(" - ")) {
        const [minV, maxV] = target.split(" - ").map(s => s.trim());
        return compareSemver(nativeVersion, minV) >= 0 && compareSemver(nativeVersion, maxV) <= 0;
    }
    // 4. Tilde "~3.9.0" -> [3.9.0, 3.10.0)
    if (target.startsWith("~")) {
        const base = target.slice(1).trim();
        const p = parseSemver(base);
        const upper = `${p[0]}.${p[1] + 1}.0`;
        return compareSemver(nativeVersion, base) >= 0 && compareSemver(nativeVersion, upper) < 0;
    }
    // 5. Caret "^3.9.0" -> [3.9.0, 4.0.0)
    if (target.startsWith("^")) {
        const base = target.slice(1).trim();
        const p = parseSemver(base);
        const upper = `${p[0] + 1}.0.0`;
        return compareSemver(nativeVersion, base) >= 0 && compareSemver(nativeVersion, upper) < 0;
    }
    // 6. Phiên bản chính xác (Exact match)
    const exactTarget = target.replace(/^[=vV]/, "").trim();
    const exactNative = String(nativeVersion).trim().replace(/^[vV]/, "");
    return exactTarget === exactNative || compareSemver(nativeVersion, exactTarget) === 0;
}
class CustomOTAManager {
    /**
     * Đăng ký lắng nghe tiến độ tải về toàn cục
     * @returns Hàm hủy đăng ký (unsubscribe)
     */
    static addProgressListener(listener) {
        this.progressListeners.add(listener);
        return () => {
            this.progressListeners.delete(listener);
        };
    }
    /**
     * Đăng ký lắng nghe trạng thái chi tiết của quá trình OTA
     * @returns Hàm hủy đăng ký (unsubscribe)
     */
    static addDetailedStatusListener(listener) {
        this.detailedStatusListeners.add(listener);
        return () => {
            this.detailedStatusListeners.delete(listener);
        };
    }
    static emitProgress(progress) {
        for (const listener of this.progressListeners) {
            try {
                listener(progress);
            }
            catch (e) {
                console.warn("[CustomOTA] Error in progress listener:", e);
            }
        }
    }
    static emitDetailedStatus(status, message) {
        for (const listener of this.detailedStatusListeners) {
            try {
                listener(status, message);
            }
            catch (e) {
                console.warn("[CustomOTA] Error in detailed status listener:", e);
            }
        }
    }
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
    static async getActualNativeVersion(fallback) {
        if (fallback && fallback !== "1.0.0" && fallback !== "0.0.0") {
            return fallback;
        }
        if (native_1.OTAUpdater?.getNativeVersion) {
            try {
                const v = await native_1.OTAUpdater.getNativeVersion();
                if (v)
                    return v;
            }
            catch (e) {
                console.warn("[CustomOTA] Error getting native version:", e);
            }
        }
        return fallback || "1.0.0";
    }
    /**
     * Lấy thông tin phiên bản OTA hiện hành trên máy.
     * Nếu vừa cập nhật và JS đã chạy thành công, tự động markReady để tránh rollback ngoài ý muốn.
     */
    static async getUpdateMetadata() {
        const state = await (0, storage_1.readState)();
        const actualNative = await this.getActualNativeVersion(state.nativeVersion);
        // Nếu bundle mới đang ở trạng thái pending mà JS đã load lên và gọi getUpdateMetadata:
        // Đánh dấu bản build đã hoạt động thành công để Resolver không rollback
        if (state.pending) {
            await this.markReady();
            state.pending = false;
            state.ready = true;
            state.trial = false;
            state.trialCount = 0;
        }
        if (!state.currentVersion || state.currentVersion === "0.0.0") {
            return {
                ...state,
                currentVersion: actualNative || "1.0.0",
                version: actualNative || "1.0.0",
                otaVersion: actualNative || "1.0.0",
                nativeVersion: actualNative,
                isNativeBase: true
            };
        }
        return {
            ...state,
            version: state.currentVersion,
            otaVersion: state.currentVersion,
            nativeVersion: actualNative || state.nativeVersion
        };
    }
    /**
     * Tương thích chuẩn CodePush: Đánh dấu ứng dụng đã khởi động thành công.
     */
    static async notifyAppReady() {
        return this.markReady();
    }
    /**
     * Kiểm tra xem có bản cập nhật mới từ OTA Server hay không.
     */
    static async checkForUpdate(options) {
        await (0, storage_1.ensureOTADirs)();
        const state = await (0, storage_1.readState)();
        const platform = react_native_1.Platform.OS === "ios" ? "ios" : "android";
        const nativeVersion = await this.getActualNativeVersion(options.nativeVersion);
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
        if (options.apiKey) {
            params.append("apiKey", options.apiKey);
        }
        const headers = {};
        if (options.apiKey) {
            headers["X-OTA-API-KEY"] = options.apiKey;
        }
        const response = await fetch(`${options.serverUrl.replace(/\/$/, "")}/ota/check?${params}`, {
            headers
        });
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
        // Kiểm tra Target Binary Version / Dải phiên bản Native tương thích
        if (rawData.targetBinaryVersion || rawData.minNativeVersion || rawData.maxNativeVersion) {
            if (!matchesTargetBinaryVersion(nativeVersion, rawData.targetBinaryVersion, rawData.minNativeVersion, rawData.maxNativeVersion)) {
                return null;
            }
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
            nativeVersion,
            targetBinaryVersion: rawData.targetBinaryVersion,
            minNativeVersion: rawData.minNativeVersion,
            maxNativeVersion: rawData.maxNativeVersion,
            downloadUrl: fullDownloadUrl,
            mandatory: Boolean(rawData.mandatory || rawData.isMandatory),
            isMandatory: Boolean(rawData.mandatory || rawData.isMandatory)
        };
        return data;
    }
    /**
     * Tải và cài đặt bản cập nhật với theo dõi tiến độ chi tiết.
     * Hỗ trợ Cập nhật vi sai (Delta Update) và Tải phân đoạn tiếp tục (Chunked & Resumable).
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
        const currentState = await (0, storage_1.readState)();
        const bundleName = react_native_1.Platform.OS === "ios" ? "main.jsbundle" : "index.android.bundle";
        const currentBundlePath = `${storage_1.CURRENT_DIR}/${bundleName}`;
        // 1. Thử cập nhật vi sai (Delta Update) nếu có patchUrl và máy đang có bản baseVersion
        if (update.isDelta &&
            update.patchUrl &&
            update.baseVersion &&
            currentState.currentVersion === update.baseVersion &&
            (await react_native_fs_1.default.exists(currentBundlePath)) &&
            native_1.OTAUpdater?.applyDelta) {
            try {
                const patchKb = Math.round((update.patchSize || 0) / 1024);
                this.emitDetailedStatus(types_1.DetailedStatus.DOWNLOADING, `Đang tải bản vá vi sai (${patchKb > 0 ? `${patchKb} KB` : "siêu nhẹ"})...`);
                const patchPath = `${storage_1.TEMP_DIR}/patch-${update.baseVersion}-to-${version}.bin`;
                await react_native_fs_1.default.unlink(patchPath).catch(() => { });
                // Tải file patch siêu nhẹ với theo dõi tiến độ
                await (0, downloader_1.downloadWithChunksAndResume)({
                    url: update.patchUrl,
                    targetPath: patchPath,
                    expectedSize: update.patchSize,
                    expectedSha256: update.patchSha256,
                    onProgress: (p) => {
                        if (onProgress) {
                            try {
                                onProgress(p, p.progress);
                            }
                            catch {
                                onProgress(p.progress);
                            }
                        }
                        this.emitProgress(p);
                    }
                });
                // Áp dụng patch vi sai
                this.emitDetailedStatus(types_1.DetailedStatus.INSTALLING, "Đang ghép bản vá vi sai...");
                const tempBundlePath = `${storage_1.TEMP_DIR}/${bundleName}`;
                await react_native_fs_1.default.unlink(tempBundlePath).catch(() => { });
                await native_1.OTAUpdater.applyDelta(currentBundlePath, patchPath, tempBundlePath);
                // Kiểm tra mã băm SHA-256 của file bundle mới ghép xong
                const actualHash = await react_native_fs_1.default.hash(tempBundlePath, "sha256");
                const expectedBundleHash = update.bundleSha256 || update.bundleHash;
                const isHashValid = expectedBundleHash
                    ? actualHash.toLowerCase() === expectedBundleHash.toLowerCase()
                    : true;
                if (isHashValid) {
                    // Backup bundle cũ
                    await react_native_fs_1.default.unlink(storage_1.BACKUP_DIR).catch(() => { });
                    await react_native_fs_1.default.mkdir(storage_1.BACKUP_DIR).catch(() => { });
                    await react_native_fs_1.default.copyFile(currentBundlePath, `${storage_1.BACKUP_DIR}/${bundleName}`).catch(() => { });
                    // Đè bundle mới vào CURRENT_DIR
                    await react_native_fs_1.default.unlink(currentBundlePath).catch(() => { });
                    await react_native_fs_1.default.moveFile(tempBundlePath, currentBundlePath);
                    const actualNative = await this.getActualNativeVersion(update.nativeVersion || currentState.nativeVersion);
                    // Cập nhật state
                    await (0, storage_1.writeState)({
                        currentVersion: version,
                        previousVersion: currentState.currentVersion !== "0.0.0" ? currentState.currentVersion : null,
                        nativeVersion: actualNative,
                        pending: true,
                        ready: false,
                        trial: false,
                        trialCount: 0,
                        failedVersions: currentState.failedVersions || []
                    });
                    await react_native_fs_1.default.unlink(patchPath).catch(() => { });
                    this.emitDetailedStatus(types_1.DetailedStatus.COMPLETED, `Đã áp dụng bản cập nhật vi sai v${version} thành công!`);
                    if (installMode === types_1.InstallMode.IMMEDIATE) {
                        await this.restartApp();
                    }
                    return true;
                }
                else {
                    console.warn("[CustomOTA] Hash sau khi ghép delta không khớp, fallback tải full bundle...");
                }
            }
            catch (deltaErr) {
                console.warn("[CustomOTA] Lỗi khi xử lý bản vá vi sai, tự động chuyển sang tải gói full:", deltaErr);
            }
        }
        // 2. Tải toàn bộ gói cập nhật (Full Package) với cơ chế Tải phân đoạn và Resume
        this.emitDetailedStatus(types_1.DetailedStatus.DOWNLOADING, `Bắt đầu tải bản cập nhật v${version}...`);
        const zipPath = `${storage_1.TEMP_DIR}/update-${version}.zip`;
        await react_native_fs_1.default.unlink(zipPath).catch(() => { });
        await (0, downloader_1.downloadWithChunksAndResume)({
            url: update.downloadUrl,
            targetPath: zipPath,
            expectedSize: update.size,
            expectedSha256: update.sha256,
            onProgress: (p) => {
                if (onProgress) {
                    try {
                        onProgress(p, p.progress);
                    }
                    catch {
                        onProgress(p.progress);
                    }
                }
                this.emitProgress(p);
            }
        });
        // Unpack temp directory
        this.emitDetailedStatus(types_1.DetailedStatus.INSTALLING, "Đang giải nén và nạp gói cập nhật...");
        const tempDir = `${storage_1.TEMP_DIR}/${version}`;
        await react_native_fs_1.default.unlink(tempDir).catch(() => { });
        await react_native_fs_1.default.mkdir(tempDir);
        await native_1.OTAUpdater.unzip(zipPath, tempDir);
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
        const actualNative = await this.getActualNativeVersion(update.nativeVersion || oldState.nativeVersion);
        await (0, storage_1.writeState)({
            currentVersion: version,
            previousVersion: oldState.currentVersion !== "0.0.0" ? oldState.currentVersion : null,
            nativeVersion: actualNative,
            pending: true,
            ready: false,
            trial: false,
            trialCount: 0,
            failedVersions: oldState.failedVersions || []
        });
        await react_native_fs_1.default.unlink(zipPath).catch(() => { });
        this.emitDetailedStatus(types_1.DetailedStatus.COMPLETED, `Đã cài đặt bản cập nhật v${version} thành công!`);
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
                apiKey: options.apiKey,
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
                const nativeVersion = await this.getActualNativeVersion(options.nativeVersion);
                await this.downloadAndInstall({ ...update, downloadUrl: fullDownloadUrl, nativeVersion }, downloadProgressCallback);
                syncStatusCallback?.(types_1.SyncStatus.INSTALLING_UPDATE);
                syncStatusCallback?.(types_1.SyncStatus.UPDATE_INSTALLED);
                const effectiveInstallMode = (update.mandatory && options.mandatoryInstallMode)
                    ? options.mandatoryInstallMode
                    : (options.installMode || types_1.InstallMode.IMMEDIATE);
                if (effectiveInstallMode === types_1.InstallMode.ON_NEXT_RESTART) {
                    return types_1.SyncStatus.UPDATE_INSTALLED;
                }
                // Tự động khởi động lại ngay để thay thế code mới lập tức
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
    optionalIgnoreButtonLabel: "Để sau",
    showProgressModal: true
};
CustomOTAManager.progressListeners = new Set();
CustomOTAManager.detailedStatusListeners = new Set();
