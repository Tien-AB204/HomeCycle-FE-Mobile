import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  mockApiClient,
  mockApiResponse,
  mockRouter,
  renderScreen,
  resetScreenHarness,
  setParams,
} from "../helpers/screenHarness";
import PaymentCancelScreen from "../../app/payments/cancel";

describe("PaymentCancelScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
    setParams({ agreementId: "ag-1" });
  });

  test("renders cancel page and navigates to checkout/chat/home", async () => {
    mockApiClient.current.get.mockResolvedValue(
      mockApiResponse({ data: { negotiationId: "neg-1" } }),
    );

    const { getByText } = await renderScreen(<PaymentCancelScreen />, {
      params: { agreementId: "ag-1" },
    });

    expect(getByText("Thanh toán đã bị hủy")).toBeTruthy();
    await waitFor(() => expect(getByText("Thử lại thanh toán")).toBeTruthy());

    await fireEvent.press(getByText("Thử lại thanh toán"));
    expect(mockRouter.current.replace).toHaveBeenCalledWith(
      "/payments/checkout?agreementId=ag-1",
    );

    await fireEvent.press(getByText("Quay lại trang chat"));
    expect(mockRouter.current.replace).toHaveBeenCalledWith("/chat/neg-1");

    await fireEvent.press(getByText("Về trang chủ"));
    expect(mockRouter.current.replace).toHaveBeenCalledWith("/(tabs)");

    expect(mockApiClient.current.get).toHaveBeenCalledWith("/agreements/ag-1");
  });

  test("falls back to chat tab when negotiation is missing", async () => {
    mockApiClient.current.get.mockResolvedValue(
      mockApiResponse({ data: { negotiationId: null } }),
    );

    const { getByText } = await renderScreen(<PaymentCancelScreen />, {
      params: { agreementId: "ag-1" },
    });

    await waitFor(() => expect(getByText("Quay lại trang chat")).toBeTruthy());
    await fireEvent.press(getByText("Quay lại trang chat"));
    expect(mockRouter.current.replace).toHaveBeenCalledWith("/(tabs)/chat");
  });
});