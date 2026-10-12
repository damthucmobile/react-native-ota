"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OTAUpdater = void 0;
const react_native_1 = require("react-native");
exports.OTAUpdater = react_native_1.NativeModules.OTAUpdater;
if (!exports.OTAUpdater) {
    console.warn("[react-native-custom-ota] NativeModule.OTAUpdater is null! " +
        "Make sure you have linked the library and rebuilt the native binary.");
}
