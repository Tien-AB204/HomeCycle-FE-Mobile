import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  mockApiClient,
  mockApiError,
  mockApiResponse,
  mockRouter,
  renderScreen,
  resetScreenHarness,
} from "../helpers/screenHarness";
import AgreementFormScreen from "../../app/agreements/form";

const NEGOTIATION: any = {
  negotiationId: "neg-1",
  offerId: "of-1",
  negotiationStatus: "Open",
};

const OFFER: any = {
  offerId: "of-1",
  postId: "post-1",
  offerPrice: 1500000,
  offerQuantity: 2,
};

const POST: any = {
  postId: "post-1",
  product: { productName: "Máy giặt cũ 9kg", productId: "prod-1" },
  deliveryMethod: "SellerDelivers",
};

function mockFormSuccess() {
  mockApiClient.current.get.mockImplementation((url: string) => {
    if (url.startsWith("/negotiations/")) {
      return Promise.resolve(mockApiResponse({ ...NEGOTIATION }));
    }
    if (url.startsWith("/offers/")) {
      return Promise.resolve(mockApiResponse({ ...OFFER }));
    }
    if (url.startsWith("/posts/get-by-id/")) {
      return Promise.resolve(mockApiResponse({ ...POST }));
    }
    if (url.startsWith("/GHN/provinces/")) {
      return Promise.resolve(
        mockApiResponse({
          data: [{ districtId: 1, provinceId: 1, districtName: "Quận 1" }],
        }),
      );
    }
    if (url.startsWith("/GHN/districts/")) {
      return Promise.resolve(
        mockApiResponse({
          data: [{ wardCode: "1", districtId: 1, wardName: "Phường 1" }],
        }),
      );
    }
    if (url.startsWith("/GHN/provinces")) {
      return Promise.resolve(
        mockApiResponse({
          data: [{ provinceId: 1, provinceName: "TP. Hồ Chí Minh" }],
        }),
      );
    }
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
}

function mockLocationFetch() {
  (global as any).fetch = jest.fn((url: string) =>
    Promise.resolve({
      ok: true,
      json: async () =>
        String(url).includes("/wards")
          ? [{ ward_name: "Phường 1" }]
          : [{ name: "TP. Hồ Chí Minh", province_code: "79" }],
    }),
  );
}

async function fillAddressPicker(
  getByText: any,
  getByPlaceholderText: any,
  triggerPlaceholder: string,
  street: string,
) {
  await fireEvent.press(getByText(triggerPlaceholder));
  await fireEvent.changeText(
    getByPlaceholderText("Gõ hoặc chọn Tỉnh/Thành..."),
    "TP",
  );
  await fireEvent.press(getByText("TP. Hồ Chí Minh"));
  await waitFor(() => expect(getByText("Phường 1")).toBeTruthy());
  await fireEvent.press(getByText("Phường 1"));
  await fireEvent.changeText(
    getByPlaceholderText("VD: 123 Nguyễn Văn Linh"),
    street,
  );
  await fireEvent.press(getByText("Xác nhận địa chỉ"));
}

async function fillDeliveryForm(
  getByText: any,
  getByPlaceholderText: any,
) {
  await fireEvent.press(getByText("Không kiểm định (Giao hàng ngay)"));
  await fireEvent.press(getByText("Chọn ngày..."));
  await fireEvent.press(getByText("20"));
  await fillAddressPicker(
    getByText,
    getByPlaceholderText,
    "Nhập địa chỉ lấy hàng...",
    "123 Lê Lợi",
  );
  await fillAddressPicker(
    getByText,
    getByPlaceholderText,
    "Nhập địa chỉ nhận hàng...",
    "456 Trần Hưng Đạo",
  );
}

describe("AgreementFormScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
    mockLocationFetch();
  });

  test("renders title, summary and fields", async () => {
    mockFormSuccess();
    const { getByText } = await renderScreen(<AgreementFormScreen />, {
      params: { negotiationId: "neg-1" },
    });
    await waitFor(() =>
      expect(getByText("Máy giặt cũ 9kg")).toBeTruthy(),
    );
    expect(getByText("Thiết lập hợp đồng")).toBeTruthy();
    expect(getByText("Tóm tắt giao dịch")).toBeTruthy();
    expect(getByText("Giá chốt: 1.500.000 ₫")).toBeTruthy();
    expect(getByText("Số lượng: 2")).toBeTruthy();
    expect(getByText("Có kiểm định trước")).toBeTruthy();
    expect(getByText("Tạo hợp đồng")).toBeTruthy();
  });

  test("validates empty inspection form on submit", async () => {
    mockFormSuccess();
    const { getByText } = await renderScreen(<AgreementFormScreen />, {
      params: { negotiationId: "neg-1" },
    });
    await waitFor(() => expect(getByText("Tạo hợp đồng")).toBeTruthy());
    await fireEvent.press(getByText("Tạo hợp đồng"));
    expect(
      getByText("Vui lòng nhập thời gian và địa điểm kiểm định."),
    ).toBeTruthy();
    expect(mockApiClient.current.post).not.toHaveBeenCalled();
  });

  test("submits agreement with delivery method via API", async () => {
    mockFormSuccess();
    mockApiClient.current.post.mockResolvedValue(mockApiResponse({}));
    const { getByText, getByPlaceholderText } = await renderScreen(
      <AgreementFormScreen />,
      { params: { negotiationId: "neg-1" } },
    );
    await waitFor(() =>
      expect(getByText("Không kiểm định (Giao hàng ngay)")).toBeTruthy(),
    );
    await fillDeliveryForm(getByText, getByPlaceholderText);
    await fireEvent.press(getByText("Tạo hợp đồng"));
    await waitFor(() =>
      expect(mockApiClient.current.post).toHaveBeenCalledWith(
        "/agreements",
        expect.objectContaining({
          negotiationId: "neg-1",
          agreementType: "No_Inspection",
          agreementDetails: expect.objectContaining({
            deliveryMethod: "SellerDelivers",
          }),
        }),
      ),
    );
    await waitFor(() =>
      expect(
        getByText("Đã tạo hợp đồng và xác nhận phía người bán."),
      ).toBeTruthy(),
    );
    await waitFor(
      () =>
        expect(mockRouter.current.replace).toHaveBeenCalledWith(
          "/chat/neg-1",
        ),
      { timeout: 2500 },
    );
  });

  test("shows error message when submit fails", async () => {
    mockFormSuccess();
    mockApiClient.current.post.mockRejectedValue(
      mockApiError("", 400, { message: "Không thể tạo hợp đồng." }),
    );
    const { getByText, getByPlaceholderText } = await renderScreen(
      <AgreementFormScreen />,
      { params: { negotiationId: "neg-1" } },
    );
    await waitFor(() =>
      expect(getByText("Không kiểm định (Giao hàng ngay)")).toBeTruthy(),
    );
    await fillDeliveryForm(getByText, getByPlaceholderText);
    await fireEvent.press(getByText("Tạo hợp đồng"));
    await waitFor(() =>
      expect(getByText("Không thể tạo hợp đồng.")).toBeTruthy(),
    );
  });
});