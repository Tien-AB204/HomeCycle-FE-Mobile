import { act, fireEvent, waitFor } from "@testing-library/react-native";
import {
  mockApiClient,
  mockRouter,
  renderScreen,
  resetScreenHarness,
  setParams,
  mockApiResponse,
  mockApiError,
} from "../helpers/screenHarness";
import OTPScreen from "../../app/(auth)/otp";

describe("OTPScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const typeFullOtp = async (
    getByLabelText: (label: string) => any,
  ) => {
    await fireEvent.changeText(getByLabelText("Chữ số OTP 1"), "123456");
  };

  test("renders the OTP form with email and countdown", async () => {
    const { getByText } = await renderScreen(<OTPScreen />, {
      params: { email: "tester@example.com", flow: "forgot_password" },
    });
    expect(getByText("Xác thực email")).toBeTruthy();
    expect(getByText("tester@example.com")).toBeTruthy();
    expect(getByText("01:58")).toBeTruthy();
    expect(getByText("Gửi lại mã")).toBeTruthy();
    expect(getByText("Quay lại đăng nhập")).toBeTruthy();
  });

  test("counts down the resend timer", async () => {
    jest.useFakeTimers();
    const { getByText } = await renderScreen(<OTPScreen />, {
      params: { email: "tester@example.com", flow: "forgot_password" },
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(getByText("01:57")).toBeTruthy();
  });

  test("shows error when verification params are missing", async () => {
    const { getByLabelText, getByText } = await renderScreen(
      <OTPScreen />,
    );
    await typeFullOtp(getByLabelText);
    await waitFor(() =>
      expect(
        getByText(
          "Không nhận được dữ liệu xác thực. Vui lòng quay lại và thử lại.",
        ),
      ).toBeTruthy(),
    );
    expect(mockApiClient.current.post).not.toHaveBeenCalled();
  });

  test("verifies OTP and navigates to reset-password for forgot_password flow", async () => {
    mockApiClient.current.post.mockResolvedValue(mockApiResponse({}));
    const { getByLabelText } = await renderScreen(<OTPScreen />, {
      params: { email: "tester@example.com", flow: "forgot_password" },
    });
    await typeFullOtp(getByLabelText);
    await waitFor(() =>
      expect(mockApiClient.current.post).toHaveBeenCalledWith(
        "/auth/verify-otp",
        { email: "tester@example.com", otp: "123456" },
      ),
    );
    await waitFor(() =>
      expect(mockRouter.current.push).toHaveBeenCalledWith({
        pathname: "/(auth)/reset-password",
        params: {
          email: "tester@example.com",
          otp: "123456",
        },
      }),
    );
  });

  test("verifies OTP and navigates to register-password for register flow", async () => {
    mockApiClient.current.post.mockResolvedValue(
      mockApiResponse({ data: { registrationToken: "tok-123" } }),
    );
    const { getByLabelText } = await renderScreen(<OTPScreen />, {
      params: {
        email: "tester@example.com",
        flow: "register",
        role: "personal",
      },
    });
    await typeFullOtp(getByLabelText);
    await waitFor(() =>
      expect(mockRouter.current.push).toHaveBeenCalledWith({
        pathname: "/(auth)/register-password",
        params: {
          email: "tester@example.com",
          role: "personal",
          registrationToken: "tok-123",
        },
      }),
    );
  });

  test("shows error message when verification fails", async () => {
    mockApiClient.current.post.mockRejectedValue(
      mockApiError("Mã OTP không chính xác", 400, {
        message: "Mã OTP không chính xác hoặc đã hết hạn.",
      }),
    );
    const { getByLabelText, getByText } = await renderScreen(
      <OTPScreen />,
      {
        params: { email: "tester@example.com", flow: "forgot_password" },
      },
    );
    await typeFullOtp(getByLabelText);
    await waitFor(() =>
      expect(
        getByText("Mã OTP không chính xác hoặc đã hết hạn."),
      ).toBeTruthy(),
    );
    expect(mockRouter.current.push).not.toHaveBeenCalled();
  });

  test("resends OTP after the countdown expires", async () => {
    jest.useFakeTimers();
    mockApiClient.current.post.mockResolvedValue(mockApiResponse({}));
    const { getByText, getByLabelText } = await renderScreen(
      <OTPScreen />,
      {
        params: { email: "tester@example.com", flow: "forgot_password" },
      },
    );
    await act(async () => {
      jest.advanceTimersByTime(118_000);
    });
    await fireEvent.press(getByText("Gửi lại mã"));
    await waitFor(() =>
      expect(mockApiClient.current.post).toHaveBeenCalledWith(
        "/auth/send-otp",
        { email: "tester@example.com" },
      ),
    );
    await waitFor(() =>
      expect(
        getByText("Mã OTP mới đã được gửi đến email của bạn."),
      ).toBeTruthy(),
    );
    expect(getByLabelText("Chữ số OTP 1")).toBeTruthy();
  });
});