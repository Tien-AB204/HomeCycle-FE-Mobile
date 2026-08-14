import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  mockApiClient,
  mockApiError,
  mockApiResponse,
  renderScreen,
  resetScreenHarness,
} from "../helpers/screenHarness";
import AgreementPreviewScreen from "../../app/agreements/preview";

const AGREEMENT: any = {
  agreementId: "ag-1",
  agreementStatus: "Pending",
  agreementType: "Inspection",
  paymentType: "Deposit",
  quantity: 2,
  initialPrice: 1500000,
  finalPrice: 1400000,
  buyerId: "user-1",
  sellerId: "seller-1",
  updatedAt: "2026-01-01T00:00:00Z",
  createdAt: "2026-01-01T00:00:00Z",
  agreementDetails: {
    revision: 1,
    deliveryMethod: "SellerDelivers",
    notes: "Giao hàng trong giờ hành chính",
    inspectionDate: "2026-01-05T00:00:00Z",
    inspectionAddress: "123 Lê Lợi",
  },
};

const PREVIEW: any = { canConfirm: true, canEdit: true, canPay: false };

function mockPreviewSuccess() {
  mockApiClient.current.get.mockImplementation((url: string) => {
    if (url.startsWith("/agreements/preview/")) {
      return Promise.resolve(mockApiResponse({ ...PREVIEW }));
    }
    if (url.startsWith("/agreements/")) {
      return Promise.resolve(mockApiResponse({ ...AGREEMENT }));
    }
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
}

describe("AgreementPreviewScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
  });

  test("renders agreement terms from mocked data", async () => {
    mockPreviewSuccess();
    const { getByText } = await renderScreen(<AgreementPreviewScreen />, {
      params: { agreementId: "ag-1", negotiationId: "neg-1" },
    });
    await waitFor(() =>
      expect(getByText("Hợp đồng giao dịch")).toBeTruthy(),
    );
    expect(getByText("Chi tiết hợp đồng")).toBeTruthy();
    expect(getByText("ag-1")).toBeTruthy();
    expect(getByText("Chờ hai bên xác nhận")).toBeTruthy();
    expect(getByText("Có kiểm định trước")).toBeTruthy();
    expect(getByText("1.400.000 đ")).toBeTruthy();
    expect(getByText("Bên bán tự giao")).toBeTruthy();
    expect(getByText("Giao hàng trong giờ hành chính")).toBeTruthy();
    expect(getByText("Xác nhận hợp đồng")).toBeTruthy();
  });

  test("accepts agreement via PATCH API", async () => {
    mockPreviewSuccess();
    mockApiClient.current.patch.mockResolvedValue(mockApiResponse({}));
    const { getByText } = await renderScreen(<AgreementPreviewScreen />, {
      params: { agreementId: "ag-1", negotiationId: "neg-1" },
    });
    await waitFor(() =>
      expect(getByText("Xác nhận hợp đồng")).toBeTruthy(),
    );
    await fireEvent.press(getByText("Xác nhận hợp đồng"));
    await waitFor(() =>
      expect(mockApiClient.current.patch).toHaveBeenCalledWith(
        "/agreements/ag-1/accept",
      ),
    );
    await waitFor(() =>
      expect(
        getByText(
          "✅ Bạn đã xác nhận hợp đồng. Đang chờ phía còn lại xác nhận.",
        ),
      ).toBeTruthy(),
    );
  });

  test("shows error state when agreement fails to load", async () => {
    mockApiClient.current.get.mockRejectedValue(
      mockApiError("Không thể tải chi tiết hợp đồng.", 404),
    );
    const { getByText } = await renderScreen(<AgreementPreviewScreen />, {
      params: { agreementId: "ag-1", negotiationId: "neg-1" },
    });
    await waitFor(() =>
      expect(getByText("Chưa tải được hợp đồng")).toBeTruthy(),
    );
    expect(
      getByText("Không thể tải chi tiết hợp đồng."),
    ).toBeTruthy();
    expect(getByText("Thử lại")).toBeTruthy();
  });
});