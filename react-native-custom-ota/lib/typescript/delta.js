"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readDeltaHeader = readDeltaHeader;
exports.createDelta = createDelta;
exports.applyDelta = applyDelta;
const crypto_1 = __importDefault(require("crypto"));
const zlib_1 = __importDefault(require("zlib"));
const MAGIC = "OTAPATCH";
const HEADER_SIZE = 76; // 8 magic + 32 baseSha + 32 targetSha + 4 targetLen
const BLOCK_SIZE = 2048;
/**
 * Đọc header của file patch OTAPATCH
 */
function readDeltaHeader(patchBuf) {
    if (patchBuf.length < HEADER_SIZE) {
        throw new Error("File patch không hợp lệ: dung lượng quá nhỏ");
    }
    const magic = patchBuf.subarray(0, 8).toString("ascii");
    if (magic !== MAGIC) {
        throw new Error(`Magic patch không đúng: kỳ vọng ${MAGIC}, nhận được ${magic}`);
    }
    const baseSha256 = patchBuf.subarray(8, 40).toString("hex");
    const targetSha256 = patchBuf.subarray(40, 72).toString("hex");
    const targetLength = patchBuf.readUInt32BE(72);
    return { magic, baseSha256, targetSha256, targetLength };
}
/**
 * Tạo file vi sai (Patch/Delta) giữa bản cũ (base) và bản mới (target)
 * Sử dụng thuật toán chunk-matching kết hợp nén Deflate/Zlib.
 */
function createDelta(baseBuf, targetBuf, blockSize = BLOCK_SIZE) {
    const baseMap = new Map();
    for (let i = 0; i <= baseBuf.length - blockSize; i += blockSize) {
        const chunk = baseBuf.subarray(i, i + blockSize);
        const hash = crypto_1.default.createHash("md5").update(chunk).digest("hex");
        if (!baseMap.has(hash)) {
            baseMap.set(hash, i);
        }
    }
    const ops = [];
    let insertBufs = [];
    let i = 0;
    function flushInsert() {
        if (insertBufs.length > 0) {
            const merged = Buffer.concat(insertBufs);
            ops.push({ type: "insert", data: merged });
            insertBufs = [];
        }
    }
    while (i < targetBuf.length) {
        if (i + blockSize <= targetBuf.length) {
            const chunk = targetBuf.subarray(i, i + blockSize);
            const hash = crypto_1.default.createHash("md5").update(chunk).digest("hex");
            if (baseMap.has(hash)) {
                flushInsert();
                const baseOffset = baseMap.get(hash);
                // Gom các khối copy liên tục để tiết kiệm dung lượng lệnh
                if (ops.length > 0 && ops[ops.length - 1].type === "copy") {
                    const last = ops[ops.length - 1];
                    if (last.offset + last.length === baseOffset) {
                        last.length += blockSize;
                        i += blockSize;
                        continue;
                    }
                }
                ops.push({ type: "copy", offset: baseOffset, length: blockSize });
                i += blockSize;
                continue;
            }
        }
        insertBufs.push(targetBuf.subarray(i, i + 1));
        i += 1;
    }
    flushInsert();
    const serializedOps = [];
    for (const op of ops) {
        if (op.type === "copy") {
            const b = Buffer.alloc(9);
            b.writeUInt8(1, 0); // 1 = COPY
            b.writeUInt32BE(op.offset, 1);
            b.writeUInt32BE(op.length, 5);
            serializedOps.push(b);
        }
        else {
            const header = Buffer.alloc(5);
            header.writeUInt8(2, 0); // 2 = INSERT
            header.writeUInt32BE(op.data.length, 1);
            serializedOps.push(header, op.data);
        }
    }
    const payload = Buffer.concat(serializedOps);
    const compressed = zlib_1.default.deflateSync(payload);
    const header = Buffer.alloc(HEADER_SIZE);
    header.write(MAGIC, 0, 8, "ascii");
    Buffer.from(crypto_1.default.createHash("sha256").update(baseBuf).digest("hex"), "hex").copy(header, 8);
    Buffer.from(crypto_1.default.createHash("sha256").update(targetBuf).digest("hex"), "hex").copy(header, 40);
    header.writeUInt32BE(targetBuf.length, 72);
    return Buffer.concat([header, compressed]);
}
/**
 * Ghép file patch lên baseBuf để tái tạo hoàn chỉnh targetBuf
 */
function applyDelta(baseBuf, patchBuf) {
    const meta = readDeltaHeader(patchBuf);
    const baseActualSha = crypto_1.default.createHash("sha256").update(baseBuf).digest("hex");
    if (baseActualSha.toLowerCase() !== meta.baseSha256.toLowerCase()) {
        throw new Error(`Base checksum mismatch: kỳ vọng ${meta.baseSha256}, thực tế ${baseActualSha}`);
    }
    const decompressed = zlib_1.default.inflateSync(patchBuf.subarray(HEADER_SIZE));
    const out = Buffer.alloc(meta.targetLength);
    let outPos = 0;
    let inPos = 0;
    while (inPos < decompressed.length) {
        const type = decompressed.readUInt8(inPos);
        inPos += 1;
        if (type === 1) {
            // 1 = COPY
            const offset = decompressed.readUInt32BE(inPos);
            const length = decompressed.readUInt32BE(inPos + 4);
            inPos += 8;
            baseBuf.copy(out, outPos, offset, offset + length);
            outPos += length;
        }
        else if (type === 2) {
            // 2 = INSERT
            const length = decompressed.readUInt32BE(inPos);
            inPos += 4;
            decompressed.copy(out, outPos, inPos, inPos + length);
            inPos += length;
            outPos += length;
        }
        else {
            throw new Error(`Opcode patch không hợp lệ: ${type}`);
        }
    }
    const actualSha = crypto_1.default.createHash("sha256").update(out).digest("hex");
    if (actualSha.toLowerCase() !== meta.targetSha256.toLowerCase()) {
        throw new Error(`Target checksum mismatch: kỳ vọng ${meta.targetSha256}, thực tế ${actualSha}`);
    }
    return out;
}
