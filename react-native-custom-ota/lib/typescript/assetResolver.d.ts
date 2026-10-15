/**
 * Thiết lập bộ chuyển đổi phân giải Asset (hình ảnh, biểu tượng) cho React Native.
 * Khi ứng dụng chạy bundle từ bản cập nhật OTA (thư mục lưu trên máy):
 * - Nếu ảnh mới nằm trong gói OTA tải về -> Nạp từ thư mục bundle của OTA.
 * - Nếu ảnh không có trong gói OTA (vd: chế độ bundle-only siêu nhẹ ~1MB):
 *   + Trên Android: Tự động fallback về APK Resource (res/drawable) qua resourceIdentifierWithoutScale().
 *   + Trên iOS: Tự động fallback về main application bundle gốc ([NSBundle mainBundle]) qua mainBundleURL.
 * Ngăn chặn triệt để tình trạng MẤT ẢNH trên cả 2 nền tảng iOS & Android!
 */
export declare function setupAssetResolver(): void;
