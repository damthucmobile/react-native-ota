interface OTAUpdaterInterface {
    unzip(zipPath: string, targetDir: string): Promise<void>;
    markReady(): Promise<void>;
    getCurrentVersion(): Promise<string>;
    restart(): Promise<void>;
}
export declare const OTAUpdater: OTAUpdaterInterface;
export {};
