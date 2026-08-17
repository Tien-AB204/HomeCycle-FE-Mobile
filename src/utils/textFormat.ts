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
