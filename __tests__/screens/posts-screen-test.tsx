import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  mockApiClient,
  mockApiError,
  mockApiResponse,
  mockRouter,
  renderScreen,
  resetScreenHarness,
} from "../helpers/screenHarness";
import PostsScreen from "../../app/(tabs)/posts";

const ACTIVE_POST = {
  postId: "p-1",
  productName: "Ghế văn phòng xoay",
  description: "Ghế còn mới 90%",
  status: "Active",
  basePrice: 200000,
  postType: "Sell",
  quantity: 3,
  remainingQuantity: 2,
  streetAddress: "15 Lý Tự Trọng",
  city: "TP.HCM",
  medias: [],
  createdAt: new Date().toISOString(),
  expiryDate: "2026-09-01T00:00:00",
};

const CLOSED_POST = {
  ...ACTIVE_POST,
  postId: "p-2",
  productName: "Bàn gỗ cũ",
  status: "Closed",
};

function mockPosts(posts: any[] = [ACTIVE_POST]) {
  mockApiClient.current.get.mockResolvedValue(
    mockApiResponse({ items: posts }),
  );
}

describe("PostsScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
  });

  test("renders user posts from API", async () => {
    mockPosts();
    const { getByText } = await renderScreen(<PostsScreen />);

    await waitFor(() =>
      expect(mockApiClient.current.get).toHaveBeenCalledWith(
        "/posts/get-all/by-user/user-1",
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect(getByText("Ghế văn phòng xoay")).toBeTruthy(),
    );
    expect(getByText("Đang hoạt động")).toBeTruthy();
    expect(getByText("200.000 đ")).toBeTruthy();
    expect(getByText("Loại: Sell")).toBeTruthy();
    expect(getByText("Đang hiển thị (1)")).toBeTruthy();
  });

  test("renders nested data shape", async () => {
    mockApiClient.current.get.mockResolvedValue(
      mockApiResponse({ data: { items: [ACTIVE_POST] } }),
    );
    const { getByText } = await renderScreen(<PostsScreen />);
    await waitFor(() =>
      expect(getByText("Ghế văn phòng xoay")).toBeTruthy(),
    );
  });

  test("shows empty state when no posts", async () => {
    mockPosts([]);
    const { getByText } = await renderScreen(<PostsScreen />);

    await waitFor(() =>
      expect(
        getByText("Chưa có tin đăng nào đang hoạt động."),
      ).toBeTruthy(),
    );
  });

  test("shows error message when loading fails", async () => {
    mockApiClient.current.get.mockRejectedValue(
      mockApiError("Lỗi tải bài đăng.", 400, {
        message: "Lỗi tải bài đăng.",
      }),
    );
    const { getByText } = await renderScreen(<PostsScreen />);

    await waitFor(() =>
      expect(getByText("Lỗi tải bài đăng.")).toBeTruthy(),
    );
  });

  test("switches to closed tab", async () => {
    mockPosts([ACTIVE_POST, CLOSED_POST]);
    const { getByText } = await renderScreen(<PostsScreen />);
    await waitFor(() =>
      expect(getByText("Ghế văn phòng xoay")).toBeTruthy(),
    );

    await fireEvent.press(getByText("Đã đóng (1)"));
    await waitFor(() => expect(getByText("Bàn gỗ cũ")).toBeTruthy());
    expect(getByText("Đã đóng")).toBeTruthy();
  });

  test("closes an active post via PATCH after confirming", async () => {
    mockPosts();
    const { getByText, getByTestId } = await renderScreen(<PostsScreen />);
    await waitFor(() =>
      expect(getByText("Ghế văn phòng xoay")).toBeTruthy(),
    );

    await fireEvent.press(getByTestId("icon-close-circle-outline"));
    expect(getByText("Đóng bài đăng")).toBeTruthy();

    mockApiClient.current.patch.mockResolvedValueOnce(
      mockApiResponse({ isSuccess: true }),
    );
    await fireEvent.press(getByText("Đóng bài"));

    await waitFor(() =>
      expect(mockApiClient.current.patch).toHaveBeenCalledWith(
        "/posts/p-1/close",
      ),
    );
    await waitFor(() =>
      expect(getByText("Đã đóng bài đăng.")).toBeTruthy(),
    );
  });

  test("keeps post when cancelling close", async () => {
    mockPosts();
    const { getByText, getByTestId } = await renderScreen(<PostsScreen />);
    await waitFor(() =>
      expect(getByText("Ghế văn phòng xoay")).toBeTruthy(),
    );

    await fireEvent.press(getByTestId("icon-close-circle-outline"));
    await fireEvent.press(getByText("Giữ bài"));

    expect(mockApiClient.current.patch).not.toHaveBeenCalled();
    expect(getByText("Ghế văn phòng xoay")).toBeTruthy();
  });

  test("navigates to post form via FAB", async () => {
    mockPosts();
    const { getByTestId } = await renderScreen(<PostsScreen />);

    await fireEvent.press(getByTestId("icon-add"));
    expect(mockRouter.current.push).toHaveBeenCalledWith(
      "/posts/post-form",
    );
  });
});