import RNFS from "react-native-fs";
const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024; // 4MB mỗi phân đoạn
/**
 * Tải file hỗ trợ phân đoạn (Chunked / Range HTTP) và tự động tiếp tục tải (Resume)
 * khi mất mạng mà không phải tải lại từ đầu.
 */
export async function downloadWithChunksAndResume(options) {
    const { url, targetPath, expectedSize = 0, expectedSha256, chunkSize = DEFAULT_CHUNK_SIZE, onProgress } = options;
    const tempDir = `${targetPath}_chunks`;
    await RNFS.mkdir(tempDir).catch(() => { });
    // 1. Kiểm tra kích thước file từ server nếu chưa biết
    let totalBytes = expectedSize;
    let supportsRange = true;
    try {
        const headRes = await fetch(url, { method: "HEAD" });
        if (headRes.ok) {
            const lenHeader = headRes.headers.get("content-length");
            if (lenHeader) {
                totalBytes = parseInt(lenHeader, 10) || totalBytes;
            }
            const acceptRanges = headRes.headers.get("accept-ranges");
            if (acceptRanges === "none") {
                supportsRange = false;
            }
        }
    }
    catch {
        // Nếu HEAD lỗi, vẫn tiếp tục thử tải
    }
    // Nếu file nhỏ hơn kích thước 1 chunk hoặc server không hỗ trợ Range -> tải trực tiếp
    if (!supportsRange || totalBytes <= chunkSize) {
        return downloadDirect(url, targetPath, totalBytes, onProgress);
    }
    const totalChunks = Math.ceil(totalBytes / chunkSize);
    let totalReceivedBytes = 0;
    // Tính toán các chunk đã tải xong từ trước (Resume)
    for (let c = 0; c < totalChunks; c++) {
        const chunkFile = `${tempDir}/chunk_${c}.part`;
        if (await RNFS.exists(chunkFile)) {
            const stat = await RNFS.stat(chunkFile);
            const expectedChunkLen = Math.min(chunkSize, totalBytes - (c * chunkSize));
            if (stat.size === expectedChunkLen) {
                totalReceivedBytes += stat.size;
            }
            else {
                // Chunk bị tải dở -> xóa để tải lại chunk này
                await RNFS.unlink(chunkFile).catch(() => { });
            }
        }
    }
    // Tải từng phân đoạn còn thiếu
    for (let c = 0; c < totalChunks; c++) {
        const chunkFile = `${tempDir}/chunk_${c}.part`;
        const startByte = c * chunkSize;
        const endByte = Math.min((c + 1) * chunkSize - 1, totalBytes - 1);
        const expectedChunkLen = endByte - startByte + 1;
        if (await RNFS.exists(chunkFile)) {
            const stat = await RNFS.stat(chunkFile);
            if (stat.size === expectedChunkLen) {
                // Chunk này đã tải xong từ trước -> bỏ qua
                continue;
            }
        }
        let chunkReceived = 0;
        const downloadRes = RNFS.downloadFile({
            fromUrl: url,
            toFile: chunkFile,
            headers: {
                Range: `bytes=${startByte}-${endByte}`
            },
            progressDivider: 0,
            progressInterval: 50,
            progress: ({ bytesWritten }) => {
                chunkReceived = bytesWritten;
                const currentTotal = totalReceivedBytes + chunkReceived;
                const percent = totalBytes > 0 ? Math.min(100, Math.round((currentTotal / totalBytes) * 100)) : 0;
                const progressVal = totalBytes > 0 ? Math.min(1, currentTotal / totalBytes) : 0;
                onProgress?.({
                    totalBytes,
                    receivedBytes: currentTotal,
                    percentage: percent,
                    progress: progressVal
                });
            }
        });
        const res = await downloadRes.promise;
        if (res.statusCode !== 206 && res.statusCode !== 200) {
            // Nếu server trả về lỗi Range (vd 416) hoặc không hỗ trợ, fallback tải trực tiếp
            await RNFS.unlink(tempDir).catch(() => { });
            return downloadDirect(url, targetPath, totalBytes, onProgress);
        }
        totalReceivedBytes += expectedChunkLen;
    }
    // Ráp tất cả các chunk lại thành file hoàn chỉnh
    await RNFS.unlink(targetPath).catch(() => { });
    // Ghép các chunk vào targetPath
    for (let c = 0; c < totalChunks; c++) {
        const chunkFile = `${tempDir}/chunk_${c}.part`;
        const chunkBase64 = await RNFS.readFile(chunkFile, "base64");
        await RNFS.appendFile(targetPath, chunkBase64, "base64");
    }
    // Dọn dẹp thư mục tạm các chunk
    await RNFS.unlink(tempDir).catch(() => { });
    // Kiểm tra SHA-256 sau khi ráp
    if (expectedSha256) {
        const actualHash = await RNFS.hash(targetPath, "sha256");
        if (actualHash.toLowerCase() !== expectedSha256.toLowerCase()) {
            await RNFS.unlink(targetPath).catch(() => { });
            throw new Error(`Checksum mismatch sau khi ráp phân đoạn! Kỳ vọng: ${expectedSha256}, thực tế: ${actualHash}`);
        }
    }
    return targetPath;
}
/**
 * Tải trực tiếp 1 luồng chuẩn (Dùng cho patch nhỏ hoặc khi không cần chia chunk)
 */
async function downloadDirect(url, targetPath, expectedSize, onProgress) {
    await RNFS.unlink(targetPath).catch(() => { });
    const downloadRes = RNFS.downloadFile({
        fromUrl: url,
        toFile: targetPath,
        begin: (res) => {
            const total = res.contentLength > 0 ? res.contentLength : expectedSize;
            onProgress?.({
                totalBytes: total,
                receivedBytes: 0,
                percentage: 0,
                progress: 0
            });
        },
        progressDivider: 0,
        progressInterval: 50,
        progress: ({ bytesWritten, contentLength }) => {
            const total = contentLength > 0 ? contentLength : expectedSize;
            const percent = total > 0 ? Math.min(100, Math.round((bytesWritten / total) * 100)) : 0;
            const progressVal = total > 0 ? Math.min(1, bytesWritten / total) : 0;
            onProgress?.({
                totalBytes: total,
                receivedBytes: bytesWritten,
                percentage: percent,
                progress: progressVal
            });
        }
    });
    const res = await downloadRes.promise;
    if (res.statusCode < 200 || res.statusCode >= 300) {
        throw new Error(`Tải trực tiếp thất bại với HTTP ${res.statusCode}`);
    }
    return targetPath;
}
