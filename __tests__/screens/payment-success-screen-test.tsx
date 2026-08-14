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
import PaymentSuccessScreen from "../../app/payments/success";

describe("PaymentSuccessScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
  });

  test("renders success UI and verifies paid status from API", async () => {
    mockApiClient.current.get.mockResolvedValue(
      mockApiResponse({
        data: { agreementStatus: "Confirmed", negotiationId: "neg-1" },
      }),
    );

    const { getByText, queryByText } = await renderScreen(
      <PaymentSuccessScreen />,
      { params: { agreementId: "ag-1", status: "PAID" } },
    );

    await waitFor(() =>
      expect(getByText("Thanh toán thành công!")).toBeTruthy(),
    );
    expect(getByText("Giao dịch đã được ghi nhận.")).toBeTruthy();
    expect(getByText("Xem đơn hàng")).toBeTruthy();
    expect(getByText("Về trang chủ")).toBeTruthy();
    expect(queryByText("Thanh toán thất bại!")).toBeNull();
    expect(mockApiClient.current.get).toHaveBeenCalledWith("/agreements/ag-1");
  });

  test("navigates to order detail and home from success screen", async () => {
    mockApiClient.current.get.mockResolvedValue(
      mockApiResponse({
        data: { agreementStatus: "Confirmed", negotiationId: "neg-1" },
      }),
    );

    const { getByText } = await renderScreen(<PaymentSuccessScreen />, {
      params: { agreementId: "ag-1", status: "PAID" },
    });

    await waitFor(() =>
      expect(getByText("Thanh toán thành công!")).toBeTruthy(),
    );
    await fireEvent.press(getByText("Xem đơn hàng"));
    expect(mockRouter.current.replace).toHaveBeenCalledWith("/orders/ag-1");

    await fireEvent.press(getByText("Về trang chủ"));
    expect(mockRouter.current.replace).toHaveBeenCalledWith("/(tabs)");
  });

  test("shows cancel UI when PayOS returns cancel=true", async () => {
    mockApiClient.current.get.mockResolvedValue(
      mockApiResponse({
        data: { agreementStatus: "Pending", negotiationId: "neg-1" },
      }),
    );

    const { getByText, queryByText } = await renderScreen(
      <PaymentSuccessScreen />,
      { params: { agreementId: "ag-1", status: "PAID", cancel: "true" } },
    );

    await waitFor(() =>
      expect(getByText("Thanh toán thất bại!")).toBeTruthy(),
    );
    expect(
      getByText("Giao dịch đã bị hủy hoặc xảy ra lỗi."),
    ).toBeTruthy();
    expect(queryByText("Xem đơn hàng")).toBeNull();
    expect(getByText("Về trang chủ")).toBeTruthy();
  });

  test("shows failure UI when verification API fails without paid URL", async () => {
    mockApiClient.current.get.mockRejectedValue(
      mockApiError("Lỗi máy chủ", 500),
    );

    const { getByText, queryByText } = await renderScreen(
      <PaymentSuccessScreen />,
      { params: { agreementId: "ag-1" } },
    );

    await waitFor(() =>
      expect(getByText("Thanh toán thất bại!")).toBeTruthy(),
    );
    expect(queryByText("Xem đơn hàng")).toBeNull();
  });
});