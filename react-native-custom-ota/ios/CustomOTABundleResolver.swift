import Foundation

@objc(CustomOTABundleResolver)
public final class CustomOTABundleResolver: NSObject {

    @objc public static func getOTADirectory() -> URL? {
        FileManager.default.urls(
            for: .documentDirectory,
            in: .userDomainMask
        ).first?.appendingPathComponent("ota")
    }

    /**
     * Kiểm tra trạng thái pending trial theo chuẩn CodePush 2-stage boot:
     * - Lần khởi động đầu tiên của bản mới: Cho phép nạp bundle mới và đánh dấu trial = true.
     * - Nếu trial == true mà pending vẫn là true -> Nghĩa là lần trước app bị CRASH trước khi gọi markReady() -> ROLLBACK!
     */
    @objc public static func checkAndRollbackIfPending() {
        guard let stateURL = stateURL(), FileManager.default.fileExists(atPath: stateURL.path) else { return }
        do {
            let data = try Data(contentsOf: stateURL)
            guard var json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let pending = json["pending"] as? Bool, pending else { return }

            guard let otaDir = getOTADirectory() else { return }
            let currentDir = otaDir.appendingPathComponent("current")
            let backupDir = otaDir.appendingPathComponent("backup")

            let trial = json["trial"] as? Bool ?? false
            if trial {
                // Đã thử chạy một lần trước đó mà app bị crash/tắt trước khi markReady() -> ROLLBACK!
                print("[CustomOTA] Detected crash on pending release! Rolling back to backup...")
                try? FileManager.default.removeItem(at: currentDir)
                if FileManager.default.fileExists(atPath: backupDir.path) {
                    try? FileManager.default.moveItem(at: backupDir, to: currentDir)
                }

                // Cập nhật failedVersions và lùi version
                let failedVer = json["currentVersion"] as? String ?? ""
                var failedVersions = json["failedVersions"] as? [String] ?? []
                if !failedVer.isEmpty && !failedVersions.contains(failedVer) {
                    failedVersions.append(failedVer)
                }
                json["failedVersions"] = failedVersions

                let prevVer = json["previousVersion"] as? String ?? "0.0.0"
                json["currentVersion"] = prevVer
                json["pending"] = false
                json["trial"] = false
                json["ready"] = true
            } else {
                // Lần khởi động đầu tiên: cho phép nạp bản mới và đánh dấu trial = true
                json["trial"] = true
            }

            let updatedData = try JSONSerialization.data(withJSONObject: json, options: [.prettyPrinted])
            try updatedData.write(to: stateURL)
        } catch {
            print("OTA Rollback error: \(error)")
        }
    }

    @objc public static func currentBundleURL() -> URL? {
        checkAndRollbackIfPending()

        guard let otaDir = getOTADirectory() else { return nil }
        let bundlePath = otaDir.appendingPathComponent("current").appendingPathComponent("main.jsbundle")

        guard FileManager.default.fileExists(atPath: bundlePath.path) else {
            return nil
        }

        return bundlePath
    }

    @objc public static func stateURL() -> URL? {
        getOTADirectory()?.appendingPathComponent("state.json")
    }
}
