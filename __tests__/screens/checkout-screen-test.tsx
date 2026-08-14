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
import * as WebBrowser from "expo-web-browser";

(WebBrowser as any).openBrowserAsync = jest
  .fn()
  .mockResolvedValue({ type: "dismiss" });

const CheckoutScreen = require("../../app/payments/checkout").default;

const agreement = {
  agreementId: "ag-1",
  agreementStatus: "AwaitingPayment",
  paymentType: "Deposit",
  finalPrice: 10000000,
  negotiationId: "neg-1",
};

describe("CheckoutScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
    setParams({ agreementId: "ag-1" });
    (WebBrowser as any).openBrowserAsync.mockClear();
  });

  test("renders invoice amounts and payment methods from agreement", async () => {
    mockApiClient.current.get.mockResolvedValue(
      mockApiResponse({ data: agreement }),
    );

    const { getByText, getAllByText } = await renderScreen(
      <CheckoutScreen />,
      { params: { agreementId: "ag-1" } },
    );

    await waitFor(() => expect(getByText("Tổng hóa đơn")).toBeTruthy());
    expect(getByText("Tiền cọc (20%):")).toBeTruthy();
    expect(getByText("Phí nền tảng:")).toBeTruthy();
    expect(getByText("Tổng thanh toán:")).toBeTruthy();
    expect(getAllByText(/2\.000\.000/).length).toBeGreaterThan(0);
    expect(getByText("Phương thức thanh toán")).toBeTruthy();
    expect(getByText("Ví HomeCycle")).toBeTruthy();
    expect(getByText("PayOS")).toBeTruthy();
    expect(getByText("Chuyển khoản ngân hàng / Mã QR")).toBeTruthy();
    expect(mockApiClient.current.get).toHaveBeenCalledWith("/agreements/ag-1");
  });

  test("wallet payment calls right endpoint and shows success", async () => {
    mockApiClient.current.get.mockResolvedValue(
      mockApiResponse({ data: agreement }),
    );
    mockApiClient.current.post.mockResolvedValue(mockApiResponse({}));

    const { getByText } = await renderScreen(
      <CheckoutScreen />,
      { params: { agreementId: "ag-1" } },
    );

    const submit = await waitFor(() => getByText(/^Thanh toán \d/));
    await fireEvent.press(submit);

    await waitFor(() =>
      expect(mockApiClient.current.post).toHaveBeenCalledWith(
        "/payments/wallet/checkout/ag-1",
      ),
    );
    expect(getByText("Thanh toán qua ví thành công.")).toBeTruthy();

    const backBtn = await waitFor(() => getByText("Quay lại"));
    await fireEvent.press(backBtn);
    expect(mockRouter.current.back).toHaveBeenCalled();
  });

  test("payos payment builds return/cancel urls and opens browser", async () => {
    mockApiClient.current.get.mockResolvedValue(
      mockApiResponse({ data: agreement }),
    );
    mockApiClient.current.post.mockResolvedValue(
      mockApiResponse({
        data: { checkoutUrl: "https://pay.payos.vn/example-checkout" },
      }),
    );
    (WebBrowser as any).openBrowserAsync.mockResolvedValueOnce({
      type: "success",
      url: "homecycle://payments/success?agreementId=ag-1&status=PAID",
    });

    const { getByText } = await renderScreen(<CheckoutScreen />, {
      params: { agreementId: "ag-1" },
    });

    await waitFor(() => expect(getByText(/^Thanh toán \d/)).toBeTruthy());
    await fireEvent.press(getByText("PayOS"));
    await fireEvent.press(getByText(/^Thanh toán \d/));

    await waitFor(() =>
      expect(mockApiClient.current.post).toHaveBeenCalledWith(
        "/payments/payos/checkout/ag-1",
        {
          returnUrl: "homecycle:///payments/success",
          cancelUrl: "homecycle:///payments/success",
        },
      ),
    );
    expect((WebBrowser as any).openBrowserAsync).toHaveBeenCalledWith(
      "https://pay.payos.vn/example-checkout",
    );
  });

  test("blocks payment when agreement status is not payable", async () => {
    mockApiClient.current.get.mockResolvedValue(
      mockApiResponse({
        data: { ...agreement, agreementStatus: "Cancelled" },
      }),
    );

    const { getByText } = await renderScreen(<CheckoutScreen />, {
      params: { agreementId: "ag-1" },
    });

    await waitFor(() => expect(getByText(/^Thanh toán \d/)).toBeTruthy());
    await fireEvent.press(getByText(/^Thanh toán \d/));

    await waitFor(() =>
      expect(
        getByText(
          /Giao dịch bị gián đoạn: Đối tác vừa cập nhật hoặc hủy hợp đồng/,
        ),
      ).toBeTruthy(),
    );
    expect(mockApiClient.current.post).not.toHaveBeenCalled();
  });

  test("shows empty state with error feedback when agreement fails to load", async () => {
    mockApiClient.current.get.mockRejectedValue(
      mockApiError("Không thể tải thông tin thanh toán.", 404),
    );

    const { getByText } = await renderScreen(<CheckoutScreen />, {
      params: { agreementId: "ag-1" },
    });

    await waitFor(() =>
      expect(
        getByText("Chưa tải được thông tin thanh toán"),
      ).toBeTruthy(),
    );
    expect(getByText("Không thể tải thông tin thanh toán.")).toBeTruthy();
    expect(getByText("Thử lại")).toBeTruthy();
  });
});