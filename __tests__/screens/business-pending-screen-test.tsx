import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  mockApiClient,
  mockApiError,
  mockApiResponse,
  mockRouter,
  renderScreen,
  resetScreenHarness,
} from "../helpers/screenHarness";
import BusinessPendingScreen from "../../app/profile/business-pending";

const pendingData = {
  businessModel: "Enterprise",
  businessName: "Công ty TNHH ABC",
  taxCode: "0312345678",
  businessAddress: "123 Lê Lợi, Q1, TP.HCM",
  serviceAreas: [{ street: "45 Nguyễn Huệ", ward: "Bến Nghé", city: "Q1" }],
  operatingScope: "Toàn quốc",
  fullName: "Nguyễn Văn A",
  identityNumber: "079123456789",
  identityDob: "1990-01-01",
  identityAddress: "TP. HCM",
  bankName: "Vietcombank",
  accountNumber: "007123456789",
  accountName: "CONG TY TNHH ABC",
  documents: [
    {
      businessDocumentId: "doc-1",
      documentType: 0,
      documentUrl: "https://example.com/doc1.jpg",
    },
    {
      businessDocumentId: "doc-2",
      documentType: 2,
      documentUrl: "https://example.com/doc2.jpg",
    },
  ],
};

describe("BusinessPendingScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
  });

  test("renders pending status info from mocked data", async () => {
    mockApiClient.current.get.mockResolvedValue(
      mockApiResponse({ data: pendingData }),
    );

    const { getByText } = await renderScreen(<BusinessPendingScreen />);

    await waitFor(() =>
      expect(getByText("Hồ sơ Đang chờ duyệt")).toBeTruthy(),
    );
    expect(getByText("Đang chờ Moderator xét duyệt")).toBeTruthy();
    expect(getByText("Xem chi tiết hồ sơ đã nộp")).toBeTruthy();
    expect(getByText("Về trang Profile")).toBeTruthy();
    expect(mockApiClient.current.get).toHaveBeenCalledWith(
      "/business-profiles/registration-detail",
    );
  });

  test("opens detail modal with submitted profile info", async () => {
    mockApiClient.current.get.mockResolvedValue(
      mockApiResponse({ data: pendingData }),
    );

    const { getByText } = await renderScreen(<BusinessPendingScreen />);

    await waitFor(() =>
      expect(getByText("Xem chi tiết hồ sơ đã nộp")).toBeTruthy(),
    );
    await fireEvent.press(getByText("Xem chi tiết hồ sơ đã nộp"));

    expect(getByText("Chi tiết hồ sơ")).toBeTruthy();
    expect(getByText("Doanh nghiệp")).toBeTruthy();
    expect(getByText("Công ty TNHH ABC")).toBeTruthy();
    expect(getByText("0312345678")).toBeTruthy();
    expect(getByText("45 Nguyễn Huệ, Bến Nghé, Q1")).toBeTruthy();
    expect(getByText("Toàn quốc")).toBeTruthy();
    expect(getByText("Nguyễn Văn A")).toBeTruthy();
    expect(getByText("Vietcombank")).toBeTruthy();
    expect(getByText("CCCD (Mặt trước)")).toBeTruthy();
    expect(getByText("Giấy phép kinh doanh")).toBeTruthy();
  });

  test("navigates back to profile tab", async () => {
    mockApiClient.current.get.mockResolvedValue(
      mockApiResponse({ data: pendingData }),
    );

    const { getByText } = await renderScreen(<BusinessPendingScreen />);

    await waitFor(() => expect(getByText("Về trang Profile")).toBeTruthy());
    await fireEvent.press(getByText("Về trang Profile"));
    expect(mockRouter.current.replace).toHaveBeenCalledWith("/(tabs)/profile");
  });

  test("still renders banner without detail button on error", async () => {
    mockApiClient.current.get.mockRejectedValue(
      mockApiError("Lỗi máy chủ", 500),
    );

    const { getByText, queryByText } = await renderScreen(
      <BusinessPendingScreen />,
    );

    await waitFor(() =>
      expect(getByText("Đang chờ Moderator xét duyệt")).toBeTruthy(),
    );
    expect(getByText("Về trang Profile")).toBeTruthy();
    expect(queryByText("Xem chi tiết hồ sơ đã nộp")).toBeNull();
  });
});