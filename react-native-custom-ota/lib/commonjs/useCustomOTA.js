"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useCustomOTA = useCustomOTA;
const react_1 = require("react");
const manager_1 = require("./manager");
const types_1 = require("./types");
function useCustomOTA() {
    const [isChecking, setIsChecking] = (0, react_1.useState)(false);
    const [isDownloading, setIsDownloading] = (0, react_1.useState)(false);
    const [progress, setProgress] = (0, react_1.useState)({
        totalBytes: 0,
        receivedBytes: 0,
        percentage: 0,
        progress: 0
    });
    const [syncStatus, setSyncStatus] = (0, react_1.useState)(types_1.SyncStatus.UP_TO_DATE);
    const [detailedStatus, setDetailedStatus] = (0, react_1.useState)(types_1.DetailedStatus.IDLE);
    const [statusText, setStatusText] = (0, react_1.useState)("");
    const [activeMetadata, setActiveMetadata] = (0, react_1.useState)(null);
    const refreshMetadata = (0, react_1.useCallback)(async () => {
        try {
            const meta = await manager_1.CustomOTAManager.getUpdateMetadata();
            setActiveMetadata(meta);
            return meta;
        }
        catch {
            return {
                currentVersion: "0.0.0",
                previousVersion: null,
                pending: false,
                ready: true,
                failedVersions: []
            };
        }
    }, []);
    (0, react_1.useEffect)(() => {
        refreshMetadata();
        // Đăng ký nhận sự kiện tiến độ toàn cục
        const removeProgressListener = manager_1.CustomOTAManager.addProgressListener((prog) => {
            setProgress(prog);
            setIsDownloading(true);
            setDetailedStatus(types_1.DetailedStatus.DOWNLOADING);
            setStatusText(`Đang tải bản cập nhật: ${prog.percentage}%`);
        });
        const removeStatusListener = manager_1.CustomOTAManager.addDetailedStatusListener((status, msg) => {
            setDetailedStatus(status);
            if (msg)
                setStatusText(msg);
            if (status === types_1.DetailedStatus.DOWNLOADING) {
                setIsDownloading(true);
            }
            else if (status === types_1.DetailedStatus.COMPLETED || status === types_1.DetailedStatus.ERROR) {
                setIsDownloading(false);
                refreshMetadata();
            }
        });
        return () => {
            removeProgressListener();
            removeStatusListener();
        };
    }, [refreshMetadata]);
    const checkForUpdate = (0, react_1.useCallback)(async (options) => {
        setIsChecking(true);
        setDetailedStatus(types_1.DetailedStatus.CHECKING);
        setStatusText("Đang kiểm tra phiên bản mới...");
        try {
            const update = await manager_1.CustomOTAManager.checkForUpdate(options);
            if (update && update.updateAvailable) {
                setDetailedStatus(types_1.DetailedStatus.UPDATE_AVAILABLE);
                setStatusText(`Tìm thấy bản cập nhật mới v${update.otaVersion}`);
            }
            else {
                setDetailedStatus(types_1.DetailedStatus.IDLE);
                setStatusText("Ứng dụng đang ở phiên bản mới nhất");
            }
            return update;
        }
        catch (err) {
            setDetailedStatus(types_1.DetailedStatus.ERROR);
            setStatusText(err.message || "Lỗi khi kiểm tra cập nhật");
            throw err;
        }
        finally {
            setIsChecking(false);
        }
    }, []);
    const sync = (0, react_1.useCallback)(async (options) => {
        setIsChecking(true);
        setProgress({ totalBytes: 0, receivedBytes: 0, percentage: 0, progress: 0 });
        try {
            const status = await manager_1.CustomOTAManager.sync(options, (s) => setSyncStatus(s), (prog) => setProgress(prog));
            setSyncStatus(status);
            await refreshMetadata();
            return status;
        }
        finally {
            setIsChecking(false);
            setIsDownloading(false);
        }
    }, [refreshMetadata]);
    const restartApp = (0, react_1.useCallback)(async () => {
        await manager_1.CustomOTAManager.restartApp();
    }, []);
    return {
        isChecking,
        isDownloading,
        progress,
        syncStatus,
        detailedStatus,
        statusText,
        activeMetadata,
        activeVersion: activeMetadata?.currentVersion || "0.0.0",
        checkForUpdate,
        sync,
        restartApp,
        refreshMetadata
    };
}
exports.default = useCustomOTA;
