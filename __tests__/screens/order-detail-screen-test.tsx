import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  mockApiClient,
  mockApiError,
  mockApiResponse,
  mockRouter,
  renderScreen,
  resetScreenHarness,
  setParams,
} from "../helpers/screenHarness";
import OrderDetailScreen from "../../app/orders/[id]";

const orderDetail = {
  order: {
    orderCode: "DH-001",
    orderStatus: 2,
    paymentStatus: 1,
    productName: "Máy giặt LG 8kg",
    quantity: 2,
    finalTotalAmount: 1500000,
    originalTotalAmount: 1000000,
    amountPaid: 1500000,
    amountRemaining: 0,
    postId: "post-1",
    createdAt: "2026-08-01T10:00:00Z",
    updatedAt: "2026-08-14T10:00:00Z",
    completedAt: "2026-08-14T10:00:00Z",
  },
  thumbnailUrl: null,
  counterpartyName: "Anh Bảo",
  negotiationId: "neg-1",
  shipment: { deliveryMethod: "GhnDelivery" },
};

const tracking = {
  deliveryMethod: "GhnDelivery",
  creationStatus: "Success",
  carrierStatus: "delivering",
  trackingCode: "GHN123456",
  expectedDeliveryAt: "2026-08-20T10:00:00Z",
  lastSyncedAt: "2026-08-14T11:00:00Z",
};

function mockOrderApis(order = orderDetail, trackingData: any = tracking) {
  mockApiClient.current.get.mockImplementation((url: string) => {
    if (url === "/orders/ord-1") {
      return Promise.resolve(mockApiResponse({ data: order }));
    }
    if (url === "/orders/ord-1/shipment-tracking") {
      return Promise.resolve(mockApiResponse({ data: trackingData }));
    }
    return Promise.resolve(mockApiResponse({}));
  });
}

describe("OrderDetailScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
    setParams({ id: "ord-1" });
  });

  test("renders order status, details and GHN shipment tracking", async () => {
    mockOrderApis();

    const { getByText } = await renderScreen(<OrderDetailScreen />, {
      params: { id: "ord-1" },
    });

    await waitFor(() => expect(getByText("Máy giặt LG 8kg")).toBeTruthy());
    expect(getByText(/Mã đơn: DH-001/)).toBeTruthy();
    expect(getByText("Tiến trình đơn hàng")).toBeTruthy();
    expect(getByText("Chờ thanh toán")).toBeTruthy();
    expect(getByText("Hoàn thành")).toBeTruthy();
    expect(getByText("Số lượng: 2")).toBeTruthy();
    expect(getByText("Thanh toán chi tiết")).toBeTruthy();
    expect(getByText("Trạng thái thanh toán:")).toBeTruthy();
    expect(getByText("Đã thanh toán toàn phần")).toBeTruthy();
    expect(getByText("Vận chuyển & Giao nhận")).toBeTruthy();
    expect(getByText("Trạng thái vận chuyển:")).toBeTruthy();
    expect(getByText("Nhân viên GHN đang giao hàng")).toBeTruthy();
    expect(getByText("Mã vận đơn GHN:")).toBeTruthy();
    expect(getByText("GHN123456")).toBeTruthy();
    expect(getByText("Đối tác giao dịch")).toBeTruthy();
    expect(getByText("Anh Bảo")).toBeTruthy();
    expect(mockApiClient.current.get).toHaveBeenCalledWith("/orders/ord-1");
    expect(mockApiClient.current.get).toHaveBeenCalledWith(
      "/orders/ord-1/shipment-tracking",
    );
  });

  test("opens chat with negotiation partner", async () => {
    mockOrderApis();

    const { getByText } = await renderScreen(<OrderDetailScreen />, {
      params: { id: "ord-1" },
    });

    await waitFor(() => expect(getByText("Mở hội thoại chat")).toBeTruthy());
    await fireEvent.press(getByText("Mở hội thoại chat"));
    expect(mockRouter.current.push).toHaveBeenCalledWith("/chat/neg-1");
  });

  test("navigates to post detail from product row", async () => {
    mockOrderApis();

    const { getByText } = await renderScreen(<OrderDetailScreen />, {
      params: { id: "ord-1" },
    });

    await waitFor(() => expect(getByText("Máy giặt LG 8kg")).toBeTruthy());
    await fireEvent.press(getByText("Máy giặt LG 8kg"));
    expect(mockRouter.current.push).toHaveBeenCalledWith({
      pathname: "/posts/[id]",
      params: { id: "post-1", viewOnly: "true" },
    });
  });

  test("shows delivery method for non-GHN orders", async () => {
    mockOrderApis(
      {
        ...orderDetail,
        shipment: { deliveryMethod: "OtherDelivery" },
      },
      { deliveryMethod: "OtherDelivery" },
    );

    const { getByText } = await renderScreen(<OrderDetailScreen />, {
      params: { id: "ord-1" },
    });

    await waitFor(() => expect(getByText("Máy giặt LG 8kg")).toBeTruthy());
    expect(getByText("Phương thức:")).toBeTruthy();
    expect(getByText("OtherDelivery")).toBeTruthy();
  });

  test("shows fallback message when tracking fails", async () => {
    mockApiClient.current.get.mockImplementation((url: string) => {
      if (url === "/orders/ord-1") {
        return Promise.resolve(mockApiResponse({ data: orderDetail }));
      }
      return Promise.reject(mockApiError("Lỗi tracking", 500));
    });

    const { getByText } = await renderScreen(<OrderDetailScreen />, {
      params: { id: "ord-1" },
    });

    await waitFor(() =>
      expect(getByText("Trạng thái vận chuyển đang được cập nhật")).toBeTruthy(),
    );
  });

  test("shows empty state when order fetch fails", async () => {
    mockApiClient.current.get.mockRejectedValue(
      mockApiError("Lỗi máy chủ", 500),
    );

    const { getByText } = await renderScreen(<OrderDetailScreen />, {
      params: { id: "ord-1" },
    });

    await waitFor(() =>
      expect(getByText("Không tìm thấy đơn hàng!")).toBeTruthy(),
    );
    await fireEvent.press(getByText("Quay lại"));
    expect(mockRouter.current.back).toHaveBeenCalled();
  });

  test("shows in-development info for bottom actions", async () => {
    mockOrderApis();

    const { getByText } = await renderScreen(<OrderDetailScreen />, {
      params: { id: "ord-1" },
    });

    await waitFor(() => expect(getByText("Hủy Đơn Hàng")).toBeTruthy());
    await fireEvent.press(getByText("Hủy Đơn Hàng"));
    expect(
      getByText('Tính năng "Hủy đơn hàng" đang được phát triển.'),
    ).toBeTruthy();
  });
});