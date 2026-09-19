/**
 * Ghi chẩn đoán chỉ khi chạy bản phát triển, dùng console.log để không mở
 * LogBox đè lên giao diện. Dành cho các lỗi đã được xử lý và đã hiển thị
 * phản hồi thân thiện cho người dùng; lỗi lập trình chưa bắt vẫn nổi bình thường.
 */
export const devLog = (...args: unknown[]): void => {
  if (__DEV__) {
    console.log(...args);
  }
};
