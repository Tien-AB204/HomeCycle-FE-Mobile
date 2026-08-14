import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  mockApiClient,
  mockApiError,
  mockApiResponse,
  mockRouter,
  renderScreen,
  resetScreenHarness,
} from "../helpers/screenHarness";
import HomeScreen from "../../app/(tabs)/index";

const SELL_POST = {
  postId: "p-1",
  postType: "Sell",
  productName: "Tủ lạnh Toshiba",
  basePrice: 3500000,
  categoryName: "Điện lạnh",
  brandName: "Toshiba",
  quantity: 2,
  remainingQuantity: 1,
  streetAddress: "12 Lê Lợi",
  city: "TP.HCM",
  medias: [],
};

const BUY_POST = {
  postId: "p-2",
  postType: "Buy",
  productName: "Mua máy giặt",
  expectedPrice: 1500000,
  categoryName: "Điện lạnh",
  quantity: 1,
  remainingQuantity: 1,
  medias: [],
};

function mockHomeData(posts: any[] = [SELL_POST, BUY_POST]) {
  mockApiClient.current.get.mockImplementation((url: string) => {
    if (url === "/posts/get-all-active") {
      return Promise.resolve(mockApiResponse({ items: posts }));
    }
    if (url === "/categories/active") {
      return Promise.resolve(
        mockApiResponse({
          data: {
            items: [
              { categoryId: "c-1", categoryName: "Điện lạnh" },
              { categoryId: "c-2", categoryName: "Nội thất gỗ" },
            ],
          },
        }),
      );
    }
    return Promise.resolve(mockApiResponse({ items: [] }));
  });
}

describe("HomeScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
  });

  test("shows loading state before data arrives", async () => {
    mockApiClient.current.get.mockImplementation(
      () => new Promise(() => {}),
    );
    const { queryByText } = await renderScreen(<HomeScreen />);
    expect(queryByText("Bạn đang tìm món đồ cũ nào?")).toBeNull();
  });

  test("renders categories and post lists from API", async () => {
    mockHomeData();
    const { getByText, getAllByText } = await renderScreen(<HomeScreen />);

    await waitFor(() =>
      expect(mockApiClient.current.get).toHaveBeenCalledWith(
        "/posts/get-all-active",
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect(getByText("Tin đăng bán mới nhất")).toBeTruthy(),
    );
    expect(getByText("Tin thu mua từ Doanh nghiệp")).toBeTruthy();
    expect(getByText("Tủ lạnh Toshiba")).toBeTruthy();
    expect(getByText("Mua máy giặt")).toBeTruthy();
    expect(getByText("3.500.000 đ")).toBeTruthy();
    expect(getAllByText("Điện lạnh").length).toBeGreaterThan(0);
  });

  test("renders with nested { data: { items: [...] } } post shape", async () => {
    mockApiClient.current.get.mockImplementation((url: string) => {
      if (url === "/posts/get-all-active") {
        return Promise.resolve(
          mockApiResponse({
            data: { items: [SELL_POST] },
          }),
        );
      }
      return Promise.resolve(mockApiResponse({ data: { items: [] } }));
    });

    const { getByText } = await renderScreen(<HomeScreen />);
    await waitFor(() => expect(getByText("Tủ lạnh Toshiba")).toBeTruthy());
  });

  test("does not crash and keeps UI when APIs fail", async () => {
    mockApiClient.current.get.mockRejectedValue(
      mockApiError("Mất kết nối", 500),
    );
    const { getByText, queryByText } = await renderScreen(<HomeScreen />);

    await waitFor(() =>
      expect(getByText("Bạn đang tìm món đồ cũ nào?")).toBeTruthy(),
    );
    expect(queryByText("Tin đăng bán mới nhất")).toBeNull();
    expect(queryByText("Tin thu mua từ Doanh nghiệp")).toBeNull();
  });

  test("navigates to search when tapping search bar", async () => {
    mockHomeData();
    const { getByText } = await renderScreen(<HomeScreen />);
    await waitFor(() =>
      expect(getByText("Bạn đang tìm món đồ cũ nào?")).toBeTruthy(),
    );

    await fireEvent.press(getByText("Bạn đang tìm món đồ cũ nào?"));
    expect(mockRouter.current.push).toHaveBeenCalledWith("/search");
  });

  test("navigates to post form when tapping banner button", async () => {
    mockHomeData();
    const { getByText } = await renderScreen(<HomeScreen />);

    await fireEvent.press(getByText("Đăng tin bán ngay"));
    expect(mockRouter.current.push).toHaveBeenCalledWith("/posts/post-form");
  });

  test("filters posts by selected category", async () => {
    mockHomeData([
      SELL_POST,
      {
        ...SELL_POST,
        postId: "p-3",
        productName: "Bàn gỗ óc chó",
        categoryName: "Nội thất gỗ",
      },
    ]);
    const { getByText, queryByText, getAllByText } = await renderScreen(
      <HomeScreen />,
    );
    await waitFor(() => expect(getByText("Bàn gỗ óc chó")).toBeTruthy());

    await fireEvent.press(getAllByText("Nội thất gỗ")[0]);
    await waitFor(() => expect(queryByText("Tủ lạnh Toshiba")).toBeNull());
    expect(getByText("Bàn gỗ óc chó")).toBeTruthy();
  });
});
