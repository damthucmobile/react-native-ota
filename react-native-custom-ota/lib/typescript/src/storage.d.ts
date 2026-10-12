import { LocalPackage } from "./types";
export declare const OTA_ROOT: string;
export declare const CURRENT_DIR: string;
export declare const BACKUP_DIR: string;
export declare const TEMP_DIR: string;
export declare function ensureOTADirs(): Promise<void>;
export declare function readState(): Promise<LocalPackage>;
export declare function writeState(state: LocalPackage): Promise<void>;
