import React, { useEffect } from "react";
import { AppState } from "react-native";
import { CustomOTAManager } from "./manager";
import { CheckFrequency } from "./types";
export function withCustomOTA(options) {
    return function (WrappedComponent) {
        return function CustomOTAWrapper(props) {
            useEffect(() => {
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
                    };
                }
            }, []);
            return React.createElement(WrappedComponent, { ...props });
        };
    };
}
