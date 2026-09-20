import { localizeSystemText } from "./localizeSystemText";

export const NETWORK_ERROR_MESSAGE =
  "Không thể kết nối đến hệ thống. Vui lòng kiểm tra kết nối mạng và thử lại.";

export const SERVER_ERROR_MESSAGE =
  "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.";

const TECHNICAL_MESSAGE_PATTERN =
  /(axios|request failed|status code|network error|exception|stack|trace|sql|database|innerexception|nullreference|typeerror|referenceerror|syntaxerror|system\.|http:\/\/|https:\/\/| at [a-z0-9_$.[\]<>-]+\s*\()/i;

const asNonEmptyText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;

  const text = value.trim();
  return text.length > 0 ? text : null;
};

export const isSafeUserMessage = (value: unknown): value is string => {
  const text = asNonEmptyText(value);
  if (!text) return false;
  if (text.length > 280) return false;
  if (TECHNICAL_MESSAGE_PATTERN.test(text)) return false;
  if (/^[\[{].*[\]}]$/s.test(text)) return false;

  return true;
};

export const readSafeApiMessage = (payload: any): string | null => {
  if (!payload) return null;

  const candidates =
    typeof payload === "string"
      ? [payload]
      : [
          payload?.message,
          payload?.error?.message,
          payload?.data?.message,
          payload?.data?.error?.message,
        ];

  for (const candidate of candidates) {
    if (isSafeUserMessage(candidate)) {
      const localized = localizeSystemText(candidate, "");
      if (localized) return localized;
    }
  }

  return null;
};

const VIETNAMESE_TEXT_PATTERN =
  /[àáâãèéêìíòóôõùúýăđĩũơưạ-ỹ]|(vui lòng|không thể|đã|chưa)/i;

// Lỗi do chính ứng dụng ném ra với thông điệp tiếng Việt (không phải lỗi mạng
// của Axios, không phải lỗi lập trình) được phép hiển thị nguyên văn.
const readAppAuthoredMessage = (error: any): string | null => {
  if (!error || typeof error !== "object") return null;
  if (error.isAxiosError || error.request || error.config) return null;
  if (
    error instanceof TypeError ||
    error instanceof RangeError ||
    error instanceof ReferenceError ||
    error instanceof SyntaxError
  ) {
    return null;
  }
  // Kết quả API bị ném ra (isSuccess=false) mang thông điệp nghiệp vụ đã lọc.
  if (error.isSuccess === false) {
    return readSafeApiMessage(error);
  }
  const message = error.userMessage ?? error.message;
  if (!isSafeUserMessage(message)) return null;
  return VIETNAMESE_TEXT_PATTERN.test(message) ? message.trim() : null;
};

export const getSafeErrorMessage = (
  error: any,
  fallback?: string,
): string => {
  const response = error?.response;
  const status = Number(response?.status || 0);

  if (!response) {
    return readAppAuthoredMessage(error) ?? NETWORK_ERROR_MESSAGE;
  }

  if (status >= 500) {
    return SERVER_ERROR_MESSAGE;
  }

  if (
    fallback &&
    [400, 401, 403, 404, 409, 422].includes(status)
  ) {
    return fallback;
  }

  const responseMessage = readSafeApiMessage(response?.data);
  if (
    responseMessage &&
    [400, 409, 422].includes(status)
  ) {
    return responseMessage;
  }

  return NETWORK_ERROR_MESSAGE;
};
