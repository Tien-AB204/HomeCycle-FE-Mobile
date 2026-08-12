import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { SERVER_ERROR_MESSAGE } from "../../utils/apiFeedback";

const API_BASE_URL =
  "https://homecycle-backend.onrender.com/api";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

let isRefreshing = false;
let failedQueue: any[] = [];

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
    return Promise.reject(error);
  },
);

apiClient.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status >= 500) {
      const responseData = error.response.data;

      const normalizedResponseData =
        responseData &&
        typeof responseData === "object" &&
        !Array.isArray(responseData)
          ? responseData
          : {};

      const normalizedError =
        normalizedResponseData?.error &&
        typeof normalizedResponseData.error === "object" &&
        !Array.isArray(normalizedResponseData.error)
          ? normalizedResponseData.error
          : {};

      error.userMessage = SERVER_ERROR_MESSAGE;
      error.message = SERVER_ERROR_MESSAGE;

      error.response.data = {
        ...normalizedResponseData,
        message: SERVER_ERROR_MESSAGE,
        error: {
          ...normalizedError,
          message: SERVER_ERROR_MESSAGE,
        },
      };
    }

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
            return Promise.reject(refreshError);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken =
          await AsyncStorage.getItem("refreshToken");

        if (!refreshToken) {
          throw new Error(
            "No refresh token available",
          );
        }

        const response = await axios.post(
          `${API_BASE_URL}/auth/refresh-token`,
          {
            refreshToken,
          },
        );

        const newAccessToken =
          response.data.accessToken ||
          response.data.data?.accessToken;

        const newRefreshToken =
          response.data.refreshToken ||
          response.data.data?.refreshToken;

        if (!newAccessToken) {
          throw new Error(
            "Refresh response does not contain access token",
          );
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

        processQueue(null, newAccessToken);

        originalRequest.headers.Authorization =
          `Bearer ${newAccessToken}`;

        isRefreshing = false;

        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;

        await AsyncStorage.multiRemove([
          "accessToken",
          "refreshToken",
        ]);

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;