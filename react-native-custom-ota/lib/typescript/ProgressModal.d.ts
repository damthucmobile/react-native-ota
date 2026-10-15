import React from "react";
import { DownloadProgress } from "./types";
export interface OTAProgressModalProps {
    /** Trạng thái hiển thị modal */
    visible: boolean;
    /** Thông tin tiến độ tải (object hoặc số thập phân 0.0 - 1.0) */
    progress?: DownloadProgress | number;
    /** Tiêu đề modal (Mặc định: 'Cập nhật ứng dụng') */
    title?: string;
    /** Thông điệp trạng thái hiện tại (vd: 'Đang tải gói cập nhật...') */
    statusText?: string;
    /** Phiên bản đang được tải về (vd: '1.0.9') */
    version?: string;
}
export declare function formatBytes(bytes: number, decimals?: number): string;
export declare const OTAProgressModal: React.FC<OTAProgressModalProps>;
export default OTAProgressModal;
