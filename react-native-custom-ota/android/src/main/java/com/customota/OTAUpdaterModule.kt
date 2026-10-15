package com.customota

import android.app.Activity
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.zip.ZipInputStream
import org.json.JSONObject

class OTAUpdaterModule(
    private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "OTAUpdater"

    @ReactMethod
    fun unzip(zipPath: String, targetDir: String, promise: Promise) {
        try {
            val dest = File(targetDir)
            if (!dest.exists()) {
                dest.mkdirs()
            }

            val buffer = ByteArray(4096)
            val zis = ZipInputStream(FileInputStream(zipPath))
            var zipEntry = zis.nextEntry

            while (zipEntry != null) {
                val newFile = File(dest, zipEntry.name)
                if (!newFile.canonicalPath.startsWith(dest.canonicalPath)) {
                    throw SecurityException("Zip Slip detected: " + zipEntry.name)
                }

                if (zipEntry.isDirectory) {
                    newFile.mkdirs()
                } else {
                    newFile.parentFile?.mkdirs()
                    val fos = FileOutputStream(newFile)
                    var len: Int
                    while (zis.read(buffer).also { len = it } > 0) {
                        fos.write(buffer, 0, len)
                    }
                    fos.close()
                }
                zipEntry = zis.nextEntry
            }
            zis.closeEntry()
            zis.close()

            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("OTA_UNZIP", e)
        }
    }

    @ReactMethod
    fun applyDelta(baseFilePath: String, patchFilePath: String, outputFilePath: String, promise: Promise) {
        try {
            val patchFile = File(patchFilePath)
            val baseFile = File(baseFilePath)
            val outputFile = File(outputFilePath)
            outputFile.parentFile?.mkdirs()

            if (!baseFile.exists()) {
                promise.reject("DELTA_BASE_NOT_FOUND", "Base bundle không tồn tại: $baseFilePath")
                return
            }

            val fis = FileInputStream(patchFile)
            val header = ByteArray(76)
            var readH = 0
            while (readH < 76) {
                val r = fis.read(header, readH, 76 - readH)
                if (r < 0) break
                readH += r
            }

            val magic = String(header, 0, 8, Charsets.US_ASCII)
            if (magic != "OTAPATCH") {
                fis.close()
                promise.reject("DELTA_INVALID_MAGIC", "Magic patch không hợp lệ: $magic")
                return
            }

            val iis = java.util.zip.InflaterInputStream(fis)
            val dis = java.io.DataInputStream(iis)
            val baseRaf = java.io.RandomAccessFile(baseFile, "r")
            val fos = java.io.BufferedOutputStream(FileOutputStream(outputFile))

            val buf = ByteArray(8192)

            while (true) {
                val type = try { dis.readUnsignedByte() } catch (eof: java.io.EOFException) { break }
                if (type == 1) { // 1 = COPY (offset: 4 bytes, length: 4 bytes)
                    val offset = dis.readInt().toLong() and 0xFFFFFFFFL
                    val length = dis.readInt()
                    baseRaf.seek(offset)
                    var remaining = length
                    while (remaining > 0) {
                        val toRead = minOf(remaining, buf.size)
                        val r = baseRaf.read(buf, 0, toRead)
                        if (r <= 0) break
                        fos.write(buf, 0, r)
                        remaining -= r
                    }
                } else if (type == 2) { // 2 = INSERT (length: 4 bytes, followed by bytes)
                    val length = dis.readInt()
                    var remaining = length
                    while (remaining > 0) {
                        val toRead = minOf(remaining, buf.size)
                        val r = dis.read(buf, 0, toRead)
                        if (r <= 0) break
                        fos.write(buf, 0, r)
                        remaining -= r
                    }
                } else {
                    throw IllegalStateException("Opcode không hợp lệ: $type")
                }
            }

            fos.flush()
            fos.close()
            baseRaf.close()
            dis.close()
            fis.close()

            promise.resolve(outputFile.absolutePath)
        } catch (e: Exception) {
            promise.reject("DELTA_APPLY_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun markReady(promise: Promise) {
        try {
            val stateFile = File(
                reactContext.filesDir,
                "ota/state.json"
            )

            if (stateFile.exists()) {
                val json = JSONObject(stateFile.readText())
                json.put("pending", false)
                json.put("ready", true)
                json.put("trial", false)
                json.put("trialCount", 0)
                stateFile.writeText(json.toString(2))

                File(
                    reactContext.filesDir,
                    "ota/backup"
                ).deleteRecursively()
            }

            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("OTA_READY", e)
        }
    }

    @ReactMethod
    fun getCurrentVersion(promise: Promise) {
        try {
            val stateFile = File(
                reactContext.filesDir,
                "ota/state.json"
            )

            if (!stateFile.exists()) {
                promise.resolve("0.0.0")
                return
            }

            val json = stateFile.readText()
            val regex =
                Regex("\"currentVersion\"\\s*:\\s*\"([^\"]+)\"")

            promise.resolve(
                regex.find(json)?.groupValues?.get(1)
                    ?: "0.0.0"
            )
        } catch (e: Exception) {
            promise.reject("OTA_VERSION", e)
        }
    }

    @ReactMethod
    fun getNativeVersion(promise: Promise) {
        try {
            val pInfo = reactContext.packageManager.getPackageInfo(reactContext.packageName, 0)
            val versionName = pInfo.versionName ?: "1.0.0"
            promise.resolve(versionName)
        } catch (e: Exception) {
            promise.resolve("1.0.0")
        }
    }

    @ReactMethod
    fun restart(promise: Promise) {
        try {
            val activity: Activity? = reactContext.currentActivity
            promise.resolve(null)

            Handler(Looper.getMainLooper()).postDelayed({
                try {
                    val packageManager = reactContext.packageManager
                    val intent = packageManager.getLaunchIntentForPackage(reactContext.packageName)

                    if (intent != null) {
                        intent.addFlags(
                            android.content.Intent.FLAG_ACTIVITY_NEW_TASK or
                            android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP or
                            android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK
                        )
                        reactContext.startActivity(intent)
                    }

                    activity?.finishAffinity()

                    // Diệt hẳn tiến trình hiện tại để Android khởi động lại một Process mới tinh,
                    // giải phóng toàn bộ static cache của ReactHost/ReactNativeHost và nạp bundle OTA mới.
                    Runtime.getRuntime().exit(0)
                } catch (e: Exception) {
                    Runtime.getRuntime().exit(0)
                }
            }, 250)
        } catch (e: Exception) {
            promise.reject("OTA_RESTART", e)
        }
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun getLocalAssets(): com.facebook.react.bridge.WritableArray {
        val array = com.facebook.react.bridge.Arguments.createArray()
        try {
            val currentDir = File(reactContext.filesDir, "ota/current")
            if (currentDir.exists() && currentDir.isDirectory) {
                val manifestFile = File(currentDir, "manifest.json")
                if (manifestFile.exists()) {
                    val json = JSONObject(manifestFile.readText())
                    val assets = json.optJSONArray("assets")
                    if (assets != null) {
                        for (i in 0 until assets.length()) {
                            array.pushString(assets.getString(i))
                        }
                        return array
                    }
                }
                currentDir.listFiles()?.forEach { file ->
                    if (file.isDirectory && file.name.startsWith("drawable")) {
                        file.listFiles()?.forEach { assetFile ->
                            array.pushString("${file.name}/${assetFile.name}")
                        }
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return array
    }
}
