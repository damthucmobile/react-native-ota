import React, { ComponentType, useEffect } from "react";
import { AppState, AppStateStatus } from "react-native";
import { CustomOTAManager } from "./manager";
import { CheckFrequency, SyncOptions } from "./types";

export function withCustomOTA(options: SyncOptions) {
  return function <P extends object>(WrappedComponent: ComponentType<P>): ComponentType<P> {
    return function CustomOTAWrapper(props: P) {
      useEffect(() => {
        // Tự động kiểm tra cập nhật khi app khởi động
        if (options.checkFrequency !== CheckFrequency.MANUAL) {
          CustomOTAManager.sync(options);
        }

        // Nếu bật kiểm tra khi App Resume từ background
        if (options.checkFrequency === CheckFrequency.ON_APP_RESUME) {
          const subscription = AppState.addEventListener(
            "change",
            (nextAppState: AppStateStatus) => {
              if (nextAppState === "active") {
                CustomOTAManager.sync(options);
              }
            }
          );
          return () => {
            subscription.remove();
          };
        }
      }, []);

      return <WrappedComponent {...props} />;
    };
  };
}
