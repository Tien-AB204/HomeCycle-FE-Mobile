import { fireEvent } from "@testing-library/react-native";
import {
  mockRouter,
  renderScreen,
  resetScreenHarness,
} from "../helpers/screenHarness";
import BusinessUpgradeScreen from "../../app/profile/business-upgrade";

describe("BusinessUpgradeScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
    (global as any).alert = jest.fn();
  });

  test("renders upgrade form with model tabs and sections", async () => {
    const { getByText, getByPlaceholderText } = await renderScreen(
      <BusinessUpgradeScreen />,
    );

    expect(getByText("Nâng cấp Doanh nghiệp")).toBeTruthy();
    expect(getByText("Hộ kinh doanh")).toBeTruthy();
    expect(getByText("Công ty / DN")).toBeTruthy();
    expect(getByText("THÔNG TIN ĐỊNH DANH TỔ CHỨC")).toBeTruthy();
    expect(getByText("THÔNG TIN NGƯỜI ĐẠI DIỆN PHÁP LUẬT")).toBeTruthy();
    expect(getByText("THÔNG TIN THANH TOÁN (RÚT TIỀN)")).toBeTruthy();
    expect(getByText("GỬI YÊU CẦU DUYỆT")).toBeTruthy();
    expect(getByPlaceholderText("VD: Công Ty TNHH ABC...")).toBeTruthy();
  });

  test("submitting upgrade shows alert and navigates back", async () => {
    const { getByText } = await renderScreen(<BusinessUpgradeScreen />);

    await fireEvent.press(getByText("GỬI YÊU CẦU DUYỆT"));

    expect((global as any).alert).toHaveBeenCalledWith(
      "Yêu cầu nâng cấp của bạn đã được gửi. Vui lòng chờ Moderator phê duyệt!",
    );
    expect(mockRouter.current.back).toHaveBeenCalled();
  });

  test("switching to company model reveals role field", async () => {
    const { getByText, queryByText } = await renderScreen(
      <BusinessUpgradeScreen />,
    );

    expect(queryByText("Chức vụ")).toBeNull();
    await fireEvent.press(getByText("Công ty / DN"));

    expect(getByText("Chức vụ")).toBeTruthy();
    expect(getByText("Tên doanh nghiệp đầy đủ")).toBeTruthy();
  });
});