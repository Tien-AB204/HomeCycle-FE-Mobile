import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  mockApiClient,
  renderScreen,
  resetScreenHarness,
  setParams,
  mockApiResponse,
  mockApiError,
} from "../helpers/screenHarness";
import BusinessSetupScreen from "../../app/(auth)/business-setup";

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

const mockNetworkFetch = () => {
  const fetchMock = jest.fn((input: any) => {
    const url = String(input);

    if (url.includes("api.vietqr.io")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ code: "00", data: BANK_DATA }),
      });
    }

    if (url.includes("/api/provinces")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve([{ name: "TP. Hồ Chí Minh", province_code: "79" }]),
      });
    }

    if (url.includes("/api/wards")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ ward_name: "Phường 1" }]),
      });
    }

    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({}),
    });
  });

  global.fetch = fetchMock as any;
  return fetchMock;
};

describe("BusinessSetupScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
    mockNetworkFetch();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const selectAddress = async (screen: any, triggerText: string) => {
    await fireEvent.press(screen.getByText(triggerText));
    await fireEvent.changeText(
      screen.getByPlaceholderText("Gõ hoặc chọn Tỉnh/Thành..."),
      "TP. Hồ Chí Minh",
    );
    await waitFor(() =>
      expect(screen.getByText("TP. Hồ Chí Minh")).toBeTruthy(),
    );
    await fireEvent.press(screen.getByText("TP. Hồ Chí Minh"));
    await waitFor(() =>
      expect(screen.getByText("Phường 1")).toBeTruthy(),
    );
    await fireEvent.press(screen.getByText("Phường 1"));
    await fireEvent.changeText(
      screen.getByPlaceholderText("VD: 123 Nguyễn Văn Linh"),
      "123 Đường ABC",
    );
    await fireEvent.press(screen.getByText("Xác nhận địa chỉ"));
  };

  const selectBirthDate = async (screen: any) => {
    await fireEvent.press(screen.getByText("Chọn ngày sinh"));
    await waitFor(() =>
      expect(screen.getByText("Tháng 1/2000")).toBeTruthy(),
    );
    await fireEvent.press(screen.getByText("15"));
  };

  const fillRequiredForm = async (screen: any) => {
    await fireEvent.changeText(
      screen.getByPlaceholderText("Nhập tên đăng ký kinh doanh"),
      "Cửa Hàng ABC",
    );
    await fireEvent.changeText(
      screen.getByPlaceholderText("Nhập 10 hoặc 13 số"),
      "0123456789",
    );
    await selectAddress(
      screen,
      "Chọn địa chỉ trụ sở / cơ sở kinh doanh",
    );
    await fireEvent.changeText(
      screen.getByPlaceholderText("NHẬP ĐẦY ĐỦ HỌ VÀ TÊN"),
      "NGUYEN VAN A",
    );
    await fireEvent.changeText(
      screen.getByPlaceholderText("Nhập 12 chữ số CCCD"),
      "012345678901",
    );
    await selectBirthDate(screen);
    await selectAddress(screen, "Chọn địa chỉ thường trú");
  };

  const uploadRequiredImages = async (screen: any) => {
    await fireEvent.press(
      screen.getByText("Tải lên file giấy phép kinh doanh"),
    );
    await fireEvent.press(screen.getByText("Mặt trước"));
    await fireEvent.press(screen.getByText("Mặt sau"));
  };

  const goToStep2 = async (screen: any, modelText: string) => {
    await fireEvent.press(screen.getByText(modelText));
    await fireEvent.press(screen.getByText("TIẾP TỤC"));
    await waitFor(() =>
      expect(screen.getByText("THÔNG TIN ĐỊNH DANH")).toBeTruthy(),
    );
  };

  test("renders the model selection step", async () => {
    const { getByText } = await renderScreen(<BusinessSetupScreen />);
    expect(getByText("Chọn mô hình kinh doanh")).toBeTruthy();
    expect(getByText("Hộ kinh doanh")).toBeTruthy();
    expect(getByText("Doanh nghiệp")).toBeTruthy();
    expect(getByText("TIẾP TỤC")).toBeTruthy();
  });

  test("shows validation error when submitting an empty form", async () => {
    const { getByText } = await renderScreen(<BusinessSetupScreen />);
    await goToStep2({ getByText } as any, "Hộ kinh doanh");
    await fireEvent.press(getByText("GỬI YÊU CẦU"));
    expect(
      getByText("Vui lòng điền đầy đủ các thông tin bắt buộc."),
    ).toBeTruthy();
    expect(mockApiClient.current.post).not.toHaveBeenCalled();
  });

  test("shows CCCD format error for a short identity number", async () => {
    const { getByText, getByPlaceholderText } = await renderScreen(
      <BusinessSetupScreen />,
    );
    const screen = { getByText, getByPlaceholderText };
    await goToStep2(screen as any, "Hộ kinh doanh");
    await fireEvent.changeText(
      getByPlaceholderText("Nhập tên đăng ký kinh doanh"),
      "Cửa Hàng ABC",
    );
    await fireEvent.changeText(
      getByPlaceholderText("Nhập 10 hoặc 13 số"),
      "0123456789",
    );
    await selectAddress(
      screen as any,
      "Chọn địa chỉ trụ sở / cơ sở kinh doanh",
    );
    await fireEvent.changeText(
      getByPlaceholderText("NHẬP ĐẦY ĐỦ HỌ VÀ TÊN"),
      "NGUYEN VAN A",
    );
    await fireEvent.changeText(
      getByPlaceholderText("Nhập 12 chữ số CCCD"),
      "123",
    );
    await selectAddress(screen as any, "Chọn địa chỉ thường trú");
    await fireEvent.press(getByText("GỬI YÊU CẦU"));
    expect(
      getByText("Số CCCD phải gồm đúng 12 chữ số."),
    ).toBeTruthy();
    expect(mockApiClient.current.post).not.toHaveBeenCalled();
  });

  test("submits a household profile and shows the success step", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue("test-token");
    mockApiClient.current.post.mockResolvedValue(
      mockApiResponse({ data: { message: "OK" } }),
    );
    const { getByText, getByPlaceholderText } = await renderScreen(
      <BusinessSetupScreen />,
    );
    const screen = { getByText, getByPlaceholderText };
    await goToStep2(screen as any, "Hộ kinh doanh");
    await fillRequiredForm(screen as any);
    await uploadRequiredImages(screen as any);
    await fireEvent.press(getByText("GỬI YÊU CẦU"));
    await waitFor(() =>
      expect(mockApiClient.current.post).toHaveBeenCalledWith(
        "/business-profiles/submit",
        expect.any(FormData),
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect(getByText("Nộp hồ sơ thành công!")).toBeTruthy(),
    );
    expect(getByText("Về trang Profile")).toBeTruthy();
  });

  test("submits an enterprise profile with warehouse address", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue("test-token");
    mockApiClient.current.post.mockResolvedValue(
      mockApiResponse({ data: { message: "OK" } }),
    );
    const { getByText, getByPlaceholderText } = await renderScreen(
      <BusinessSetupScreen />,
    );
    const screen = { getByText, getByPlaceholderText };
    await goToStep2(screen as any, "Doanh nghiệp");
    expect(getByText("Tên doanh nghiệp đầy đủ")).toBeTruthy();
    expect(getByText("Địa chỉ kho bãi (Tùy chọn)")).toBeTruthy();
    expect(getByText("Giấy ủy quyền + CCCD người được ủy quyền (Tùy chọn)")).toBeTruthy();
    await fillRequiredForm(screen as any);
    await uploadRequiredImages(screen as any);
    await fireEvent.press(getByText("GỬI YÊU CẦU"));
    await waitFor(() =>
      expect(mockApiClient.current.post).toHaveBeenCalledWith(
        "/business-profiles/submit",
        expect.any(FormData),
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect(getByText("Nộp hồ sơ thành công!")).toBeTruthy(),
    );
  });

  test("shows server error when submit fails", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue("test-token");
    mockApiClient.current.post.mockRejectedValue(
      mockApiError("Lỗi máy chủ", 500),
    );
    const { getByText, getByPlaceholderText } = await renderScreen(
      <BusinessSetupScreen />,
    );
    const screen = { getByText, getByPlaceholderText };
    await goToStep2(screen as any, "Hộ kinh doanh");
    await fillRequiredForm(screen as any);
    await uploadRequiredImages(screen as any);
    await fireEvent.press(getByText("GỬI YÊU CẦU"));
    await waitFor(() =>
      expect(
        getByText("Lỗi máy chủ. Vui lòng thử lại sau."),
      ).toBeTruthy(),
    );
  });

  test("loads rejected profile data and shows the resubmit button", async () => {
    mockApiClient.current.get.mockResolvedValue(
      mockApiResponse({
        data: {
          data: {
            rejectReason: "Thiếu giấy phép kinh doanh.",
            businessModel: "Household",
            fullName: "NGUYEN VAN A",
          },
        },
      }),
    );
    const { getByText, getByTestId } = await renderScreen(
      <BusinessSetupScreen />,
      { params: { isRejected: "true" } },
    );
    await waitFor(() =>
      expect(getByTestId("icon-checkmark")).toBeTruthy(),
    );
    await fireEvent.press(getByText("TIẾP TỤC"));
    await waitFor(() =>
      expect(getByText("NỘP LẠI HỒ SƠ")).toBeTruthy(),
    );
    expect(getByText("Yêu cầu chỉnh sửa:")).toBeTruthy();
    expect(getByText("Thiếu giấy phép kinh doanh.")).toBeTruthy();
    expect(mockApiClient.current.get).toHaveBeenCalledWith(
      "/business-profiles/registration-detail",
    );
  });
});