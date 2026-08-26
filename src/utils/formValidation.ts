export const EMAIL_MAX_LENGTH = 100;
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 50;
export const FULL_NAME_MAX_LENGTH = 100;
export const USERNAME_MAX_LENGTH = 100;

/**
 * Email:
 * - không rỗng
 * - tối đa 100 ký tự
 * - format cơ bản
 */
export const validateEmail = (value: string): string => {
  const email = value.trim();

  if (!email) {
    return "Vui lòng nhập địa chỉ email.";
  }

  if (email.length > EMAIL_MAX_LENGTH) {
    return `Email không được vượt quá ${EMAIL_MAX_LENGTH} ký tự.`;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Địa chỉ email không đúng định dạng.";
  }

  return "";
};

/**
 * Password:
 * - GIỮ NGUYÊN chính xác giá trị user nhập
 * - không trim
 * - 6 -> 50 ký tự
 * - toàn whitespace không được xem là password hợp lệ
 */
export const validatePassword = (value: string): string => {
  if (!value || !value.trim()) {
    return "Vui lòng nhập mật khẩu.";
  }

  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`;
  }

  if (value.length > PASSWORD_MAX_LENGTH) {
    return `Mật khẩu không được vượt quá ${PASSWORD_MAX_LENGTH} ký tự.`;
  }

  return "";
};

/**
 * Full name:
 * - Unicode letters, bao gồm tiếng Việt
 * - cho phép khoảng trắng giữa các từ
 * - không ký tự đặc biệt / số
 * - tối đa 100 ký tự
 */
export const validateFullName = (value: string): string => {
  const fullName = value.trim().replace(/\s+/gu, " ");

  if (!fullName) {
    return "Vui lòng nhập họ và tên.";
  }

  if (fullName.length > FULL_NAME_MAX_LENGTH) {
    return `Họ và tên không được vượt quá ${FULL_NAME_MAX_LENGTH} ký tự.`;
  }

  if (!/^[\p{L}]+(?: [\p{L}]+)*$/u.test(fullName)) {
    return "Họ và tên chỉ được chứa chữ cái và khoảng trắng.";
  }

  return "";
};

/**
 * Username:
 * - tối đa 100
 * - chỉ ASCII letters, digits, underscore
 */
export const validateUsername = (value: string): string => {
  const username = value.trim();

  if (!username) {
    return "Vui lòng nhập username.";
  }

  if (username.length > USERNAME_MAX_LENGTH) {
    return `Username không được vượt quá ${USERNAME_MAX_LENGTH} ký tự.`;
  }

  if (!/^[A-Za-z0-9_]+$/.test(username)) {
    return "Username chỉ được chứa chữ cái, chữ số và dấu gạch dưới _.";
  }

  return "";
};

/**
 * Chỉ bỏ đúng các separator BE cho phép người dùng nhập:
 * whitespace, "." và "-"
 *
 * Không chuyển +84 / 84 thành 0 vì FE đã chốt chỉ nhận dạng bắt đầu bằng 0.
 */
export const normalizeVietnamPhone = (value: string): string =>
  value.replace(/[\s.-]/gu, "");

/**
 * Mobile:
 * 03xxxxxxxx
 * 05xxxxxxxx
 * 07xxxxxxxx
 * 08xxxxxxxx
 * 09xxxxxxxx
 *
 * Landline:
 * 02xxxxxxxxx
 */
export const validateVietnamPhone = (value: string): string => {
  const raw = value.trim();

  if (!raw) {
    return "Vui lòng nhập số điện thoại.";
  }

  const normalized = normalizeVietnamPhone(raw);

  if (!/^\d+$/.test(normalized)) {
    return "Số điện thoại chỉ được chứa chữ số, khoảng trắng, dấu chấm hoặc dấu gạch ngang.";
  }

  if (!/^0(?:[35789]\d{8}|2\d{9})$/.test(normalized)) {
    return "Số điện thoại phải bắt đầu bằng 02, 03, 05, 07, 08 hoặc 09.";
  }

  return "";
};
