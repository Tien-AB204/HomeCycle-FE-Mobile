import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  mockApiClient,
  mockRouter,
  renderScreen,
  resetScreenHarness,
  mockApiResponse,
  mockApiError,
} from "../helpers/screenHarness";
import ChatListScreen from "../../app/(tabs)/chat";

describe("ChatListScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
  });

  const conversations = [
    {
      negotiationId: "n1",
      otherPartyName: "Nguyễn Văn A",
      otherPartyAvatarUrl: null,
      lastMessageAt: "2026-08-10T10:00:00Z",
      currentOfferPrice: 50000,
      currentOfferQuantity: 2,
      unreadCount: 3,
    },
    {
      negotiationId: "n2",
      otherPartyName: "Trần Thị B",
      otherPartyAvatarUrl: null,
      lastMessageAt: "2026-08-11T08:30:00Z",
      currentOfferPrice: 120000,
      currentOfferQuantity: 1,
      unreadCount: 0,
    },
  ];

  test("renders conversations from mocked data", async () => {
    mockApiClient.current.get.mockResolvedValue(
      mockApiResponse({ data: { items: conversations } }),
    );
    const { getByText, getByPlaceholderText } = await renderScreen(
      <ChatListScreen />,
    );
    expect(getByText("Tin nhắn")).toBeTruthy();
    expect(getByText("Đoạn chat")).toBeTruthy();
    expect(getByText("Yêu cầu mới")).toBeTruthy();
    expect(getByText("Đã gửi")).toBeTruthy();
    expect(getByPlaceholderText("Tìm kiếm đoạn chat...")).toBeTruthy();
    await waitFor(() =>
      expect(getByText("Nguyễn Văn A")).toBeTruthy(),
    );
    expect(getByText("Trần Thị B")).toBeTruthy();
    expect(getByText("3")).toBeTruthy();
    expect(mockApiClient.current.get).toHaveBeenCalledWith(
      "/negotiations",
      expect.anything(),
    );
  });

  test("opens a conversation when pressing its card", async () => {
    mockApiClient.current.get.mockResolvedValue(
      mockApiResponse({ data: { items: conversations } }),
    );
    const { getByText } = await renderScreen(<ChatListScreen />);
    await waitFor(() =>
      expect(getByText("Nguyễn Văn A")).toBeTruthy(),
    );
    await fireEvent.press(getByText("Nguyễn Văn A"));
    expect(mockRouter.current.push).toHaveBeenCalledWith("/chat/n1");
  });

  test("shows empty state when there are no conversations", async () => {
    mockApiClient.current.get.mockResolvedValue(
      mockApiResponse({ data: { items: [] } }),
    );
    const { getByText } = await renderScreen(<ChatListScreen />);
    await waitFor(() =>
      expect(
        getByText("Chưa có cuộc trò chuyện nào đang diễn ra."),
      ).toBeTruthy(),
    );
  });

  test("shows error message when loading conversations fails", async () => {
    mockApiClient.current.get.mockRejectedValue(
      mockApiError("Lỗi tải dữ liệu", 400, {
        message: "Máy chủ không phản hồi.",
      }),
    );
    const { getByText } = await renderScreen(<ChatListScreen />);
    await waitFor(() =>
      expect(getByText("Máy chủ không phản hồi.")).toBeTruthy(),
    );
  });

  test("filters conversations by search query", async () => {
    mockApiClient.current.get.mockResolvedValue(
      mockApiResponse({ data: { items: conversations } }),
    );
    const { getByText, getByPlaceholderText, queryByText } =
      await renderScreen(<ChatListScreen />);
    await waitFor(() =>
      expect(getByText("Nguyễn Văn A")).toBeTruthy(),
    );
    await fireEvent.changeText(
      getByPlaceholderText("Tìm kiếm đoạn chat..."),
      "Trần",
    );
    expect(queryByText("Nguyễn Văn A")).toBeNull();
    expect(getByText("Trần Thị B")).toBeTruthy();
    await fireEvent.changeText(
      getByPlaceholderText("Tìm kiếm đoạn chat..."),
      "khong co ket qua",
    );
    expect(
      getByText("Không tìm thấy cuộc trò chuyện phù hợp."),
    ).toBeTruthy();
  });

  test("switches to received offers tab and renders offer actions", async () => {
    mockApiClient.current.get.mockImplementation((url: string) => {
      if (url === "/offers/received") {
        return Promise.resolve(
          mockApiResponse({
            data: {
              items: [
                {
                  offerId: "o1",
                  senderId: "other-1",
                  receiverId: "user-1",
                  senderName: "Người Khác",
                  productName: "Áo khoác",
                  offerPrice: 120000,
                  offerQuantity: 1,
                  offerStatus: "Pending",
                  createdAt: "2026-08-10T10:00:00Z",
                },
              ],
            },
          }),
        );
      }
      return Promise.resolve(mockApiResponse({ data: { items: [] } }));
    });
    const { getByText } = await renderScreen(<ChatListScreen />);
    await fireEvent.press(getByText("Yêu cầu mới"));
    await waitFor(() =>
      expect(mockApiClient.current.get).toHaveBeenCalledWith(
        "/offers/received",
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect(getByText("Người Khác đã gửi đề nghị")).toBeTruthy(),
    );
    expect(getByText("Áo khoác")).toBeTruthy();
    expect(getByText("Đồng ý")).toBeTruthy();
    expect(getByText("Từ chối")).toBeTruthy();
    expect(getByText("Đề xuất giá mới")).toBeTruthy();
  });

  test("switches to sent offers tab and renders sent offer", async () => {
    mockApiClient.current.get.mockImplementation((url: string) => {
      if (url === "/offers/sent") {
        return Promise.resolve(
          mockApiResponse({
            data: {
              items: [
                {
                  offerId: "o2",
                  senderId: "user-1",
                  receiverId: "other-2",
                  receiverName: "Người Mua",
                  productName: "Xe đạp",
                  offerPrice: 800000,
                  offerQuantity: 1,
                  offerStatus: "Pending",
                  createdAt: "2026-08-10T10:00:00Z",
                  postId: "p1",
                },
              ],
            },
          }),
        );
      }
      return Promise.resolve(mockApiResponse({ data: { items: [] } }));
    });
    const { getByText } = await renderScreen(<ChatListScreen />);
    await fireEvent.press(getByText("Đã gửi"));
    await waitFor(() =>
      expect(mockApiClient.current.get).toHaveBeenCalledWith(
        "/offers/sent",
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect(getByText("Bạn đã gửi cho Người Mua")).toBeTruthy(),
    );
    expect(getByText("Xe đạp")).toBeTruthy();
    expect(getByText("Xem lại bài đăng")).toBeTruthy();
  });
});