const VIETNAMESE_LOCALE = "vi-VN";

export const toUppercaseText = (value: unknown) =>
  String(value ?? "").normalize("NFC").toLocaleUpperCase(VIETNAMESE_LOCALE);

/**
 * Viết hoa ký tự đầu của từng từ nhưng giữ nguyên phần còn lại user đã nhập.
 * Cách này phù hợp cho họ tên thường và tên đường, đồng thời không làm hỏng
 * các mã như QL1A hay số nhà 12A.
 */
export const capitalizeWordInitials = (value: unknown) =>
  String(value ?? "")
    .normalize("NFC")
    .replace(/(^|[\s\-\/.,])([\p{L}])/gu, (_match, prefix: string, letter: string) =>
      `${prefix}${letter.toLocaleUpperCase(VIETNAMESE_LOCALE)}`,
    );

// Ô nhập giá chỉ hiển thị có dấu chấm ngăn cách hàng nghìn (5.000.000); state và
// payload giữ chuỗi chữ số thuần (5000000).
export const formatPriceInput = (raw: string): string => {
  if (!raw) return "";
  // Giá nạp từ API có thể là số thập phân dạng "5000000.5": chỉ hiển thị phần nguyên.
  const digits = /^\d+(\.\d+)?$/.test(raw) ? raw.split(".")[0] : raw.replace(/\D/g, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export const toPriceDigits = (text: string): string => text.replace(/\D/g, "");
