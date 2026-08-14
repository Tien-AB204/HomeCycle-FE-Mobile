import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  mockApiClient,
  mockRouter,
  renderScreen,
  resetScreenHarness,
  mockApiResponse,
  mockApiError,
} from "../helpers/screenHarness";
import RegisterScreen from "../../app/(auth)/register";

describe("RegisterScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
  });

  test("renders the register form with role tabs and Google button", async () => {
    const { getByText, getByPlaceholderText } = await renderScreen(
      <RegisterScreen />,
    );
    expect(getByText("Tạo tài khoản")).toBeTruthy();
    expect(getByText("Cá nhân")).toBeTruthy();
    expect(getByText("Doanh nghiệp")).toBeTruthy();
    expect(getByPlaceholderText("example@gmail.com")).toBeTruthy();
    expect(getByText("ĐĂNG KÝ")).toBeTruthy();
    expect(getByText("Google")).toBeTruthy();
  });

  test("shows validation errors when submitting empty form", async () => {
    const { getByText } = await renderScreen(<RegisterScreen />);
    await fireEvent.press(getByText("ĐĂNG KÝ"));
    expect(getByText("Vui lòng nhập địa chỉ email.")).toBeTruthy();
    expect(
      getByText(
        "Bạn cần đồng ý với điều khoản dịch vụ và chính sách bảo mật.",
      ),
    ).toBeTruthy();
    expect(mockApiClient.current.post).not.toHaveBeenCalled();
    expect(mockRouter.current.push).not.toHaveBeenCalled();
  });

  test("shows invalid email format error", async () => {
    const { getByText, getByPlaceholderText, getByRole } = await renderScreen(
      <RegisterScreen />,
    );
    await fireEvent.changeText(
      getByPlaceholderText("example@gmail.com"),
      "not-an-email",
    );
    await fireEvent.press(getByRole("checkbox"));
    await fireEvent.press(getByText("ĐĂNG KÝ"));
    expect(
      getByText("Địa chỉ email không đúng định dạng."),
    ).toBeTruthy();
    expect(mockApiClient.current.post).not.toHaveBeenCalled();
  });

  test("sends OTP and navigates to OTP screen with personal role", async () => {
    mockApiClient.current.post.mockResolvedValue(mockApiResponse({}));
    const { getByText, getByPlaceholderText, getByRole } = await renderScreen(
      <RegisterScreen />,
    );
    await fireEvent.changeText(
      getByPlaceholderText("example@gmail.com"),
      "tester@example.com",
    );
    await fireEvent.press(getByRole("checkbox"));
    await fireEvent.press(getByText("ĐĂNG KÝ"));
    await waitFor(() =>
      expect(mockApiClient.current.post).toHaveBeenCalledWith(
        "/auth/send-otp",
        { email: "tester@example.com" },
      ),
    );
    await waitFor(() =>
      expect(mockRouter.current.push).toHaveBeenCalledWith({
        pathname: "/(auth)/otp",
        params: {
          email: "tester@example.com",
          flow: "register",
          role: "personal",
        },
      }),
    );
  });

  test("selects business role and navigates with business role", async () => {
    mockApiClient.current.post.mockResolvedValue(mockApiResponse({}));
    const { getByText, getByPlaceholderText, getByRole } = await renderScreen(
      <RegisterScreen />,
    );
    await fireEvent.press(getByText("Doanh nghiệp"));
    await fireEvent.changeText(
      getByPlaceholderText("example@gmail.com"),
      "business@example.com",
    );
    await fireEvent.press(getByRole("checkbox"));
    await fireEvent.press(getByText("ĐĂNG KÝ"));
    await waitFor(() =>
      expect(mockRouter.current.push).toHaveBeenCalledWith({
        pathname: "/(auth)/otp",
        params: {
          email: "business@example.com",
          flow: "register",
          role: "business",
        },
      }),
    );
  });

  test("shows error message when sending OTP fails", async () => {
    mockApiClient.current.post.mockRejectedValue(
      mockApiError("Email đã tồn tại", 400, { message: "Email đã tồn tại." }),
    );
    const { getByText, getByPlaceholderText, getByRole } = await renderScreen(
      <RegisterScreen />,
    );
    await fireEvent.changeText(
      getByPlaceholderText("example@gmail.com"),
      "tester@example.com",
    );
    await fireEvent.press(getByRole("checkbox"));
    await fireEvent.press(getByText("ĐĂNG KÝ"));
    await waitFor(() =>
      expect(getByText("Email đã tồn tại.")).toBeTruthy(),
    );
    expect(mockRouter.current.push).not.toHaveBeenCalled();
  });
});