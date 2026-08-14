import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  mockAuth,
  mockRouter,
  renderScreen,
  resetScreenHarness,
  setAuth,
  setParams,
} from "../helpers/screenHarness";
import LoginScreen from "../../app/(auth)/login";

describe("LoginScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
  });

  test("renders the login form", async () => {
    const { getByText, getByPlaceholderText } = await renderScreen(
      <LoginScreen />,
    );
    expect(getByText("Đăng nhập vào tài khoản của bạn")).toBeTruthy();
    expect(getByPlaceholderText("Nhập email...")).toBeTruthy();
    expect(getByPlaceholderText("Nhập mật khẩu...")).toBeTruthy();
    expect(getByText("ĐĂNG NHẬP")).toBeTruthy();
  });

  test("shows validation errors when submitting empty form", async () => {
    const { getByText } = await renderScreen(<LoginScreen />);
    await fireEvent.press(getByText("ĐĂNG NHẬP"));
    expect(getByText("Vui lòng nhập địa chỉ email.")).toBeTruthy();
    expect(getByText("Vui lòng nhập mật khẩu.")).toBeTruthy();
    expect(mockAuth.current.login).not.toHaveBeenCalled();
  });

  test("shows invalid email format error", async () => {
    const { getByText, getByPlaceholderText } = await renderScreen(
      <LoginScreen />,
    );
    await fireEvent.changeText(
      getByPlaceholderText("Nhập email..."),
      "not-an-email",
    );
    await fireEvent.changeText(
      getByPlaceholderText("Nhập mật khẩu..."),
      "secret123",
    );
    await fireEvent.press(getByText("ĐĂNG NHẬP"));
    expect(
      getByText("Địa chỉ email không đúng định dạng."),
    ).toBeTruthy();
    expect(mockAuth.current.login).not.toHaveBeenCalled();
  });

  test("calls login with credentials and navigates to (tabs)", async () => {
    const { getByText, getByPlaceholderText } = await renderScreen(
      <LoginScreen />,
    );
    await fireEvent.changeText(
      getByPlaceholderText("Nhập email..."),
      "tester@example.com",
    );
    await fireEvent.changeText(
      getByPlaceholderText("Nhập mật khẩu..."),
      "secret123",
    );
    await fireEvent.press(getByText("ĐĂNG NHẬP"));
    await waitFor(() =>
      expect(mockAuth.current.login).toHaveBeenCalledWith(
        "tester@example.com",
        "secret123",
      ),
    );
    expect(mockRouter.current.replace).toHaveBeenCalledWith("/(tabs)");
  });

  test("navigates to returnUrl after login", async () => {
    setParams({ returnUrl: "/posts/123" });
    const { getByText, getByPlaceholderText } = await renderScreen(
      <LoginScreen />,
      { params: { returnUrl: "/posts/123" } },
    );
    await fireEvent.changeText(
      getByPlaceholderText("Nhập email..."),
      "tester@example.com",
    );
    await fireEvent.changeText(
      getByPlaceholderText("Nhập mật khẩu..."),
      "secret123",
    );
    await fireEvent.press(getByText("ĐĂNG NHẬP"));
    await waitFor(() =>
      expect(mockRouter.current.replace).toHaveBeenCalledWith(
        "/posts/123",
      ),
    );
  });

  test("shows error message when login fails", async () => {
    setAuth({
      login: jest
        .fn()
        .mockRejectedValue(new Error("Sai thông tin đăng nhập")),
    });
    const { getByText, getByPlaceholderText } = await renderScreen(
      <LoginScreen />,
    );
    await fireEvent.changeText(
      getByPlaceholderText("Nhập email..."),
      "tester@example.com",
    );
    await fireEvent.changeText(
      getByPlaceholderText("Nhập mật khẩu..."),
      "secret123",
    );
    await fireEvent.press(getByText("ĐĂNG NHẬP"));
    await waitFor(() =>
      expect(getByText("Sai thông tin đăng nhập")).toBeTruthy(),
    );
    expect(mockRouter.current.replace).not.toHaveBeenCalled();
  });

  test("navigates to forgot-password screen", async () => {
    const { getByText } = await renderScreen(<LoginScreen />);
    await fireEvent.press(getByText("Quên mật khẩu?"));
    expect(mockRouter.current.push).toHaveBeenCalledWith(
      "/forgot-password",
    );
  });
});