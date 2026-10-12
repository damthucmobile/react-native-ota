import Foundation
import UIKit
import React
import SSZipArchive

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
    func restart(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        resolve(nil)
        DispatchQueue.main.async {
            RCTTriggerReloadCommandListeners("OTA Update")
        }
    }
}
