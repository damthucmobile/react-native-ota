import { InstallMode, LocalPackage, RemotePackage, SyncOptions, SyncStatus } from "./types";
export declare class CustomOTAManager {
    private static defaultDialog;
    /**
     * Đánh dấu bản build OTA hiện tại đã khởi động thành công.
     * Xóa bản backup trước đó và tắt cờ pending.
     */
    static markReady(): Promise<void>;
    /**
     * Khởi động lại ứng dụng để nạp ngay bản OTA mới.
     */
    static restartApp(): Promise<void>;
    /**
     * Lấy thông tin phiên bản OTA hiện hành trên máy.
     */
    static getUpdateMetadata(): Promise<LocalPackage>;
    /**
     * Kiểm tra xem server có bản cập nhật mới hay không.
     */
    static checkForUpdate(options: {
        serverUrl: string;
        appId?: string;
        nativeVersion?: string;
        channel?: string;
    }): Promise<RemotePackage | null>;
    /**
     * Tải và cài đặt bản cập nhật.
     */
    static downloadAndInstall(update: RemotePackage, onProgress?: (progress: number) => void, installMode?: InstallMode): Promise<boolean>;
    /**
     * Phương thức đồng bộ tự động như CodePush.sync()
     */
    static sync(options: SyncOptions, syncStatusCallback?: (status: SyncStatus) => void, downloadProgressCallback?: (progress: number) => void): Promise<SyncStatus>;
}
