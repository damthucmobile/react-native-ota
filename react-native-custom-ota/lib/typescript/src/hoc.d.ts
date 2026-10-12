import { ComponentType } from "react";
import { SyncOptions } from "./types";
export declare function withCustomOTA(options: SyncOptions): <P extends object>(WrappedComponent: ComponentType<P>) => ComponentType<P>;
