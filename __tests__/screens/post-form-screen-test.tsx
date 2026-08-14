import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  mockApiClient,
  mockApiResponse,
  mockRouter,
  renderScreen,
  resetScreenHarness,
} from "../helpers/screenHarness";
import PostFormScreen from "../../app/posts/post-form";

const PROVINCES = [{ name: "TP. Hồ Chí Minh", province_code: "79" }];

const EDIT_POST_DATA: any = {
  postId: "post-1",
  productName: "Máy giặt cũ 9kg",
  description: "Mô tả cũ",
  basePrice: 2000000,
  quantity: 1,
  city: "TP. Hồ Chí Minh",
  ward: "Quận 1",
  streetAddress: "123 Lê Lợi",
  deliveryMethod: "GhnDelivery",
  priorityLevel: "Medium",
  medias: [{ mediaId: "m1", url: "https://example.com/img1.jpg" }],
  product: {
    categoryId: "cat-1",
    productId: "prod-1",
    brandId: "brand-1",
    modelNumber: "WM-1",
    detailDescription: "Chi tiết",
    weight: 9,
    usageDuration: 2,
    spaceUsage: "Kitchen",
    functionalityStatus: "FullyFunctional",
    damageLevel: "None",
    originalPrice: 3000000,
    length: 60,
    width: 60,
    height: 85,
    attributeValues: [],
  },
};

function mockMasterData() {
  mockApiClient.current.get.mockImplementation((url: string) => {
    if (url.startsWith("/categories/active")) {
      return Promise.resolve(
        mockApiResponse({
          items: [{ categoryId: "cat-1", categoryName: "Điện máy" }],
        }),
      );
    }
    if (url.startsWith("/product-types/get-all")) {
      return Promise.resolve(mockApiResponse({ data: { items: [] } }));
    }
    if (url.startsWith("/brands")) {
      return Promise.resolve(mockApiResponse({ data: { items: [] } }));
    }
    if (url.startsWith("/posts/get-by-id/")) {
      return Promise.resolve(mockApiResponse({ ...EDIT_POST_DATA }));
    }
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
}

function mockLocationFetch() {
  (global as any).fetch = jest.fn((url: string) =>
    Promise.resolve({
      ok: true,
      json: async () =>
        String(url).includes("/wards") ? [] : PROVINCES,
    }),
  );
}

describe("PostFormScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
    (global as any).alert = jest.fn();
    mockLocationFetch();
  });

  test("renders the create post form", async () => {
    mockMasterData();
    const { getByText, getByPlaceholderText } = await renderScreen(
      <PostFormScreen />,
    );
    expect(getByText("Đăng tin mới")).toBeTruthy();
    expect(getByText("Đăng")).toBeTruthy();
    expect(getByText("Thêm ảnh")).toBeTruthy();
    expect(getByPlaceholderText("Nhập tiêu đề sản phẩm...")).toBeTruthy();
    expect(getByText("THÔNG TIN CƠ BẢN")).toBeTruthy();
  });

  test("shows required-field alert on empty submit", async () => {
    mockMasterData();
    const { getByText } = await renderScreen(<PostFormScreen />);
    await fireEvent.press(getByText("Đăng"));
    expect((global as any).alert).toHaveBeenCalledWith(
      "Vui lòng điền đủ thông tin!",
    );
    expect(mockApiClient.current.post).not.toHaveBeenCalled();
  });

  test("creates sell post via API and navigates back", async () => {
    mockMasterData();
    mockApiClient.current.post.mockResolvedValue(mockApiResponse({}));
    const { getByText, getByPlaceholderText, getAllByPlaceholderText } =
      await renderScreen(<PostFormScreen />);
    await fireEvent.press(getByText("Thêm ảnh"));
    await fireEvent.changeText(
      getByPlaceholderText("Nhập tiêu đề sản phẩm..."),
      "Máy giặt cũ 9kg",
    );
    await fireEvent.changeText(
      getAllByPlaceholderText("VNĐ")[0],
      "2500000",
    );
    await fireEvent.press(getByText("Đăng"));
    await waitFor(() =>
      expect(mockApiClient.current.post).toHaveBeenCalledWith(
        "/posts/create/sell",
        expect.any(FormData),
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect((global as any).alert).toHaveBeenCalledWith("Thành công!"),
    );
    expect(mockRouter.current.back).toHaveBeenCalled();
  });

  test("loads existing post in edit mode and updates via PATCH", async () => {
    mockMasterData();
    mockApiClient.current.patch.mockResolvedValue(mockApiResponse({}));
    const { getByText, getByDisplayValue, getByPlaceholderText } =
      await renderScreen(<PostFormScreen />, {
        params: { editId: "post-1" },
      });
    await waitFor(() => expect(getByText("Sửa tin đăng")).toBeTruthy());
    await waitFor(() =>
      expect(getByDisplayValue("Máy giặt cũ 9kg")).toBeTruthy(),
    );
    expect(getByDisplayValue("2000000")).toBeTruthy();
    await fireEvent.changeText(
      getByPlaceholderText("VD: Cần pass gấp tủ lạnh vì chuyển trọ..."),
      "Mô tả mới",
    );
    await fireEvent.press(getByText("Cập nhật"));
    await waitFor(() =>
      expect(mockApiClient.current.patch).toHaveBeenCalledWith(
        "/posts/update/sell/post-1",
        expect.any(FormData),
        expect.anything(),
      ),
    );
  });
});