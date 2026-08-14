import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  mockApiClient,
  mockApiError,
  mockApiResponse,
  renderScreen,
  resetScreenHarness,
} from "../helpers/screenHarness";
import AccountInfoScreen from "../../app/profile/account-info";

describe("AccountInfoScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
    (global as any).alert = jest.fn();
  });

  test("renders user data from auth context", async () => {
    const { getByText, getByDisplayValue } = await renderScreen(
      <AccountInfoScreen />,
    );

    expect(getByText("Thông tin tài khoản")).toBeTruthy();
    expect(getByText("THÔNG TIN CÁ NHÂN")).toBeTruthy();
    expect(getByDisplayValue("tester")).toBeTruthy();
    expect(getByDisplayValue("Người Dùng Test")).toBeTruthy();
    expect(getByDisplayValue("0900000000")).toBeTruthy();
    expect(getByText("LƯU THAY ĐỔI")).toBeTruthy();
  });

  test("saves edited profile via PUT and shows success alert", async () => {
    mockApiClient.current.put.mockResolvedValue(mockApiResponse({}));

    const { getByText, getByDisplayValue } = await renderScreen(
      <AccountInfoScreen />,
    );

    await fireEvent.changeText(
      getByDisplayValue("Người Dùng Test"),
      "Người Dùng Mới",
    );
    await fireEvent.press(getByText("LƯU THAY ĐỔI"));

    await waitFor(() =>
      expect(mockApiClient.current.put).toHaveBeenCalledWith(
        "/personal-profiles/me/profile",
        {
          username: "tester",
          fullName: "Người Dùng Mới",
          phoneNumber: "0900000000",
        },
      ),
    );
    await waitFor(() =>
      expect((global as any).alert).toHaveBeenCalledWith(
        "Cập nhật thông tin thành công!",
      ),
    );
  });

  test("shows no-change alert when nothing was edited", async () => {
    const { getByText } = await renderScreen(<AccountInfoScreen />);

    await fireEvent.press(getByText("LƯU THAY ĐỔI"));

    await waitFor(() =>
      expect((global as any).alert).toHaveBeenCalledWith(
        "Không có thông tin nào bị thay đổi.",
      ),
    );
    expect(mockApiClient.current.put).not.toHaveBeenCalled();
  });

  test("picks an avatar image and uploads via PATCH", async () => {
    mockApiClient.current.patch.mockResolvedValue(mockApiResponse({}));

    const { getByText, getByTestId } = await renderScreen(
      <AccountInfoScreen />,
    );

    await fireEvent.press(getByTestId("icon-camera"));
    await fireEvent.press(getByText("LƯU THAY ĐỔI"));

    await waitFor(() =>
      expect(mockApiClient.current.patch).toHaveBeenCalledWith(
        "/personal-profiles/me/avatar",
        expect.any(FormData),
        expect.objectContaining({ timeout: 60000 }),
      ),
    );
    expect(mockApiClient.current.put).not.toHaveBeenCalled();
    await waitFor(() =>
      expect((global as any).alert).toHaveBeenCalledWith(
        "Cập nhật thông tin thành công!",
      ),
    );
  });

  test("shows error alert when save fails", async () => {
    mockApiClient.current.put.mockRejectedValue(
      mockApiError("Lỗi lưu", 400),
    );

    const { getByText, getByDisplayValue } = await renderScreen(
      <AccountInfoScreen />,
    );

    await fireEvent.changeText(
      getByDisplayValue("Người Dùng Test"),
      "Người Dùng Mới",
    );
    await fireEvent.press(getByText("LƯU THAY ĐỔI"));

    await waitFor(() =>
      expect((global as any).alert).toHaveBeenCalledWith(
        "Đã xảy ra lỗi khi lưu thông tin. Vui lòng thử lại!",
      ),
    );
  });
});