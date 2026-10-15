"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OTAProgressModal = void 0;
exports.formatBytes = formatBytes;
const react_1 = __importDefault(require("react"));
const react_native_1 = require("react-native");
function formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes <= 0)
        return "0 B";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
const OTAProgressModal = ({ visible, progress, title = "Cập nhật ứng dụng", statusText = "Đang tải bản cập nhật...", version }) => {
    // Chuẩn hóa dữ liệu tiến độ
    let percent = 0;
    let receivedBytes = 0;
    let totalBytes = 0;
    if (typeof progress === "number") {
        percent = Math.min(100, Math.max(0, Math.round(progress * 100)));
    }
    else if (progress && typeof progress === "object") {
        percent = Math.min(100, Math.max(0, Math.round(progress.percentage || 0)));
        receivedBytes = progress.receivedBytes || 0;
        totalBytes = progress.totalBytes || 0;
    }
    const bytesInfo = totalBytes > 0
        ? `${formatBytes(receivedBytes)} / ${formatBytes(totalBytes)}`
        : "";
    return (react_1.default.createElement(react_native_1.Modal, { transparent: true, animationType: "fade", visible: visible, statusBarTranslucent: true },
        react_1.default.createElement(react_native_1.View, { style: styles.overlay },
            react_1.default.createElement(react_native_1.View, { style: styles.card },
                react_1.default.createElement(react_native_1.View, { style: styles.header },
                    react_1.default.createElement(react_native_1.View, { style: styles.iconContainer },
                        react_1.default.createElement(react_native_1.Text, { style: styles.iconText }, "\u26A1")),
                    react_1.default.createElement(react_native_1.View, { style: styles.headerTextContainer },
                        react_1.default.createElement(react_native_1.Text, { style: styles.title }, title),
                        version ? (react_1.default.createElement(react_native_1.Text, { style: styles.versionBadge },
                            "Phi\u00EAn b\u1EA3n v",
                            version)) : null)),
                react_1.default.createElement(react_native_1.Text, { style: styles.statusText }, statusText),
                react_1.default.createElement(react_native_1.View, { style: styles.progressBarTrack },
                    react_1.default.createElement(react_native_1.View, { style: [styles.progressBarFill, { width: `${percent}%` }] })),
                react_1.default.createElement(react_native_1.View, { style: styles.detailsRow },
                    react_1.default.createElement(react_native_1.Text, { style: styles.percentageText },
                        percent,
                        "%"),
                    bytesInfo ? (react_1.default.createElement(react_native_1.Text, { style: styles.bytesText }, bytesInfo)) : null),
                react_1.default.createElement(react_native_1.View, { style: styles.footer },
                    react_1.default.createElement(react_native_1.ActivityIndicator, { size: "small", color: "#38bdf8", style: { marginRight: 8 } }),
                    react_1.default.createElement(react_native_1.Text, { style: styles.footerText }, "Vui l\u00F2ng kh\u00F4ng \u0111\u00F3ng \u1EE9ng d\u1EE5ng..."))))));
};
exports.OTAProgressModal = OTAProgressModal;
const styles = react_native_1.StyleSheet.create({
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
exports.default = exports.OTAProgressModal;
