import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  mockApiClient,
  mockApiError,
  mockApiResponse,
  renderScreen,
  resetScreenHarness,
} from "../helpers/screenHarness";
import SearchScreen from "../../app/search";

const PROVINCES = [
  { name: "Hà Nội", province_code: "01" },
  { name: "Hồ Chí Minh", province_code: "79" },
];

const CATEGORY = { categoryId: "c1", categoryName: "Điện lạnh" };

const POST_ITEM = {
  postId: "post-1",
  productName: "Tủ lạnh Samsung Inverter",
  brandName: "Samsung",
  categoryName: "Điện lạnh",
  basePrice: 1500000,
  remainingQuantity: 2,
  quantity: 3,
  status: "Active",
  streetAddress: "12 Lê Lợi",
  ward: "Bến Nghé",
  city: "Hồ Chí Minh",
  priorityLevel: "High",
};

describe("SearchScreen", () => {
  const originalFetch = globalThis.fetch;
  const originalAlert = (globalThis as any).alert;

  beforeAll(() => {
    (globalThis as any).alert = jest.fn();
  });

  afterAll(() => {
    (globalThis as any).alert = originalAlert;
  });

  beforeEach(() => {
    resetScreenHarness();
    (globalThis as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => PROVINCES,
    });
  });

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
  });

  test("renders search input, filter sections and chips", async () => {
    mockApiClient.current.get.mockResolvedValue(
      mockApiResponse({ data: { items: [CATEGORY] } }),
    );
    const { getByPlaceholderText, getByText } = await renderScreen(
      <SearchScreen />,
    );
    expect(getByPlaceholderText("Tìm theo tên, mô tả...")).toBeTruthy();
    expect(getByText("1. Thông tin cơ bản")).toBeTruthy();
    expect(getByText("2. Tình trạng & Giá cả")).toBeTruthy();
    expect(getByText("Bán")).toBeTruthy();
    expect(getByText("Mua")).toBeTruthy();
    expect(getByText("Điện lạnh")).toBeTruthy();
    expect(getByText("Không hoạt động")).toBeTruthy();
    expect(
      getByPlaceholderText("Nhập hoặc Chọn Tỉnh/Thành phố..."),
    ).toBeTruthy();
    expect(getByText("Áp dụng tìm kiếm")).toBeTruthy();
    expect(getByText("Thiết lập lại")).toBeTruthy();
    expect(mockApiClient.current.get).toHaveBeenCalledWith(
      "/categories/active",
      { params: { PageSize: 100, PageNumber: 1 } },
    );
  });

  test("submits keyword search and renders results", async () => {
    mockApiClient.current.get.mockResolvedValue(
      mockApiResponse({ data: { items: [CATEGORY] } }),
    );
    mockApiClient.current.post.mockResolvedValue(
      mockApiResponse({ data: { items: [POST_ITEM] } }),
    );
    const { getByPlaceholderText, getByText } = await renderScreen(
      <SearchScreen />,
    );
    await fireEvent.changeText(
      getByPlaceholderText("Tìm theo tên, mô tả..."),
      "tủ lạnh",
    );
    await fireEvent.press(getByText("Áp dụng tìm kiếm"));
    await waitFor(() =>
      expect(mockApiClient.current.post).toHaveBeenCalledWith(
        "/posts/search",
        expect.objectContaining({
          keyword: "tủ lạnh",
          pageNumber: 1,
          pageSize: 100,
        }),
      ),
    );
    await waitFor(() =>
      expect(getByText(/Kết quả tìm kiếm cho từ khoá/)).toBeTruthy(),
    );
    expect(getByText("Tủ lạnh Samsung Inverter")).toBeTruthy();
    expect(getByText("1.500.000 đ")).toBeTruthy();
    expect(getByText("Bán gấp")).toBeTruthy();
  });

  test("shows empty results message when no posts match", async () => {
    mockApiClient.current.get.mockResolvedValue(
      mockApiResponse({ data: { items: [] } }),
    );
    mockApiClient.current.post.mockResolvedValue(
      mockApiResponse({ data: { items: [] } }),
    );
    const { getByPlaceholderText, getByText } = await renderScreen(
      <SearchScreen />,
    );
    await fireEvent.changeText(
      getByPlaceholderText("Tìm theo tên, mô tả..."),
      "máy giặt",
    );
    await fireEvent.press(getByText("Áp dụng tìm kiếm"));
    await waitFor(() =>
      expect(
        getByText("Không tìm thấy sản phẩm nào phù hợp"),
      ).toBeTruthy(),
    );
  });

  test("shows empty state and alert when search request fails", async () => {
    mockApiClient.current.get.mockResolvedValue(
      mockApiResponse({ data: { items: [] } }),
    );
    mockApiClient.current.post.mockRejectedValue(
      mockApiError("Network Error"),
    );
    const { getByPlaceholderText, getByText } = await renderScreen(
      <SearchScreen />,
    );
    await fireEvent.changeText(
      getByPlaceholderText("Tìm theo tên, mô tả..."),
      "tivi",
    );
    await fireEvent.press(getByText("Áp dụng tìm kiếm"));
    await waitFor(() =>
      expect((globalThis as any).alert).toHaveBeenCalledWith(
        "Không thể kết nối đến máy chủ. Vui lòng thử lại!",
      ),
    );
    expect(getByText("Không tìm thấy sản phẩm nào phù hợp")).toBeTruthy();
  });

  test("applies selected filter chips to search payload", async () => {
    mockApiClient.current.get.mockResolvedValue(
      mockApiResponse({ data: { items: [CATEGORY] } }),
    );
    mockApiClient.current.post.mockResolvedValue(
      mockApiResponse({ data: { items: [] } }),
    );
    const { getByText } = await renderScreen(<SearchScreen />);
    await fireEvent.press(getByText("Bán"));
    await fireEvent.press(getByText("Không hoạt động"));
    await fireEvent.press(getByText("Giao hàng nhanh (GHN)"));
    await fireEvent.press(getByText("Bán gấp"));
    await fireEvent.press(getByText("Áp dụng tìm kiếm"));
    await waitFor(() =>
      expect(mockApiClient.current.post).toHaveBeenCalledWith(
        "/posts/search",
        expect.objectContaining({
          postType: "Sell",
          functionalityStatus: "NonFunctional",
          deliveryMethod: "GhnDelivery",
          priorityLevel: "High",
        }),
      ),
    );
  });

  test("selects province from autocomplete and includes it in payload", async () => {
    mockApiClient.current.get.mockResolvedValue(
      mockApiResponse({ data: { items: [] } }),
    );
    mockApiClient.current.post.mockResolvedValue(
      mockApiResponse({ data: { items: [] } }),
    );
    const { getByPlaceholderText, getByText } = await renderScreen(
      <SearchScreen />,
    );
    await fireEvent.changeText(
      getByPlaceholderText("Nhập hoặc Chọn Tỉnh/Thành phố..."),
      "Hà",
    );
    await waitFor(() => expect(getByText("Hà Nội")).toBeTruthy());
    await fireEvent.press(getByText("Hà Nội"));
    await fireEvent.press(getByText("Áp dụng tìm kiếm"));
    await waitFor(() =>
      expect(mockApiClient.current.post).toHaveBeenCalledWith(
        "/posts/search",
        expect.objectContaining({ city: "Hà Nội" }),
      ),
    );
  });
});
