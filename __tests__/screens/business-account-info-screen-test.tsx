import { waitFor } from "@testing-library/react-native";
import {
  mockApiClient,
  mockApiError,
  mockApiResponse,
  renderScreen,
  resetScreenHarness,
} from "../helpers/screenHarness";
import BusinessAccountInfoScreen from "../../app/profile/business-account-info";

const businessProfile = {
  businessName: "Công ty TNHH ABC",
  taxCode: "0312345678",
  businessAddress: "123 Lê Lợi, Q1, TP.HCM",
  fullName: "Nguyễn Văn A",
  identityNumber: "079123456789",
  bankAccount: {
    bankName: "Vietcombank",
    accountNumber: "007123456789",
    accountName: "CONG TY TNHH ABC",
  },
};

describe("BusinessAccountInfoScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
  });

  test("renders business profile from mocked GET", async () => {
    mockApiClient.current.get.mockResolvedValue(
      mockApiResponse({ data: businessProfile }),
    );

    const { getByText, getAllByText } = await renderScreen(
      <BusinessAccountInfoScreen />,
    );

    await waitFor(() =>
      expect(getByText("Hồ sơ Doanh nghiệp")).toBeTruthy(),
    );
    expect(getAllByText("Công ty TNHH ABC").length).toBeGreaterThan(0);
    expect(getByText("Hồ sơ đã được xác thực pháp lý")).toBeTruthy();
    expect(getByText("***5678")).toBeTruthy();
    expect(getByText("123 Lê Lợi, Q1, TP.HCM")).toBeTruthy();
    expect(getByText("Nguyễn Văn A")).toBeTruthy();
    expect(getAllByText("***6789").length).toBeGreaterThan(0);
    expect(getByText("Vietcombank")).toBeTruthy();
    expect(getByText("CONG TY TNHH ABC")).toBeTruthy();
    expect(getByText("Xem lại bản Khảo sát thu mua")).toBeTruthy();
    expect(mockApiClient.current.get).toHaveBeenCalledWith(
      "/business-profiles",
    );
  });

  test("shows error text when profile fetch fails", async () => {
    mockApiClient.current.get.mockRejectedValue(
      mockApiError("Lỗi máy chủ", 500),
    );

    const { getByText } = await renderScreen(<BusinessAccountInfoScreen />);

    await waitFor(() => expect(getByText("Không thể tải hồ sơ.")).toBeTruthy());
  });
});