import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  mockApiClient,
  mockApiError,
  mockApiResponse,
  mockRouter,
  renderScreen,
  resetScreenHarness,
} from "../helpers/screenHarness";
import CartScreen from "../../app/(tabs)/cart";

const CART_ITEM = {
  cartItemId: "ci-1",
  postId: "p-1",
  quantity: 2,
  addedAt: "2026-08-01T10:00:00",
  post: {
    postId: "p-1",
    productName: "Tủ lạnh Toshiba",
    basePrice: 5000000,
    status: "Active",
    remainingQuantity: 5,
    categoryName: "Điện lạnh",
    medias: [],
  },
};

function mockCart(items: any[] = [CART_ITEM]) {
  mockApiClient.current.get.mockResolvedValue(
    mockApiResponse({
      data: {
        items,
        totalQuantity: items.length ? 2 : 0,
        totalPrice: items.length ? 10000000 : 0,
      },
    }),
  );
}

describe("CartScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
  });

  test("renders cart items and totals", async () => {
    mockCart();
    const { getByText } = await renderScreen(<CartScreen />);

    await waitFor(() =>
      expect(mockApiClient.current.get).toHaveBeenCalledWith("/cart"),
    );
    await waitFor(() => expect(getByText("Tủ lạnh Toshiba")).toBeTruthy());
    expect(getByText("SL: 2")).toBeTruthy();
    expect(getByText("5.000.000 đ")).toBeTruthy();
    expect(getByText("Tổng cộng (2 sản phẩm)")).toBeTruthy();
    expect(getByText("Mua thêm")).toBeTruthy();
  });

  test("shows empty cart message", async () => {
    mockCart([]);
    const { getByText } = await renderScreen(<CartScreen />);

    await waitFor(() =>
      expect(getByText("Giỏ hàng đang trống")).toBeTruthy(),
    );
    expect(
      getByText("Những sản phẩm bạn muốn mua sẽ xuất hiện tại đây."),
    ).toBeTruthy();
  });

  test("navigates to tabs from empty cart", async () => {
    mockCart([]);
    const { getByText } = await renderScreen(<CartScreen />);
    await waitFor(() =>
      expect(getByText("Giỏ hàng đang trống")).toBeTruthy(),
    );

    await fireEvent.press(getByText("Khám phá sản phẩm"));
    expect(mockRouter.current.push).toHaveBeenCalledWith("/(tabs)");
  });

  test("shows error state when loading fails", async () => {
    mockApiClient.current.get.mockRejectedValue(
      mockApiError("Lỗi tải giỏ hàng từ máy chủ.", 400, {
        message: "Lỗi tải giỏ hàng từ máy chủ.",
      }),
    );
    const { getByText } = await renderScreen(<CartScreen />);

    await waitFor(() =>
      expect(getByText("Không thể tải giỏ hàng")).toBeTruthy(),
    );
    expect(getByText("Lỗi tải giỏ hàng từ máy chủ.")).toBeTruthy();
  });

  test("retries fetch when tapping Thử lại", async () => {
    mockApiClient.current.get
      .mockRejectedValueOnce(mockApiError("Lỗi máy chủ", 500))
      .mockResolvedValueOnce(
        mockApiResponse({ data: { items: [CART_ITEM] } }),
      );
    const { getByText } = await renderScreen(<CartScreen />);

    await waitFor(() =>
      expect(getByText("Không thể tải giỏ hàng")).toBeTruthy(),
    );
    await fireEvent.press(getByText("Thử lại"));
    await waitFor(() => expect(getByText("Tủ lạnh Toshiba")).toBeTruthy());
  });

  test("removes item via DELETE after confirming", async () => {
    mockCart();
    const { getByText, getByTestId } = await renderScreen(<CartScreen />);
    await waitFor(() => expect(getByText("Tủ lạnh Toshiba")).toBeTruthy());

    await fireEvent.press(getByTestId("icon-trash-outline"));
    expect(getByText("Xóa khỏi giỏ hàng")).toBeTruthy();

    mockApiClient.current.delete.mockResolvedValueOnce(
      mockApiResponse({ isSuccess: true }),
    );
    await fireEvent.press(getByText("Xóa"));

    await waitFor(() =>
      expect(mockApiClient.current.delete).toHaveBeenCalledWith(
        "/cart/ci-1",
      ),
    );
    await waitFor(() =>
      expect(
        getByText("Đã xóa sản phẩm khỏi giỏ hàng."),
      ).toBeTruthy(),
    );
  });

  test("keeps item when cancelling removal", async () => {
    mockCart();
    const { getByText, getByTestId } = await renderScreen(<CartScreen />);
    await waitFor(() => expect(getByText("Tủ lạnh Toshiba")).toBeTruthy());

    await fireEvent.press(getByTestId("icon-trash-outline"));
    await fireEvent.press(getByText("Giữ lại"));

    expect(mockApiClient.current.delete).not.toHaveBeenCalled();
    expect(getByText("Tủ lạnh Toshiba")).toBeTruthy();
  });
});
