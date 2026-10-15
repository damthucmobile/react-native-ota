import { useEffect, useState, useCallback } from "react";
import { CustomOTAManager } from "./manager";
import { SyncStatus, DetailedStatus } from "./types";
export function useCustomOTA() {
    const [isChecking, setIsChecking] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [progress, setProgress] = useState({
        totalBytes: 0,
        receivedBytes: 0,
        percentage: 0,
        progress: 0
    });
    const [syncStatus, setSyncStatus] = useState(SyncStatus.UP_TO_DATE);
    const [detailedStatus, setDetailedStatus] = useState(DetailedStatus.IDLE);
    const [statusText, setStatusText] = useState("");
    const [activeMetadata, setActiveMetadata] = useState(null);
    const refreshMetadata = useCallback(async () => {
        try {
            const meta = await CustomOTAManager.getUpdateMetadata();
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
    useEffect(() => {
        refreshMetadata();
        // Đăng ký nhận sự kiện tiến độ toàn cục
        const removeProgressListener = CustomOTAManager.addProgressListener((prog) => {
            setProgress(prog);
            setIsDownloading(true);
            setDetailedStatus(DetailedStatus.DOWNLOADING);
            setStatusText(`Đang tải bản cập nhật: ${prog.percentage}%`);
        });
        const removeStatusListener = CustomOTAManager.addDetailedStatusListener((status, msg) => {
            setDetailedStatus(status);
            if (msg)
                setStatusText(msg);
            if (status === DetailedStatus.DOWNLOADING) {
                setIsDownloading(true);
            }
            else if (status === DetailedStatus.COMPLETED || status === DetailedStatus.ERROR) {
                setIsDownloading(false);
                refreshMetadata();
            }
        });
        return () => {
            removeProgressListener();
            removeStatusListener();
        };
    }, [refreshMetadata]);
    const checkForUpdate = useCallback(async (options) => {
        setIsChecking(true);
        setDetailedStatus(DetailedStatus.CHECKING);
        setStatusText("Đang kiểm tra phiên bản mới...");
        try {
            const update = await CustomOTAManager.checkForUpdate(options);
            if (update && update.updateAvailable) {
                setDetailedStatus(DetailedStatus.UPDATE_AVAILABLE);
                setStatusText(`Tìm thấy bản cập nhật mới v${update.otaVersion}`);
            }
            else {
                setDetailedStatus(DetailedStatus.IDLE);
                setStatusText("Ứng dụng đang ở phiên bản mới nhất");
            }
            return update;
        }
        catch (err) {
            setDetailedStatus(DetailedStatus.ERROR);
            setStatusText(err.message || "Lỗi khi kiểm tra cập nhật");
            throw err;
        }
        finally {
            setIsChecking(false);
        }
    }, []);
    const sync = useCallback(async (options) => {
        setIsChecking(true);
        setProgress({ totalBytes: 0, receivedBytes: 0, percentage: 0, progress: 0 });
        try {
            const status = await CustomOTAManager.sync(options, (s) => setSyncStatus(s), (prog) => setProgress(prog));
            setSyncStatus(status);
            await refreshMetadata();
            return status;
        }
        finally {
            setIsChecking(false);
            setIsDownloading(false);
        }
    }, [refreshMetadata]);
    const restartApp = useCallback(async () => {
        await CustomOTAManager.restartApp();
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
export default useCustomOTA;
