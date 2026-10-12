import RNFS from "react-native-fs";
import { LocalPackage } from "./types";

export const OTA_ROOT = `${RNFS.DocumentDirectoryPath}/ota`;
export const CURRENT_DIR = `${OTA_ROOT}/current`;
export const BACKUP_DIR = `${OTA_ROOT}/backup`;
export const TEMP_DIR = `${OTA_ROOT}/temp`;
const STATE_FILE = `${OTA_ROOT}/state.json`;

export async function ensureOTADirs(): Promise<void> {
  await RNFS.mkdir(OTA_ROOT).catch(() => {});
  await RNFS.mkdir(TEMP_DIR).catch(() => {});
}

export async function readState(): Promise<LocalPackage> {
  await ensureOTADirs();

  if (!(await RNFS.exists(STATE_FILE))) {
    return {
      currentVersion: "0.0.0",
      previousVersion: null,
      pending: false,
      ready: true,
      failedVersions: []
    };
  }

  try {
    const content = await RNFS.readFile(STATE_FILE, "utf8");
    return JSON.parse(content);
  } catch {
    return {
      currentVersion: "0.0.0",
      previousVersion: null,
      pending: false,
      ready: true,
      failedVersions: []
    };
  }
}

export async function writeState(state: LocalPackage): Promise<void> {
  await ensureOTADirs();
  await RNFS.writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}
