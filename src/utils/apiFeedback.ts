import {
  getSafeErrorMessage,
  NETWORK_ERROR_MESSAGE,
  readSafeApiMessage,
  SERVER_ERROR_MESSAGE,
} from "./errorMessage";

export {
  NETWORK_ERROR_MESSAGE,
  SERVER_ERROR_MESSAGE,
};

export const getApiErrorMessage = (
  error: unknown,
  fallback =
    "Không thể thực hiện thao tác. Vui lòng thử lại.",
) => getSafeErrorMessage(error, fallback);

export const getApiSuccessMessage = (
  response: unknown,
  fallback: string,
) => readSafeApiMessage(response) || fallback;
