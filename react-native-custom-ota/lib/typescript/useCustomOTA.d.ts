import { DownloadProgress, LocalPackage, RemotePackage, SyncOptions, SyncStatus, DetailedStatus } from "./types";
export interface UseCustomOTAReturn {
    /** Đang kiểm tra cập nhật */
    isChecking: boolean;
    /** Đang trong tiến trình tải xuống hoặc cài đặt */
    isDownloading: boolean;
    /** Thông tin tiến độ tải chi tiết */
    progress: DownloadProgress;
    /** Trạng thái tổng quát của Sync */
    syncStatus: SyncStatus;
    /** Trạng thái chi tiết (IDLE, CHECKING, DOWNLOADING, VERIFYING, INSTALLING, COMPLETED, ERROR) */
    detailedStatus: DetailedStatus;
    /** Thông điệp trạng thái bằng chữ (tiếng Việt thân thiện) */
    statusText: string;
    /** Thông tin phiên bản OTA hiện tại của máy */
    activeMetadata: LocalPackage | null;
    /** Phiên bản active hiện tại (vd: '1.0.8') */
    activeVersion: string;
    /** Kiểm tra bản cập nhật mới từ server */
    checkForUpdate: (options: {
        serverUrl: string;
        appId?: string;
        apiKey?: string;
        nativeVersion?: string;
        channel?: string;
    }) => Promise<RemotePackage | null>;
    /** Thực hiện đồng bộ tự động */
    sync: (options: SyncOptions) => Promise<SyncStatus>;
    /** Khởi động lại ứng dụng để áp dụng bản OTA */
    restartApp: () => Promise<void>;
    /** Làm mới thông tin metadata phiên bản hiện tại */
    refreshMetadata: () => Promise<LocalPackage | null>;
}
export declare function useCustomOTA(): UseCustomOTAReturn;
export default useCustomOTA;
