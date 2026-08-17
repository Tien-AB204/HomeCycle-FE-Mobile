import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Header from "../../src/components/shared/Header";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import { useChatRealtime } from "../../src/contexts/ChatRealtimeContext";
import apiClient from "../../src/services/apis/axiosClient";

const agreementApi = {
  getPreview: (negotiationId: string) =>
    apiClient
      .get(`/agreements/preview/${negotiationId}`)
      .then((response) => response.data),

  getAgreementById: (agreementId: string) =>
    apiClient
      .get(`/agreements/${agreementId}`)
      .then((response) => response.data),
};

const messageApi = {
  sendMessage: (negotiationId: string, payload: any) =>
    apiClient
      .post("/Messages", payload, {
        params: { negotiationId },
      })
      .then((response) => response.data),

  getMessages: (params?: any) =>
    apiClient
      .get("/Messages", { params })
      .then((response) => response.data),

  markAsRead: async (negotiationId: string) => {
    await apiClient.patch("/Messages/read", null, {
      params: { negotiationId },
    });

    return true;
  },
};

const negotiationApi = {
  getNegotiationById: (negotiationId: string) =>
    apiClient
      .get(`/negotiations/${negotiationId}`)
      .then((response) => response.data),

  counterNegotiation: (
    negotiationId: string,
    data: {
      offerPrice: number;
      offerQuantity: number;
    },
  ) =>
    apiClient
      .post(`/negotiations/${negotiationId}/counter`, data)
      .then((response) => response.data),

  acceptProposal: (
    negotiationId: string,
    proposalMessageId: string,
  ) =>
    apiClient
      .patch(
        `/negotiations/${negotiationId}/proposals/${proposalMessageId}/accept`,
      )
      .then((response) => response.data),

  rejectProposal: (
    negotiationId: string,
    proposalMessageId: string,
  ) =>
    apiClient
      .patch(
        `/negotiations/${negotiationId}/proposals/${proposalMessageId}/reject`,
      )
      .then((response) => response.data),

  cancelNegotiation: (negotiationId: string) =>
    apiClient
      .post(`/negotiations/${negotiationId}/cancel`)
      .then((response) => response.data),
};

const offerApi = {
  getOfferById: (offerId: string) =>
    apiClient
      .get(`/offers/${offerId}`)
      .then((response) => response.data),
};

const postApi = {
  getPostById: (postId: string) =>
    apiClient
      .get(`/posts/get-by-id/${postId}`)
      .then((response) => response.data),
};

const getRobustAvatar = (
  url: string | null | undefined,
  name: string,
) => {
  const isValid =
    url &&
    url !== "string" &&
    url !== "null" &&
    url.startsWith("http");

  if (isValid) {
    if (url.includes("googleusercontent.com")) {
      return `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
    }

    return url;
  }

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "U",
  )}&background=547B7D&color=fff`;
};

const normalizeAgreementUiText = (text?: string | null) => {
  if (!text) {
    return "Đã tạo hợp đồng giao dịch, vui lòng kiểm tra và xác nhận.";
  }

  return text
    .replace(/\bagreement\b/gi, "hợp đồng")
    .replace(/đơn xác nhận/gi, "hợp đồng")
    .replace(/thỏa thuận mua bán/gi, "hợp đồng giao dịch");
};

export default function ChatDetailScreen() {
  const router = useRouter();

  const params = useLocalSearchParams();

  const negotiationId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const { user, isLoading: isAuthLoading } = useAuth();

  const { connection } = useChatRealtime();

  const currentUserId = user?.userId || user?.id;

  const [negotiationInfo, setNegotiationInfo] =
    useState<any>(null);

  const negotiationInfoRef = useRef<any>(null);
  const isScreenFocusedRef = useRef(false);

  const [messages, setMessages] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  const [loadError, setLoadError] =
    useState<string | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);

  const [agreementPreview, setAgreementPreview] =
    useState<any>(null);

  const [inputText, setInputText] = useState("");

  const [
    isActionMenuVisible,
    setActionMenuVisible,
  ] = useState(false);

  const [
    isCounterModalVisible,
    setCounterModalVisible,
  ] = useState(false);

  const [
    counterPriceInput,
    setCounterPriceInput,
  ] = useState("");

  const [
    counterQuantityInput,
    setCounterQuantityInput,
  ] = useState("1");

  const fetchBaseInfo = useCallback(async () => {
    if (!negotiationId || !currentUserId) {
      return null;
    }

    try {
      const negotiationResponse =
        await negotiationApi.getNegotiationById(
          negotiationId,
        );

      const info =
        negotiationResponse?.data || negotiationResponse;

      const productDetails: any = {
        postId: "",
        name: "Sản phẩm thương lượng",
        image: "",
        basePrice: 0,
        city: "",
        productTypeName: "",
        partnerName: info?.otherPartyName,
        partnerAvatar: info?.otherPartyAvatarUrl,
        myAvatar: user?.avatarUrl || user?.avatar,
      };

      if (info?.offerId) {
        try {
          const offerResponse =
            await offerApi.getOfferById(info.offerId);

          const offer =
            offerResponse?.data || offerResponse;

          if (offer) {
            const senderId =
              offer.sender?.userId?.toLowerCase();

            const isCurrentUserSender =
              senderId ===
              String(currentUserId).toLowerCase();

            const currentUserData =
              isCurrentUserSender
                ? offer.sender
                : offer.receiver;

            const partnerData =
              isCurrentUserSender
                ? offer.receiver
                : offer.sender;

            if (currentUserData?.avatarUrl) {
              productDetails.myAvatar =
                currentUserData.avatarUrl;
            }

            if (partnerData) {
              productDetails.partnerName =
                partnerData.displayName ||
                partnerData.username ||
                productDetails.partnerName;

              productDetails.partnerAvatar =
                partnerData.avatarUrl ||
                partnerData.avatar ||
                productDetails.partnerAvatar;
            }
          }

          if (offer?.postId) {
            const postResponse =
              await postApi.getPostById(offer.postId);

            const post =
              postResponse?.data || postResponse;

            productDetails.postId =
              post?.postId || "";

            productDetails.name =
              post?.product?.productName ||
              post?.productName ||
              "Sản phẩm";

            productDetails.basePrice =
              Number(post?.basePrice || 0);

            productDetails.city =
              post?.city || "Chưa cập nhật";

            productDetails.productTypeName =
              post?.product?.productTypeName ||
              post?.productTypeName ||
              "";

            if (
              Array.isArray(post?.medias) &&
              post.medias.length > 0
            ) {
              productDetails.image =
                post.medias[0].url ||
                post.medias[0].mediaUrl;
            }
          }
        } catch (error) {
          console.log(
            "Lỗi tải thông tin offer/post:",
            error,
          );
        }
      }

      productDetails.partnerName =
        productDetails.partnerName ||
        "Đối tác giao dịch";

      const combinedInfo = {
        ...info,
        ...productDetails,
      };

      if (
        info?.negotiationStatus === "Agreed" ||
        info?.negotiationStatus === "Accepted"
      ) {
        try {
          const previewResponse =
            await agreementApi.getPreview(
              negotiationId,
            );

          const preview =
            previewResponse?.data ||
            previewResponse;

          setAgreementPreview(preview);

          combinedInfo.agreementPreview =
            preview;

          if (
            preview?.hasAgreement &&
            preview?.agreementId
          ) {
            const agreementResponse =
              await agreementApi.getAgreementById(
                preview.agreementId,
              );

            combinedInfo.agreementData =
              agreementResponse?.data ||
              agreementResponse;
          }
        } catch (error) {
          console.log(
            "Lỗi tải Agreement Preview:",
            error,
          );
        }
      }

      negotiationInfoRef.current =
        combinedInfo;

      setNegotiationInfo(combinedInfo);

      return combinedInfo;
    } catch (error) {
      console.error(
        "Lỗi tải thông tin thương lượng:",
        error,
      );

      return null;
    }
  }, [
    currentUserId,
    negotiationId,
    user,
  ]);

  const fetchMessagesOnly =
    useCallback(async () => {
      if (!negotiationId || !currentUserId) {
        return;
      }

      const info =
        negotiationInfoRef.current;

      if (!info) {
        return;
      }

      try {
        const messageResponse =
          await messageApi.getMessages({
            negotiationId,
            PageNumber: 1,
            PageSize: 50,
          });

        const messageData =
          messageResponse?.data ||
          messageResponse;

        let rawMessages: any[] = [];

        if (Array.isArray(messageData)) {
          rawMessages = [...messageData];
        } else if (
          Array.isArray(messageData?.items)
        ) {
          rawMessages = [
            ...messageData.items,
          ];
        }

        const getMessageTypeOrder = (
          messageType: unknown,
        ) => {
          const normalizedType = String(
            messageType ?? "",
          )
            .trim()
            .toLowerCase();

          if (
            normalizedType === "offer" ||
            normalizedType === "2"
          ) {
            return 0;
          }

          if (
            normalizedType ===
              "counteroffer" ||
            normalizedType === "3"
          ) {
            return 1;
          }

          if (
            normalizedType ===
            "agreement"
          ) {
            return 3;
          }

          return 2;
        };

        const sortedMessages = [
          ...rawMessages,
        ].sort(
          (
            firstMessage,
            secondMessage,
          ) => {
            const firstCreatedTime =
              new Date(
                firstMessage.createdAt || 0,
              ).getTime();

            const secondCreatedTime =
              new Date(
                secondMessage.createdAt || 0,
              ).getTime();

            if (
              firstCreatedTime !==
              secondCreatedTime
            ) {
              return (
                firstCreatedTime -
                secondCreatedTime
              );
            }

            const messageTypeDifference =
              getMessageTypeOrder(
                firstMessage.messageType,
              ) -
              getMessageTypeOrder(
                secondMessage.messageType,
              );

            if (
              messageTypeDifference !== 0
            ) {
              return messageTypeDifference;
            }

            const firstUpdatedTime =
              new Date(
                firstMessage.updatedAt ||
                  firstMessage.createdAt ||
                  0,
              ).getTime();

            const secondUpdatedTime =
              new Date(
                secondMessage.updatedAt ||
                  secondMessage.createdAt ||
                  0,
              ).getTime();

            if (
              firstUpdatedTime !==
              secondUpdatedTime
            ) {
              return (
                firstUpdatedTime -
                secondUpdatedTime
              );
            }

            return String(
              firstMessage.messageId || "",
            ).localeCompare(
              String(
                secondMessage.messageId ||
                  "",
              ),
            );
          },
        );

        const formattedMessages: any[] = [];
        
        let lastAgreementCardIndex = -1;

        sortedMessages.forEach(
          (message, index) => {
            const isMe =
              String(
                message.senderId,
              ).toLowerCase() ===
              String(
                currentUserId,
              ).toLowerCase();

            // =========================================================================
            // LẮNG NGHE SỰ KIỆN HỢP ĐỒNG & RENDER CARD
            // =========================================================================
            const isSystemAgreementEvent = 
              message.messageType === "Agreement" || 
              message.messageType === 4 ||
              (message.messageContent && message.messageContent.toLowerCase().includes("đã chỉnh sửa hợp đồng"));

            if (isSystemAgreementEvent && info.agreementData) {
              
              // 1. KẾ THỪA SENDER ID VÀ TRẠNG THÁI ĐÃ ĐỌC (isRead)
              // Thay vì gán sender: "system" như cũ, giờ gán theo người thực sự đã tạo/sửa (isMe).
              // Như vậy thẻ sẽ nằm bên phải nếu mình sửa, nằm trái nếu đối tác sửa. Kèm theo có cả Tick Đã Đọc.
              formattedMessages.push({
                id: `card-${message.messageId}`,
                type: "agreement_card",
                agreementId: info.agreementData.agreementId,
                agreementData: info.agreementData, 
                sender: isMe ? "me" : "them", // KHẮC PHỤC LỖI NẰM SAI BÊN
                isRead: message.isRead === true, // KHẮC PHỤC LỖI THIẾU TICK XANH ĐÃ ĐỌC
                time: new Date(message.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                isLatestAgreement: false, 
              });
              
              lastAgreementCardIndex = formattedMessages.length - 1;

              // 2. Chèn Bong bóng (Bubble) thông báo hệ thống màu xám ở DƯỚI Card
              // Bong bóng này vẫn hiển thị dạng "system_agreed" để hiện khung màu xám căn giữa màn hình
              formattedMessages.push({
                id: message.messageId,
                type: "system_agreed",
                text: normalizeAgreementUiText(message.messageContent) || message.messageContent,
                avatar: isMe ? info.myAvatar : info.partnerAvatar,
                accepterName: isMe ? "Bạn" : info.partnerName,
              });
              
              return;
            }

            const isOfferType =
              message.messageType === 2 ||
              message.messageType === 3 ||
              message.messageType ===
                "Offer" ||
              message.messageType ===
                "CounterOffer" ||
              Number(message.offerPrice) > 0;

            const formattedMessage = {
              id:
                message.messageId ||
                String(index),
              type: isOfferType
                ? "offer"
                : "text",
              text:
                message.messageContent ||
                "",
              price: Number(
                message.offerPrice || 0,
              ),
              quantity: Number(
                message.offerQuantity || 1,
              ),
              status: message.offerStatus
                ? String(
                    message.offerStatus,
                  ).toLowerCase()
                : "pending",
              isRead:
                message.isRead === true,
              sender: isMe
                ? "me"
                : "them",
              avatar: isMe
                ? info.myAvatar
                : info.partnerAvatar,
              senderName: isMe
                ? "Bạn"
                : info.partnerName,
              time: message.createdAt
                ? new Date(
                    message.createdAt,
                  ).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Vừa xong",
            };

            formattedMessages.push(
              formattedMessage,
            );

            if (
              isOfferType &&
              formattedMessage.status ===
                "accepted"
            ) {
              const currentUserAccepted =
                !isMe;

              const accepterName =
                currentUserAccepted
                  ? "Bạn"
                  : info.partnerName;

              formattedMessages.push({
                id: `system-agreed-${formattedMessage.id}`,
                type: "system_agreed",
                text: currentUserAccepted
                  ? "Bạn đã chấp nhận thương lượng"
                  : `${accepterName} đã chấp nhận thương lượng`,
                avatar:
                  currentUserAccepted
                    ? info.myAvatar
                    : info.partnerAvatar,
                accepterName,
              });
            }
          },
        );

        if (lastAgreementCardIndex !== -1) {
          formattedMessages[lastAgreementCardIndex].isLatestAgreement = true;
        }

        setMessages(formattedMessages);
      } catch (error) {
        console.error(
          "Lỗi tải tin nhắn:",
          error,
        );
      }
    }, [
      currentUserId,
      negotiationId,
    ]);

  const initialLoad =
    useCallback(async () => {
      if (
        !negotiationId ||
        !currentUserId
      ) {
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const loadedInfo =
          await fetchBaseInfo();

        if (!loadedInfo) {
          setLoadError(
            "Không thể tải cuộc trò chuyện. Vui lòng thử lại.",
          );

          return;
        }

        await fetchMessagesOnly();

        try {
          await messageApi.markAsRead(
            negotiationId,
          );
        } catch {
          // Không chặn UI nếu API read lỗi.
        }
      } finally {
        setIsLoading(false);
      }
    }, [
      currentUserId,
      fetchBaseInfo,
      fetchMessagesOnly,
      negotiationId,
    ]);

  useFocusEffect(
    useCallback(() => {
      isScreenFocusedRef.current = true;

      return () => {
        isScreenFocusedRef.current = false;
      };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      if (isAuthLoading) {
        setIsLoading(true);
        return;
      }

      if (!negotiationId) {
        setLoadError(
          "Không tìm thấy cuộc trò chuyện này.",
        );

        setIsLoading(false);
        return;
      }

      if (!currentUserId) {
        setLoadError(
          "Bạn cần đăng nhập để xem cuộc trò chuyện.",
        );

        setIsLoading(false);
        return;
      }

      void initialLoad();
    }, [
      currentUserId,
      initialLoad,
      isAuthLoading,
      negotiationId,
    ]),
  );

  useEffect(() => {
    if (!connection || !negotiationId) {
      return;
    }

    let isMounted = true;

    const handleMessageCreated = async (newMsg: any) => {
      if (!isMounted) return;

      const isMe =
        String(newMsg.senderId).toLowerCase() ===
        String(currentUserId).toLowerCase();

      if (!isMe && isScreenFocusedRef.current) {
        messageApi.markAsRead(negotiationId).catch(() => {});
      }

      const isSpecialEvent =
        newMsg.messageType === 2 ||
        newMsg.messageType === 3 ||
        newMsg.messageType === "Offer" ||
        newMsg.messageType === "CounterOffer" ||
        newMsg.messageType === "Agreement" ||
        newMsg.messageType === 4 ||
        newMsg.messageType === "AgreementCard" ||
        Number(newMsg.offerPrice) > 0 ||
        (newMsg.messageContent && newMsg.messageContent.toLowerCase().includes("đã chỉnh sửa hợp đồng"));

      if (isSpecialEvent) {
        await fetchBaseInfo();
        await fetchMessagesOnly();
      } else {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.messageId)) return prev;

          const info = negotiationInfoRef.current;

          const formatted = {
            id: newMsg.messageId || Date.now().toString(),
            type: "text",
            text: newMsg.messageContent || "",
            price: 0,
            quantity: 1,
            status: "pending",
            isRead: newMsg.isRead === true,
            sender: isMe ? "me" : "them",
            avatar: isMe ? info?.myAvatar : info?.partnerAvatar,
            senderName: isMe ? "Bạn" : info?.partnerName,
            time: new Date(newMsg.createdAt || Date.now()).toLocaleTimeString(
              [],
              { hour: "2-digit", minute: "2-digit" },
            ),
          };
          return [...prev, formatted];
        });
      }
    };

    const handleMessagesRead = () => {
      if (isMounted) {
        setMessages((prev) =>
          prev.map((m) => (m.sender === "me" ? { ...m, isRead: true } : m)),
        );
      }
    };

    const handleConversationUpdated = async (payload: any) => {
      if (!isMounted) return;

      const updatedNegotiationId =
        payload?.negotiationId ??
        payload?.NegotiationId;

      if (
        updatedNegotiationId &&
        String(updatedNegotiationId).toLowerCase() !==
          String(negotiationId).toLowerCase()
      ) {
        return;
      }

      await fetchBaseInfo();
      await fetchMessagesOnly();
    };

    const joinRoom = async () => {
      try {
        await connection.invoke(
          "JoinNegotiation",
          negotiationId,
        );
      } catch (error) {
        console.log(
          "Không thể tham gia phòng chat:",
          error,
        );
      }
    };

    connection.on(
      "MessageCreated",
      handleMessageCreated,
    );

    connection.on(
      "MessagesRead",
      handleMessagesRead,
    );

    connection.on(
      "ConversationUpdated",
      handleConversationUpdated,
    );

    connection.onreconnected(() => {
      if (!isMounted) {
        return;
      }

      void joinRoom().then(() =>
        fetchMessagesOnly(),
      );
    });

    void joinRoom();

    return () => {
      isMounted = false;

      connection.off(
        "MessageCreated",
        handleMessageCreated,
      );

      connection.off(
        "MessagesRead",
        handleMessagesRead,
      );

      connection.off(
        "ConversationUpdated",
        handleConversationUpdated,
      );

      void connection
        .invoke(
          "LeaveNegotiation",
          negotiationId,
        )
        .catch(() => undefined);
    };
  }, [
    connection,
    fetchBaseInfo,
    fetchMessagesOnly,
    negotiationId,
  ]);

  const currentActiveOffer =
  useMemo(() => {
    const offers =
      messages.filter(
        (message) =>
          message.type === "offer",
      );

    if (offers.length === 0) {
      return null;
    }

    const matchingPendingOffer =
      offers.find(
        (message) =>
          message.status ===
            "pending" &&
          Number(message.price) ===
            Number(
              negotiationInfo
                ?.currentOfferPrice,
            ) &&
          Number(
            message.quantity,
          ) ===
            Number(
              negotiationInfo
                ?.currentOfferQuantity,
            ),
      );

    if (matchingPendingOffer) {
      return matchingPendingOffer;
    }

    const pendingOffers =
      offers.filter(
        (message) =>
          message.status ===
          "pending",
      );

    if (
      pendingOffers.length > 0
    ) {
      return pendingOffers[
        pendingOffers.length - 1
      ];
    }

    return offers[
      offers.length - 1
    ];
  }, [
    messages,
    negotiationInfo
      ?.currentOfferPrice,
    negotiationInfo
      ?.currentOfferQuantity,
  ]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(Number(value || 0));

  const reloadAll = async () => {
    setLoadError(null);

    const loadedInfo =
      await fetchBaseInfo();

    if (!loadedInfo) {
      setLoadError(
        "Không thể tải cuộc trò chuyện. Vui lòng thử lại.",
      );

      return;
    }

    await fetchMessagesOnly();
  };

  const openCounterModal = () => {
    if (currentActiveOffer) {
      setCounterPriceInput(
        Number(
          currentActiveOffer.price,
        ).toLocaleString("vi-VN"),
      );

      setCounterQuantityInput(
        String(
          currentActiveOffer.quantity,
        ),
      );
    } else {
      setCounterPriceInput("");
      setCounterQuantityInput("1");
    }

    setCounterModalVisible(true);
  };

  const handlePriceChange = (
    text: string,
  ) => {
    const numericValue =
      text.replace(/\D/g, "");

    if (!numericValue) {
      setCounterPriceInput("");
      return;
    }

    setCounterPriceInput(
      Number(
        numericValue,
      ).toLocaleString("vi-VN"),
    );
  };

  const handleAcceptOffer = async (
    proposalMessageId: string,
  ) => {
    if (!negotiationId) {
      return;
    }

    try {
      setIsProcessing(true);

      await negotiationApi.acceptProposal(
        negotiationId,
        proposalMessageId,
      );

      await reloadAll();
    } catch (error: any) {
      const message =
        error?.response?.data?.error
          ?.message ||
        "Không thể chấp nhận đề xuất.";

      Platform.OS === "web"
        ? window.alert(message)
        : Alert.alert("Lỗi", message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectOffer = async (
    proposalMessageId: string,
  ) => {
    if (!negotiationId) {
      return;
    }

    try {
      setIsProcessing(true);

      await negotiationApi.rejectProposal(
        negotiationId,
        proposalMessageId,
      );

      await reloadAll();
    } catch (error: any) {
      const message =
        error?.response?.data?.error
          ?.message ||
        "Không thể từ chối đề xuất.";

      Platform.OS === "web"
        ? window.alert(message)
        : Alert.alert("Lỗi", message);
    } finally {
      setIsProcessing(false);
    }
  };

  const submitCounterOffer = async () => {
    if (!negotiationId) {
      return;
    }

    const price = Number(
      counterPriceInput.replace(/\D/g, ""),
    );

    const quantity =
      Number(counterQuantityInput) || 1;

    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {
      const message =
        "Vui lòng nhập mức giá hợp lệ.";

      Platform.OS === "web"
        ? window.alert(message)
        : Alert.alert("Lỗi", message);

      return;
    }

    try {
      setIsProcessing(true);

      await negotiationApi.counterNegotiation(
        negotiationId,
        {
          offerPrice: price,
          offerQuantity: quantity,
        },
      );

      setCounterModalVisible(false);

      await reloadAll();
    } catch (error: any) {
      const message =
        error?.response?.data?.error
          ?.message ||
        "Không thể gửi đề xuất mới.";

      Platform.OS === "web"
        ? window.alert(message)
        : Alert.alert("Lỗi", message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelNegotiation = () => {
    if (!negotiationId) {
      return;
    }

    const executeCancel = async () => {
      try {
        setIsProcessing(true);

        await negotiationApi.cancelNegotiation(
          negotiationId,
        );

        if (Platform.OS !== "web") {
          Alert.alert(
            "Thành công",
            "Đã hủy phiên thương lượng.",
          );
        }

        await reloadAll();
      } catch (error: any) {
        const message =
          error?.response?.data?.error
            ?.message ||
          "Không thể hủy giao dịch.";

        Platform.OS === "web"
          ? window.alert(message)
          : Alert.alert("Lỗi", message);
      } finally {
        setIsProcessing(false);
      }
    };

    const message =
      "Bạn có chắc chắn muốn hủy phiên thương lượng này không?";

    if (Platform.OS === "web") {
      if (window.confirm(message)) {
        void executeCancel();
      }

      return;
    }

    Alert.alert(
      "Hủy giao dịch",
      message,
      [
        {
          text: "Không",
          style: "cancel",
        },
        {
          text: "Hủy giao dịch",
          style: "destructive",
          onPress: () =>
            void executeCancel(),
        },
      ],
    );
  };

  const handleSendMessage = async () => {
    if (
      !inputText.trim() ||
      !negotiationId
    ) {
      return;
    }

    const content = inputText.trim();

    setInputText("");

    try {
      const clientMessageId =
        "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
          /[xy]/g,
          (character) => {
            const random =
              (Math.random() * 16) | 0;

            const value =
              character === "x"
                ? random
                : (random & 0x3) | 0x8;

            return value.toString(16);
          },
        );

      await messageApi.sendMessage(
        negotiationId,
        {
          messageContent: content,
          clientMessageId,
        },
      );
    } catch (error: any) {
      const message =
        error?.response?.data?.error
          ?.message ||
        "Không thể gửi tin nhắn lúc này.";

      Platform.OS === "web"
        ? window.alert(message)
        : Alert.alert("Lỗi", message);
    }
  };

  const renderProductBanner = () => (
    <TouchableOpacity
      style={styles.productBanner}
      activeOpacity={0.7}
      onPress={() => {
        if (negotiationInfo?.postId) {
          router.push({
            pathname: "/posts/[id]",
            params: {
              id: negotiationInfo.postId,
              viewOnly: "true",
            },
          });
        }
      }}
    >
      <Image
        source={{
          uri:
            negotiationInfo?.image ||
            "https://placehold.co/100x100/png",
        }}
        style={styles.productImg}
      />

      <View style={styles.productInfo}>
        <Text
          style={styles.productName}
          numberOfLines={1}
        >
          {negotiationInfo?.name}
        </Text>

        <Text
          style={styles.productSubText}
          numberOfLines={1}
        >
          {negotiationInfo?.productTypeName ||
            "Khác"}{" "}
          •{" "}
          {negotiationInfo?.city || "N/A"}
        </Text>

        <Text style={styles.productPrice}>
          Giá niêm yết:{" "}
          <Text style={styles.boldText}>
            {formatCurrency(
              negotiationInfo?.basePrice,
            )}
          </Text>
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={20}
        color={COLORS.textLight}
      />
    </TouchableOpacity>
  );

  const renderHeader = () => {
    const partnerName =
      negotiationInfo?.partnerName ||
      "Đối tác giao dịch";

    const avatarUri = getRobustAvatar(
      negotiationInfo?.partnerAvatar,
      partnerName,
    );

    const centerContent = (
      <View style={styles.headerCenter}>
        <Image
          source={{ uri: avatarUri }}
          style={styles.headerAvatar}
        />

        <View
          style={styles.headerTextBlock}
        >
          <Text
            style={styles.headerName}
            numberOfLines={1}
          >
            {partnerName}
          </Text>
        </View>
      </View>
    );

    const rightContent = (
      <TouchableOpacity
        style={styles.headerIcon}
        onPress={() =>
          void reloadAll()
        }
      >
        <Ionicons
          name="reload"
          size={20}
          color={COLORS.primary}
        />
      </TouchableOpacity>
    );

    return (
      <Header
        showBack
        centerContent={centerContent}
        rightContent={rightContent}
      />
    );
  };

  const renderMessage = ({
    item,
  }: {
    item: any;
  }) => {
    const isMe = item.sender === "me";

    if (
      item.type === "system_agreed"
    ) {
      const avatarUri = getRobustAvatar(
        item.avatar,
        item.accepterName,
      );

      return (
        <View
          style={
            styles.systemAgreedContainer
          }
        >
          <Image
            source={{ uri: avatarUri }}
            style={
              styles.systemAgreedAvatar
            }
          />

          <Text
            style={
              styles.systemAgreedText
            }
          >
            {item.text}
          </Text>
        </View>
      );
    }

    const avatarComponent = (
      <Image
        source={{
          uri: getRobustAvatar(
            item.avatar,
            item.senderName,
          ),
        }}
        style={styles.chatAvatar}
      />
    );

    const renderContent = () => {
      if (
        item.type === "agreement_card"
      ) {
        return (
          <View
            style={[
              styles.offerCard,
              styles.fullWidth,
            ]}
          >
            <View
              style={styles.offerHeader}
            >
              <Ionicons
                name="document-text"
                size={18}
                color={COLORS.primary}
                style={styles.offerIcon}
              />

              <Text
                style={styles.offerTitle}
              >
                Hợp đồng giao dịch
              </Text>
            </View>

            <View
              style={
                styles.offerPriceBox
              }
            >
              <Text
                style={
                  styles.offerPriceValue
                }
              >
                {formatCurrency(
                  item.agreementData
                    ?.finalPrice,
                )}
              </Text>

              <Text
                style={
                  styles.offerQuantity
                }
              >
                Số lượng:{" "}
                {
                  item.agreementData
                    ?.quantity
                }
              </Text>
            </View>

            {item.isLatestAgreement ? (
              <TouchableOpacity
                style={
                  styles.viewAgreementBtnFill
                }
                onPress={() => {
                  router.push({
                    pathname:
                      "/agreements/preview",
                    params: {
                      agreementId: String(
                        item.agreementId,
                      ),
                      negotiationId: String(
                        negotiationId,
                      ),
                    },
                  });
                }}
              >
                <Text
                  style={
                    styles.viewAgreementBtnFillText
                  }
                >
                  Xem chi tiết
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.outdatedOfferText}>(Hợp đồng đã được cập nhật)</Text>
            )}
          </View>
        );
      }

      if (item.type === "offer") {
        const isLatestOffer =
          currentActiveOffer?.id ===
          item.id;

        const negotiationStatus =
          negotiationInfo?.negotiationStatus;

        const defaultTitle = isMe
          ? "Bạn đề xuất"
          : "Đối tác đề xuất";

        const title = item.text?.trim()
          ? item.text
          : defaultTitle;

        return (
          <View
            style={[
              styles.offerCard,
              (!isLatestOffer ||
                item.status ===
                  "superseded") &&
                styles.outdatedCard,
            ]}
          >
            <View
              style={styles.offerHeader}
            >
              <Ionicons
                name="pricetag"
                size={18}
                color={COLORS.primary}
                style={styles.offerIcon}
              />

              <Text
                style={styles.offerTitle}
              >
                {title}
              </Text>
            </View>

            <View
              style={
                styles.offerPriceBox
              }
            >
              <Text

                style={
                  styles.offerPriceValue
                }
              >
                {formatCurrency(
                  item.price,
                )}
              </Text>

              <Text
                style={
                  styles.offerQuantity
                }
              >
                Số lượng:{" "}
                {item.quantity}
              </Text>
            </View>

            {isLatestOffer &&
              negotiationStatus ===
                "Open" &&
              item.status ===
                "pending" &&
              (isMe ? (
                <Text
                  style={
                    styles.pendingText
                  }
                >
                  Đang chờ đối tác phản
                  hồi...
                </Text>
              ) : (
                <View
                  style={
                    styles.actionBlock
                  }
                >
                  <View
                    style={
                      styles.offerActionRow
                    }
                  >
                    <TouchableOpacity
                      style={
                        styles.rejectBtn
                      }
                      onPress={() =>
                        void handleRejectOffer(
                          item.id,
                        )
                      }
                      disabled={
                        isProcessing
                      }
                    >
                      <Text
                        style={
                          styles.rejectBtnText
                        }
                      >
                        Từ chối
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={
                        styles.acceptBtn
                      }
                      onPress={() =>
                        void handleAcceptOffer(
                          item.id,
                        )
                      }
                      disabled={
                        isProcessing
                      }
                    >
                      <Text
                        style={
                          styles.acceptBtnText
                        }
                      >
                        Đồng ý
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={
                      styles.counterBtn
                    }
                    onPress={
                      openCounterModal
                    }
                    disabled={
                      isProcessing
                    }
                  >
                    <Text
                      style={
                        styles.counterBtnText
                      }
                    >
                      Đề xuất giá khác
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}

            {item.status ===
              "accepted" &&
              (negotiationStatus ===
                "Accepted" ||
                negotiationStatus ===
                  "Agreed") &&
              !agreementPreview?.hasAgreement &&
              agreementPreview?.canCreate && (
                <View
                  style={
                    styles.agreedBlock
                  }
                >
                  <TouchableOpacity
                    style={
                      styles.inlineCreateFormBtn
                    }
                    onPress={() => {
                      router.push({
                        pathname:
                          "/agreements/form",
                        params: {
                          negotiationId:
                            String(
                              negotiationId,
                            ),
                        },
                      });
                    }}
                  >
                    <Ionicons
                      name="create-outline"
                      size={18}
                      color={COLORS.white}
                      style={
                        styles.offerIcon
                      }
                    />

                    <Text
                      style={
                        styles.inlineCreateFormBtnText
                      }
                    >
                      Tạo hợp đồng
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

            {item.status ===
              "rejected" && (
              <View
                style={
                  styles.statusBadgeError
                }
              >
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={COLORS.white}
                />

                <Text
                  style={
                    styles.statusBadgeText
                  }
                >
                  Đã từ chối đề xuất này
                </Text>
              </View>
            )}

            {isLatestOffer &&
              negotiationStatus ===
                "Cancelled" && (
                <View
                  style={
                    styles.statusBadgeError
                  }
                >
                  <Ionicons
                    name="close-circle"
                    size={16}
                    color={COLORS.white}
                  />

                  <Text
                    style={
                      styles.statusBadgeText
                    }
                  >
                    Phiên thương lượng
                    đã hủy
                  </Text>
                </View>
              )}

            {(!isLatestOffer ||
              item.status ===
                "superseded") &&
              item.status !==
                "rejected" && (
                <Text
                  style={
                    styles.outdatedOfferText
                  }
                >
                  (Đề xuất cũ)
                </Text>
              )}
          </View>
        );
      }

      return (
        <View
          style={[
            styles.bubble,
            isMe
              ? styles.bubbleMe
              : styles.bubbleThem,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isMe
                ? styles.messageTextMe
                : styles.messageTextThem,
            ]}
          >
            {item.text}
          </Text>
        </View>
      );
    };

    return (
      <View
        style={[
          styles.messageWrapper,
          isMe
            ? styles.messageWrapperMe
            : styles.messageWrapperThem,
        ]}
      >
        {!isMe && avatarComponent}

        <View
          style={[
            styles.messageContentBlock,
            item.type === "offer" ||
            item.type ===
              "agreement_card"
              ? styles.cardMessageWidth
              : styles.textMessageWidth,
          ]}
        >
          {renderContent()}

          <View
            style={[
              styles.timeRow,
              isMe
                ? styles.timeRowMe
                : styles.timeRowThem,
            ]}
          >
            <Text
              style={styles.timeText}
            >
              {item.time}
            </Text>

            {isMe && (
              <Ionicons
                name={
                  item.isRead
                    ? "checkmark-done"
                    : "checkmark"
                }
                size={14}
                color={
                  item.isRead
                    ? COLORS.primary
                    : COLORS.textLight
                }
                style={styles.readIcon}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <KeyboardAvoidingView
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : "height"
        }
        style={styles.mobileWrapper}
      >
        {isAuthLoading || isLoading ? (
          <View
            style={
              styles.loadingContainer
            }
          >
            <ActivityIndicator
              size="large"
              color={COLORS.primary}
            />

            <Text
              style={styles.loadingText}
            >
              Đang tải cuộc trò
              chuyện...
            </Text>
          </View>
        ) : loadError ||
          !negotiationInfo ? (
          <View
            style={
              styles.loadingContainer
            }
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={42}
              color={COLORS.textLight}
            />

            <Text
              style={
                styles.loadErrorText
              }
            >
              {loadError ||
                "Không thể tải cuộc trò chuyện."}
            </Text>

            {negotiationId &&
            currentUserId ? (
              <TouchableOpacity
                style={
                  styles.retryButton
                }
                onPress={() =>
                  void initialLoad()
                }
              >
                <Text
                  style={
                    styles.retryButtonText
                  }
                >
                  Thử lại
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={
                  styles.retryButton
                }
                onPress={() =>
                  router.back()
                }
              >
                <Text
                  style={
                    styles.retryButtonText
                  }
                >
                  Quay lại
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {renderHeader()}
            {renderProductBanner()}

            <FlatList
              data={messages}
              keyExtractor={(item) =>
                String(item.id)
              }
              renderItem={
                renderMessage
              }
              contentContainerStyle={
                styles.chatList
              }
              showsVerticalScrollIndicator={
                false
              }
              ListHeaderComponent={
                <Text
                  style={
                    styles.dateSeparator
                  }
                >
                  Giao dịch bắt đầu
                </Text>
              }
            />

            <View
              style={
                styles.inputContainer
              }
            >
              <TouchableOpacity
                style={styles.attachBtn}
                onPress={() =>
                  setActionMenuVisible(
                    true,
                  )
                }
              >
                <Ionicons
                  name="add-circle-outline"
                  size={28}
                  color={
                    COLORS.primary
                  }
                />
              </TouchableOpacity>

              <TextInput
                style={styles.textInput}
                placeholder="Nhập tin nhắn..."
                placeholderTextColor={
                  COLORS.textLight
                }
                value={inputText}
                onChangeText={
                  setInputText
                }
                onSubmitEditing={() =>
                  void handleSendMessage()
                }
                blurOnSubmit={false}
              />

              <TouchableOpacity
                style={styles.sendBtn}
                onPress={() =>
                  void handleSendMessage()
                }
              >
                <Ionicons
                  name="send"
                  size={18}
                  color={COLORS.white}
                />
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>

      <Modal
        visible={isActionMenuVisible}
        transparent
        animationType="fade"
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() =>
            setActionMenuVisible(false)
          }
        >
          <View
            style={
              styles.menuSheetContent
            }
          >
            {negotiationInfo?.negotiationStatus ===
              "Open" && (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setActionMenuVisible(
                      false,
                    );

                    openCounterModal();
                  }}
                >
                  <Ionicons
                    name="pricetag-outline"
                    size={22}
                    color={
                      COLORS.primary
                    }
                  />

                  <Text
                    style={
                      styles.menuItemText
                    }
                  >
                    Đề xuất giá mới
                  </Text>
                </TouchableOpacity>

                <View
                  style={
                    styles.menuDivider
                  }
                />
              </>
            )}

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setActionMenuVisible(
                  false,
                );

                handleCancelNegotiation();
              }}
            >
              <Ionicons
                name="close-circle-outline"
                size={22}
                color={COLORS.error}
              />

              <Text
                style={[
                  styles.menuItemText,
                  styles.errorText,
                ]}
              >
                Hủy giao dịch
              </Text>
            </TouchableOpacity>

            {agreementPreview?.canCreate &&
              !agreementPreview?.hasAgreement && (
                <>
                  <View
                    style={
                      styles.menuDivider
                    }
                  />

                  <TouchableOpacity
                    style={
                      styles.menuItem
                    }
                    onPress={() => {
                      setActionMenuVisible(
                        false,
                      );

                      router.push({
                        pathname:
                          "/agreements/form",
                        params: {
                          negotiationId:
                            String(
                              negotiationId,
                            ),
                        },
                      });
                    }}
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={22}
                      color={
                        COLORS.primary
                      }
                    />

                    <Text
                      style={
                        styles.menuItemText
                      }
                    >
                      Tạo hợp đồng
                    </Text>
                  </TouchableOpacity>
                </>
              )}

            {agreementPreview?.hasAgreement && (
              <>
                <View
                  style={
                    styles.menuDivider
                  }
                />

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setActionMenuVisible(
                      false,
                    );

                    router.push({
                      pathname:
                        "/agreements/preview",
                      params: {
                        agreementId: String(
                          agreementPreview.agreementId,
                        ),
                        negotiationId:
                          String(
                            negotiationId,
                          ),
                      },
                    });
                  }}
                >
                  <Ionicons
                    name="eye-outline"
                    size={22}
                    color={
                      COLORS.primary
                    }
                  />

                  <Text
                    style={
                      styles.menuItemText
                    }
                  >
                    Xem chi tiết hợp đồng
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={isCounterModalVisible}
        transparent
        animationType="slide"
      >
        <View
          style={styles.modalOverlay}
        >
          <View
            style={styles.modalContent}
          >
            <View
              style={styles.modalHeader}
            >
              <Text
                style={styles.modalTitle}
              >
                Đề xuất mức giá mới
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setCounterModalVisible(
                    false,
                  )
                }
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={COLORS.text}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View>
                <Text style={styles.inputLabel}>
                  Giá đề xuất (VNĐ) <Text style={{ color: COLORS.error }}>*</Text>
                </Text>
                <View style={styles.inputGroup}>
                  <TextInput
                    style={styles.priceInput}
                    placeholder={
                      currentActiveOffer
                        ? Number(currentActiveOffer.price).toLocaleString("vi-VN")
                        : "Ví dụ: 1.500.000"
                    }
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    value={counterPriceInput}
                    onChangeText={handlePriceChange}
                    selectTextOnFocus
                    autoFocus
                  />
                  <Text style={styles.currencyLabel}>VNĐ</Text>
                </View>
              </View>

              <View>
                <Text style={styles.inputLabel}>
                  Số lượng <Text style={{ color: COLORS.error }}>*</Text>
                </Text>
                <View style={[styles.inputGroup, styles.quantityInputGroup]}>
                  <TextInput
                    style={[styles.priceInput, styles.quantityInput]}
                    placeholder={
                      currentActiveOffer
                        ? String(currentActiveOffer.quantity)
                        : "1"
                    }
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    value={counterQuantityInput}
                    onChangeText={setCounterQuantityInput}
                    selectTextOnFocus
                  />
                  <Text style={styles.currencyLabel}>SL</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.submitOfferBtn}
                onPress={() => void submitCounterOffer()}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.submitOfferText}>Gửi đề xuất</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.border,
    alignItems: "center",
  },

  mobileWrapper: {
    flex: 1,
    width: "100%",
    maxWidth: 480,
    backgroundColor: COLORS.background,
    ...(Platform.OS === "web"
      ? ({
          boxShadow:
            "0px 0px 20px rgba(0,0,0,0.1)",
        } as any)
      : {}),
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },

  loadingText: {
    marginTop: 12,
    color: COLORS.textLight,
    fontSize: 14,
  },

  loadErrorText: {
    marginTop: 14,
    color: COLORS.textLight,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  retryButton: {
    marginTop: 18,
    minWidth: 112,
    height: 42,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
  },

  retryButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "700",
  },

  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  headerTextBlock: {
    flex: 1,
    justifyContent: "center",
  },

  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  headerName: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },

  headerIcon: {
    padding: 8,
  },

  productBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    elevation: 2,
  },

  productImg: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginRight: 10,
  },

  productInfo: {
    flex: 1,
  },

  productName: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
  },

  productSubText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },

  productPrice: {
    fontSize: 13,
    color: COLORS.textLight,
    fontWeight: "600",
    marginTop: 4,
  },

  boldText: {
    color: COLORS.text,
    fontWeight: "bold",
  },

  chatList: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    paddingBottom: 24,
  },

  dateSeparator: {
    alignSelf: "center",
    backgroundColor: "#E9F0F0",
    color: COLORS.textLight,
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
  },

  systemAgreedContainer: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#E9F0F0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },

  systemAgreedAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginRight: 8,
  },

  systemAgreedText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "600",
  },

  messageWrapper: {
    flexDirection: "row",
    marginBottom: 16,
    alignItems: "flex-start",
    width: "100%",
  },

  messageWrapperMe: {
    justifyContent: "flex-end",
  },

  messageWrapperThem: {
    justifyContent: "flex-start",
  },

  chatAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    marginTop: 2,
  },

  messageContentBlock: {},

  cardMessageWidth: {
    width: "75%",
  },

  textMessageWidth: {
    maxWidth: "78%",
  },

  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },

  bubbleMe: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },

  bubbleThem: {
    backgroundColor: "#EAEAEA",
    borderBottomLeftRadius: 4,
  },

  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },

  messageTextMe: {
    color: COLORS.white,
  },

  messageTextThem: {
    color: COLORS.text,
  },

  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },

  timeRowMe: {
    justifyContent: "flex-end",
  },

  timeRowThem: {
    justifyContent: "flex-start",
  },

  timeText: {
    fontSize: 11,
    color: COLORS.textLight,
  },

  readIcon: {
    marginLeft: 4,
    marginTop: 1,
  },

  offerCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    width: "100%",
  },

  fullWidth: {
    width: "100%",
  },

  outdatedCard: {
    opacity: 0.6,
  },

  offerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  offerIcon: {
    marginRight: 6,
  },

  offerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },

  offerPriceBox: {
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: "center",
  },

  offerPriceValue: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.primary,
  },

  offerQuantity: {
    color: COLORS.textLight,
    marginTop: 4,
    fontSize: 13,
  },

  actionBlock: {
    marginTop: 4,
  },

  offerActionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },

  rejectBtn: {
    flex: 1,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.error,
    backgroundColor: COLORS.white,
  },

  rejectBtnText: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: "700",
  },

  acceptBtn: {
    flex: 1,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },

  acceptBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "700",
  },

  counterBtn: {
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#E9F0F0",
  },

  counterBtnText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "700",
  },

  pendingText: {
    fontSize: 13,
    color: COLORS.textLight,
    fontStyle: "italic",
    textAlign: "center",
  },

  outdatedOfferText: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: "center",
    marginTop: 8,
  },

  statusBadgeError: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.error,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },

  statusBadgeText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 13,
  },

  agreedBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },

  inlineCreateFormBtn: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  inlineCreateFormBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "bold",
  },

  viewAgreementBtnFill: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },

  viewAgreementBtnFillText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "bold",
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  attachBtn: {
    marginRight: 8,
    padding: 4,
  },

  textInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    textAlignVertical: "center",
    ...(Platform.OS === "web"
      ? ({
          outlineStyle: "none",
          lineHeight: "40px",
          paddingTop: 0,
          paddingBottom: 0,
        } as any)
      : {
          paddingVertical: 0,
        }),
  },

  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },

  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 300,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },

  modalBody: {
    gap: 16,
  },

  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
  },

  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: COLORS.background,
  },

  quantityInputGroup: {
    marginBottom: 24,
  },

  priceInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.primary,
    ...(Platform.OS === "web"
      ? ({
          outlineStyle: "none",
        } as any)
      : {}),
  },

  quantityInput: {
    fontSize: 16,
  },

  currencyLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textLight,
    marginLeft: 8,
  },

  submitOfferBtn: {
    height: 50,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  submitOfferText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },

  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-end",
  },

  menuSheetContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom:
      Platform.OS === "ios" ? 40 : 20,
  },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
  },

  menuItemText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginLeft: 12,
  },

  errorText: {
    color: COLORS.error,
  },

  menuDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
});