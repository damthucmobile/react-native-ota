import { DownloadProgress, InstallMode, LocalPackage, RemotePackage, SyncOptions, SyncStatus, DetailedStatus } from "./types";
export declare function compareSemver(v1?: string, v2?: string): number;
export declare function matchesTargetBinaryVersion(nativeVersion?: string, targetBinary?: string, minNativeVersion?: string, maxNativeVersion?: string): boolean;
export declare class CustomOTAManager {
    private static defaultDialog;
    private static progressListeners;
    private static detailedStatusListeners;
    /**
     * Đăng ký lắng nghe tiến độ tải về toàn cục
     * @returns Hàm hủy đăng ký (unsubscribe)
     */
    static addProgressListener(listener: (progress: DownloadProgress) => void): () => void;
    /**
     * Đăng ký lắng nghe trạng thái chi tiết của quá trình OTA
     * @returns Hàm hủy đăng ký (unsubscribe)
     */
    static addDetailedStatusListener(listener: (status: DetailedStatus, message?: string) => void): () => void;
    private static emitProgress;
    private static emitDetailedStatus;
    /**
     * Đánh dấu bản build OTA hiện tại đã khởi động thành công.
     * Xóa bản backup trước đó và tắt cờ pending.
     */
    static markReady(): Promise<void>;
    /**
     * Khởi động lại ứng dụng để nạp ngay bản OTA mới.
     */
    static restartApp(): Promise<void>;
    private static getActualNativeVersion;
    /**
     * Lấy thông tin phiên bản OTA hiện hành trên máy.
     * Nếu vừa cập nhật và JS đã chạy thành công, tự động markReady để tránh rollback ngoài ý muốn.
     */
    static getUpdateMetadata(): Promise<LocalPackage | null>;
    /**
     * Tương thích chuẩn CodePush: Đánh dấu ứng dụng đã khởi động thành công.
     */
    static notifyAppReady(): Promise<void>;
    /**
     * Kiểm tra xem có bản cập nhật mới từ OTA Server hay không.
     */
    static checkForUpdate(options: {
        serverUrl: string;
        appId?: string;
        apiKey?: string;
        nativeVersion?: string;
        channel?: string;
    }): Promise<RemotePackage | null>;
    /**
     * Tải và cài đặt bản cập nhật với theo dõi tiến độ chi tiết.
     * Hỗ trợ Cập nhật vi sai (Delta Update) và Tải phân đoạn tiếp tục (Chunked & Resumable).
     */
    static downloadAndInstall(update: RemotePackage, onProgress?: ((progress: DownloadProgress) => void) | ((progressValue: number) => void), installMode?: InstallMode): Promise<boolean>;
    /**
     * Phương thức đồng bộ tự động như CodePush.sync()
     */
    static sync(options: SyncOptions, syncStatusCallback?: (status: SyncStatus) => void, downloadProgressCallback?: ((progress: DownloadProgress) => void) | ((progressValue: number) => void)): Promise<SyncStatus>;
}
