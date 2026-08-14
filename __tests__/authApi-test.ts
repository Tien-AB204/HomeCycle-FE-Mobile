import axiosClient from "../src/services/apis/axiosClient";

jest.mock("../src/services/apis/axiosClient", () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

import { authApi } from "../src/services/apis/authApi";

const mockedPost = axiosClient.post as jest.Mock;

describe("authApi", () => {
  beforeEach(() => {
    mockedPost.mockReset();
    mockedPost.mockResolvedValue({ data: {} });
  });

  describe("sendOtp", () => {
    test("POST /auth/send-otp with email payload", async () => {
      await authApi.sendOtp("a@b.com");
      expect(mockedPost).toHaveBeenCalledWith("/auth/send-otp", {
        email: "a@b.com",
      });
    });

    test("resolves with axios response", async () => {
      mockedPost.mockResolvedValueOnce({ data: { ok: true } });
      await expect(authApi.sendOtp("a@b.com")).resolves.toEqual({
        data: { ok: true },
      });
    });
  });

  describe("verifyOtp", () => {
    test("POST /auth/verify-otp with email + otp payload", async () => {
      await authApi.verifyOtp("a@b.com", "123456");
      expect(mockedPost).toHaveBeenCalledWith("/auth/verify-otp", {
        email: "a@b.com",
        otp: "123456",
      });
    });

    test("abnormal: rejects when the request fails", async () => {
      mockedPost.mockRejectedValueOnce(new Error("network"));
      await expect(
        authApi.verifyOtp("a@b.com", "000000"),
      ).rejects.toThrow("network");
    });
  });

  describe("registerPersonal", () => {
    test("POST /auth/personal/register with FormData and headers", async () => {
      const formData = new FormData();
      await authApi.registerPersonal("reg-token-1", formData);
      expect(mockedPost).toHaveBeenCalledWith(
        "/auth/personal/register",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            "X-Registration-Token": "reg-token-1",
          },
        },
      );
    });
  });

  describe("registerBusiness", () => {
    test("POST /auth/business/register with password + registration token header", async () => {
      await authApi.registerBusiness("reg-token-2", "pass123");
      expect(mockedPost).toHaveBeenCalledWith(
        "/auth/business/register",
        { password: "pass123" },
        {
          headers: { "X-Registration-Token": "reg-token-2" },
        },
      );
    });

    test("returns response.data (not full response)", async () => {
      mockedPost.mockResolvedValueOnce({ data: { user: { id: 1 } } });
      await expect(
        authApi.registerBusiness("t", "p"),
      ).resolves.toEqual({ user: { id: 1 } });
    });
  });

  describe("googleLogin", () => {
    test("POST /auth/google-login with idToken payload", async () => {
      await authApi.googleLogin("google-id-token");
      expect(mockedPost).toHaveBeenCalledWith("/auth/google-login", {
        idToken: "google-id-token",
      });
    });
  });
});