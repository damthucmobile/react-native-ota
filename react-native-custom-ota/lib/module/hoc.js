import React, { useEffect, useState } from "react";
import { AppState, View } from "react-native";
import { CustomOTAManager } from "./manager";
import { CheckFrequency, DetailedStatus } from "./types";
import { OTAProgressModal } from "./ProgressModal";
export function withCustomOTA(options) {
    return function (WrappedComponent) {
        return function CustomOTAWrapper(props) {
            const [isDownloading, setIsDownloading] = useState(false);
            const [progress, setProgress] = useState({
                totalBytes: 0,
                receivedBytes: 0,
                percentage: 0,
                progress: 0
            });
            const [statusText, setStatusText] = useState("Đang tải bản cập nhật...");
            useEffect(() => {
                let removeProg;
                let removeStatus;
                if (options.showProgressModal) {
                    removeProg = CustomOTAManager.addProgressListener((p) => {
                        setProgress(p);
                        setIsDownloading(true);
                    });
                    removeStatus = CustomOTAManager.addDetailedStatusListener((s, msg) => {
                        if (msg)
                            setStatusText(msg);
                        if (s === DetailedStatus.DOWNLOADING ||
                            s === DetailedStatus.VERIFYING ||
                            s === DetailedStatus.INSTALLING) {
                            setIsDownloading(true);
                        }
                        else if (s === DetailedStatus.COMPLETED || s === DetailedStatus.ERROR) {
                            setIsDownloading(false);
                        }
                    });
                }
                // Tự động kiểm tra cập nhật khi app khởi động
                if (options.checkFrequency !== CheckFrequency.MANUAL) {
                    CustomOTAManager.sync(options);
                }
                // Nếu bật kiểm tra khi App Resume từ background
                if (options.checkFrequency === CheckFrequency.ON_APP_RESUME) {
                    const subscription = AppState.addEventListener("change", (nextAppState) => {
                        if (nextAppState === "active") {
                            CustomOTAManager.sync(options);
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
            return (React.createElement(View, { style: { flex: 1 } },
                React.createElement(WrappedComponent, { ...props }),
                options.showProgressModal && (React.createElement(OTAProgressModal, { visible: isDownloading, progress: progress, statusText: statusText }))));
        };
    };
}
export default withCustomOTA;
