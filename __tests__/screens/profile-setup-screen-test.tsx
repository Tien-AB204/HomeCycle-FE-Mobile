import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  mockRouter,
  renderScreen,
  resetScreenHarness,
  setParams,
} from "../helpers/screenHarness";
import ProfileSetupScreen from "../../app/(auth)/profile-setup";

describe("ProfileSetupScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
  });

  test("renders the profile setup form", async () => {
    const { getByText, getByPlaceholderText } = await renderScreen(
      <ProfileSetupScreen />,
    );
    expect(getByText("Thiết lập hồ sơ cá nhân")).toBeTruthy();
    expect(getByText("Bước 1/2: Điền thông tin cơ bản để hoàn thiện tài khoản.")).toBeTruthy();
    expect(getByPlaceholderText("Nhập họ và tên...")).toBeTruthy();
    expect(getByPlaceholderText("username_cua_ban")).toBeTruthy();
    expect(getByPlaceholderText("Nhập số điện thoại...")).toBeTruthy();
    expect(getByText("TIẾP TỤC")).toBeTruthy();
  });

  test("shows validation errors when submitting empty form", async () => {
    const { getByText } = await renderScreen(<ProfileSetupScreen />);
    await fireEvent.press(getByText("TIẾP TỤC"));
    expect(getByText("Vui lòng nhập họ và tên.")).toBeTruthy();
    expect(getByText("Vui lòng nhập username.")).toBeTruthy();
    expect(getByText("Vui lòng nhập số điện thoại.")).toBeTruthy();
    expect(mockRouter.current.push).not.toHaveBeenCalled();
  });

  test("navigates to verification-setup with the entered data", async () => {
    setParams({
      email: "tester@example.com",
      password: "secret123",
      registrationToken: "tok-123",
    });
    const { getByText, getByPlaceholderText } = await renderScreen(
      <ProfileSetupScreen />,
      {
        params: {
          email: "tester@example.com",
          password: "secret123",
          registrationToken: "tok-123",
        },
      },
    );
    await fireEvent.changeText(
      getByPlaceholderText("Nhập họ và tên..."),
      "Nguyễn Văn A",
    );
    await fireEvent.changeText(
      getByPlaceholderText("username_cua_ban"),
      "nguyenvana",
    );
    await fireEvent.changeText(
      getByPlaceholderText("Nhập số điện thoại..."),
      "0901234567",
    );
    await fireEvent.press(getByText("TIẾP TỤC"));
    await waitFor(() =>
      expect(mockRouter.current.push).toHaveBeenCalledWith({
        pathname: "/(auth)/verification-setup",
        params: {
          email: "tester@example.com",
          registrationToken: "tok-123",
          password: "secret123",
          fullName: "Nguyễn Văn A",
          username: "nguyenvana",
          phoneNumber: "0901234567",
          avatarUri: "",
        },
      }),
    );
  });

  test("picks an avatar image and forwards its uri", async () => {
    setParams({
      email: "tester@example.com",
      password: "secret123",
      registrationToken: "tok-123",
    });
    const { getByText, getByPlaceholderText, getByLabelText } =
      await renderScreen(<ProfileSetupScreen />, {
        params: {
          email: "tester@example.com",
          password: "secret123",
          registrationToken: "tok-123",
        },
      });
    await fireEvent.press(getByLabelText("Chọn ảnh đại diện"));
    await waitFor(() =>
      expect(getByLabelText("Thay ảnh đại diện")).toBeTruthy(),
    );
    await fireEvent.changeText(
      getByPlaceholderText("Nhập họ và tên..."),
      "Nguyễn Văn A",
    );
    await fireEvent.changeText(
      getByPlaceholderText("username_cua_ban"),
      "nguyenvana",
    );
    await fireEvent.changeText(
      getByPlaceholderText("Nhập số điện thoại..."),
      "0901234567",
    );
    await fireEvent.press(getByText("TIẾP TỤC"));
    await waitFor(() =>
      expect(mockRouter.current.push).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: "/(auth)/verification-setup",
          params: expect.objectContaining({
            avatarUri: "file:///tmp/mock-image.jpg",
          }),
        }),
      ),
    );
  });
});