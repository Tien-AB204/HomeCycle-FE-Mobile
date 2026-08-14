import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  mockRouter,
  renderScreen,
  resetScreenHarness,
} from "../helpers/screenHarness";
import ForgotPasswordScreen from "../../app/(auth)/forgot-password";

describe("ForgotPasswordScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
  });

  test("renders the forgot password form", async () => {
    const { getByText, getByPlaceholderText } = await renderScreen(
      <ForgotPasswordScreen />,
    );
    expect(getByText("Khôi phục mật khẩu")).toBeTruthy();
    expect(
      getByText(
        "Nhập email của bạn để nhận mã OTP xác thực khôi phục tài khoản.",
      ),
    ).toBeTruthy();
    expect(getByPlaceholderText("user@example.com")).toBeTruthy();
    expect(getByText("GỬI MÃ KHÔI PHỤC")).toBeTruthy();
    expect(getByText("Quay lại đăng nhập")).toBeTruthy();
  });

  test("shows validation error when submitting empty email", async () => {
    const { getByText } = await renderScreen(<ForgotPasswordScreen />);
    await fireEvent.press(getByText("GỬI MÃ KHÔI PHỤC"));
    expect(getByText("Vui lòng nhập email của bạn.")).toBeTruthy();
    expect(mockRouter.current.push).not.toHaveBeenCalled();
  });

  test("shows invalid email format error", async () => {
    const { getByText, getByPlaceholderText } = await renderScreen(
      <ForgotPasswordScreen />,
    );
    await fireEvent.changeText(
      getByPlaceholderText("user@example.com"),
      "not-an-email",
    );
    await fireEvent.press(getByText("GỬI MÃ KHÔI PHỤC"));
    expect(
      getByText("Địa chỉ email không đúng định dạng."),
    ).toBeTruthy();
    expect(mockRouter.current.push).not.toHaveBeenCalled();
  });

  test("navigates to OTP screen with email and flow params", async () => {
    const { getByText, getByPlaceholderText } = await renderScreen(
      <ForgotPasswordScreen />,
    );
    await fireEvent.changeText(
      getByPlaceholderText("user@example.com"),
      "tester@example.com",
    );
    await fireEvent.press(getByText("GỬI MÃ KHÔI PHỤC"));
    await waitFor(() =>
      expect(mockRouter.current.push).toHaveBeenCalledWith({
        pathname: "/(auth)/otp",
        params: {
          email: "tester@example.com",
          flow: "forgot_password",
        },
      }),
    );
  });

  test("goes back when pressing the back button", async () => {
    const { getByLabelText } = await renderScreen(<ForgotPasswordScreen />);
    await fireEvent.press(getByLabelText("Quay lại"));
    expect(mockRouter.current.back).toHaveBeenCalled();
  });

  test("replaces to login when pressing Quay lại đăng nhập", async () => {
    const { getByText } = await renderScreen(<ForgotPasswordScreen />);
    await fireEvent.press(getByText("Quay lại đăng nhập"));
    expect(mockRouter.current.replace).toHaveBeenCalledWith(
      "/(auth)/login",
    );
  });
});