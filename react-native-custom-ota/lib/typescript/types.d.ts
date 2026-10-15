export declare enum SyncStatus {
    UP_TO_DATE = 0,
    UPDATE_AVAILABLE = 1,
    DOWNLOADING_PACKAGE = 2,
    INSTALLING_UPDATE = 3,
    UPDATE_INSTALLED = 4,
    ERROR = -1
}
export declare enum DetailedStatus {
    IDLE = "IDLE",
    CHECKING = "CHECKING",
    UPDATE_AVAILABLE = "UPDATE_AVAILABLE",
    DOWNLOADING = "DOWNLOADING",
    VERIFYING = "VERIFYING",
    INSTALLING = "INSTALLING",
    COMPLETED = "COMPLETED",
    ERROR = "ERROR"
}
export declare enum CheckFrequency {
    ON_APP_START = "ON_APP_START",
    ON_APP_RESUME = "ON_APP_RESUME",
    MANUAL = "MANUAL"
}
export declare enum InstallMode {
    IMMEDIATE = "IMMEDIATE",
    ON_NEXT_RESTART = "ON_NEXT_RESTART"
}
/**
 * Thông tin tiến độ tải về bản cập nhật
 */
export interface DownloadProgress {
    /** Tổng số byte cần tải */
    totalBytes: number;
    /** Số byte đã tải về máy */
    receivedBytes: number;
    /** Tỷ lệ hoàn thành từ 0 đến 100 (%) */
    percentage: number;
    /** Giá trị tỷ lệ từ 0.0 đến 1.0 (tương thích CodePush / Progress Bar) */
    progress: number;
}
export type DownloadProgressCallback = (progress: DownloadProgress) => void;
export type DetailedStatusCallback = (status: DetailedStatus, message?: string) => void;
export interface UpdateDialogOptions {
    title?: string;
    optionalUpdateMessage?: string;
    mandatoryUpdateMessage?: string;
    optionalInstallButtonLabel?: string;
    optionalIgnoreButtonLabel?: string;
    /** Hiển thị modal tiến độ tải sau khi người dùng bấm cập nhật */
    showProgressModal?: boolean;
}
export interface SyncOptions {
    serverUrl: string;
    appId?: string;
    apiKey?: string;
    nativeVersion?: string;
    channel?: string;
    installMode?: InstallMode;
    mandatoryInstallMode?: InstallMode;
    updateDialog?: boolean | UpdateDialogOptions;
    /** Tự động hiển thị modal tiến độ tải cập nhật */
    showProgressModal?: boolean;
    checkFrequency?: CheckFrequency;
    /** Bật chế độ tải phân đoạn / tiếp tục tải khi rớt mạng (Mặc định: true) */
    resumable?: boolean;
}
export interface RemotePackage {
    updateAvailable: boolean;
    appId?: string;
    platform?: string;
    otaVersion?: string;
    version?: string;
    bundle?: string;
    sha256?: string;
    channel?: string;
    targetBinaryVersion?: string;
    minNativeVersion?: string;
    maxNativeVersion?: string;
    nativeVersion?: string;
    mandatory?: boolean;
    isMandatory?: boolean;
    releaseNotes?: string;
    downloadUrl?: string;
    size?: number;
    reason?: string;
    /** Cập nhật vi sai (Delta Update) */
    isDelta?: boolean;
    baseVersion?: string;
    patchUrl?: string;
    patchSize?: number;
    patchSha256?: string;
    /** Hash SHA-256 của file bundle JS/HBC */
    bundleSha256?: string;
    bundleHash?: string;
    zipSha256?: string;
}
export interface LocalPackage {
    currentVersion: string;
    version?: string;
    otaVersion?: string;
    previousVersion: string | null;
    nativeVersion?: string;
    pending: boolean;
    trial?: boolean;
    trialCount?: number;
    ready: boolean;
    failedVersions: string[];
    isNativeBase?: boolean;
}
