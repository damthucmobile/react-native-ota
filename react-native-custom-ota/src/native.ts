import { NativeModules } from "react-native";

interface OTAUpdaterInterface {
  unzip(zipPath: string, targetDir: string): Promise<void>;
  markReady(): Promise<void>;
  getCurrentVersion(): Promise<string>;
  restart(): Promise<void>;
}

export const OTAUpdater = NativeModules.OTAUpdater as OTAUpdaterInterface;

if (!OTAUpdater) {
  console.warn(
    "[react-native-custom-ota] NativeModule.OTAUpdater is null! " +
    "Make sure you have linked the library and rebuilt the native binary."
  );
}
