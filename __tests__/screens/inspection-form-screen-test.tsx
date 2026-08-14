import { fireEvent } from "@testing-library/react-native";
import {
  mockRouter,
  renderScreen,
  resetScreenHarness,
} from "../helpers/screenHarness";
import InspectionFormScreen from "../../app/inspection-form";

describe("InspectionFormScreen", () => {
  const originalAlert = (globalThis as any).alert;

  beforeAll(() => {
    (globalThis as any).alert = jest.fn();
  });

  afterAll(() => {
    (globalThis as any).alert = originalAlert;
  });

  beforeEach(() => {
    resetScreenHarness();
    (globalThis as any).alert = jest.fn();
  });

  test("renders order info and form sections", async () => {
    const { getByText, getByPlaceholderText } = await renderScreen(
      <InspectionFormScreen />,
    );
    expect(getByText("Biểu mẫu Kiểm định")).toBeTruthy();
    expect(getByText("Mã đơn hàng:")).toBeTruthy();
    expect(getByText("ORD-882910")).toBeTruthy();
    expect(getByText("Tủ lạnh Samsung Inverter 236L")).toBeTruthy();
    expect(getByText("3.500.000 đ")).toBeTruthy();
    expect(getByText("1. TÌNH TRẠNG THỰC TẾ")).toBeTruthy();
    expect(getByText(/Tình trạng hoạt động/)).toBeTruthy();
    expect(getByText("Hoạt động tốt")).toBeTruthy();
    expect(getByText("2. GHI CHÚ & HÌNH ẢNH")).toBeTruthy();
    expect(
      getByPlaceholderText("Mô tả chi tiết lỗi hoặc tình trạng thực tế..."),
    ).toBeTruthy();
    expect(getByText("3. KẾT LUẬN GIAO DỊCH")).toBeTruthy();
    expect(getByText("Đạt yêu cầu")).toBeTruthy();
    expect(getByText("GỬI KẾT QUẢ KIỂM ĐỊNH")).toBeTruthy();
  });

  test("submits form and navigates back", async () => {
    const { getByText } = await renderScreen(<InspectionFormScreen />);
    await fireEvent.press(getByText("Hoạt động tốt"));
    await fireEvent.press(getByText("Đạt yêu cầu"));
    await fireEvent.press(getByText("GỬI KẾT QUẢ KIỂM ĐỊNH"));
    expect((globalThis as any).alert).toHaveBeenCalledWith(
      "Đã gửi biểu mẫu kiểm định thành công cho người bán!",
    );
    expect(mockRouter.current.back).toHaveBeenCalled();
  });

  test("reveals price proposal input when price adjustment selected", async () => {
    const { getByText, getByPlaceholderText, queryByPlaceholderText } =
      await renderScreen(<InspectionFormScreen />);
    expect(
      queryByPlaceholderText("Nhập mức giá bạn muốn đề xuất..."),
    ).toBeNull();
    await fireEvent.press(getByText("Cần điều chỉnh giá"));
    expect(
      getByPlaceholderText("Nhập mức giá bạn muốn đề xuất..."),
    ).toBeTruthy();
  });
});