import Foundation
import UIKit
import React
import SSZipArchive
import zlib

@objc(OTAUpdater)
final class OTAUpdater: NSObject, RCTBridgeModule {

    static func moduleName() -> String! {
        return "OTAUpdater"
    }

    static func requiresMainQueueSetup() -> Bool {
        return true
    }

    @objc
    func unzip(
        _ zipPath: String,
        targetDir: String,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        let success = SSZipArchive.unzipFile(atPath: zipPath, toDestination: targetDir)
        if success {
            resolve(nil)
        } else {
            reject("OTA_UNZIP", "Failed to unzip archive at \(zipPath)", nil)
        }
    }

    @objc
    func markReady(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        do {
            guard let stateURL = CustomOTABundleResolver.stateURL() else {
                resolve(nil)
                return
            }

            if FileManager.default.fileExists(atPath: stateURL.path) {
                var json = try JSONSerialization.jsonObject(
                    with: Data(contentsOf: stateURL),
                    options: []
                ) as? [String: Any] ?? [:]

                json["pending"] = false
                json["ready"] = true
                json["trial"] = false

                let data = try JSONSerialization.data(
                    withJSONObject: json,
                    options: [.prettyPrinted]
                )

                try data.write(to: stateURL)

                if let otaDir = CustomOTABundleResolver.getOTADirectory() {
                    let backup = otaDir.appendingPathComponent("backup")
                    try? FileManager.default.removeItem(at: backup)
                }
            }

            resolve(nil)
        } catch {
            reject("OTA_READY", error.localizedDescription, error)
        }
    }

    @objc
    func getCurrentVersion(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        do {
            guard let stateURL = CustomOTABundleResolver.stateURL(),
                  FileManager.default.fileExists(atPath: stateURL.path) else {
                resolve("0.0.0")
                return
            }

            let object = try JSONSerialization.jsonObject(
                with: Data(contentsOf: stateURL),
                options: []
            ) as? [String: Any]

            resolve(object?["currentVersion"] as? String ?? "0.0.0")
        } catch {
            reject("OTA_VERSION", error.localizedDescription, error)
        }
    }

    @objc
    func applyDelta(
        _ baseFilePath: String,
        patchFilePath: String,
        outputFilePath: String,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        do {
            guard let patchData = try? Data(contentsOf: URL(fileURLWithPath: patchFilePath)) else {
                reject("DELTA_FILE", "Không thể đọc file patch: \(patchFilePath)", nil)
                return
            }
            if patchData.count < 76 {
                reject("DELTA_INVALID", "File patch quá nhỏ (kỳ vọng >= 76 bytes)", nil)
                return
            }

            let magic = String(decoding: patchData.subdata(in: 0..<8), as: UTF8.self)
            if magic != "OTAPATCH" {
                reject("DELTA_MAGIC", "Magic patch không hợp lệ: \(magic)", nil)
                return
            }

            let compressedData = patchData.subdata(in: 76..<patchData.count)

            var stream = z_stream()
            var status = inflateInit_(&stream, ZLIB_VERSION, Int32(MemoryLayout<z_stream>.size))
            guard status == Z_OK else {
                reject("DELTA_ZLIB", "Lỗi khởi tạo zlib inflate", nil)
                return
            }
            defer { inflateEnd(&stream) }

            var decompressed = Data()
            let bufferSize = 65536
            var buffer = [UInt8](repeating: 0, count: bufferSize)

            compressedData.withUnsafeBytes { rawBuffer in
                guard let baseAddress = rawBuffer.baseAddress else { return }
                stream.next_in = UnsafeMutablePointer<Bytef>(mutating: baseAddress.assumingMemoryBound(to: Bytef.self))
                stream.avail_in = uInt(compressedData.count)

                repeat {
                    buffer.withUnsafeMutableBytes { outBuf in
                        guard let outBaseAddress = outBuf.baseAddress else { return }
                        stream.next_out = outBaseAddress.assumingMemoryBound(to: Bytef.self)
                        stream.avail_out = uInt(bufferSize)
                        status = inflate(&stream, Z_NO_FLUSH)
                        let bytesRead = bufferSize - Int(stream.avail_out)
                        if bytesRead > 0 {
                            decompressed.append(outBuf.bindMemory(to: UInt8.self).baseAddress!, count: bytesRead)
                        }
                    }
                } while status == Z_OK
            }

            guard status == Z_STREAM_END else {
                reject("DELTA_DECOMPRESS", "Giải nén patch thất bại với mã lỗi \(status)", nil)
                return
            }

            guard let baseHandle = FileHandle(forReadingAtPath: baseFilePath) else {
                reject("DELTA_BASE", "Không thể mở bundle cơ sở: \(baseFilePath)", nil)
                return
            }
            defer { try? baseHandle.close() }

            FileManager.default.createFile(atPath: outputFilePath, contents: nil, attributes: nil)
            guard let outHandle = FileHandle(forWritingAtPath: outputFilePath) else {
                reject("DELTA_OUT", "Không thể tạo file bundle đích: \(outputFilePath)", nil)
                return
            }
            defer { try? outHandle.close() }

            var inPos = 0
            let decCount = decompressed.count

            while inPos < decCount {
                let type = decompressed[inPos]
                inPos += 1

                if type == 1 { // COPY
                    guard inPos + 8 <= decCount else { break }
                    let offset = decompressed.subdata(in: inPos..<inPos+4).withUnsafeBytes { $0.load(as: UInt32.self).bigEndian }
                    let length = decompressed.subdata(in: inPos+4..<inPos+8).withUnsafeBytes { $0.load(as: UInt32.self).bigEndian }
                    inPos += 8

                    try baseHandle.seek(toOffset: UInt64(offset))
                    let chunk = baseHandle.readData(ofLength: Int(length))
                    try outHandle.write(contentsOf: chunk)
                } else if type == 2 { // INSERT
                    guard inPos + 4 <= decCount else { break }
                    let length = decompressed.subdata(in: inPos..<inPos+4).withUnsafeBytes { $0.load(as: UInt32.self).bigEndian }
                    inPos += 4
                    guard inPos + Int(length) <= decCount else { break }
                    let chunk = decompressed.subdata(in: inPos..<inPos+Int(length))
                    inPos += Int(length)
                    try outHandle.write(contentsOf: chunk)
                } else {
                    reject("DELTA_OPCODE", "Opcode patch không hợp lệ: \(type)", nil)
                    return
                }
            }

            resolve(outputFilePath)
        } catch {
            reject("DELTA_APPLY_ERROR", error.localizedDescription, error)
        }
    }

    @objc
    func restart(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        resolve(nil)
        DispatchQueue.main.async {
            RCTTriggerReloadCommandListeners("OTA Update")
        }
    }

    @objc
    func getNativeVersion(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        let version = (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "1.0.0"
        resolve(version)
    }

    @objc
    func getLocalAssets() -> [String] {
        guard let otaDir = CustomOTABundleResolver.getOTADirectory() else { return [] }
        let currentDir = otaDir.appendingPathComponent("current")
        let manifestFile = currentDir.appendingPathComponent("manifest.json")
        if let data = try? Data(contentsOf: manifestFile),
           let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
           let assets = json["assets"] as? [String] {
            return assets
        }
        return []
    }

    @objc
    func constantsToExport() -> [AnyHashable: Any]! {
        var bundleURLStr = Bundle.main.bundleURL.absoluteString
        if !bundleURLStr.hasSuffix("/") {
            bundleURLStr += "/"
        }
        return [
            "mainBundleURL": bundleURLStr
        ]
    }

    @objc
    func getMainBundleURL() -> String {
        var bundleURLStr = Bundle.main.bundleURL.absoluteString
        if !bundleURLStr.hasSuffix("/") {
            bundleURLStr += "/"
        }
        return bundleURLStr
    }
}
