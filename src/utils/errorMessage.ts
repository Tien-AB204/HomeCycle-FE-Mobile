export const NETWORK_ERROR_MESSAGE =
  "Không thể kết nối đến hệ thống. Vui lòng kiểm tra kết nối mạng và thử lại.";

export const SERVER_ERROR_MESSAGE = NETWORK_ERROR_MESSAGE;

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
      return candidate.trim();
    }
  }

  return null;
};

export const getSafeErrorMessage = (
  error: any,
  fallback?: string,
): string => {
  const response = error?.response;
  const status = Number(response?.status || 0);

  if (!response || status >= 500) {
    return NETWORK_ERROR_MESSAGE;
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
