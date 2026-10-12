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
    fun restart(promise: Promise) {
        try {
            val activity: Activity? =
                reactContext.currentActivity

            if (activity == null) {
                promise.reject(
                    "OTA_RESTART",
                    "No current Activity"
                )
                return
            }

            promise.resolve(null)

            Handler(Looper.getMainLooper()).postDelayed({
                val packageManager =
                    reactContext.packageManager

                val intent =
                    packageManager.getLaunchIntentForPackage(
                        reactContext.packageName
                    )

                intent?.addFlags(
                    android.content.Intent.FLAG_ACTIVITY_NEW_TASK or
                    android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK
                )

                reactContext.startActivity(intent)
                activity.finishAffinity()
            }, 300)
        } catch (e: Exception) {
            promise.reject("OTA_RESTART", e)
        }
    }
}
