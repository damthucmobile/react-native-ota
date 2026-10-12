import { NativeModules } from "react-native";
export const OTAUpdater = NativeModules.OTAUpdater;
if (!OTAUpdater) {
    console.warn("[react-native-custom-ota] NativeModule.OTAUpdater is null! " +
        "Make sure you have linked the library and rebuilt the native binary.");
}
