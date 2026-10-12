export declare enum SyncStatus {
    UP_TO_DATE = 0,
    UPDATE_AVAILABLE = 1,
    DOWNLOADING_PACKAGE = 2,
    INSTALLING_UPDATE = 3,
    UPDATE_INSTALLED = 4,
    ERROR = -1
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
export interface UpdateDialogOptions {
    title?: string;
    optionalUpdateMessage?: string;
    mandatoryUpdateMessage?: string;
    optionalInstallButtonLabel?: string;
    optionalIgnoreButtonLabel?: string;
}
export interface SyncOptions {
    serverUrl: string;
    nativeVersion?: string;
    channel?: string;
    installMode?: InstallMode;
    updateDialog?: boolean | UpdateDialogOptions;
    checkFrequency?: CheckFrequency;
}
export interface RemotePackage {
    updateAvailable: boolean;
    appId?: string;
    platform?: string;
    otaVersion?: string;
    bundle?: string;
    sha256?: string;
    channel?: string;
    minNativeVersion?: string;
    mandatory?: boolean;
    releaseNotes?: string;
    downloadUrl?: string;
    size?: number;
    reason?: string;
}
export interface LocalPackage {
    currentVersion: string;
    previousVersion: string | null;
    pending: boolean;
    ready: boolean;
    failedVersions: string[];
}
