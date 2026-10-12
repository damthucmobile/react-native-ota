import React, { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

import CustomOTA, {
  InstallMode,
  SyncStatus,
  readState,
  writeState
} from "react-native-custom-ota";

const DEFAULT_SERVER_URL = Platform.OS === "android" ? "http://10.0.2.2:4500" : "http://localhost:4500";
const NATIVE_VERSION = "1.0.0";
const APP_ID = "com.otademoapp";

export default function App() {
  const [progress, setProgress] = useState(0);
  const [checking, setChecking] = useState(false);
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [logs, setLogs] = useState<string[]>([]);
  const [activeVersion, setActiveVersion] = useState("0.0.0");
  const [otaStateText, setOtaStateText] = useState("");

  const addLog = (message: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${message}`, ...prev.slice(0, 49)]);
  };

  useEffect(() => {
    async function boot() {
      addLog("🚀 App khởi động với react-native-custom-ota!");
      try {
        const state = await CustomOTA.getUpdateMetadata();
        setActiveVersion(state.currentVersion);
        setOtaStateText(JSON.stringify(state, null, 2));
        addLog(`State ban đầu: version=${state.currentVersion}, pending=${state.pending}`);

        // Đánh dấu bản build OTA hiện tại đã boot thành công (tránh rollback)
        await CustomOTA.markReady();
        const readyState = await CustomOTA.getUpdateMetadata();
        setActiveVersion(readyState.currentVersion);
        setOtaStateText(JSON.stringify(readyState, null, 2));
        addLog("✅ Đã gọi CustomOTA.markReady() thành công!");
      } catch (error) {
        addLog(`⚠️ markReady lỗi: ${String(error)}`);
      }
    }

    boot();
  }, []);

  const handleCheckAndInstall = async () => {
    setChecking(true);
    setProgress(0);
    addLog(`🔍 CustomOTA.checkForUpdate từ: ${serverUrl} (App: ${APP_ID})...`);

    try {
      const currentState = await CustomOTA.getUpdateMetadata();

      // Trường hợp người dùng vừa tải bản cập nhật nhưng chưa restart (pending = true)
      if (currentState.pending) {
        addLog(`ℹ️ Bản cập nhật v${currentState.currentVersion} đã được tải về và đang chờ khởi động lại.`);
        Alert.alert(
          "Cập nhật đã sẵn sàng",
          `Bản cập nhật v${currentState.currentVersion} đã được tải về máy và đang chờ áp dụng.\nBạn có muốn khởi động lại ngay bây giờ?`,
          [
            { text: "Để sau", style: "cancel" },
            {
              text: "Khởi động lại ngay",
              onPress: () => {
                addLog("🔄 CustomOTA.restartApp()...");
                CustomOTA.restartApp();
              }
            }
          ]
        );
        return;
      }

      const update = await CustomOTA.checkForUpdate({
        serverUrl: serverUrl.trim(),
        appId: APP_ID,
        nativeVersion: NATIVE_VERSION,
        channel: "production"
      });

      // Nếu không có bản cập nhật mới hoặc đã ở bản mới nhất
      if (!update || !update.updateAvailable) {
        addLog(`ℹ️ Ứng dụng đang ở phiên bản mới nhất (v${currentState.currentVersion}).`);
        Alert.alert(
          "Đã là phiên bản mới nhất",
          `Ứng dụng của bạn đang chạy phiên bản v${currentState.currentVersion} mới nhất. Không có bản cập nhật nào mới hơn.`
        );
        return;
      }

      addLog(`✨ Tìm thấy bản cập nhật v${update.version}! Bắt đầu tải...`);

      const installed = await CustomOTA.downloadAndInstall(
        update,
        val => {
          setProgress(val);
        },
        InstallMode.ON_NEXT_RESTART
      );

      if (installed) {
        addLog(`🎉 Đã cài đặt OTA v${update.version}!`);
        const updatedState = await CustomOTA.getUpdateMetadata();
        setOtaStateText(JSON.stringify(updatedState, null, 2));

        Alert.alert(
          "Cập nhật thành công!",
          `Phiên bản: ${update.version}\nBắt buộc: ${update.isMandatory ? "Có" : "Không"}\n\nKhởi động lại ngay để áp dụng?`,
          [
            { text: "Để sau", style: "cancel" },
            {
              text: "Khởi động lại ngay",
              onPress: () => {
                addLog("🔄 CustomOTA.restartApp()...");
                CustomOTA.restartApp();
              }
            }
          ]
        );
      }
    } catch (error: any) {
      addLog(`❌ Cập nhật thất bại: ${error.message || String(error)}`);
      Alert.alert("Lỗi OTA", error.message || String(error));
    } finally {
      setChecking(false);
    }
  };

  const handleSyncCodePushStyle = async () => {
    setChecking(true);
    setProgress(0);
    addLog("⚡ Chạy CustomOTA.sync() (kiểu react-native-code-push)...");

    try {
      const syncStatus = await CustomOTA.sync(
        {
          serverUrl: serverUrl.trim(),
          appId: APP_ID,
          nativeVersion: NATIVE_VERSION,
          installMode: InstallMode.IMMEDIATE,
          mandatoryInstallMode: InstallMode.IMMEDIATE
        },
        status => {
          addLog(`[Sync Status] ${status}`);
        },
        val => {
          setProgress(val);
        }
      );
      const updatedState = await CustomOTA.getUpdateMetadata();
      setActiveVersion(updatedState.currentVersion);
      setOtaStateText(JSON.stringify(updatedState, null, 2));

      if (syncStatus === SyncStatus.UP_TO_DATE) {
        addLog(`ℹ️ Sync hoàn tất: Ứng dụng đã ở phiên bản mới nhất (v${updatedState.currentVersion}).`);
        Alert.alert("Thông báo", `Ứng dụng đang ở phiên bản mới nhất (v${updatedState.currentVersion}).`);
      }
    } catch (error: any) {
      addLog(`❌ Sync lỗi: ${error.message || String(error)}`);
    } finally {
      setChecking(false);
    }
  };

  const handleSimulatePendingCrash = async () => {
    try {
      const state = await readState();
      state.pending = true;
      state.ready = false;
      await writeState(state);
      addLog("⚠️ Đã đặt pending=true để thử nghiệm Rollback.");
      Alert.alert(
        "Đã đặt pending=true",
        "Khi tắt app và mở lại, Native Resolver từ react-native-custom-ota sẽ phát hiện pending=true và tự động khôi phục về bản backup!",
        [
          { text: "Đóng" },
          { text: "Restart ngay", onPress: () => CustomOTA.restartApp() }
        ]
      );
    } catch (e) {
      addLog(`Lỗi: ${String(e)}`);
    }
  };

  const handleRefreshState = async () => {
    const state = await CustomOTA.getUpdateMetadata();
    setActiveVersion(state.currentVersion);
    setOtaStateText(JSON.stringify(state, null, 2));
    addLog("🔄 Đã cập nhật lại thông tin State.");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>react-native-custom-ota</Text>
          <Text style={styles.subtitle}>Thư viện OTA độc lập chuẩn Code-Push</Text>
        </View>

        {/* Status Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📱 Thông tin phiên bản</Text>
          <View style={styles.row}>
            <Text style={styles.label}>App ID:</Text>
            <Text style={[styles.value, { color: "#38bdf8" }]}>{APP_ID}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Nền tảng:</Text>
            <Text style={styles.value}>{Platform.OS.toUpperCase()}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Native Target Version:</Text>
            <Text style={styles.value}>{NATIVE_VERSION}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>OTA Version hiện hành:</Text>
            <Text style={[styles.value, styles.highlightValue]}>
              {activeVersion === "0.0.0" ? "0.0.0 (Gốc Native APK/IPA)" : `v${activeVersion}`}
            </Text>
          </View>
        </View>

        {/* Server Config Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🌐 Cấu hình OTA Server</Text>
          <TextInput
            style={styles.input}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="http://10.0.2.2:4500"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
          />

          <View style={styles.presetButtons}>
            <TouchableOpacity
              style={styles.presetBtn}
              onPress={() => setServerUrl("http://10.0.2.2:4500")}
            >
              <Text style={styles.presetBtnText}>Android Emulator</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.presetBtn}
              onPress={() => setServerUrl("http://localhost:4500")}
            >
              <Text style={styles.presetBtnText}>Localhost (iOS)</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Progress Bar */}
        {checking && (
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>Tiến độ tải: {Math.round(progress * 100)}%</Text>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <TouchableOpacity
          style={[styles.primaryButton, checking && styles.disabledButton]}
          onPress={handleCheckAndInstall}
          disabled={checking}
        >
          <Text style={styles.primaryButtonText}>
            {checking ? "⏳ Đang xử lý cập nhật..." : "⚡ CustomOTA.checkForUpdate()"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.syncButton, checking && styles.disabledButton]}
          onPress={handleSyncCodePushStyle}
          disabled={checking}
        >
          <Text style={styles.syncButtonText}>
            🚀 CustomOTA.sync() (Auto Restart)
          </Text>
        </TouchableOpacity>

        <View style={styles.secondaryActions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleRefreshState}>
            <Text style={styles.secondaryButtonText}>🔍 Đọc lại State</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => CustomOTA.restartApp()}>
            <Text style={styles.secondaryButtonText}>🔄 Khởi động lại</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.dangerButton} onPress={handleSimulatePendingCrash}>
          <Text style={styles.dangerButtonText}>🧪 Test Crash/Rollback (Set pending=true)</Text>
        </TouchableOpacity>

        {/* State Preview */}
        {otaStateText ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📄 ota/state.json</Text>
            <Text style={styles.codeBlock}>{otaStateText}</Text>
          </View>
        ) : null}

        {/* Activity Logs */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 Nhật ký hoạt động (Logs)</Text>
          {logs.map((log, index) => (
            <Text key={index} style={styles.logText}>
              {log}
            </Text>
          ))}
          {logs.length === 0 && <Text style={styles.emptyLog}>Chưa có hoạt động</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#090d16"
  },
  container: {
    padding: 16,
    paddingBottom: 40
  },
  header: {
    marginBottom: 20,
    alignItems: "center"
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#38bdf8"
  },
  subtitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 4
  },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155"
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#f8fafc",
    marginBottom: 10
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4
  },
  label: {
    color: "#94a3b8",
    fontSize: 14
  },
  value: {
    color: "#f1f5f9",
    fontSize: 14,
    fontWeight: "500"
  },
  highlightValue: {
    color: "#4ade80",
    fontWeight: "bold"
  },
  input: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#475569",
    borderRadius: 8,
    color: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 8
  },
  presetButtons: {
    flexDirection: "row",
    gap: 8
  },
  presetBtn: {
    backgroundColor: "#334155",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6
  },
  presetBtnText: {
    color: "#cbd5e1",
    fontSize: 12
  },
  progressContainer: {
    marginBottom: 16
  },
  progressText: {
    color: "#38bdf8",
    fontSize: 12,
    marginBottom: 4,
    textAlign: "right"
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: "#334155",
    borderRadius: 4,
    overflow: "hidden"
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#38bdf8"
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12
  },
  disabledButton: {
    opacity: 0.6
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 16
  },
  syncButton: {
    backgroundColor: "#059669",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12
  },
  syncButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 16
  },
  secondaryActions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#334155",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center"
  },
  secondaryButtonText: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "500"
  },
  dangerButton: {
    backgroundColor: "#7f1d1d",
    borderWidth: 1,
    borderColor: "#ef4444",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 16
  },
  dangerButtonText: {
    color: "#fecaca",
    fontSize: 13,
    fontWeight: "600"
  },
  codeBlock: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    backgroundColor: "#0f172a",
    color: "#a5f3fc",
    padding: 10,
    borderRadius: 6,
    fontSize: 12
  },
  logText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: "#cbd5e1",
    fontSize: 11,
    marginBottom: 3
  },
  emptyLog: {
    color: "#64748b",
    fontSize: 12,
    fontStyle: "italic"
  }
});
