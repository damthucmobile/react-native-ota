package com.customota

import android.content.Context
import java.io.File
import org.json.JSONArray
import org.json.JSONObject

object CustomOTABundleResolver {

    /**
     * Lấy đường dẫn file JS bundle của OTA.
     * Tự động kiểm tra trạng thái crash/pending để phục hồi (Rollback) bản backup trước đó.
     */
    @JvmStatic
    fun getBundleFile(context: Context): String? {
        checkAndRollbackIfPending(context)

        val file = File(
            context.filesDir,
            "ota/current/index.android.bundle"
        )

        return if (file.exists() && file.length() > 0) {
            file.absolutePath
        } else {
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
            if (!pending) return

            val trial = json.optBoolean("trial", false)
            val currentDir = File(context.filesDir, "ota/current")
            val backupDir = File(context.filesDir, "ota/backup")

            if (trial) {
                // Đã thử chạy lần trước mà bị crash trước khi gọi markReady() -> ROLLBACK!
                if (backupDir.exists()) {
                    currentDir.deleteRecursively()
                    backupDir.renameTo(currentDir)
                } else {
                    currentDir.deleteRecursively()
                }

                val failedVer = json.optString("currentVersion", "")
                val failedArray = json.optJSONArray("failedVersions") ?: JSONArray()
                if (failedVer.isNotEmpty()) {
                    failedArray.put(failedVer)
                }
                json.put("failedVersions", failedArray)

                val prevVer = json.optString("previousVersion", "0.0.0")
                json.put("currentVersion", prevVer)
                json.put("pending", false)
                json.put("trial", false)
                json.put("ready", true)
            } else {
                // Lần đầu mở bản mới: cho phép chạy và đánh dấu trial = true
                json.put("trial", true)
            }

            stateFile.writeText(json.toString(2))
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
