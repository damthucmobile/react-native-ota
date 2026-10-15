export interface DeltaMetadata {
    magic: string;
    baseSha256: string;
    targetSha256: string;
    targetLength: number;
}
/**
 * Đọc header của file patch OTAPATCH
 */
export declare function readDeltaHeader(patchBuf: Buffer): DeltaMetadata;
/**
 * Tạo file vi sai (Patch/Delta) giữa bản cũ (base) và bản mới (target)
 * Sử dụng thuật toán chunk-matching kết hợp nén Deflate/Zlib.
 */
export declare function createDelta(baseBuf: Buffer, targetBuf: Buffer, blockSize?: number): Buffer;
/**
 * Ghép file patch lên baseBuf để tái tạo hoàn chỉnh targetBuf
 */
export declare function applyDelta(baseBuf: Buffer, patchBuf: Buffer): Buffer;
