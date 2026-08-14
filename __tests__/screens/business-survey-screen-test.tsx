import { fireEvent } from "@testing-library/react-native";
import {
  mockRouter,
  renderScreen,
  resetScreenHarness,
} from "../helpers/screenHarness";
import BusinessSurveyScreen from "../../app/profile/business-survey";

describe("BusinessSurveyScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
    (global as any).alert = jest.fn();
  });

  test("renders survey questions and selection chips", async () => {
    const { getByText, getByPlaceholderText } = await renderScreen(
      <BusinessSurveyScreen />,
    );

    expect(getByText("Thiết lập nhận thông báo")).toBeTruthy();
    expect(getByText("1. Loại sản phẩm quan tâm")).toBeTruthy();
    expect(getByText("2. Tỉnh / thành quan tâm")).toBeTruthy();
    expect(getByText("3. Quy mô thu mua")).toBeTruthy();
    expect(getByText("4. Tình trạng sản phẩm chấp nhận")).toBeTruthy();
    expect(getByText("Máy giặt")).toBeTruthy();
    expect(getByText("Tủ lạnh")).toBeTruthy();
    expect(getByText("Điều hoà")).toBeTruthy();
    expect(getByText("TP. Hồ Chí Minh")).toBeTruthy();
    expect(getByText("Bình Dương")).toBeTruthy();
    expect(getByText("Số lượng lớn")).toBeTruthy();
    expect(getByPlaceholderText("Tìm loại sản phẩm...")).toBeTruthy();
  });

  test("submits survey with alert and navigates back", async () => {
    const { getByText } = await renderScreen(<BusinessSurveyScreen />);

    await fireEvent.press(getByText("Lưu thiết lập"));

    expect((global as any).alert).toHaveBeenCalledWith(
      "Thiết lập thành công! Hệ thống sẽ gợi ý bài đăng dựa trên tiêu chí này.",
    );
    expect(mockRouter.current.back).toHaveBeenCalled();
  });

  test("skip button navigates back without alert", async () => {
    const { getByText } = await renderScreen(<BusinessSurveyScreen />);

    await fireEvent.press(getByText("Bỏ qua"));

    expect(mockRouter.current.back).toHaveBeenCalled();
    expect((global as any).alert).not.toHaveBeenCalled();
  });

  test("toggling a product chip keeps it rendered", async () => {
    const { getByText } = await renderScreen(<BusinessSurveyScreen />);

    await fireEvent.press(getByText("Điều hoà"));
    expect(getByText("Điều hoà")).toBeTruthy();
  });
});