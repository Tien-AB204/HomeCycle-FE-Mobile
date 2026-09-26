export const NETWORK_ERROR_MESSAGE =
  "Không thể kết nối đến hệ thống. Vui lòng kiểm tra kết nối mạng và thử lại.";

export const SERVER_ERROR_MESSAGE =
  "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.";

export const DEFAULT_ACTION_ERROR_MESSAGE =
  "Không thể thực hiện thao tác. Vui lòng thử lại.";

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
  if (text.length > 600) return false;
  if (TECHNICAL_MESSAGE_PATTERN.test(text)) return false;
  if (/^[\[{].*[\]}]$/s.test(text)) return false;

  return true;
};

// ProblemDetails của ASP.NET khi model binding/validation lỗi:
// { errors: { Field: ["message", ...] } }.
const readValidationErrors = (errors: unknown): string | null => {
  if (!errors || typeof errors !== "object") return null;

  const messages = Object.values(errors as Record<string, unknown>)
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter(isSafeUserMessage)
    .map((message) => message.trim());

  return messages.length > 0 ? Array.from(new Set(messages)).join("\n") : null;
};

/**
 * Đọc thông điệp BE trả về và giữ nguyên văn. Chỉ bỏ qua nội dung kỹ thuật
 * (stack trace, SQL, JSON thô...) để khi đó màn hình dùng thông điệp dự phòng.
 */
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
          payload?.detail,
          readValidationErrors(payload?.errors),
        ];

  for (const candidate of candidates) {
    if (isSafeUserMessage(candidate)) return candidate.trim();
  }

  return null;
};

const VIETNAMESE_TEXT_PATTERN =
  /[àáâãèéêìíòóôõùúýăđĩũơưạ-ỹ]|(vui lòng|không thể|đã|chưa)/i;

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
  // Kết quả API bị ném ra (isSuccess=false) mang thông điệp nghiệp vụ của BE.
  if (error.isSuccess === false) {
    return readSafeApiMessage(error);
  }
  const message = error.userMessage ?? error.message;
  if (!isSafeUserMessage(message)) return null;
  return VIETNAMESE_TEXT_PATTERN.test(message) ? message.trim() : null;
};

/**
 * Ưu tiên thông điệp BE trả về. Chỉ dùng `fallback` khi BE không trả thông
 * điệp nào dùng được.
 */
export const getSafeErrorMessage = (
  error: any,
  fallback?: string,
): string => {
  const response = error?.response;
  const status = Number(response?.status || 0);

  if (!response) {
    const appMessage = readAppAuthoredMessage(error);
    if (appMessage) return appMessage;
    // Chỉ lỗi request thực sự không tới được BE mới là lỗi kết nối.
    const isTransportError =
      !error || typeof error !== "object" || error.isAxiosError || error.request;
    return isTransportError || !fallback ? NETWORK_ERROR_MESSAGE : fallback;
  }

  const responseMessage = readSafeApiMessage(response?.data);
  if (responseMessage) return responseMessage;

  if (status >= 500) return SERVER_ERROR_MESSAGE;

  return fallback || DEFAULT_ACTION_ERROR_MESSAGE;
};
