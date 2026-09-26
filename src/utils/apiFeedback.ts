import {
  DEFAULT_ACTION_ERROR_MESSAGE,
  getSafeErrorMessage,
  isSafeUserMessage,
  NETWORK_ERROR_MESSAGE,
  SERVER_ERROR_MESSAGE,
} from "./errorMessage";

export {
  NETWORK_ERROR_MESSAGE,
  SERVER_ERROR_MESSAGE,
};

// Ưu tiên thông điệp lỗi BE trả về; `fallback` chỉ dùng khi BE không trả.
export const getApiErrorMessage = (
  error: unknown,
  fallback = DEFAULT_ACTION_ERROR_MESSAGE,
) => getSafeErrorMessage(error, fallback);

// Một số API trả kèm thông điệp thành công (ví dụ { message } hoặc
// { data: { message } }); không có thì dùng `fallback`.
export const getApiSuccessMessage = (
  response: unknown,
  fallback: string,
) => {
  const payload = response as any;
  const candidates = [payload?.message, payload?.data?.message];
  const message = candidates.find(isSafeUserMessage);
  return message ? message.trim() : fallback;
};
