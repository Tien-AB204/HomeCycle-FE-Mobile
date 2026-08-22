import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import {
  NETWORK_ERROR_MESSAGE,
  readSafeApiMessage,
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

  const response = error.response;
  const status = Number(response?.status || 0);
  const responseData = response?.data;
  const safeResponseMessage = readSafeApiMessage(responseData);

  const userMessage =
    !response || status >= 500
      ? NETWORK_ERROR_MESSAGE
      : safeResponseMessage || NETWORK_ERROR_MESSAGE;

  error.userMessage = userMessage;
  error.message = userMessage;

  if (!response) {
    return error;
  }

  if (
    responseData &&
    typeof responseData === "object" &&
    !Array.isArray(responseData)
  ) {
    const nestedError =
      responseData.error &&
      typeof responseData.error === "object" &&
      !Array.isArray(responseData.error)
        ? responseData.error
        : {};

    if (!safeResponseMessage) {
      response.data = {
        ...responseData,
        message: userMessage,
        error: {
          ...nestedError,
          message: userMessage,
        },
      };
    }
  } else if (!safeResponseMessage) {
    response.data = {
      message: userMessage,
    };
  }

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
      throw new Error(NETWORK_ERROR_MESSAGE);
    }

    const response = await axios.post(
      `${API_BASE_URL}/auth/refresh-token`,
      {
        refreshToken,
      },
    );

    const responseData =
      response.data?.data || response.data;

    const newAccessToken =
      responseData?.accessToken;

    const newRefreshToken =
      responseData?.refreshToken;

    if (!newAccessToken) {
      throw new Error(NETWORK_ERROR_MESSAGE);
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

        await AsyncStorage.multiRemove([
          "accessToken",
          "refreshToken",
        ]);

        return Promise.reject(safeRefreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
