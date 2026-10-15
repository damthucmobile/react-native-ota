package com.customota

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import java.io.File
import org.json.JSONArray
import org.json.JSONObject

object CustomOTABundleResolver {

    private var hasCheckedRollbackInProcess = false

    private fun getNativeAppVersion(context: Context): String {
        return try {
            val pInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.packageManager.getPackageInfo(context.packageName, PackageManager.PackageInfoFlags.of(0))
            } else {
                @Suppress("DEPRECATION")
                context.packageManager.getPackageInfo(context.packageName, 0)
            }
            pInfo.versionName ?: "0.0.0"
        } catch (e: Exception) {
            "0.0.0"
        }
    }

    private fun compareVersion(a: String?, b: String?): Int {
        val pa = (a ?: "0").trim().removePrefix("v").removePrefix("V").split(".").mapNotNull { it.toIntOrNull() }
        val pb = (b ?: "0").trim().removePrefix("v").removePrefix("V").split(".").mapNotNull { it.toIntOrNull() }
        val n = maxOf(pa.size, pb.size)
        for (i in 0 until n) {
            val x = pa.getOrElse(i) { 0 }
            val y = pb.getOrElse(i) { 0 }
            if (x > y) return 1
            if (x < y) return -1
        }
        return 0
    }

    /**
     * Tự động kiểm tra xem ứng dụng Native có vừa được nâng cấp (ví dụ qua CH Play / Store) hay không.
     * Nếu Native Version hiện tại MỚI HƠN nativeVersion lúc cài đặt OTA:
     * -> Xóa bỏ toàn bộ cache OTA cũ (ota/current, ota/backup) và state.json
     * để app khởi chạy bằng bundle nhúng sẵn trong file APK mới của bản cập nhật Native.
     */
    @JvmStatic
    fun checkAndCleanIfNativeUpdated(context: Context) {
        val stateFile = getStateFile(context)
        if (!stateFile.exists()) return

        try {
            val jsonStr = stateFile.readText()
            val json = JSONObject(jsonStr)
            val savedNativeVersion = json.optString("nativeVersion", "")
            val currentNativeVersion = getNativeAppVersion(context)

            // Nếu savedNativeVersion chưa có hoặc là giá trị mặc định ("0.0.0", "1.0.0"), 
            // tự động chuẩn hóa về currentNativeVersion của ứng dụng hiện tại, tuyệt đối KHÔNG xóa bundle!
            if (savedNativeVersion.isEmpty() || savedNativeVersion == "0.0.0" || savedNativeVersion == "1.0.0") {
                json.put("nativeVersion", currentNativeVersion)
                stateFile.writeText(json.toString(2))
                return
            }

            // Chỉ xóa cache OTA khi ứng dụng Native thực sự được nâng cấp qua Store (currentNativeVersion > savedNativeVersion)
            if (compareVersion(currentNativeVersion, savedNativeVersion) > 0) {
                android.util.Log.i("CustomOTA", "Native app upgraded from store ($savedNativeVersion -> $currentNativeVersion). Clearing OTA cache...")
                val currentDir = File(context.filesDir, "ota/current")
                val backupDir = File(context.filesDir, "ota/backup")
                currentDir.deleteRecursively()
                backupDir.deleteRecursively()
                stateFile.delete()
            }
        } catch (e: Exception) {
            android.util.Log.e("CustomOTA", "Error checking native update", e)
        }
    }

    /**
     * Lấy đường dẫn file JS bundle của OTA.
     * Tự động kiểm tra trạng thái crash/pending để phục hồi (Rollback) bản backup trước đó.
     */
    @JvmStatic
    fun getBundleFile(context: Context): String? {
        if (!hasCheckedRollbackInProcess) {
            hasCheckedRollbackInProcess = true
            checkAndCleanIfNativeUpdated(context)
            checkAndRollbackIfPending(context)
        }

        val file = File(
            context.filesDir,
            "ota/current/index.android.bundle"
        )

        return if (file.exists() && file.length() > 0) {
            android.util.Log.i("CustomOTA", "Active OTA bundle resolved at: ${file.absolutePath} (size: ${file.length()} bytes)")
            file.absolutePath
        } else {
            android.util.Log.i("CustomOTA", "No active OTA bundle found. Falling back to APK base bundle.")
            null
        }
    }

    @JvmStatic
    fun getStateFile(context: Context): File {
        return File(
            context.filesDir,
            "ota/state.json"
        )
    }

    @JvmStatic
    fun checkAndRollbackIfPending(context: Context) {
        val stateFile = getStateFile(context)
        if (!stateFile.exists()) return

        try {
            val jsonStr = stateFile.readText()
            val json = JSONObject(jsonStr)

            val pending = json.optBoolean("pending", false)
            if (!pending) {
                android.util.Log.i("CustomOTA", "OTA state is stable (pending=false). Active version: ${json.optString("currentVersion")}")
                return
            }

            val trialCount = json.optInt("trialCount", if (json.optBoolean("trial", false)) 1 else 0)
            val currentDir = File(context.filesDir, "ota/current")
            val backupDir = File(context.filesDir, "ota/backup")
            val currentVer = json.optString("currentVersion", "")

            // Chỉ rollback khi bản build crash liên tục >= 2 lần mà không hoàn thành khởi động
            if (trialCount >= 2) {
                android.util.Log.w("CustomOTA", "Phát hiện OTA v$currentVer không ổn định (thử $trialCount lần). Đang ROLLBACK...")
                if (backupDir.exists()) {
                    currentDir.deleteRecursively()
                    backupDir.renameTo(currentDir)
                    android.util.Log.i("CustomOTA", "Đã khôi phục thành công bản backup trước đó.")
                } else {
                    currentDir.deleteRecursively()
                    android.util.Log.i("CustomOTA", "Đã gỡ bỏ bản OTA lỗi để chạy bundle gốc.")
                }

                val failedArray = json.optJSONArray("failedVersions") ?: JSONArray()
                if (currentVer.isNotEmpty()) {
                    failedArray.put(currentVer)
                }
                json.put("failedVersions", failedArray)

                val prevVer = json.optString("previousVersion", "0.0.0")
                json.put("currentVersion", prevVer)
                json.put("pending", false)
                json.put("trial", false)
                json.put("trialCount", 0)
                json.put("ready", true)
            } else {
                val nextCount = trialCount + 1
                android.util.Log.i("CustomOTA", "Bản cập nhật v$currentVer đang khởi động thử (lần $nextCount). Chờ JS xác nhận...")
                json.put("trial", true)
                json.put("trialCount", nextCount)
            }

            stateFile.writeText(json.toString(2))
        } catch (e: Exception) {
            android.util.Log.e("CustomOTA", "Lỗi kiểm tra rollback", e)
        }
    }
}
