import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
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

const LOCAL_ROCKET_IMAGE = require("./src/assets/ota-test-image.png");
const LOCAL_AVATAR_IMAGE = require("./src/assets/avatar-test.png");
const REMOTE_SAMPLE_IMAGE_URL = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&q=80";

import CustomOTA, {
  InstallMode,
  SyncStatus,
  DownloadProgress,
  DetailedStatus,
  OTAProgressModal,
  formatBytes,
  readState,
  writeState
} from "react-native-custom-ota";

const DEFAULT_SERVER_URL = Platform.OS === "android" ? "http://10.0.2.2:4500" : "http://localhost:4500";
const NATIVE_VERSION = "1.0.0";
const APP_ID = "com.otademoapp";
const DEFAULT_PULL_API_KEY = "ota_pull_live_defc92afe497a8bbe5025b58fc6ac6c9f1309083a3da49e7";

export default function App() {
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({
    totalBytes: 0,
    receivedBytes: 0,
    percentage: 0,
    progress: 0
  });
  const [statusMessage, setStatusMessage] = useState("");
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [targetOtaVersion, setTargetOtaVersion] = useState("");

  const [checking, setChecking] = useState(false);
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [apiKey, setApiKey] = useState('ota_pull_live_defc92afe497a8bbe5025b58fc6ac6c9f1309083a3da49e7');
  const [logs, setLogs] = useState<string[]>([]);
  const [activeVersion, setActiveVersion] = useState("0.0.0");
  const [otaStateText, setOtaStateText] = useState("");

  // Trạng thái load ảnh để chẩn đoán OTA
  const [rocketImageStatus, setRocketImageStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [avatarImageStatus, setAvatarImageStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [remoteImageStatus, setRemoteImageStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [rocketImageError, setRocketImageError] = useState("");
  const [avatarImageError, setAvatarImageError] = useState("");

  const rocketResolved = Image.resolveAssetSource(LOCAL_ROCKET_IMAGE);
  const avatarResolved = Image.resolveAssetSource(LOCAL_AVATAR_IMAGE);

  const addLog = (message: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${message}`, ...prev.slice(0, 49)]);
  };

  useEffect(() => {
    async function boot() {
      addLog("🚀 App khởi động với react-native-custom-ota!");
      try {
        const state = await CustomOTA.getUpdateMetadata();
        const curVer = state?.currentVersion || "0.0.0 (Native APK)";
        setActiveVersion(curVer);
        setOtaStateText(state ? JSON.stringify(state, null, 2) : "Đang chạy Native APK gốc (Chưa có bản OTA)");
        addLog(`State ban đầu: version=${curVer}, pending=${state?.pending ?? false}`);

        // Đánh dấu bản build OTA hiện tại đã boot thành công (tránh rollback)
        if (state?.pending) {
          await CustomOTA.markReady();
          const readyState = await CustomOTA.getUpdateMetadata();
          setActiveVersion(readyState?.currentVersion || curVer);
          setOtaStateText(readyState ? JSON.stringify(readyState, null, 2) : "Native APK gốc");
          addLog("✅ Đã gọi CustomOTA.markReady() thành công!");
        }
      } catch (error) {
        addLog(`⚠️ markReady lỗi: ${String(error)}`);
      }
    }

    boot();

    // 1. Đăng ký sự kiện lắng nghe tiến độ tải toàn cục
    const unsubscribeProgress = CustomOTA.addProgressListener((prog) => {
      setDownloadProgress(prog);
    });

    // 2. Đăng ký sự kiện trạng thái chi tiết (Downloading, Verifying SHA-256, Installing...)
    const unsubscribeStatus = CustomOTA.addDetailedStatusListener((status, msg) => {
      if (msg) {
        setStatusMessage(msg);
        addLog(`[Status] ${msg}`);
      }
      if (
        status === DetailedStatus.DOWNLOADING ||
        status === DetailedStatus.VERIFYING ||
        status === DetailedStatus.INSTALLING
      ) {
        setShowProgressModal(true);
      } else if (status === DetailedStatus.COMPLETED || status === DetailedStatus.ERROR) {
        setTimeout(() => setShowProgressModal(false), 900);
      }
    });

    return () => {
      unsubscribeProgress();
      unsubscribeStatus();
    };
  }, []);

  const handleCheckAndInstall = async () => {
    setChecking(true);
    setDownloadProgress({ totalBytes: 0, receivedBytes: 0, percentage: 0, progress: 0 });
    setStatusMessage("Đang kiểm tra phiên bản mới...");
    addLog(`🔍 CustomOTA.checkForUpdate từ: ${serverUrl} (App: ${APP_ID})...`);

    try {
      const currentState = await CustomOTA.getUpdateMetadata();
      const currentVerStr = currentState?.currentVersion || "0.0.0";

      // Trường hợp người dùng vừa tải bản cập nhật nhưng chưa restart (pending = true)
      if (currentState?.pending) {
        addLog(`ℹ️ Bản cập nhật v${currentVerStr} đã được tải về và đang chờ khởi động lại.`);
        Alert.alert(
          "Cập nhật đã sẵn sàng",
          `Bản cập nhật v${currentVerStr} đã được tải về máy và đang chờ áp dụng.\nBạn có muốn khởi động lại ngay bây giờ?`,
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
        apiKey: 'ota_pull_live_defc92afe497a8bbe5025b58fc6ac6c9f1309083a3da49e7',
        nativeVersion: NATIVE_VERSION,
        channel: "production"
      });

      // Nếu không có bản cập nhật mới hoặc đã ở bản mới nhất
      if (!update || !update.updateAvailable) {
        addLog(`ℹ️ Ứng dụng đang ở phiên bản mới nhất (v${currentVerStr}).`);
        Alert.alert(
          "Đã là phiên bản mới nhất",
          `Ứng dụng của bạn đang chạy phiên bản v${currentVerStr} mới nhất. Không có bản cập nhật nào mới hơn.`
        );
        return;
      }

      const newVer = update.version || update.otaVersion || "";
      setTargetOtaVersion(newVer);
      addLog(`✨ Tìm thấy bản cập nhật v${newVer}! Dung lượng: ${formatBytes(update.size || 0)}.`);

      // Bật Modal tiến độ tải
      setShowProgressModal(true);

      const installed = await CustomOTA.downloadAndInstall(
        update,
        (prog: DownloadProgress) => {
          setDownloadProgress(prog);
        },
        InstallMode.ON_NEXT_RESTART
      );

      if (installed) {
        addLog(`🎉 Đã cài đặt OTA v${newVer}!`);
        const updatedState = await CustomOTA.getUpdateMetadata();
        setOtaStateText(JSON.stringify(updatedState, null, 2));

        Alert.alert(
          "Cập nhật thành công!",
          `Phiên bản: ${newVer}\nBắt buộc: ${update.isMandatory ? "Có" : "Không"}\n\nKhởi động lại ngay để áp dụng?`,
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
    setDownloadProgress({ totalBytes: 0, receivedBytes: 0, percentage: 0, progress: 0 });
    setStatusMessage("Đang đồng bộ...");
    addLog("⚡ Chạy CustomOTA.sync() (kiểu react-native-code-push)...");

    try {
      const syncStatus = await CustomOTA.sync(
        {
          serverUrl: serverUrl.trim(),
          appId: APP_ID,
          apiKey: apiKey.trim() || undefined,
          nativeVersion: NATIVE_VERSION,
          installMode: InstallMode.IMMEDIATE,
          mandatoryInstallMode: InstallMode.IMMEDIATE,
          showProgressModal: true
        },
        status => {
          addLog(`[Sync Status] ${status}`);
        },
        (prog: DownloadProgress) => {
          setDownloadProgress(prog);
        }
      );
      const updatedState = await CustomOTA.getUpdateMetadata();
      const updatedVer = updatedState?.currentVersion || "0.0.0";
      setActiveVersion(updatedVer);
      setOtaStateText(updatedState ? JSON.stringify(updatedState, null, 2) : "Đang chạy Native APK gốc");

      if (syncStatus === SyncStatus.UP_TO_DATE) {
        addLog(`ℹ️ Sync hoàn tất: Ứng dụng đã ở phiên bản mới nhất (v${updatedVer}).`);
        Alert.alert("Thông báo", `Ứng dụng đang ở phiên bản mới nhất (v${updatedVer}).`);
      }
    } catch (error: any) {
      addLog(`❌ Sync lỗi: ${error.message || String(error)}`);
    } finally {
      setChecking(false);
    }
  };

  // Demo preview Modal tiến độ tải để người dùng kiểm thử giao diện
  const handleDemoProgressModal = () => {
    setTargetOtaVersion("1.0.9 (Demo)");
    setShowProgressModal(true);
    setStatusMessage("Đang kết nối CDN & bắt đầu tải...");
    setDownloadProgress({ totalBytes: 8500000, receivedBytes: 0, percentage: 0, progress: 0 });

    const total = 8500000;
    let current = 0;
    const interval = setInterval(() => {
      current += 850000;
      if (current < total) {
        const pct = Math.round((current / total) * 100);
        setDownloadProgress({
          totalBytes: total,
          receivedBytes: current,
          percentage: pct,
          progress: current / total
        });
        setStatusMessage(`Đang tải bản cập nhật: ${pct}%`);
      } else {
        clearInterval(interval);
        setDownloadProgress({
          totalBytes: total,
          receivedBytes: total,
          percentage: 100,
          progress: 1
        });
        setStatusMessage("Đang kiểm tra tính toàn vẹn (SHA-256)...");
        setTimeout(() => {
          setStatusMessage("Đang giải nén và nạp gói cập nhật...");
          setTimeout(() => {
            setStatusMessage("Đã cài đặt thành công!");
            setTimeout(() => {
              setShowProgressModal(false);
            }, 800);
          }, 700);
        }, 700);
      }
    }, 200);
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
    setActiveVersion(state?.currentVersion || "0.0.0 (Native APK)");
    setOtaStateText(state ? JSON.stringify(state, null, 2) : "Đang chạy Native APK gốc (Chưa có bản OTA)");
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
          <Text style={styles.cardTitle}>📱 Trạng thái ứng dụng</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Native Version:</Text>
            <Text style={styles.statusValue}>{NATIVE_VERSION}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>OTA Version hiện tại:</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>v{activeVersion}</Text>
            </View>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Nền tảng:</Text>
            <Text style={styles.statusValue}>{Platform.OS} ({Platform.Version})</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>App ID:</Text>
            <Text style={[styles.statusValue, { color: "#38bdf8" }]}>{APP_ID}</Text>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* 🖼️ KHU VỰC TEST & CHẨN ĐOÁN HIỂN THỊ HÌNH ẢNH (IMAGE TEST)               */}
        {/* ========================================================================= */}
        <View style={styles.card}>
          <View style={styles.imageCardHeader}>
            <Text style={styles.cardTitle}>🖼️ Kiểm tra Hiển thị Ảnh (OTA Image Test)</Text>
            <View style={styles.badgeInfo}>
              <Text style={styles.badgeInfoText}>Chẩn đoán Bundle</Text>
            </View>
          </View>
          <Text style={styles.imageCardDescription}>
            Kiểm tra xem khi app nạp bundle OTA từ thư mục offline thì các ảnh import cục bộ (<Text style={{ color: "#38bdf8" }}>require('./assets/...')</Text>) có bị mất hoặc load lỗi hay không.
          </Text>

          {/* Test Item 1: Rocket Image (Local) */}
          <View style={styles.imageTestItem}>
            <View style={styles.imageThumbContainer}>
              <Image
                source={LOCAL_ROCKET_IMAGE}
                style={styles.imageThumb}
                resizeMode="cover"
                onLoad={() => {
                  setRocketImageStatus("loaded");
                  addLog("🖼️ [Ảnh 1 - Rocket] Tải thành công từ bundle!");
                }}
                onError={(e) => {
                  const err = e.nativeEvent?.error || "Không tìm thấy file ảnh";
                  setRocketImageStatus("error");
                  setRocketImageError(err);
                  addLog(`❌ [Ảnh 1 - Rocket] BỊ MẤT ẢNH: ${err}`);
                }}
              />
            </View>
            <View style={styles.imageTestMeta}>
              <View style={styles.imageMetaHeader}>
                <Text style={styles.imageMetaTitle}>Ảnh 1: Rocket Icon (Local)</Text>
                <View
                  style={[
                    styles.statusPill,
                    rocketImageStatus === "loaded"
                      ? styles.pillSuccess
                      : rocketImageStatus === "error"
                        ? styles.pillError
                        : styles.pillLoading
                  ]}
                >
                  <Text style={styles.statusPillText}>
                    {rocketImageStatus === "loaded"
                      ? "🟢 Hiển thị tốt"
                      : rocketImageStatus === "error"
                        ? "🔴 BỊ MẤT ẢNH"
                        : "🟡 Đang tải..."}
                  </Text>
                </View>
              </View>
              <Text style={styles.imagePathText} numberOfLines={2}>
                URI: {rocketResolved?.uri || "Chưa resolve"}
              </Text>
              {rocketImageError ? (
                <Text style={styles.imageErrorDetail}>Lỗi: {rocketImageError}</Text>
              ) : null}
            </View>
          </View>

          {/* Test Item 2: Avatar Image (Local) */}
          <View style={styles.imageTestItem}>
            <View style={styles.imageThumbContainer}>
              <Image
                source={LOCAL_AVATAR_IMAGE}
                style={styles.imageThumb}
                resizeMode="cover"
                onLoad={() => {
                  setAvatarImageStatus("loaded");
                  addLog("🖼️ [Ảnh 2 - Avatar] Tải thành công từ bundle!");
                }}
                onError={(e) => {
                  const err = e.nativeEvent?.error || "Không tìm thấy file ảnh";
                  setAvatarImageStatus("error");
                  setAvatarImageError(err);
                  addLog(`❌ [Ảnh 2 - Avatar] BỊ MẤT ẢNH: ${err}`);
                }}
              />
            </View>
            <View style={styles.imageTestMeta}>
              <View style={styles.imageMetaHeader}>
                <Text style={styles.imageMetaTitle}>Ảnh 2: Dev Avatar (Local)</Text>
                <View
                  style={[
                    styles.statusPill,
                    avatarImageStatus === "loaded"
                      ? styles.pillSuccess
                      : avatarImageStatus === "error"
                        ? styles.pillError
                        : styles.pillLoading
                  ]}
                >
                  <Text style={styles.statusPillText}>
                    {avatarImageStatus === "loaded"
                      ? "🟢 Hiển thị tốt"
                      : avatarImageStatus === "error"
                        ? "🔴 BỊ MẤT ẢNH"
                        : "🟡 Đang tải..."}
                  </Text>
                </View>
              </View>
              <Text style={styles.imagePathText} numberOfLines={2}>
                URI: {avatarResolved?.uri || "Chưa resolve"}
              </Text>
              {avatarImageError ? (
                <Text style={styles.imageErrorDetail}>Lỗi: {avatarImageError}</Text>
              ) : null}
            </View>
          </View>

          {/* Test Item 3: Remote Network Image */}
          <View style={[styles.imageTestItem, { marginBottom: 4 }]}>
            <View style={styles.imageThumbContainer}>
              <Image
                source={{ uri: REMOTE_SAMPLE_IMAGE_URL }}
                style={styles.imageThumb}
                resizeMode="cover"
                onLoad={() => setRemoteImageStatus("loaded")}
                onError={() => setRemoteImageStatus("error")}
              />
            </View>
            <View style={styles.imageTestMeta}>
              <View style={styles.imageMetaHeader}>
                <Text style={styles.imageMetaTitle}>Ảnh 3: Remote URL (Đối chứng)</Text>
                <View
                  style={[
                    styles.statusPill,
                    remoteImageStatus === "loaded"
                      ? styles.pillSuccess
                      : remoteImageStatus === "error"
                        ? styles.pillError
                        : styles.pillLoading
                  ]}
                >
                  <Text style={styles.statusPillText}>
                    {remoteImageStatus === "loaded"
                      ? "🟢 Luôn nạp được"
                      : remoteImageStatus === "error"
                        ? "🔴 Lỗi mạng"
                        : "🟡 Đang tải..."}
                  </Text>
                </View>
              </View>
              <Text style={styles.imagePathText} numberOfLines={2}>
                URL: https://images.unsplash.com/...
              </Text>
            </View>
          </View>

          {/* Hộp hướng dẫn test */}
          <View style={styles.testGuideBox}>
            <Text style={styles.testGuideTitle}>💡 Hướng dẫn kiểm tra 2 tình huống:</Text>
            <Text style={styles.testGuideItem}>
              • <Text style={{ color: "#4ade80", fontWeight: "bold" }}>Bản Chuẩn:</Text> Chạy{" "}
              <Text style={styles.codeInline}>yarn ota android 1.0.3</Text> → Nạp OTA xong ảnh vẫn hiển thị 🟢.
            </Text>
            <Text style={styles.testGuideItem}>
              • <Text style={{ color: "#f87171", fontWeight: "bold" }}>Bản Lỗi:</Text> Chạy{" "}
              <Text style={styles.codeInline}>yarn ota android 1.0.4 --broken-assets</Text> → Nạp OTA xong ảnh sẽ bị mất 🔴 do sai đường dẫn assets.
            </Text>
          </View>
        </View>

        {/* Server & API Key Config */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>⚙️ Cấu hình Máy chủ OTA</Text>
          <TextInput
            style={styles.input}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="http://localhost:4500"
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

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
            <Text style={[styles.cardTitle, { fontSize: 13 }]}>🔑 API Key (Pull Key)</Text>
            {apiKey !== DEFAULT_PULL_API_KEY && (
              <TouchableOpacity onPress={() => setApiKey(DEFAULT_PULL_API_KEY)}>
                <Text style={{ fontSize: 11, color: "#38bdf8", fontWeight: "600" }}>Khôi phục mặc định</Text>
              </TouchableOpacity>
            )}
          </View>
          <TextInput
            style={styles.input}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder="ota_pull_live_xxxx"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
          />
        </View>

        {/* Live Progress Bar Section */}
        {(checking || downloadProgress.percentage > 0) && (
          <View style={styles.progressContainer}>
            <View style={styles.progressHeaderRow}>
              <Text style={styles.progressTitleText}>
                {statusMessage || "Tiến độ tải gói OTA:"}
              </Text>
              <Text style={styles.progressPercentBadge}>
                {downloadProgress.percentage}%
              </Text>
            </View>

            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${downloadProgress.percentage}%` }
                ]}
              />
            </View>

            <View style={styles.progressFooterRow}>
              <Text style={styles.progressBytesText}>
                {downloadProgress.totalBytes > 0
                  ? `${formatBytes(downloadProgress.receivedBytes)} / ${formatBytes(downloadProgress.totalBytes)}`
                  : "Đang nạp dữ liệu..."}
              </Text>
              <Text style={styles.progressSpeedText}>
                {downloadProgress.percentage === 100 ? "Hoàn tất" : "Đang tải"}
              </Text>
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
            🚀 CustomOTA.sync() (Auto Modal + Restart)
          </Text>
        </TouchableOpacity>

        {/* Nút xem thử Modal tiến độ */}
        <TouchableOpacity style={styles.previewButton} onPress={handleDemoProgressModal}>
          <Text style={styles.previewButtonText}>
            🎨 Test Modal tiến độ tải (Mô phỏng UI)
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

      {/* Built-in Progress Modal từ thư viện */}
      <OTAProgressModal
        visible={showProgressModal}
        progress={downloadProgress}
        statusText={statusMessage}
        version={targetOtaVersion}
      />
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
    alignItems: "center",
    marginVertical: 16
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#38bdf8",
    letterSpacing: 0.5
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
    fontWeight: "bold",
    color: "#f1f5f9",
    marginBottom: 12
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#334155"
  },
  statusLabel: {
    fontSize: 13,
    color: "#94a3b8"
  },
  statusValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#e2e8f0"
  },
  badge: {
    backgroundColor: "#0284c7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold"
  },
  input: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 8,
    color: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    marginTop: 6
  },
  presetButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8
  },
  presetBtn: {
    flex: 1,
    backgroundColor: "#334155",
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center"
  },
  presetBtnText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "500"
  },
  progressContainer: {
    backgroundColor: "#0f172a",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#0284c7"
  },
  progressHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10
  },
  progressTitleText: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "600",
    flex: 1
  },
  progressPercentBadge: {
    color: "#38bdf8",
    fontSize: 16,
    fontWeight: "800"
  },
  progressBarTrack: {
    height: 10,
    backgroundColor: "#1e293b",
    borderRadius: 999,
    overflow: "hidden"
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#38bdf8",
    borderRadius: 999
  },
  progressFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8
  },
  progressBytesText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "500"
  },
  progressSpeedText: {
    color: "#38bdf8",
    fontSize: 12,
    fontWeight: "600"
  },
  primaryButton: {
    backgroundColor: "#0284c7",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10
  },
  disabledButton: {
    opacity: 0.6
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 15
  },
  syncButton: {
    backgroundColor: "#059669",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10
  },
  syncButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 15
  },
  previewButton: {
    backgroundColor: "#1e1b4b",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#6366f1"
  },
  previewButtonText: {
    color: "#c7d2fe",
    fontWeight: "600",
    fontSize: 14
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
  },
  imageCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6
  },
  badgeInfo: {
    backgroundColor: "#0369a1",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  badgeInfoText: {
    color: "#e0f2fe",
    fontSize: 11,
    fontWeight: "bold"
  },
  imageCardDescription: {
    fontSize: 12,
    color: "#94a3b8",
    lineHeight: 18,
    marginBottom: 12
  },
  imageTestItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#334155"
  },
  imageThumbContainer: {
    width: 64,
    height: 64,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#475569",
    justifyContent: "center",
    alignItems: "center"
  },
  imageThumb: {
    width: "100%",
    height: "100%"
  },
  imageTestMeta: {
    flex: 1,
    marginLeft: 12
  },
  imageMetaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4
  },
  imageMetaTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#f8fafc"
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12
  },
  pillSuccess: {
    backgroundColor: "#065f46"
  },
  pillError: {
    backgroundColor: "#7f1d1d"
  },
  pillLoading: {
    backgroundColor: "#854d0e"
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#ffffff"
  },
  imagePathText: {
    fontSize: 10,
    color: "#64748b",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginTop: 2
  },
  imageErrorDetail: {
    fontSize: 11,
    color: "#f87171",
    marginTop: 2,
    fontWeight: "500"
  },
  testGuideBox: {
    backgroundColor: "#111827",
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#38bdf8"
  },
  testGuideTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#f1f5f9",
    marginBottom: 4
  },
  testGuideItem: {
    fontSize: 11,
    color: "#cbd5e1",
    lineHeight: 18,
    marginTop: 2
  },
  codeInline: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: "#38bdf8",
    backgroundColor: "#1e293b"
  }
});

