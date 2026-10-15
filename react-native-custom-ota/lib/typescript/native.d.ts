interface OTAUpdaterInterface {
    unzip(zipPath: string, targetDir: string): Promise<void>;
    applyDelta?(baseFilePath: string, patchFilePath: string, outputFilePath: string): Promise<string>;
    markReady(): Promise<void>;
    getCurrentVersion(): Promise<string>;
    getNativeVersion?(): Promise<string>;
    restart(): Promise<void>;
}
export declare const OTAUpdater: OTAUpdaterInterface;
export {};
