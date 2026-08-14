import {
  mockApiClient,
  renderScreen,
  resetScreenHarness,
} from "../helpers/screenHarness";
import PolicyScreen from "../../app/policy";

describe("PolicyScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
  });

  test("renders main title and all section titles", async () => {
    const { getByText } = await renderScreen(<PolicyScreen />);
    expect(getByText("Quy định & Chính sách Nền tảng HomeCycle")).toBeTruthy();
    expect(
      getByText("1. Quy định về Tài khoản và Xác thực danh tính"),
    ).toBeTruthy();
    expect(getByText("2. Quy định Đăng tin và Hàng hóa")).toBeTruthy();
    expect(
      getByText("3. Quy định Thương lượng và Lịch hẹn"),
    ).toBeTruthy();
    expect(
      getByText("4. Chính sách Vận chuyển (Giao Hàng Nhanh - GHN)"),
    ).toBeTruthy();
    expect(
      getByText("5. Chính sách Thanh toán và Rút tiền"),
    ).toBeTruthy();
    expect(
      getByText("6. Hệ thống Điểm uy tín và Đánh giá"),
    ).toBeTruthy();
    expect(
      getByText("7. Chính sách Khiếu nại và Tranh chấp"),
    ).toBeTruthy();
    expect(
      getByText("Cập nhật lần cuối: Tháng 08/2026"),
    ).toBeTruthy();
  });

  test("renders a policy detail bullet", async () => {
    const { getByText } = await renderScreen(<PolicyScreen />);
    expect(getByText(/Tối thiểu 100.000 VNĐ\/lần/)).toBeTruthy();
    expect(getByText(/Mỗi tài khoản khởi đầu với 100 Điểm uy tín/)).toBeTruthy();
  });

  test("makes no API calls", async () => {
    await renderScreen(<PolicyScreen />);
    expect(mockApiClient.current.get).not.toHaveBeenCalled();
    expect(mockApiClient.current.post).not.toHaveBeenCalled();
  });
});