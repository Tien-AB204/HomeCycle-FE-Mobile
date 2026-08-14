import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  mockApiClient,
  mockApiResponse,
  renderScreen,
  resetScreenHarness,
} from "../helpers/screenHarness";
import NotificationsScreen from "../../app/(tabs)/notifications";

const NOTIFICATION = {
  id: "n-1",
  title: "Đơn hàng đã giao",
  message: "Đơn hàng DH123 đã được giao thành công.",
  isRead: false,
  type: "success",
  createdAt: new Date().toISOString(),
};

function mockNotifications(items: any[] = [NOTIFICATION]) {
  mockApiClient.current.get.mockResolvedValue(
    mockApiResponse({ items }),
  );
}

describe("NotificationsScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
  });

  test("renders notification list from API", async () => {
    mockNotifications();
    const { getByText } = await renderScreen(<NotificationsScreen />);

    await waitFor(() =>
      expect(mockApiClient.current.get).toHaveBeenCalledWith(
        "/notifications",
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect(getByText("Đơn hàng đã giao")).toBeTruthy(),
    );
    expect(
      getByText("Đơn hàng DH123 đã được giao thành công."),
    ).toBeTruthy();
    expect(getByText("Đánh dấu đã đọc")).toBeTruthy();
    expect(getByText("Gần đây")).toBeTruthy();
  });

  test("shows empty state when no notifications", async () => {
    mockNotifications([]);
    const { getByText } = await renderScreen(<NotificationsScreen />);

    await waitFor(() =>
      expect(getByText("Chưa có thông báo nào")).toBeTruthy(),
    );
  });

  test("shows empty state when API fails", async () => {
    mockApiClient.current.get.mockRejectedValue(
      new Error("Lỗi máy chủ"),
    );
    const { getByText } = await renderScreen(<NotificationsScreen />);

    await waitFor(() =>
      expect(getByText("Chưa có thông báo nào")).toBeTruthy(),
    );
  });

  test("marks all notifications as read via PUT", async () => {
    mockNotifications();
    const { getByText } = await renderScreen(<NotificationsScreen />);
    await waitFor(() =>
      expect(getByText("Đơn hàng đã giao")).toBeTruthy(),
    );

    mockApiClient.current.put.mockResolvedValueOnce(
      mockApiResponse({ isSuccess: true }),
    );
    await fireEvent.press(getByText("Đánh dấu đã đọc"));

    await waitFor(() =>
      expect(mockApiClient.current.put).toHaveBeenCalledWith(
        "/notifications/mark-all-read",
      ),
    );
    expect(mockApiClient.current.get).toHaveBeenCalled();
  });
});
