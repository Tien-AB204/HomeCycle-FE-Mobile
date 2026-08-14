import {
  mockApiClient,
  renderScreen,
  resetScreenHarness,
} from "../helpers/screenHarness";
import BusinessRulesScreen from "../../app/business-rules";

describe("BusinessRulesScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
  });

  test("renders under-construction content", async () => {
    const { getByText } = await renderScreen(<BusinessRulesScreen />);
    expect(getByText("Quy định & Chính sách")).toBeTruthy();
    expect(getByText("Tính năng đang phát triển")).toBeTruthy();
    expect(
      getByText(
        /Nội dung về quy định, điều khoản và chính sách dành cho người dùng/,
      ),
    ).toBeTruthy();
  });

  test("makes no API calls", async () => {
    await renderScreen(<BusinessRulesScreen />);
    expect(mockApiClient.current.get).not.toHaveBeenCalled();
    expect(mockApiClient.current.post).not.toHaveBeenCalled();
    expect(mockApiClient.current.patch).not.toHaveBeenCalled();
  });
});