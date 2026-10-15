"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.withCustomOTA = withCustomOTA;
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const manager_1 = require("./manager");
const types_1 = require("./types");
const ProgressModal_1 = require("./ProgressModal");
function withCustomOTA(options) {
    return function (WrappedComponent) {
        return function CustomOTAWrapper(props) {
            const [isDownloading, setIsDownloading] = (0, react_1.useState)(false);
            const [progress, setProgress] = (0, react_1.useState)({
                totalBytes: 0,
                receivedBytes: 0,
                percentage: 0,
                progress: 0
            });
            const [statusText, setStatusText] = (0, react_1.useState)("Đang tải bản cập nhật...");
            (0, react_1.useEffect)(() => {
                let removeProg;
                let removeStatus;
                if (options.showProgressModal) {
                    removeProg = manager_1.CustomOTAManager.addProgressListener((p) => {
                        setProgress(p);
                        setIsDownloading(true);
                    });
                    removeStatus = manager_1.CustomOTAManager.addDetailedStatusListener((s, msg) => {
                        if (msg)
                            setStatusText(msg);
                        if (s === types_1.DetailedStatus.DOWNLOADING ||
                            s === types_1.DetailedStatus.VERIFYING ||
                            s === types_1.DetailedStatus.INSTALLING) {
                            setIsDownloading(true);
                        }
                        else if (s === types_1.DetailedStatus.COMPLETED || s === types_1.DetailedStatus.ERROR) {
                            setIsDownloading(false);
                        }
                    });
                }
                // Tự động kiểm tra cập nhật khi app khởi động
                if (options.checkFrequency !== types_1.CheckFrequency.MANUAL) {
                    manager_1.CustomOTAManager.sync(options);
                }
                // Nếu bật kiểm tra khi App Resume từ background
                if (options.checkFrequency === types_1.CheckFrequency.ON_APP_RESUME) {
                    const subscription = react_native_1.AppState.addEventListener("change", (nextAppState) => {
                        if (nextAppState === "active") {
                            manager_1.CustomOTAManager.sync(options);
                        }
                    });
                    return () => {
                        subscription.remove();
                        removeProg?.();
                        removeStatus?.();
                    };
                }
                return () => {
                    removeProg?.();
                    removeStatus?.();
                };
            }, []);
            return (react_1.default.createElement(react_native_1.View, { style: { flex: 1 } },
                react_1.default.createElement(WrappedComponent, { ...props }),
                options.showProgressModal && (react_1.default.createElement(ProgressModal_1.OTAProgressModal, { visible: isDownloading, progress: progress, statusText: statusText }))));
        };
    };
}
exports.default = withCustomOTA;
