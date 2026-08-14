jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("axios", () => {
  const mockPost = jest.fn();
  const mockApiClient: any = jest.fn();
  mockApiClient.interceptors = {
    request: {
      use: (onFulfilled: any, onRejected: any) => {
        mockApiClient.__requestFulfilled = onFulfilled;
        mockApiClient.__requestRejected = onRejected;
      },
    },
    response: {
      use: (onFulfilled: any, onRejected: any) => {
        mockApiClient.__responseFulfilled = onFulfilled;
        mockApiClient.__responseRejected = onRejected;
      },
    },
  };
  mockApiClient.defaults = { headers: { common: {} } };
  mockApiClient.post = mockPost;

  return {
    __esModule: true,
    default: {
      create: () => mockApiClient,
      post: mockPost,
      isAxiosError: (error: any) => error?.isAxiosError === true,
      __mockApiClient: mockApiClient,
      __mockPost: mockPost,
    },
  };
});

import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

import apiClient from "../src/services/apis/axiosClient";
import { SERVER_ERROR_MESSAGE } from "../src/utils/apiFeedback";

const mockAxios = axios as any;
const mockApiClient: any = mockAxios.__mockApiClient;
const mockPost: jest.Mock = mockAxios.__mockPost;

const requestFulfilled = (config: any) =>
  mockApiClient.__requestFulfilled(config);
const responseRejected = (error: any) =>
  mockApiClient.__responseRejected(error);

const REFRESH_URL =
  "https://homecycle-backend.onrender.com/api/auth/refresh-token";

const createError = (
  response: { status: number; data: any } | undefined,
  config: any = {},
): any => ({
  isAxiosError: true,
  config,
  response,
});

describe("axiosClient - request interceptor", () => {
  beforeEach(() => {
    mockApiClient.__requestFulfilled = mockApiClient.__requestFulfilled;
    mockApiClient.__responseFulfilled = mockApiClient.__responseFulfilled;
    jest.clearAllMocks();
  });

  test("adds Authorization header when accessToken exists", async () => {
    jest.spyOn(AsyncStorage, "getItem").mockResolvedValueOnce("token-abc");
    const config = await requestFulfilled({ headers: {} });
    expect(config.headers.Authorization).toBe("Bearer token-abc");
  });

  test("does not add Authorization header when no token", async () => {
    jest.spyOn(AsyncStorage, "getItem").mockResolvedValueOnce(null);
    const config = await requestFulfilled({ headers: {} });
    expect(config.headers.Authorization).toBeUndefined();
  });

  test("abnormal: AsyncStorage error -> config passed through unchanged", async () => {
    jest
      .spyOn(AsyncStorage, "getItem")
      .mockRejectedValueOnce(new Error("storage error"));
    const config = await requestFulfilled({ headers: {} });
    expect(config).toEqual({ headers: {} });
  });
});

describe("axiosClient - response interceptor (5xx)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("500 with object payload -> normalized SERVER_ERROR_MESSAGE, original fields preserved", async () => {
    const error = createError({
      status: 500,
      data: { detail: "boom", error: { code: "E1" } },
    });
    await expect(responseRejected(error)).rejects.toBe(error);

    expect(error.userMessage).toBe(SERVER_ERROR_MESSAGE);
    expect(error.message).toBe(SERVER_ERROR_MESSAGE);
    expect(error.response.data.message).toBe(SERVER_ERROR_MESSAGE);
    expect(error.response.data.error.message).toBe(SERVER_ERROR_MESSAGE);
    expect(error.response.data.detail).toBe("boom");
    expect(error.response.data.error.code).toBe("E1");
  });

  test("boundary: 503 -> normalized SERVER_ERROR_MESSAGE", async () => {
    const error = createError({ status: 503, data: {} });
    await expect(responseRejected(error)).rejects.toBe(error);
    expect(error.response.data.message).toBe(SERVER_ERROR_MESSAGE);
  });

  test("abnormal: 500 with non-object payload -> safe normalization", async () => {
    const error = createError({
      status: 500,
      data: "Internal Server Error",
    });
    await expect(responseRejected(error)).rejects.toBe(error);
    expect(error.response.data.message).toBe(SERVER_ERROR_MESSAGE);
    expect(error.response.data.error.message).toBe(SERVER_ERROR_MESSAGE);
  });
});

describe("axiosClient - response interceptor (401 refresh)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiClient.mockReset();
  });

  test("refreshes token and retries original request with new token", async () => {
    jest
      .spyOn(AsyncStorage, "getItem")
      .mockResolvedValueOnce("refresh-token-123");
    mockPost.mockResolvedValueOnce({
      data: {
        accessToken: "new-access",
        refreshToken: "new-refresh",
      },
    });
    mockApiClient.mockResolvedValueOnce({ status: 200, data: {} });

    const originalRequest: any = { url: "/me", headers: {} };
    const error = createError({ status: 401, data: {} }, originalRequest);

    await expect(responseRejected(error)).resolves.toEqual({
      status: 200,
      data: {},
    });

    expect(mockPost).toHaveBeenCalledWith(REFRESH_URL, {
      refreshToken: "refresh-token-123",
    });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "accessToken",
      "new-access",
    );
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "refreshToken",
      "new-refresh",
    );
    expect(originalRequest.headers.Authorization).toBe(
      "Bearer new-access",
    );
    expect(mockApiClient.defaults.headers.common.Authorization).toBe(
      "Bearer new-access",
    );
    expect(mockApiClient).toHaveBeenCalledWith(originalRequest);
  });

  test("no refresh token -> rejects and clears stored tokens", async () => {
    jest.spyOn(AsyncStorage, "getItem").mockResolvedValueOnce(null);

    const originalRequest: any = { url: "/me", headers: {} };
    const error = createError({ status: 401, data: {} }, originalRequest);

    await expect(responseRejected(error)).rejects.toThrow(
      "No refresh token available",
    );
    expect(mockPost).not.toHaveBeenCalled();
    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
      "accessToken",
      "refreshToken",
    ]);
  });

  test("refresh endpoint fails -> rejects with refresh error and clears tokens", async () => {
    jest
      .spyOn(AsyncStorage, "getItem")
      .mockResolvedValueOnce("refresh-token-123");
    mockPost.mockRejectedValueOnce(new Error("refresh failed"));

    const originalRequest: any = { url: "/me", headers: {} };
    const error = createError({ status: 401, data: {} }, originalRequest);

    await expect(responseRejected(error)).rejects.toThrow(
      "refresh failed",
    );
    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
      "accessToken",
      "refreshToken",
    ]);
  });

  test("concurrent 401s -> only one refresh call, queued requests retried", async () => {
    jest
      .spyOn(AsyncStorage, "getItem")
      .mockResolvedValueOnce("refresh-token-123");
    mockPost.mockResolvedValueOnce({
      data: { accessToken: "new-access" },
    });
    mockApiClient.mockResolvedValue({ status: 200 });

    const req1: any = { url: "/a", headers: {} };
    const req2: any = { url: "/b", headers: {} };
    const error1 = createError({ status: 401, data: {} }, req1);
    const error2 = createError({ status: 401, data: {} }, req2);

    await Promise.all([
      responseRejected(error1),
      responseRejected(error2),
    ]);

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockApiClient).toHaveBeenCalledTimes(2);
    expect(req2.headers.Authorization).toBe("Bearer new-access");
  });

  test("401 with already-retried request -> rejected without refresh", async () => {
    const originalRequest: any = {
      url: "/me",
      headers: {},
      _retry: true,
    };
    const error = createError({ status: 401, data: {} }, originalRequest);

    await expect(responseRejected(error)).rejects.toBe(error);
    expect(mockPost).not.toHaveBeenCalled();
  });

  test("401 without config -> rejected without refresh", async () => {
    const error = createError({ status: 401, data: {} }, null as any);
    await expect(responseRejected(error)).rejects.toBe(error);
    expect(mockPost).not.toHaveBeenCalled();
  });
});

describe("axiosClient - response interceptor (other errors)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("abnormal: 404 -> rejected unchanged, no refresh, no mutation", async () => {
    const error = createError(
      { status: 404, data: { message: "Not found" } },
      { url: "/x", headers: {} },
    );
    await expect(responseRejected(error)).rejects.toBe(error);
    expect(mockPost).not.toHaveBeenCalled();
    expect(error.response.data).toEqual({ message: "Not found" });
  });

  test("abnormal: no response object -> rejected unchanged", async () => {
    const error = createError(undefined, { url: "/x", headers: {} });
    await expect(responseRejected(error)).rejects.toBe(error);
    expect(mockPost).not.toHaveBeenCalled();
  });
});

describe("axiosClient - default export", () => {
  test("is the axios instance created by axios.create", () => {
    expect(apiClient).toBe(mockApiClient);
  });
});