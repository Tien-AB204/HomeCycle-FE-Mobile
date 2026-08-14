import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  mockApiClient,
  mockApiError,
  mockApiResponse,
  renderScreen,
  resetScreenHarness,
} from "../helpers/screenHarness";
import ChatDetailScreen from "../../app/chat/[id]";

const NEGOTIATION: any = {
  negotiationId: "neg-1",
  negotiationStatus: "Open",
  otherPartyName: "Nguyễn Văn A",
  currentOfferPrice: 1500000,
  currentOfferQuantity: 2,
  offerId: "of-1",
};

const OFFER: any = {
  offerId: "of-1",
  postId: "post-1",
  offerPrice: 1500000,
  offerQuantity: 2,
  sender: { userId: "seller-1", displayName: "Nguyễn Văn A" },
  receiver: { userId: "user-1", displayName: "Người Dùng Test" },
};

const POST: any = {
  postId: "post-1",
  product: { productName: "Máy giặt cũ 9kg", productTypeName: "Máy giặt" },
  basePrice: 2500000,
  city: "TP. Hồ Chí Minh",
  medias: [],
};

const MESSAGES: any = {
  items: [
    {
      messageId: "m1",
      senderId: "seller-1",
      messageContent: "Chào bạn, tôi là người bán.",
      messageType: "Text",
      createdAt: "2026-01-01T08:00:00Z",
      isRead: true,
    },
    {
      messageId: "m2",
      senderId: "user-1",
      messageContent: "Chào anh, giá có bớt không ạ?",
      messageType: "Text",
      createdAt: "2026-01-01T08:05:00Z",
      isRead: false,
    },
  ],
};

function mockChatSuccess() {
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
    if (url.startsWith("/Messages")) {
      return Promise.resolve(mockApiResponse({ ...MESSAGES }));
    }
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
  mockApiClient.current.patch.mockResolvedValue(mockApiResponse({}));
}

describe("ChatDetailScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
  });

  test("renders negotiation header, product banner and message list", async () => {
    mockChatSuccess();
    const { getByText } = await renderScreen(<ChatDetailScreen />, {
      params: { id: "neg-1" },
    });
    await waitFor(() => expect(getByText("Nguyễn Văn A")).toBeTruthy());
    expect(getByText("Máy giặt cũ 9kg")).toBeTruthy();
    expect(getByText("Giá niêm yết: 2.500.000 ₫")).toBeTruthy();
    expect(getByText("Chào bạn, tôi là người bán.")).toBeTruthy();
    expect(getByText("Chào anh, giá có bớt không ạ?")).toBeTruthy();
    expect(getByText("Giao dịch bắt đầu")).toBeTruthy();
  });

  test("sends a message via the message API", async () => {
    mockChatSuccess();
    mockApiClient.current.post.mockResolvedValue(mockApiResponse({}));
    const { getByPlaceholderText, getByTestId } = await renderScreen(
      <ChatDetailScreen />,
      { params: { id: "neg-1" } },
    );
    await waitFor(() =>
      expect(getByPlaceholderText("Nhập tin nhắn...")).toBeTruthy(),
    );
    await fireEvent.changeText(
      getByPlaceholderText("Nhập tin nhắn..."),
      "Bớt chút được không?",
    );
    await fireEvent.press(getByTestId("icon-send"));
    await waitFor(() =>
      expect(mockApiClient.current.post).toHaveBeenCalledWith(
        "/Messages",
        expect.objectContaining({
          messageContent: "Bớt chút được không?",
        }),
        expect.objectContaining({
          params: { negotiationId: "neg-1" },
        }),
      ),
    );
  });

  test("does not send empty messages", async () => {
    mockChatSuccess();
    const { getByTestId } = await renderScreen(<ChatDetailScreen />, {
      params: { id: "neg-1" },
    });
    await waitFor(() => expect(getByTestId("icon-send")).toBeTruthy());
    await fireEvent.press(getByTestId("icon-send"));
    expect(mockApiClient.current.post).not.toHaveBeenCalled();
  });

  test("shows error state when negotiation fails to load", async () => {
    mockApiClient.current.get.mockRejectedValue(
      mockApiError(
        "Không thể tải cuộc trò chuyện. Vui lòng thử lại.",
        404,
      ),
    );
    const { getByText } = await renderScreen(<ChatDetailScreen />, {
      params: { id: "neg-1" },
    });
    await waitFor(() =>
      expect(
        getByText("Không thể tải cuộc trò chuyện. Vui lòng thử lại."),
      ).toBeTruthy(),
    );
    expect(getByText("Thử lại")).toBeTruthy();
  });
});