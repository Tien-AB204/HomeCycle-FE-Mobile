import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  mockApiClient,
  mockRouter,
  renderScreen,
  resetScreenHarness,
  setParams,
  mockApiResponse,
  mockApiError,
} from "../helpers/screenHarness";
import RegisterPasswordScreen from "../../app/(auth)/register-password";

describe("RegisterPasswordScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
  });

  const defaultParams = {
    email: "tester@example.com",
    role: "personal",
    registrationToken: "tok-123",
    isGoogleAuth: "",
  };

  test("renders the password form with the email", async () => {
    const { getByText, getByPlaceholderText, getByLabelText } =
      await renderScreen(<RegisterPasswordScreen />, {
        params: defaultParams,
      });
    expect(getByText("Tạo mật khẩu")).toBeTruthy();
    expect(getByLabelText("Email tài khoản")).toHaveProp("value", "tester@example.com");
    expect(getByPlaceholderText("Tối thiểu 6 ký tự...")).toBeTruthy();
    expect(getByText("TIẾP TỤC")).toBeTruthy();
  });

  test("shows validation error when submitting empty password", async () => {
    const { getByText } = await renderScreen(<RegisterPasswordScreen />, {
      params: defaultParams,
    });
    await fireEvent.press(getByText("TIẾP TỤC"));
    expect(getByText("Vui lòng nhập mật khẩu.")).toBeTruthy();
    expect(mockApiClient.current.post).not.toHaveBeenCalled();
    expect(mockRouter.current.push).not.toHaveBeenCalled();
  });

  test("shows error for password shorter than 6 characters", async () => {
    const { getByText, getByPlaceholderText } = await renderScreen(
      <RegisterPasswordScreen />,
      { params: defaultParams },
    );
    await fireEvent.changeText(
      getByPlaceholderText("Tối thiểu 6 ký tự..."),
      "12345",
    );
    await fireEvent.press(getByText("TIẾP TỤC"));
    expect(
      getByText("Mật khẩu phải có ít nhất 6 ký tự."),
    ).toBeTruthy();
    expect(mockApiClient.current.post).not.toHaveBeenCalled();
  });

  test("personal role navigates to profile-setup without API call", async () => {
    const { getByText, getByPlaceholderText } = await renderScreen(
      <RegisterPasswordScreen />,
      { params: defaultParams },
    );
    await fireEvent.changeText(
      getByPlaceholderText("Tối thiểu 6 ký tự..."),
      "secret123",
    );
    await fireEvent.press(getByText("TIẾP TỤC"));
    await waitFor(() =>
      expect(mockRouter.current.push).toHaveBeenCalledWith({
        pathname: "/(auth)/profile-setup",
        params: {
          email: "tester@example.com",
          password: "secret123",
          registrationToken: "tok-123",
          isGoogleAuth: "",
        },
      }),
    );
    expect(mockApiClient.current.post).not.toHaveBeenCalled();
  });

  test("business role registers via API and stores tokens", async () => {
    mockApiClient.current.post.mockResolvedValue(
      mockApiResponse({
        data: {
          accessToken: "access-123",
          refreshToken: "refresh-456",
        },
      }),
    );
    const { getByText, getByPlaceholderText } = await renderScreen(
      <RegisterPasswordScreen />,
      {
        params: {
          ...defaultParams,
          role: "business",
        },
      },
    );
    await fireEvent.changeText(
      getByPlaceholderText("Tối thiểu 6 ký tự..."),
      "secret123",
    );
    await fireEvent.press(getByText("TIẾP TỤC"));
    await waitFor(() =>
      expect(mockApiClient.current.post).toHaveBeenCalledWith(
        "/auth/business/register",
        { password: "secret123" },
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "accessToken",
        "access-123",
      ),
    );
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "userRole",
      "business",
    );
    await waitFor(() =>
      expect(mockRouter.current.push).toHaveBeenCalledWith({
        pathname: "/(auth)/business-setup",
        params: {
          email: "tester@example.com",
          isGoogleAuth: "",
        },
      }),
    );
  });

  test("business role without registration token shows error", async () => {
    const { getByText, getByPlaceholderText } = await renderScreen(
      <RegisterPasswordScreen />,
      {
        params: {
          email: "tester@example.com",
          role: "business",
          registrationToken: "",
          isGoogleAuth: "",
        },
      },
    );
    await fireEvent.changeText(
      getByPlaceholderText("Tối thiểu 6 ký tự..."),
      "secret123",
    );
    await fireEvent.press(getByText("TIẾP TỤC"));
    await waitFor(() =>
      expect(
        getByText(
          "Không tìm thấy mã đăng ký. Vui lòng thực hiện lại quá trình đăng ký.",
        ),
      ).toBeTruthy(),
    );
    expect(mockApiClient.current.post).not.toHaveBeenCalled();
  });

  test("shows error message when business registration fails", async () => {
    mockApiClient.current.post.mockRejectedValue(
      mockApiError("Máy chủ từ chối", 400, {
        message: "Mã đăng ký không hợp lệ.",
      }),
    );
    const { getByText, getByPlaceholderText } = await renderScreen(
      <RegisterPasswordScreen />,
      {
        params: {
          ...defaultParams,
          role: "business",
        },
      },
    );
    await fireEvent.changeText(
      getByPlaceholderText("Tối thiểu 6 ký tự..."),
      "secret123",
    );
    await fireEvent.press(getByText("TIẾP TỤC"));
    await waitFor(() =>
      expect(getByText("Mã đăng ký không hợp lệ.")).toBeTruthy(),
    );
    expect(mockRouter.current.push).not.toHaveBeenCalled();
  });
});