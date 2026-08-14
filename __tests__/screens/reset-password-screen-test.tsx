import { fireEvent } from "@testing-library/react-native";
import {
  mockApiClient,
  renderScreen,
  resetScreenHarness,
  setParams,
} from "../helpers/screenHarness";
import ResetPasswordScreen from "../../app/(auth)/reset-password";

describe("ResetPasswordScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
  });

  test("renders the reset password form", async () => {
    const { getByText, getByPlaceholderText } = await renderScreen(
      <ResetPasswordScreen />,
      { params: { email: "tester@example.com" } },
    );
    expect(getByText("Đặt lại mật khẩu mới")).toBeTruthy();
    expect(getByText("tester@example.com")).toBeTruthy();
    expect(getByPlaceholderText("Nhập mật khẩu mới...")).toBeTruthy();
    expect(
      getByPlaceholderText("Nhập lại mật khẩu mới..."),
    ).toBeTruthy();
    expect(getByText("XÁC NHẬN ĐỔI MẬT KHẨU")).toBeTruthy();
  });

  test("shows validation errors when submitting empty form", async () => {
    const { getByText } = await renderScreen(<ResetPasswordScreen />);
    await fireEvent.press(getByText("XÁC NHẬN ĐỔI MẬT KHẨU"));
    expect(getByText("Vui lòng nhập mật khẩu mới.")).toBeTruthy();
    expect(
      getByText("Vui lòng nhập lại mật khẩu mới."),
    ).toBeTruthy();
  });

  test("shows error for short new password", async () => {
    const { getByText, getByPlaceholderText } = await renderScreen(
      <ResetPasswordScreen />,
    );
    await fireEvent.changeText(
      getByPlaceholderText("Nhập mật khẩu mới..."),
      "12345",
    );
    await fireEvent.changeText(
      getByPlaceholderText("Nhập lại mật khẩu mới..."),
      "12345",
    );
    await fireEvent.press(getByText("XÁC NHẬN ĐỔI MẬT KHẨU"));
    expect(
      getByText("Mật khẩu phải có ít nhất 6 ký tự."),
    ).toBeTruthy();
  });

  test("shows error when confirm password does not match", async () => {
    const { getByText, getByPlaceholderText } = await renderScreen(
      <ResetPasswordScreen />,
    );
    await fireEvent.changeText(
      getByPlaceholderText("Nhập mật khẩu mới..."),
      "secret123",
    );
    await fireEvent.changeText(
      getByPlaceholderText("Nhập lại mật khẩu mới..."),
      "secret124",
    );
    await fireEvent.press(getByText("XÁC NHẬN ĐỔI MẬT KHẨU"));
    expect(getByText("Mật khẩu xác nhận không khớp.")).toBeTruthy();
  });

  test("valid form shows unsupported feature message without API call", async () => {
    const { getByText, getByPlaceholderText } = await renderScreen(
      <ResetPasswordScreen />,
    );
    await fireEvent.changeText(
      getByPlaceholderText("Nhập mật khẩu mới..."),
      "secret123",
    );
    await fireEvent.changeText(
      getByPlaceholderText("Nhập lại mật khẩu mới..."),
      "secret123",
    );
    await fireEvent.press(getByText("XÁC NHẬN ĐỔI MẬT KHẨU"));
    expect(
      getByText(
        "Chức năng đặt lại mật khẩu hiện chưa được máy chủ hỗ trợ. Vui lòng thử lại sau.",
      ),
    ).toBeTruthy();
    expect(mockApiClient.current.post).not.toHaveBeenCalled();
    expect(mockApiClient.current.get).not.toHaveBeenCalled();
  });
});