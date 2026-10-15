import { DownloadProgress } from "./types";
export interface ChunkedDownloadOptions {
    url: string;
    targetPath: string;
    expectedSize?: number;
    expectedSha256?: string;
    chunkSize?: number;
    onProgress?: (progress: DownloadProgress) => void;
}
/**
 * Tải file hỗ trợ phân đoạn (Chunked / Range HTTP) và tự động tiếp tục tải (Resume)
 * khi mất mạng mà không phải tải lại từ đầu.
 */
export declare function downloadWithChunksAndResume(options: ChunkedDownloadOptions): Promise<string>;
