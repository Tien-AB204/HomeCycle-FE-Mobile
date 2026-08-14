import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  mockApiClient,
  mockAuth,
  renderScreen,
  resetScreenHarness,
  setParams,
  mockApiResponse,
  mockApiError,
} from "../helpers/screenHarness";
import VerificationSetupScreen from "../../app/(auth)/verification-setup";

const BANK_DATA = [
  {
    id: 1,
    name: "Ngân hàng TMCP Ngoại thương Việt Nam",
    code: "VCB",
    bin: "970436",
    shortName: "Vietcombank",
    logo: "https://api.vietqr.io/img/VCB.0.png",
  },
];

const originalFetch = global.fetch;

const mockBanksFetch = () => {
  const fetchMock = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ code: "00", data: BANK_DATA }),
    }),
  );
  global.fetch = fetchMock as any;
  return fetchMock;
};

describe("VerificationSetupScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
    mockBanksFetch();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const defaultParams = {
    email: "tester@example.com",
    registrationToken: "tok-123",
    password: "secret123",
    fullName: "Nguyễn Văn A",
    username: "nguyenvana",
    phoneNumber: "0901234567",
    avatarUri: "file:///tmp/mock-image.jpg",
  };

  test("renders the verification form", async () => {
    const { getByText, getByPlaceholderText } = await renderScreen(
      <VerificationSetupScreen />,
      { params: defaultParams },
    );
    expect(getByText("Xác minh & Thanh toán")).toBeTruthy();
    expect(getByPlaceholderText("Nhập số CCCD (12 số)...")).toBeTruthy();
    expect(getAllByPlaceholderText("VD: NGUYEN VAN A")).toHaveLength(2);
    expect(getByText("Chọn ngân hàng của bạn...")).toBeTruthy();
    expect(getByText("HOÀN THÀNH")).toBeTruthy();
    expect(getByText("Bỏ qua & Đăng ký ngay")).toBeTruthy();
  });

  test("opens the bank modal and selects a bank", async () => {
    const { getByText } = await renderScreen(
      <VerificationSetupScreen />,
      { params: defaultParams },
    );
    await fireEvent.press(getByText("Chọn ngân hàng của bạn..."));
    expect(getByText("Chọn Ngân Hàng")).toBeTruthy();
    await fireEvent.press(getByText(/Vietcombank/));
    await waitFor(() =>
      expect(getByText("Vietcombank (VCB)")).toBeTruthy(),
    );
  });

  test("skips verification and registers with avatar", async () => {
    mockApiClient.current.post.mockResolvedValue(
      mockApiResponse({ data: { message: "Đăng ký thành công" } }),
    );
    const { getByText } = await renderScreen(
      <VerificationSetupScreen />,
      { params: defaultParams },
    );
    await fireEvent.press(getByText("Bỏ qua & Đăng ký ngay"));
    await waitFor(() =>
      expect(mockApiClient.current.post).toHaveBeenCalledWith(
        "/auth/personal/register",
        expect.any(FormData),
        expect.anything(),
      ),
    );
    await waitFor(
      () =>
        expect(mockAuth.current.login).toHaveBeenCalledWith(
          "tester@example.com",
          "secret123",
        ),
      { timeout: 3000 },
    );
  });

  test("registers with full verification data", async () => {
    mockApiClient.current.post.mockResolvedValue(
      mockApiResponse({ data: { message: "Đăng ký thành công" } }),
    );
    const { getByText, getByPlaceholderText, getAllByPlaceholderText } =
      await renderScreen(<VerificationSetupScreen />, {
        params: defaultParams,
      });
    await fireEvent.changeText(
      getByPlaceholderText("Nhập số CCCD (12 số)..."),
      "012345678901",
    );
    await fireEvent.changeText(
      getAllByPlaceholderText("VD: NGUYEN VAN A")[0],
      "NGUYEN VAN A",
    );
    await fireEvent.changeText(
      getByPlaceholderText("VD: 2000-01-25"),
      "2000-01-25",
    );
    await fireEvent.changeText(
      getByPlaceholderText("Nhập địa chỉ theo CCCD..."),
      "123 Đường ABC",
    );
    await fireEvent.press(getByText("Mặt trước"));
    await fireEvent.press(getByText("Mặt sau"));
    await fireEvent.press(getByText("Chọn ngân hàng của bạn..."));
    await fireEvent.press(getByText(/Vietcombank/));
    await waitFor(() =>
      expect(getByText("Vietcombank (VCB)")).toBeTruthy(),
    );
    await fireEvent.changeText(
      getByPlaceholderText("Nhập số tài khoản..."),
      "0123456789",
    );
    await fireEvent.changeText(
      getAllByPlaceholderText("VD: NGUYEN VAN A")[1],
      "NGUYEN VAN A",
    );
    await fireEvent.press(getByText("HOÀN THÀNH"));
    await waitFor(() =>
      expect(mockApiClient.current.post).toHaveBeenCalledWith(
        "/auth/personal/register",
        expect.any(FormData),
        expect.anything(),
      ),
    );
  });

  test("shows error when registration fails", async () => {
    mockApiClient.current.post.mockRejectedValue(
      mockApiError("Email đã tồn tại", 400, { message: "Email đã tồn tại." }),
    );
    const { getByText } = await renderScreen(
      <VerificationSetupScreen />,
      { params: defaultParams },
    );
    await fireEvent.press(getByText("Bỏ qua & Đăng ký ngay"));
    await waitFor(() =>
      expect(getByText("Email đã tồn tại.")).toBeTruthy(),
    );
    expect(mockAuth.current.login).not.toHaveBeenCalled();
  });

  test("shows error when bank list cannot be loaded", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("network down")) as any;
    const { getByText } = await renderScreen(
      <VerificationSetupScreen />,
      { params: defaultParams },
    );
    await waitFor(() =>
      expect(getByText("network down")).toBeTruthy(),
    );
  });
});