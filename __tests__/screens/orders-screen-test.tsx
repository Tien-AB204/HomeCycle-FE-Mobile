import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  mockApiClient,
  mockApiError,
  mockApiResponse,
  mockRouter,
  renderScreen,
  resetScreenHarness,
} from "../helpers/screenHarness";
import OrdersScreen from "../../app/(tabs)/orders";

const BUYER_ORDER = {
  orderId: "o-1",
  orderCode: "DH0001",
  productName: "Máy giặt LG",
  finalTotalAmount: 2500000,
  orderStatus: 1,
  createdAt: "2026-08-10T10:00:00",
};

const SELLER_ORDER = {
  orderId: "o-2",
  orderCode: "DH0002",
  productName: "Tủ lạnh Panasonic",
  finalTotalAmount: 4000000,
  orderStatus: 2,
  createdAt: "2026-08-09T10:00:00",
};

function mockOrders() {
  mockApiClient.current.get.mockImplementation((url: string) => {
    if (url === "/orders/buyer") {
      return Promise.resolve(mockApiResponse({ items: [BUYER_ORDER] }));
    }
    if (url === "/orders/seller") {
      return Promise.resolve(mockApiResponse({ items: [SELLER_ORDER] }));
    }
    return Promise.resolve(mockApiResponse({ items: [] }));
  });
}

describe("OrdersScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
  });

  test("renders processing orders with status text", async () => {
    mockOrders();
    const { getByText, getAllByText } = await renderScreen(<OrdersScreen />);

    await waitFor(() =>
      expect(mockApiClient.current.get).toHaveBeenCalledWith(
        "/orders/buyer",
        expect.anything(),
      ),
    );
    await waitFor(() => expect(getByText("Máy giặt LG")).toBeTruthy());
    expect(getAllByText("Đang xử lý").length).toBeGreaterThan(0);
    expect(getAllByText("Đơn mua").length).toBeGreaterThan(0);
    expect(getByText("Mã: DH0001")).toBeTruthy();
    expect(getByText("Chi tiết đơn hàng")).toBeTruthy();
  });

  test("switches to history tab showing seller order", async () => {
    mockOrders();
    const { getByText, queryByText, getAllByText } = await renderScreen(
      <OrdersScreen />,
    );
    await waitFor(() => expect(getByText("Máy giặt LG")).toBeTruthy());
    expect(queryByText("Tủ lạnh Panasonic")).toBeNull();

    await fireEvent.press(getByText("Lịch sử"));
    await waitFor(() =>
      expect(getByText("Tủ lạnh Panasonic")).toBeTruthy(),
    );
    expect(getByText("Đã hoàn thành")).toBeTruthy();
    expect(getAllByText("Đơn bán").length).toBeGreaterThan(0);
    expect(queryByText("Máy giặt LG")).toBeNull();
  });

  test("filters by Đơn bán sub filter", async () => {
    mockOrders();
    const { getByText, queryByText } = await renderScreen(<OrdersScreen />);
    await waitFor(() => expect(getByText("Máy giặt LG")).toBeTruthy());

    await fireEvent.press(getByText("Đơn bán"));
    await waitFor(() => expect(queryByText("Máy giặt LG")).toBeNull());
  });

  test("shows empty state when no orders", async () => {
    mockApiClient.current.get.mockResolvedValue(
      mockApiResponse({ items: [] }),
    );
    const { getByText } = await renderScreen(<OrdersScreen />);

    await waitFor(() =>
      expect(getByText("Chưa có đơn hàng nào cho mục này.")).toBeTruthy(),
    );
  });

  test("shows empty state when APIs fail", async () => {
    mockApiClient.current.get.mockRejectedValue(
      mockApiError("Lỗi tải đơn hàng.", 400, {
        message: "Lỗi tải đơn hàng.",
      }),
    );
    const { getByText } = await renderScreen(<OrdersScreen />);

    await waitFor(() =>
      expect(getByText("Chưa có đơn hàng nào cho mục này.")).toBeTruthy(),
    );
  });

  test("navigates to order detail", async () => {
    mockOrders();
    const { getByText } = await renderScreen(<OrdersScreen />);
    await waitFor(() => expect(getByText("Máy giặt LG")).toBeTruthy());

    await fireEvent.press(getByText("Chi tiết đơn hàng"));
    expect(mockRouter.current.push).toHaveBeenCalledWith("/orders/o-1");
  });
});
