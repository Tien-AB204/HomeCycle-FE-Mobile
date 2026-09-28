import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import {
  DEFAULT_ACTION_ERROR_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  readSafeApiMessage,
  SERVER_ERROR_MESSAGE,
} from "../../utils/errorMessage";

const API_BASE_URL =
  "https://homecycle-backend.onrender.com/api";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

let isRefreshing = false;
let failedQueue: any[] = [];
let refreshPromise: Promise<string> | null = null;

export const SESSION_EXPIRED_MESSAGE =
  "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
const LOGIN_REQUIRED_MESSAGE = "Vui lòng đăng nhập để tiếp tục.";

// AuthContext đăng ký để xóa trạng thái đăng nhập khi phiên thực sự hết hạn;
// nếu không, giao diện vẫn hiển thị như đã đăng nhập trong khi token đã bị xóa.
let sessionExpiredHandler: (() => void) | null = null;
export const setSessionExpiredHandler = (handler: (() => void) | null) => {
  sessionExpiredHandler = handler;
};

const createAuthError = (message: string, sessionExpired: boolean) => {
  const error: any = new Error(message);
  error.userMessage = message;
  error.isSessionExpired = sessionExpired;
  return error;
};

const expireSession = async () => {
  await AsyncStorage.multiRemove(["accessToken", "refreshToken", "userRole"]);
  delete apiClient.defaults.headers.common.Authorization;
  sessionExpiredHandler?.();
  return createAuthError(SESSION_EXPIRED_MESSAGE, true);
};

const processQueue = (
  error: any,
  token: string | null = null,
) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });

  failedQueue = [];
};

const sanitizeRejectedError = (error: any) => {
  if (!error) return error;
  // Lỗi phiên do chính client tạo (createAuthError) đã có thông điệp đúng.
  if (typeof error.isSessionExpired === "boolean") return error;

  const response = error.response;
  const status = Number(response?.status || 0);
  const responseData = response?.data;
  const safeResponseMessage = readSafeApiMessage(responseData);

  // Giữ nguyên response.data để màn hình đọc được thông điệp gốc của BE;
  // chỉ gắn thông điệp hiển thị lên chính đối tượng lỗi.
  const userMessage = !response
    ? NETWORK_ERROR_MESSAGE
    : safeResponseMessage ||
      (status >= 500 ? SERVER_ERROR_MESSAGE : DEFAULT_ACTION_ERROR_MESSAGE);

  error.userMessage = userMessage;
  error.message = userMessage;

  return error;
};

export const refreshAccessToken = async () => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken =
      await AsyncStorage.getItem("refreshToken");

    if (!refreshToken) {
      // Còn access token mà mất refresh token: phiên hỏng. Không có token nào: khách.
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (accessToken) throw await expireSession();
      throw createAuthError(LOGIN_REQUIRED_MESSAGE, false);
    }

    let response;
    try {
      response = await axios.post(
        `${API_BASE_URL}/auth/refresh-token`,
        {
          refreshToken,
        },
        { timeout: 30000 },
      );
    } catch (error: any) {
      // Chỉ khi BE từ chối refresh token mới là hết phiên. Lỗi mạng / hết thời gian
      // chờ / 5xx (vd. BE đang khởi động) giữ nguyên token để lần sau thử lại.
      const status = Number(error?.response?.status || 0);
      if (status === 400 || status === 401) throw await expireSession();
      throw error;
    }

    const responseData =
      response.data?.data || response.data;

    const newAccessToken =
      responseData?.accessToken;

    const newRefreshToken =
      responseData?.refreshToken;

    if (!newAccessToken) {
      throw createAuthError(NETWORK_ERROR_MESSAGE, false);
    }

    await AsyncStorage.setItem(
      "accessToken",
      newAccessToken,
    );

    if (newRefreshToken) {
      await AsyncStorage.setItem(
        "refreshToken",
        newRefreshToken,
      );
    }

    apiClient.defaults.headers.common.Authorization =
      `Bearer ${newAccessToken}`;

    return newAccessToken;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
};

apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token =
        await AsyncStorage.getItem("accessToken");

      if (token) {
        config.headers.Authorization =
          `Bearer ${token}`;
      }
    } catch (error) {
      console.log(
        "Error getting token from AsyncStorage",
        error,
      );
    }

    return config;
  },
  (error) => {
    return Promise.reject(
      sanitizeRejectedError(error),
    );
  },
);

apiClient.interceptors.response.use(
  (response) => response,

  async (rawError) => {
    const error = sanitizeRejectedError(rawError);
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve,
            reject,
          });
        })
          .then((token) => {
            originalRequest.headers.Authorization =
              `Bearer ${token}`;

            return apiClient(originalRequest);
          })
          .catch((refreshError) => {
            return Promise.reject(
              sanitizeRejectedError(refreshError),
            );
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newAccessToken =
          await refreshAccessToken();

        processQueue(null, newAccessToken);

        originalRequest.headers.Authorization =
          `Bearer ${newAccessToken}`;

        isRefreshing = false;

        return apiClient(originalRequest);
      } catch (refreshError) {
        const safeRefreshError =
          sanitizeRejectedError(refreshError);

        processQueue(safeRefreshError, null);
        isRefreshing = false;

        return Promise.reject(safeRefreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
