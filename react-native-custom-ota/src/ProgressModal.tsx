import React from "react";
import {
  Modal,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Dimensions
} from "react-native";
import { DownloadProgress } from "./types";

export interface OTAProgressModalProps {
  /** Trạng thái hiển thị modal */
  visible: boolean;
  /** Thông tin tiến độ tải (object hoặc số thập phân 0.0 - 1.0) */
  progress?: DownloadProgress | number;
  /** Tiêu đề modal (Mặc định: 'Cập nhật ứng dụng') */
  title?: string;
  /** Thông điệp trạng thái hiện tại (vd: 'Đang tải gói cập nhật...') */
  statusText?: string;
  /** Phiên bản đang được tải về (vd: '1.0.9') */
  version?: string;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export const OTAProgressModal: React.FC<OTAProgressModalProps> = ({
  visible,
  progress,
  title = "Cập nhật ứng dụng",
  statusText = "Đang tải bản cập nhật...",
  version
}) => {
  // Chuẩn hóa dữ liệu tiến độ
  let percent = 0;
  let receivedBytes = 0;
  let totalBytes = 0;

  if (typeof progress === "number") {
    percent = Math.min(100, Math.max(0, Math.round(progress * 100)));
  } else if (progress && typeof progress === "object") {
    percent = Math.min(100, Math.max(0, Math.round(progress.percentage || 0)));
    receivedBytes = progress.receivedBytes || 0;
    totalBytes = progress.totalBytes || 0;
  }

  const bytesInfo = totalBytes > 0
    ? `${formatBytes(receivedBytes)} / ${formatBytes(totalBytes)}`
    : "";

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Text style={styles.iconText}>⚡</Text>
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.title}>{title}</Text>
              {version ? (
                <Text style={styles.versionBadge}>Phiên bản v{version}</Text>
              ) : null}
            </View>
          </View>

          {/* Status Message */}
          <Text style={styles.statusText}>{statusText}</Text>

          {/* Progress Bar */}
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
          </View>

          {/* Progress Details */}
          <View style={styles.detailsRow}>
            <Text style={styles.percentageText}>{percent}%</Text>
            {bytesInfo ? (
              <Text style={styles.bytesText}>{bytesInfo}</Text>
            ) : null}
          </View>

          {/* Footer note */}
          <View style={styles.footer}>
            <ActivityIndicator size="small" color="#38bdf8" style={{ marginRight: 8 }} />
            <Text style={styles.footerText}>
              Vui lòng không đóng ứng dụng...
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 16
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)"
  },
  iconText: {
    fontSize: 22
  },
  headerTextContainer: {
    flex: 1
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f8fafc",
    letterSpacing: 0.2
  },
  versionBadge: {
    fontSize: 12,
    color: "#38bdf8",
    fontWeight: "600",
    marginTop: 2
  },
  statusText: {
    fontSize: 14,
    color: "#94a3b8",
    marginBottom: 16,
    lineHeight: 20
  },
  progressBarTrack: {
    height: 10,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 10
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#38bdf8",
    borderRadius: 999
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20
  },
  percentageText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#38bdf8"
  },
  bytesText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500"
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)"
  },
  footerText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500"
  }
});

export default OTAProgressModal;
