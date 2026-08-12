import axios from "axios";

export const SERVER_ERROR_MESSAGE =
  "Lỗi máy chủ. Vui lòng thử lại sau.";

export const NETWORK_ERROR_MESSAGE =
  "Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng và thử lại.";

const asNonEmptyText = (
  value: unknown,
): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  return text.length > 0 ? text : null;
};

const readMessage = (payload: any): string | null => {
  if (!payload) {
    return null;
  }

  if (typeof payload === "string") {
    return asNonEmptyText(payload);
  }

  return (
    asNonEmptyText(payload?.message) ||
    asNonEmptyText(payload?.error?.message) ||
    asNonEmptyText(payload?.data?.message) ||
    asNonEmptyText(payload?.data?.error?.message) ||
    null
  );
};

export const getApiErrorMessage = (
  error: unknown,
  fallback =
    "Không thể thực hiện thao tác. Vui lòng thử lại.",
) => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;

    if (status && status >= 500) {
      return SERVER_ERROR_MESSAGE;
    }

    if (!error.response) {
      return NETWORK_ERROR_MESSAGE;
    }

    return (
      readMessage(error.response.data) ||
      fallback
    );
  }

  const status = (error as any)?.response?.status;

  if (status && status >= 500) {
    return SERVER_ERROR_MESSAGE;
  }

  return (
    readMessage((error as any)?.response?.data) ||
    asNonEmptyText((error as any)?.message) ||
    fallback
  );
};

export const getApiSuccessMessage = (
  response: unknown,
  fallback: string,
) => {
  return readMessage(response) || fallback;
};