import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  mockApiClient,
  mockApiError,
  mockApiResponse,
  mockRouter,
  renderScreen,
  resetScreenHarness,
} from "../helpers/screenHarness";
import PostDetailScreen from "../../app/posts/[id]";

const POST_DATA: any = {
  postId: "post-1",
  productName: "Máy giặt cửa ngang",
  basePrice: 2500000,
  description: "Máy giặt hoạt động tốt, ít sử dụng.",
  ownerId: "seller-1",
  remainingQuantity: 2,
  quantity: 3,
  status: "Active",
  postType: "Sell",
  deliveryMethod: "GhnDelivery",
  city: "TP. Hồ Chí Minh",
  ward: "Quận 1",
  streetAddress: "123 Lê Lợi",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
  expiryDate: "2026-02-01T00:00:00Z",
  medias: [{ mediaId: "m1", url: "https://example.com/img.jpg" }],
  product: {
    productName: "Máy giặt cửa ngang",
    categoryName: "Điện máy",
    brandName: "LG",
    functionalityStatus: "FullyFunctional",
  },
};

function mockPostSuccess(overrides: any = {}) {
  mockApiClient.current.get.mockImplementation((url: string) => {
    if (url.startsWith("/posts/get-by-id/")) {
      return Promise.resolve(
        mockApiResponse({ data: { ...POST_DATA, ...overrides } }),
      );
    }
    if (url.startsWith("/offers/sent")) {
      return Promise.resolve(mockApiResponse({ data: { items: [] } }));
    }
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
}

describe("PostDetailScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
  });

  test("renders post info from mocked data", async () => {
    mockPostSuccess();
    const { getByText } = await renderScreen(<PostDetailScreen />, {
      params: { id: "post-1" },
    });
    await waitFor(() =>
      expect(getByText("Máy giặt cửa ngang")).toBeTruthy(),
    );
    expect(getByText("Chi tiết tin đăng")).toBeTruthy();
    expect(getByText("2.500.000 đ")).toBeTruthy();
    expect(getByText("Máy giặt hoạt động tốt, ít sử dụng.")).toBeTruthy();
    expect(getByText("Tin Bán")).toBeTruthy();
    expect(mockApiClient.current.get).toHaveBeenCalledWith(
      "/posts/get-by-id/post-1",
    );
  });

  test("adds product to cart via API", async () => {
    mockPostSuccess();
    mockApiClient.current.post.mockResolvedValue(mockApiResponse({}));
    const { getByText, getAllByText, getByPlaceholderText } =
      await renderScreen(<PostDetailScreen />, {
        params: { id: "post-1" },
      });
    await waitFor(() => expect(getByText("Thêm giỏ hàng")).toBeTruthy());
    await fireEvent.press(getByText("Thêm giỏ hàng"));
    await fireEvent.changeText(
      getByPlaceholderText("Nhập số lượng..."),
      "2",
    );
    await fireEvent.press(getAllByText("Thêm vào giỏ hàng")[1]);
    await waitFor(() =>
      expect(mockApiClient.current.post).toHaveBeenCalledWith(
        "/cart/post-1",
        { quantity: 2 },
      ),
    );
    expect(getByText("Đã thêm 2 sản phẩm vào giỏ hàng.")).toBeTruthy();
  });

  test("validates offer form before sending", async () => {
    mockPostSuccess();
    const { getByText } = await renderScreen(<PostDetailScreen />, {
      params: { id: "post-1" },
    });
    await waitFor(() => expect(getByText("Thương lượng")).toBeTruthy());
    await fireEvent.press(getByText("Thương lượng"));
    await fireEvent.press(getByText("Gửi đề nghị"));
    expect(getByText("Giá thương lượng phải lớn hơn 0.")).toBeTruthy();
    expect(mockApiClient.current.post).not.toHaveBeenCalled();
  });

  test("sends negotiation offer via API", async () => {
    mockPostSuccess();
    mockApiClient.current.post.mockResolvedValue(mockApiResponse({}));
    const { getByText, getByPlaceholderText } = await renderScreen(
      <PostDetailScreen />,
      { params: { id: "post-1" } },
    );
    await waitFor(() => expect(getByText("Thương lượng")).toBeTruthy());
    await fireEvent.press(getByText("Thương lượng"));
    await fireEvent.changeText(
      getByPlaceholderText("Ví dụ: 1500000"),
      "1500000",
    );
    await fireEvent.press(getByText("Gửi đề nghị"));
    await waitFor(() =>
      expect(mockApiClient.current.post).toHaveBeenCalledWith("/offers", {
        postId: "post-1",
        offerPrice: 1500000,
        offerQuantity: 1,
      }),
    );
  });

  test("shows error state when post fails to load", async () => {
    mockApiClient.current.get.mockRejectedValue(
      mockApiError("Không thể tải thông tin bài đăng.", 404),
    );
    const { getByText } = await renderScreen(<PostDetailScreen />, {
      params: { id: "post-1" },
    });
    await waitFor(() =>
      expect(getByText("Không thể tải thông tin bài đăng.")).toBeTruthy(),
    );
    await fireEvent.press(getByText("Quay lại"));
    expect(mockRouter.current.back).toHaveBeenCalled();
  });

  test("viewOnly hides action buttons", async () => {
    mockPostSuccess();
    const { getByText, queryByText } = await renderScreen(
      <PostDetailScreen />,
      { params: { id: "post-1", viewOnly: "true" } },
    );
    await waitFor(() =>
      expect(getByText("Máy giặt cửa ngang")).toBeTruthy(),
    );
    expect(queryByText("Thêm giỏ hàng")).toBeNull();
    expect(queryByText("Thương lượng")).toBeNull();
  });

  test("owner can close own post via confirm dialog", async () => {
    mockPostSuccess({ ownerId: "user-1" });
    mockApiClient.current.patch.mockResolvedValue(mockApiResponse({}));
    const { getByText } = await renderScreen(<PostDetailScreen />, {
      params: { id: "post-1" },
    });
    await waitFor(() => expect(getByText("Đóng tin")).toBeTruthy());
    expect(getByText("Sửa tin đăng")).toBeTruthy();
    fireEvent.press(getByText("Đóng tin"));
    await waitFor(() => expect(getByText("Đóng bài đăng")).toBeTruthy());
    await fireEvent.press(getByText("Đóng bài"));
    await waitFor(() =>
      expect(mockApiClient.current.patch).toHaveBeenCalledWith(
        "/posts/post-1/close",
      ),
    );
    expect(getByText("Đã đóng bài đăng.")).toBeTruthy();
  });

  test("owner can edit post via router push", async () => {
    mockPostSuccess({ ownerId: "user-1" });
    const { getByText } = await renderScreen(<PostDetailScreen />, {
      params: { id: "post-1" },
    });
    await waitFor(() => expect(getByText("Sửa tin đăng")).toBeTruthy());
    await fireEvent.press(getByText("Sửa tin đăng"));
    expect(mockRouter.current.push).toHaveBeenCalledWith({
      pathname: "/posts/post-form",
      params: { editId: "post-1", postType: "Sell" },
    });
  });
});
