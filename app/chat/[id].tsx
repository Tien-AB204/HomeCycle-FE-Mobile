import { DEFAULT_AVATAR_URI } from "../../src/utils/avatar";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
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
  Keyboard,
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
import { ModalBackdrop, ModalSurface } from "../../src/components/shared/ModalBackdrop";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import { useChatRealtime } from "../../src/contexts/ChatRealtimeContext";
import apiClient from "../../src/services/apis/axiosClient";
import conversationApi from "../../src/services/apis/conversationApi";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";
import { compareChatTimeline } from "../../src/utils/chatTimeline";
import { normalizeTargetType } from "../../src/services/notifications/notificationTargets";
import { getPosterRoleLabel, isBuyPostType } from "../../src/utils/postType";
import { devLog } from "../../src/utils/devLog";
import { localizeSystemText } from "../../src/utils/localizeSystemText";
import { useGuardedRouter } from "../../src/utils/tapGuard";

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

const orderApi = {
  getByAgreement: (agreementId: string) =>
    apiClient
      .get(`/orders/agreement/${agreementId}`)
      .then((response) => response.data),

  getDetail: (orderId: string) =>
    apiClient
      .get(`/orders/${orderId}`)
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

  return DEFAULT_AVATAR_URI;
};

const getNegotiationStatusLabel = (status: unknown) => {
  const normalized = String(status ?? "").trim().toLowerCase();

  const labels: Record<string, string> = {
    "1": "Đang thương lượng",
    open: "Đang thương lượng",
    "2": "Đã thống nhất",
    agreed: "Đã thống nhất",
    "3": "Chờ ký hợp đồng",
    agreementpending: "Chờ ký hợp đồng",
    "4": "Hoàn tất",
    completed: "Hoàn tất",
    "5": "Đã đóng",
    closed: "Đã đóng",
    "6": "Hết hạn",
    expired: "Hết hạn",
    "7": "Đã hủy",
    cancelled: "Đã hủy",
  };

  return labels[normalized] || "Phiên thương lượng";
};

const getPostTypeLabel = (value: unknown) => {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized === "1" || normalized === "sell") {
    return "Tin bán";
  }

  if (normalized === "2" || normalized === "buy") {
    return "Tin mua";
  }

  return "";
};

const getTransactionRoleLabels = (userId: unknown, context: any) => {
  const normalizedUserId = String(userId ?? "").trim().toLowerCase();
  if (!normalizedUserId) return [];

  const isSeller =
    normalizedUserId === String(context?.sellerId ?? "").trim().toLowerCase();
  const isBuyer =
    normalizedUserId === String(context?.buyerId ?? "").trim().toLowerCase();
  const isPoster =
    normalizedUserId ===
    String(context?.postOwnerId ?? "").trim().toLowerCase();

  // A poster gets ONE merged label ("Người đăng bài bán"/"mua") instead of
  // the old "Người bán · Người đăng bài" composite; the non-poster
  // counterparty keeps a plain role label.
  if (isPoster) {
    return [getPosterRoleLabel(isBuyPostType(context?.postType))];
  }

  return [isSeller ? "Người bán" : isBuyer ? "Người mua" : null].filter(
    (label): label is string => Boolean(label),
  );
};

const normalizeAgreementUiText = (
  text?: string | null,
  actorName?: string | null,
) => {
  let normalized = (
    text || "Đã tạo hợp đồng giao dịch, vui lòng kiểm tra và xác nhận."
  )
    .replace(/\bagreement\b/gi, "hợp đồng")
    .replace(/đơn xác nhận/gi, "hợp đồng")
    .replace(/thỏa thuận mua bán/gi, "hợp đồng giao dịch");

  const resolvedActorName = String(actorName || "").trim();

  if (resolvedActorName) {
    normalized = normalized.replace(
      /^(Người bán|Người mua)\b/i,
      resolvedActorName,
    );

    if (/^Đã tạo hợp đồng giao dịch\b/i.test(normalized)) {
      normalized = `${resolvedActorName} đã tạo hợp đồng giao dịch, vui lòng kiểm tra và xác nhận.`;
    }
  }

  return localizeSystemText(
    normalized,
    "Cập nhật hợp đồng giao dịch.",
  );
};

// Bản xem trước một dòng của tin nhắn mới nhất cho bộ chọn phiên. Dùng chung cho
// kết quả GET /Messages (PageSize=1) và payload realtime; không lộ enum/DTO/JSON.
const NO_MESSAGE_PREVIEW = "Chưa có tin nhắn";
const toSingleLine = (value: unknown) =>
  String(value ?? "").replace(/\s+/g, " ").trim();
const looksTechnical = (text: string) =>
  /^[[{].*[\]}]$/s.test(text) ||
  /exception|stack ?trace|nullreference|traceback|\bdto\b/i.test(text);
const formatPreviewCurrency = (value: number) =>
  `${Math.round(value).toLocaleString("vi-VN")}đ`;
const buildMessagePreview = (message: any): string => {
  if (!message || typeof message !== "object") return NO_MESSAGE_PREVIEW;
  const rawType = message.messageType ?? message.MessageType;
  const type = String(rawType ?? "").trim().toLowerCase();
  const content = toSingleLine(message.messageContent ?? message.MessageContent);
  const offerPrice = Number(message.offerPrice ?? message.OfferPrice ?? 0);
  const offerQuantity = Number(message.offerQuantity ?? message.OfferQuantity ?? 0);

  if (type === "media" || type === "1" || (!content && (message.mediaUrl ?? message.MediaUrl))) {
    return "[Hình ảnh]";
  }
  if (type === "offer" || type === "counteroffer" || type === "2" || type === "3" || offerPrice > 0) {
    return offerPrice > 0
      ? `Đề nghị ${formatPreviewCurrency(offerPrice)} × ${offerQuantity > 0 ? offerQuantity : 1}`
      : "Đề nghị mới";
  }
  if (type === "system" || type === "4") {
    const text = normalizeSystemUiText(content);
    return looksTechnical(text) ? "Cập nhật phiên thương lượng." : text;
  }
  if (type === "agreement" || type === "5") {
    const text = toSingleLine(normalizeAgreementUiText(content));
    return looksTechnical(text) ? "Cập nhật hợp đồng giao dịch." : text;
  }
  if (!content) return message.mediaUrl || message.MediaUrl ? "[Hình ảnh]" : "[Tin nhắn]";
  return looksTechnical(content) ? "[Tin nhắn]" : content;
};

const normalizeSystemUiText = (text?: string | null) => {
  const normalized = String(text || "").trim();

  if (
    /thanh toán thành công/i.test(normalized) &&
    /đơn hàng đã được tạo/i.test(normalized)
  ) {
    return "Hợp đồng đã được thanh toán. Đơn hàng và lịch hẹn đã được tạo.";
  }

  return localizeSystemText(
    normalized,
    "Cập nhật phiên thương lượng.",
  );
};

const isPaymentCompletedSystemText = (text?: string | null) => {
  const normalized = String(text || "")
    .trim()
    .toLocaleLowerCase("vi-VN");

  return (
    (
      normalized.includes("thanh toán thành công") &&
      normalized.includes("đơn hàng")
    ) ||
    (
      normalized.includes("hợp đồng đã được thanh toán") &&
      normalized.includes("đơn hàng")
    )
  );
};

const isBilateralSystemText = (text?: string | null) => {
  const normalized = String(text || "")
    .trim()
    .toLocaleLowerCase("vi-VN");

  return (
    normalized.includes("cả hai bên") ||
    normalized.includes("hai bên đã xác nhận")
  );
};

type AgreementTimelineKind = "created" | "updated" | "confirmed";

const getAgreementTimelineKind = (text?: string | null): AgreementTimelineKind => {
  const normalized = String(text || "")
    .trim()
    .toLocaleLowerCase("vi-VN");

  if (
    normalized.includes("cả hai bên") &&
    normalized.includes("xác nhận")
  ) {
    return "confirmed";
  }

  if (
    normalized.includes("đã tạo") ||
    normalized.includes("tạo thỏa thuận")
  ) {
    return "created";
  }

  return "updated";
};

const getAgreementTimelineTitle = (kind?: AgreementTimelineKind) => {
  switch (kind) {
    case "created":
      return "Hợp đồng đã tạo";
    case "confirmed":
      return "Hợp đồng đã xác nhận";
    default:
      return "Hợp đồng đã cập nhật";
  }
};

const getTimelineTime = (value: unknown) => {
  const time = new Date(String(value || "")).getTime();
  return Number.isFinite(time) ? time : 0;
};

const MESSAGE_PAGE_SIZE = 50;

type TimelineMergeAuthority = "authoritative" | "backfill";

const mergeTimelineMessages = (
  existing: any[],
  incoming: any[],
  authority: TimelineMergeAuthority,
) => {
  const incomingById = new Map(
    incoming.map((message) => [String(message.id), message]),
  );
  const existingIds = new Set(existing.map((message) => String(message.id)));
  const merged = existing.map((message) =>
    authority === "authoritative"
      ? incomingById.get(String(message.id)) || message
      : message,
  );

  incoming.forEach((message) => {
    if (!existingIds.has(String(message.id))) merged.push(message);
  });

  return merged.sort(compareChatTimeline);
};

const markLatestAgreementCard = (items: any[]) => {
  let latestAgreementCardIndex = -1;
  items.forEach((item, index) => {
    if (item.type === "agreement_card") latestAgreementCardIndex = index;
  });

  return items.map((item, index) =>
    item.type === "agreement_card"
      ? { ...item, isLatestAgreement: index === latestAgreementCardIndex }
      : item,
  );
};

const applyTimelineGrouping = (items: any[]) => {
  const grouped = [...items].sort(compareChatTimeline).map((item) => ({
    ...item,
    groupWithPrevious: false,
    groupWithNext: false,
  }));
  const groupingWindowMs = 5 * 60 * 1000;

  const canGroupPair = (first: any, second: any) => {
    if (!first || !second || first.type !== second.type) {
      return false;
    }

    if (first.type === "text") {
      if (first.sender !== second.sender) {
        return false;
      }
    } else if (first.type === "system") {
      if (first.hideAvatar || second.hideAvatar) {
        return false;
      }

      const firstActor = String(
        first.actorName || first.accepterName || "",
      ).trim();
      const secondActor = String(
        second.actorName || second.accepterName || "",
      ).trim();

      if (!firstActor || firstActor !== secondActor) {
        return false;
      }
    } else {
      return false;
    }

    const firstTime = getTimelineTime(first.createdAt);
    const secondTime = getTimelineTime(second.createdAt);

    return (
      firstTime > 0 &&
      secondTime > 0 &&
      secondTime >= firstTime &&
      secondTime - firstTime <= groupingWindowMs
    );
  };

  for (let index = 1; index < grouped.length; index += 1) {
    if (canGroupPair(grouped[index - 1], grouped[index])) {
      grouped[index - 1].groupWithNext = true;
      grouped[index].groupWithPrevious = true;
    }
  }

  return grouped;
};

export default function ChatDetailScreen() {
  const router = useGuardedRouter();
  const insets = useSafeAreaInsets();

  const [isKeyboardVisible, setIsKeyboardVisible] =
    useState(false);

  const composerBottomInset =
    Platform.OS === "android"
      ? isKeyboardVisible
        ? 40
        : 12
      : Math.max(insets.bottom, 10);

  const params = useLocalSearchParams();

  const routeId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;
  const requestedNegotiationId = Array.isArray(
    params.negotiationId,
  )
    ? params.negotiationId[0]
    : params.negotiationId;

  const { user, isLoading: isAuthLoading } = useAuth();

  const {
    connection,
    connectionStatus,
    reconnectVersion,
    joinNegotiation,
    leaveNegotiation,
    joinConversation,
    leaveConversation,
    refreshConversationSummaries,
  } = useChatRealtime();

  const currentUserId = user?.userId || user?.id;
  const isWaitingForNetwork =
    connectionStatus === "reconnecting" ||
    connectionStatus === "disconnected";

  const [conversationId, setConversationId] =
    useState<string | null>(null);
  const [negotiationId, setNegotiationId] =
    useState<string | null>(null);
  const [isResolvingRoute, setIsResolvingRoute] =
    useState(true);

  const [negotiationInfo, setNegotiationInfo] =
    useState<any>(null);
  const [conversationNegotiations, setConversationNegotiations] =
    useState<any[]>([]);
  const [isNegotiationPickerVisible, setNegotiationPickerVisible] =
    useState(false);
  const [isLoadingNegotiations, setIsLoadingNegotiations] =
    useState(false);
  const [negotiationLabels, setNegotiationLabels] =
    useState<Record<string, string>>({});
  // Xem trước tin nhắn mới nhất theo negotiationId (nguồn: GET /Messages PageSize=1,
  // realtime, hoặc trang 1 của phiên đang mở). lastMessageAt dùng để phát hiện cũ.
  const [negotiationPreviews, setNegotiationPreviews] =
    useState<Record<string, string>>({});
  const previewCacheRef = useRef<
    Map<string, { text: string; lastMessageAt: number | null; resolved: boolean }>
  >(new Map());
  const stalePreviewIdsRef = useRef<Set<string>>(new Set());
  const [isPreparingPicker, setIsPreparingPicker] = useState(false);
  const pickerPrepareInFlightRef = useRef(false);
  const pickerGenerationRef = useRef(0);

  const negotiationInfoRef = useRef<any>(null);
  // Lỗi gần nhất của fetchBaseInfo để hiển thị thông điệp BE thay vì chữ cố định.
  const baseInfoErrorRef = useRef<unknown>(null);
  const isScreenFocusedRef = useRef(false);
  const processedRealtimeMessageIdsRef =
    useRef<Set<string>>(new Set());
  const readRequestInFlightRef = useRef(false);
  const negotiationActionInFlightRef = useRef<string | null>(null);
  const messageSendInFlightRef = useRef(false);
  const activeReadTargetKeyRef = useRef<string | null>(null);
  const pendingReadTargetRef = useRef<{
    conversationId?: string | null;
    negotiationId?: string | null;
  } | null>(null);
  const hydratedPostIdsRef = useRef<Set<string>>(new Set());
  const focusedRouteLoadKeyRef = useRef<string | null>(null);
  const messageListRef = useRef<FlatList<any>>(null);
  const shouldScrollToLatestRef = useRef(true);
  const animateNextScrollToLatestRef = useRef(false);
  const isNearLatestRef = useRef(true);
  const scrollRetryTimersRef =
    useRef<ReturnType<typeof setTimeout>[]>([]);
  const messagePageStateRef = useRef({
    generation: 0,
    nextPage: 2,
    hasOlderMessages: true,
    loadedPages: new Set<number>(),
    inFlightPages: new Set<number>(),
    loadedRawMessageIds: new Set<string>(),
  });

  const clearScheduledScrolls = useCallback(() => {
    scrollRetryTimersRef.current.forEach((timer) =>
      clearTimeout(timer),
    );
    scrollRetryTimersRef.current = [];
  }, []);

  const scrollToLatest = useCallback(
    (animated = false) => {
      clearScheduledScrolls();
      animateNextScrollToLatestRef.current = false;
      isNearLatestRef.current = true;

      const performScroll = (useAnimation: boolean) => {
        requestAnimationFrame(() => {
          messageListRef.current?.scrollToEnd({
            animated: useAnimation,
          });
        });
      };

      performScroll(animated);

      [80, 220, 500].forEach((delay) => {
        const timer = setTimeout(() => {
          performScroll(false);
        }, delay);

        scrollRetryTimersRef.current.push(timer);
      });

      const settleTimer = setTimeout(() => {
        shouldScrollToLatestRef.current = false;
        scrollRetryTimersRef.current = [];
      }, 650);

      scrollRetryTimersRef.current.push(settleTimer);
    },
    [clearScheduledScrolls],
  );

  useEffect(
    () => () => {
      clearScheduledScrolls();
    },
    [clearScheduledScrolls],
  );

  const [messages, setMessages] = useState<any[]>([]);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(true);

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

  const [
    revealedSystemMessageIds,
    setRevealedSystemMessageIds,
  ] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setConversationId(null);
    setNegotiationId(null);
    setNegotiationInfo(null);
    negotiationInfoRef.current = null;
    processedRealtimeMessageIdsRef.current.clear();
    messagePageStateRef.current = {
      generation: messagePageStateRef.current.generation + 1,
      nextPage: 2,
      hasOlderMessages: true,
      loadedPages: new Set(),
      inFlightPages: new Set(),
      loadedRawMessageIds: new Set(),
    };
    setMessages([]);
    setIsLoadingOlderMessages(false);
    setHasOlderMessages(true);
    setAgreementPreview(null);
    setRevealedSystemMessageIds(new Set());
    setLoadError(null);
    setNegotiationPickerVisible(false);
    // Kết quả chuẩn bị bộ chọn của phiên/cuộc trò chuyện cũ không được áp dụng nữa.
    pickerGenerationRef.current += 1;
    pickerPrepareInFlightRef.current = false;
    setIsPreparingPicker(false);
    shouldScrollToLatestRef.current = true;
    animateNextScrollToLatestRef.current = false;
    isNearLatestRef.current = true;
    setIsResolvingRoute(true);

    return () => {
      messagePageStateRef.current.generation += 1;
    };
  }, [routeId, requestedNegotiationId]);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    const showSubscription =
      Keyboard.addListener(
        "keyboardDidShow",
        () => {
          setIsKeyboardVisible(true);
        },
      );

    const hideSubscription =
      Keyboard.addListener(
        "keyboardDidHide",
        () => {
          setIsKeyboardVisible(false);
        },
      );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const resolveRouteContext = useCallback(async () => {
    if (!routeId || !currentUserId) {
      return null;
    }

    setIsResolvingRoute(true);
    setLoadError(null);

    try {
      try {
        const conversationResponse =
          await conversationApi.getConversationById(
            String(routeId),
          );

        const conversation =
          conversationResponse?.data ||
          conversationResponse;

        const resolvedConversationId = String(
          conversation?.conversationId ||
            routeId,
        );
        const resolvedNegotiationId = String(
          requestedNegotiationId ||
            conversation?.latestNegotiationId ||
            "",
        );

        if (!resolvedNegotiationId) {
          setLoadError(
            "Cuộc trò chuyện này chưa có phiên thương lượng để mở.",
          );
          return null;
        }

        setConversationId(resolvedConversationId);
        setNegotiationId(resolvedNegotiationId);

        return {
          conversationId: resolvedConversationId,
          negotiationId: resolvedNegotiationId,
        };
      } catch {
        const negotiationResponse =
          await negotiationApi.getNegotiationById(
            String(routeId),
          );

        const negotiation =
          negotiationResponse?.data ||
          negotiationResponse;

        const resolvedNegotiationId = String(
          negotiation?.negotiationId ||
            routeId,
        );
        const resolvedConversationId = String(
          negotiation?.conversationId ||
            "",
        );

        setNegotiationId(resolvedNegotiationId);
        setConversationId(
          resolvedConversationId || null,
        );

        return {
          conversationId:
            resolvedConversationId || null,
          negotiationId: resolvedNegotiationId,
        };
      }
    } catch (error) {
      devLog(
        "Lỗi xác định cuộc trò chuyện:",
        error,
      );
      setLoadError(
        getApiErrorMessage(
          error,
          "Không thể mở cuộc trò chuyện này. Vui lòng thử lại.",
        ),
      );
      return null;
    } finally {
      setIsResolvingRoute(false);
    }
  }, [
    currentUserId,
    requestedNegotiationId,
    routeId,
  ]);

  const markCurrentContextAsRead = useCallback(
    async (target?: {
      conversationId?: string | null;
      negotiationId?: string | null;
    }) => {
      const readTarget = {
        conversationId: target?.conversationId ?? conversationId,
        negotiationId: target?.negotiationId ?? negotiationId,
      };

      if (!currentUserId || (!readTarget.conversationId && !readTarget.negotiationId)) {
        return;
      }

      const readTargetKey = [
        String(readTarget.conversationId ?? ""),
        String(readTarget.negotiationId ?? ""),
      ].join(":");

      if (readRequestInFlightRef.current) {
        const pendingTarget = pendingReadTargetRef.current;
        const pendingTargetKey = pendingTarget
          ? [
              String(pendingTarget.conversationId ?? ""),
              String(pendingTarget.negotiationId ?? ""),
            ].join(":")
          : null;

        if (
          activeReadTargetKeyRef.current === readTargetKey ||
          pendingTargetKey === readTargetKey
        ) {
          return;
        }

        pendingReadTargetRef.current = readTarget;
        return;
      }

      pendingReadTargetRef.current = readTarget;
      readRequestInFlightRef.current = true;

      try {
        while (pendingReadTargetRef.current) {
          const nextTarget = pendingReadTargetRef.current;
          pendingReadTargetRef.current = null;
          activeReadTargetKeyRef.current = [
            String(nextTarget.conversationId ?? ""),
            String(nextTarget.negotiationId ?? ""),
          ].join(":");

          try {
            if (nextTarget.conversationId) {
              await conversationApi.markConversationAsRead(
                String(nextTarget.conversationId),
              );
            } else if (nextTarget.negotiationId) {
              await messageApi.markAsRead(
                String(nextTarget.negotiationId),
              );
            }

            void refreshConversationSummaries({ silent: true });
          } catch {
            // Read receipt không chặn UI; reconnect/focus sẽ thử lại.
          }
        }
      } finally {
        activeReadTargetKeyRef.current = null;
        readRequestInFlightRef.current = false;
      }
    },
    [
      conversationId,
      currentUserId,
      negotiationId,
      refreshConversationSummaries,
    ],
  );

  const fetchConversationNegotiations = useCallback(
    async (targetConversationId?: string | null) => {
      const effectiveConversationId = targetConversationId;

      if (!effectiveConversationId) {
        setConversationNegotiations([]);
        return [];
      }

      setIsLoadingNegotiations(true);

      try {
        const response =
          await conversationApi.getConversationNegotiations(
            String(effectiveConversationId),
            { PageNumber: 1, PageSize: 50 },
          );

        if (response?.isSuccess === false) {
          throw response;
        }

        const items =
          response?.data?.items ?? response?.items ?? [];
        const normalizedItems = Array.isArray(items) ? items : [];
        setConversationNegotiations(normalizedItems);
        return normalizedItems;
      } catch {
        setConversationNegotiations([]);
        return [];
      } finally {
        setIsLoadingNegotiations(false);
      }
    },
    [],
  );

  const hydrateNegotiationLabels = useCallback(async (items: any[]) => {
    const targets = items.filter((item) => {
      const postId = String(item?.postId ?? "");
      return postId && !hydratedPostIdsRef.current.has(postId);
    });

    if (targets.length === 0) {
      return;
    }

    targets.forEach((item) => {
      const postId = String(item?.postId ?? "");
      if (postId) hydratedPostIdsRef.current.add(postId);
    });

    const results = await Promise.allSettled(
      targets.map(async (item) => {
        const postId = String(item?.postId ?? "");
        const response = await postApi.getPostById(postId);
        const post = response?.data ?? response;
        const label = String(
          post?.productName ??
            post?.product?.productName ??
            post?.productTypeName ??
            "",
        ).trim();

        return { postId, label };
      }),
    );

    const resolvedLabels: Record<string, string> = {};

    results.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value.label) {
        resolvedLabels[result.value.postId] = result.value.label;
        return;
      }
      // Thất bại/không có tên: cho phép thử lại ở lần mở sau, không kẹt nhãn tạm.
      const failedPostId = String(targets[index]?.postId ?? "");
      if (failedPostId) hydratedPostIdsRef.current.delete(failedPostId);
    });

    if (Object.keys(resolvedLabels).length > 0) {
      setNegotiationLabels((current) => ({
        ...current,
        ...resolvedLabels,
      }));
    }
  }, []);

  const parseTimestamp = (value: unknown): number | null => {
    const parsed = value ? Date.parse(String(value)) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  };

  const storeNegotiationPreview = useCallback(
    (targetNegotiationId: string, text: string, lastMessageAt: number | null, resolved = true) => {
      const key = targetNegotiationId.toLowerCase();
      if (!key) return;
      previewCacheRef.current.set(key, { text, lastMessageAt, resolved });
      stalePreviewIdsRef.current.delete(key);
      setNegotiationPreviews((current) =>
        current[key] === text ? current : { ...current, [key]: text },
      );
    },
    [],
  );

  const markNegotiationPreviewStale = useCallback((targetNegotiationId: unknown) => {
    const key = String(targetNegotiationId ?? "").toLowerCase();
    if (key) stalePreviewIdsRef.current.add(key);
  }, []);

  // Cập nhật rẻ từ tin nhắn thật (REST trang 1 hoặc realtime) — không cần gọi lại API.
  const updatePreviewFromMessage = useCallback(
    (targetNegotiationId: unknown, message: any) => {
      const key = String(targetNegotiationId ?? "").toLowerCase();
      if (!key || !message) return;
      const createdAt = parseTimestamp(message.createdAt ?? message.CreatedAt);
      const cached = previewCacheRef.current.get(key);
      if (cached?.lastMessageAt && createdAt && createdAt < cached.lastMessageAt) return;
      storeNegotiationPreview(key, buildMessagePreview(message), createdAt);
    },
    [storeNegotiationPreview],
  );

  const isPreviewCurrent = useCallback((item: any) => {
    const key = String(item?.negotiationId ?? "").toLowerCase();
    if (!key) return true;
    const cached = previewCacheRef.current.get(key);
    if (!cached || !cached.resolved || stalePreviewIdsRef.current.has(key)) return false;
    const listedAt = parseTimestamp(item?.lastMessageAt ?? item?.LastMessageAt);
    // Danh sách phiên báo có tin mới hơn bản đã lưu → cần tải lại.
    if (listedAt && cached.lastMessageAt && listedAt > cached.lastMessageAt + 1000) return false;
    if (listedAt && !cached.lastMessageAt && cached.text === NO_MESSAGE_PREVIEW) return false;
    return true;
  }, []);

  // Mỗi phiên hiển thị chỉ cần đúng MỘT tin mới nhất: GET /Messages PageNumber=1, PageSize=1.
  const hydrateNegotiationPreviews = useCallback(
    async (items: any[]) => {
      const targets = items.filter((item) => !isPreviewCurrent(item));
      if (targets.length === 0) return;

      const results = await Promise.allSettled(
        targets.map(async (item) => {
          const targetNegotiationId = String(item?.negotiationId ?? "");
          const response = await messageApi.getMessages({
            negotiationId: targetNegotiationId,
            PageNumber: 1,
            PageSize: 1,
          });
          const data = response?.data ?? response;
          const list = Array.isArray(data)
            ? data
            : Array.isArray(data?.items)
              ? data.items
              : Array.isArray(data?.Items)
                ? data.Items
                : [];
          return { targetNegotiationId, latest: list[0] ?? null };
        }),
      );

      results.forEach((result, index) => {
        const targetNegotiationId = String(targets[index]?.negotiationId ?? "");
        if (result.status === "fulfilled") {
          const { latest } = result.value;
          storeNegotiationPreview(
            targetNegotiationId,
            latest ? buildMessagePreview(latest) : NO_MESSAGE_PREVIEW,
            latest ? parseTimestamp(latest.createdAt ?? latest.CreatedAt) : null,
          );
        } else {
          // Dự phòng ổn định, không ghi vào bộ nhớ đệm để lần mở sau thử lại.
          storeNegotiationPreview(
            targetNegotiationId,
            "Chưa tải được tin nhắn gần nhất",
            null,
            false,
          );
        }
      });
    },
    [isPreviewCurrent, storeNegotiationPreview],
  );

  const fetchBaseInfo = useCallback(async (
    targetNegotiationId?: string,
  ) => {
    const effectiveNegotiationId =
      targetNegotiationId ||
      negotiationId;

    baseInfoErrorRef.current = null;

    if (!effectiveNegotiationId || !currentUserId) {
      return null;
    }

    try {
      const negotiationResponse =
        await negotiationApi.getNegotiationById(
          effectiveNegotiationId,
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
        postType: null,
        partnerName: info?.otherPartyName,
        partnerAvatar: info?.otherPartyAvatarUrl,
        myName:
          user?.username ||
          user?.name ||
          user?.displayName ||
          "Bạn",
        myAvatar: user?.avatarUrl || user?.avatar,
        myUserId: currentUserId,
        partnerUserId: null,
        sellerId: null,
        buyerId: null,
        postOwnerId: null,
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

            productDetails.myUserId =
              currentUserData?.userId || currentUserId;
            productDetails.partnerUserId =
              partnerData?.userId || null;
            productDetails.sellerId =
              offer?.seller?.userId || offer?.Seller?.UserId || null;
            productDetails.buyerId =
              offer?.buyer?.userId || offer?.Buyer?.UserId || null;
            productDetails.postOwnerId =
              offer?.buyPost?.ownerId ||
              offer?.BuyPost?.OwnerId ||
              offer?.sellPost?.ownerId ||
              offer?.SellPost?.OwnerId ||
              null;

            productDetails.myName =
              currentUserData?.username ||
              currentUserData?.displayName ||
              currentUserData?.name ||
              productDetails.myName;

            if (currentUserData?.avatarUrl) {
              productDetails.myAvatar =
                currentUserData.avatarUrl;
            }

            if (partnerData) {
              productDetails.partnerName =
                partnerData.username ||
                partnerData.displayName ||
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

            productDetails.postType =
              post?.postType ?? null;

            productDetails.postOwnerId =
              post?.ownerId || productDetails.postOwnerId;

            if (
              !isBuyPostType(post?.postType) &&
              Array.isArray(post?.medias) &&
              post.medias.length > 0
            ) {
              productDetails.image =
                post.medias[0].url ||
                post.medias[0].mediaUrl;
            }
          }
        } catch (error) {
          devLog("[chat] Không tải được thông tin offer/post:", error);
        }
      }

      productDetails.partnerName =
        productDetails.partnerName ||
        "Đối tác giao dịch";

      const combinedInfo = {
        ...info,
        ...productDetails,
      };

      // Agreement existence is decided by the preview endpoint (hasAgreement),
      // never by negotiationStatus (AgreementPending/Completed must still render).
      {
        try {
          const previewResponse =
            await agreementApi.getPreview(
              effectiveNegotiationId,
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

            const agreementStatus = String(
              combinedInfo.agreementData?.agreementStatus ?? "",
            )
              .trim()
              .toLowerCase();

            const isPaidAgreement =
              agreementStatus === "confirmed" ||
              agreementStatus === "2";

            combinedInfo.isPaidAgreement = isPaidAgreement;
            combinedInfo.orderId = null;
            combinedInfo.appointmentId = null;

            if (isPaidAgreement) {
              try {
                const orderResponse =
                  await orderApi.getByAgreement(preview.agreementId);
                const orderRef =
                  orderResponse?.data || orderResponse;
                const resolvedOrderId =
                  orderRef?.orderId ||
                  orderRef?.order?.orderId ||
                  null;

                if (resolvedOrderId) {
                  combinedInfo.orderId =
                    String(resolvedOrderId);

                  const orderDetailResponse =
                    await orderApi.getDetail(
                      String(resolvedOrderId),
                    );
                  const orderDetail =
                    orderDetailResponse?.data ||
                    orderDetailResponse;

                  const appointments = Array.isArray(
                    orderDetail?.appointments,
                  )
                    ? orderDetail.appointments
                    : Array.isArray(
                          orderDetail?.order?.appointments,
                        )
                      ? orderDetail.order.appointments
                      : [];

                  const sortedAppointments = [
                    ...appointments,
                  ].sort((first, second) => {
                    const firstTime = new Date(
                      first?.createdAt ||
                        first?.scheduledAt ||
                        0,
                    ).getTime();
                    const secondTime = new Date(
                      second?.createdAt ||
                        second?.scheduledAt ||
                        0,
                    ).getTime();

                    return secondTime - firstTime;
                  });

                  const normalizeAppointmentStatus = (
                    value: unknown,
                  ) =>
                    String(value ?? "")
                      .trim()
                      .toLowerCase();

                  const currentAppointment =
                    sortedAppointments.find(
                      (appointment) => {
                        const status =
                          normalizeAppointmentStatus(
                            appointment?.appointmentStatus,
                          );

                        return ![
                          "0",
                          "proposed",
                          "3",
                          "cancelled",
                          "canceled",
                        ].includes(status);
                      },
                    ) ||
                    sortedAppointments.find(
                      (appointment) => {
                        const status =
                          normalizeAppointmentStatus(
                            appointment?.appointmentStatus,
                          );

                        return ![
                          "3",
                          "cancelled",
                          "canceled",
                        ].includes(status);
                      },
                    ) ||
                    sortedAppointments[0] ||
                    null;

                  combinedInfo.appointmentId =
                    currentAppointment?.appointmentId ||
                    null;
                }
              } catch (error) {
                devLog("[chat] Không tải được Order/Appointment từ hợp đồng:", error);
              }
            }
          }
        } catch (error) {
          devLog("[chat] Không tải được bản xem trước hợp đồng:", error);
        }
      }

      negotiationInfoRef.current =
        combinedInfo;

      setNegotiationInfo(combinedInfo);

      return combinedInfo;
    } catch (error) {
      devLog(
        "Lỗi tải thông tin thương lượng:",
        error,
      );
      baseInfoErrorRef.current = error;

      return null;
    }
  }, [
    currentUserId,
    negotiationId,
    user,
  ]);

  const fetchMessagesOnly =
    useCallback(async (
      targetNegotiationId?: string,
      pageNumber = 1,
    ) => {
      const effectiveNegotiationId =
        targetNegotiationId ||
        negotiationId;

      if (!effectiveNegotiationId || !currentUserId) {
        return false;
      }

      const info =
        negotiationInfoRef.current;

      if (!info) {
        return false;
      }

      const pageState = messagePageStateRef.current;
      const requestGeneration = pageState.generation;
      if (pageState.inFlightPages.has(pageNumber)) {
        return false;
      }

      if (pageNumber > 1 && !pageState.hasOlderMessages) {
        return false;
      }

      pageState.inFlightPages.add(pageNumber);
      if (pageNumber > 1) setIsLoadingOlderMessages(true);

      try {
        const messageResponse =
          await messageApi.getMessages({
            negotiationId: effectiveNegotiationId,
            PageNumber: pageNumber,
            PageSize: MESSAGE_PAGE_SIZE,
          });

        const messageData =
          messageResponse?.data ||
          messageResponse;

        let rawMessages: any[] = [];

        if (Array.isArray(messageData)) {
          rawMessages = [...messageData];
        } else if (
          Array.isArray(messageData?.Items) ||
          Array.isArray(messageData?.items)
        ) {
          rawMessages = [
            ...(messageData.Items ?? messageData.items),
          ];
        }

        const responsePageNumber = Number(
          messageData?.PageNumber ?? messageData?.pageNumber,
        );
        const responsePageSize = Number(
          messageData?.PageSize ?? messageData?.pageSize,
        );
        const totalCount = Number(
          messageData?.TotalCount ?? messageData?.totalCount,
        );
        const minimumMessagesThroughThisPage =
          (pageNumber - 1) * responsePageSize + rawMessages.length;
        const hasValidPaginationMetadata =
          Number.isInteger(responsePageNumber) &&
          responsePageNumber === pageNumber &&
          Number.isInteger(responsePageSize) &&
          responsePageSize > 0 &&
          Number.isInteger(totalCount) &&
          totalCount >= minimumMessagesThroughThisPage;
        const rawMessageIds = rawMessages
          .map((message) =>
            String(message?.messageId ?? message?.MessageId ?? "").trim(),
          )
          .filter(Boolean);

        if (requestGeneration !== messagePageStateRef.current.generation) {
          return false;
        }

        if (rawMessages.length === 0) {
          // A final page confirmed by metadata is authoritative. An empty
          // page with missing or contradictory metadata stops only as the
          // compatibility fallback, so it cannot trigger repeated requests.
          messagePageStateRef.current.hasOlderMessages = false;
          setHasOlderMessages(false);
          return false;
        }

        const sortedMessages = [...rawMessages].sort(compareChatTimeline);
        if (pageNumber === 1) {
          // Phiên đang mở: tin mới nhất trong bộ nhớ là nguồn xem trước, khỏi gọi lại.
          updatePreviewFromMessage(
            effectiveNegotiationId,
            sortedMessages[sortedMessages.length - 1],
          );
        }

        const formattedMessages: any[] = [];

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
              message.messageType === 5 ||
              String(message.messageType ?? "").trim() === "5" ||
              (message.messageContent &&
                message.messageContent
                  .toLowerCase()
                  .includes("đã chỉnh sửa hợp đồng"));

            if (isSystemAgreementEvent && info.agreementData) {
              const actorName = isMe
                ? info.myName || "Bạn"
                : info.partnerName || "Đối tác giao dịch";
              const agreementUiText = normalizeAgreementUiText(
                message.messageContent,
                actorName,
              );
              const timelineKind = getAgreementTimelineKind(
                message.messageContent,
              );

              const agreementCardMessage = {
                id: `card-${message.messageId}`,
                sourceMessageId: String(message.messageId || index),
                sourceMessageType: message.messageType,
                timelineItemOrder: 1,
                type: "agreement_card",
                agreementId: info.agreementData.agreementId,
                agreementData: info.agreementData,
                agreementTimelineKind: timelineKind,
                sender: isMe ? "me" : "them",
                senderName: actorName,
                avatar: isMe ? info.myAvatar : info.partnerAvatar,
                isRead: message.isRead === true,
                createdAt: message.createdAt || null,
                time: new Date(message.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                isLatestAgreement: false,
              };

              const agreementSystemMessage = {
                id: message.messageId,
                sourceMessageId: String(message.messageId || index),
                sourceMessageType: message.messageType,
                timelineItemOrder: 0,
                type: "system",
                text: agreementUiText,
                createdAt: message.createdAt || null,
                avatar: isMe ? info.myAvatar : info.partnerAvatar,
                actorName,
                hideAvatar: isBilateralSystemText(agreementUiText),
              };

              // Mọi mốc Agreement đều theo cùng chronology:
              // System event trước -> resource card ngay sau.
              formattedMessages.push(agreementSystemMessage);
              formattedMessages.push(agreementCardMessage);

              return;
            }

            const normalizedMessageType = String(
              message.messageType ?? "",
            )
              .trim()
              .toLowerCase();

            const isSystemMessage =
              normalizedMessageType === "system" ||
              normalizedMessageType === "4";

            if (isSystemMessage) {
              const actorName = isMe
                ? info.myName || "Bạn"
                : info.partnerName || "Đối tác giao dịch";
              const systemUiText = normalizeSystemUiText(
                message.messageContent,
              );

              const systemMessage = {
                id:
                  message.messageId ||
                  "system-" + index,
                sourceMessageId: String(message.messageId || index),
                sourceMessageType: message.messageType,
                timelineItemOrder: 0,
                type: "system",
                text: systemUiText,
                createdAt:
                  message.createdAt || null,
                avatar: isMe
                  ? info.myAvatar
                  : info.partnerAvatar,
                actorName,
                hideAvatar: isBilateralSystemText(systemUiText),
              };

              formattedMessages.push(systemMessage);

              if (
                isPaymentCompletedSystemText(message.messageContent) &&
                info.agreementData
              ) {
                formattedMessages.push({
                  id: `paid-card-${message.messageId || index}`,
                  sourceMessageId: String(message.messageId || index),
                  sourceMessageType: message.messageType,
                  timelineItemOrder: 1,
                  type: "agreement_card",
                  agreementId: info.agreementData.agreementId,
                  agreementData: info.agreementData,
                  agreementTimelineKind: "confirmed",
                  sender: isMe ? "me" : "them",
                  senderName: actorName,
                  avatar: isMe ? info.myAvatar : info.partnerAvatar,
                  isRead: message.isRead === true,
                  createdAt: message.createdAt || null,
                  time: message.createdAt
                    ? new Date(message.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Vừa xong",
                  isLatestAgreement: true,
                  isPaidAgreement: true,
                  orderId: info.orderId || null,
                  appointmentId: info.appointmentId || null,
                });
              }

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
              sourceMessageId: String(message.messageId || index),
              sourceMessageType: message.messageType,
              timelineItemOrder: 0,
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
              createdAt: message.createdAt || null,
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

          },
        );

        // Latestness is computed ONCE, in a single pass over the complete,
        // already-chronological Agreement-card list — every variant
        // (created/updated/confirmed event cards AND the separately
        // constructed paid-state card) is a candidate. Whichever card ends
        // up last in that list is THE canonical latest card; every other
        // Agreement card (however it set isLatestAgreement when it was first
        // pushed above) is forced back to false here. This replaces the old
        // two-writer pattern (event-card pass + hard-coded paid-card flag)
        // that could leave two cards both marked latest.
        const agreementCardIndexes = formattedMessages.reduce<number[]>(
          (indexes, entry, index) => {
            if (entry.type === "agreement_card") indexes.push(index);
            return indexes;
          },
          [],
        );
        agreementCardIndexes.forEach((messageIndex, position) => {
          formattedMessages[messageIndex].isLatestAgreement =
            position === agreementCardIndexes.length - 1;
        });

        setMessages((previousMessages) =>
          applyTimelineGrouping(
            markLatestAgreementCard(
              mergeTimelineMessages(
                previousMessages,
                formattedMessages,
                pageNumber === 1 ? "authoritative" : "backfill",
              ),
            ),
          ),
        );

        const latestPageState = messagePageStateRef.current;
        const loadedPageNumber = hasValidPaginationMetadata
          ? responsePageNumber
          : pageNumber;
        latestPageState.loadedPages.add(loadedPageNumber);
        let nextUnloadedOlderPage = Math.max(
          2,
          latestPageState.nextPage,
          loadedPageNumber + 1,
        );
        while (latestPageState.loadedPages.has(nextUnloadedOlderPage)) {
          nextUnloadedOlderPage += 1;
        }
        latestPageState.nextPage = nextUnloadedOlderPage;
        rawMessageIds.forEach((messageId) =>
          latestPageState.loadedRawMessageIds.add(messageId),
        );
        if (hasValidPaginationMetadata) {
          const loadedRawMessageCount =
            latestPageState.loadedRawMessageIds.size;
          latestPageState.hasOlderMessages =
            responsePageNumber * responsePageSize < totalCount &&
            loadedRawMessageCount < totalCount;
        } else {
          latestPageState.hasOlderMessages = rawMessages.length >= MESSAGE_PAGE_SIZE;
        }
        setHasOlderMessages(latestPageState.hasOlderMessages);
        return true;
      } catch (error) {
        devLog(
          "Lỗi tải tin nhắn:",
          error,
        );
        return false;
      } finally {
        const latestPageState = messagePageStateRef.current;
        if (requestGeneration === latestPageState.generation) {
          latestPageState.inFlightPages.delete(pageNumber);
          if (pageNumber > 1) setIsLoadingOlderMessages(false);
        }
      }
    }, [
      updatePreviewFromMessage,
      currentUserId,
      negotiationId,
    ]);

  const loadOlderMessages = useCallback(async () => {
    const pageState = messagePageStateRef.current;
    if (!pageState.hasOlderMessages) return;

    await fetchMessagesOnly(undefined, pageState.nextPage);
  }, [fetchMessagesOnly]);

  const initialLoad =
    useCallback(async (
      targetNegotiationId?: string,
      targetConversationId?: string | null,
    ) => {
      const effectiveNegotiationId =
        targetNegotiationId ||
        negotiationId;

      if (
        !effectiveNegotiationId ||
        !currentUserId
      ) {
        return;
      }

      setIsLoading(true);
      setLoadError(null);
      shouldScrollToLatestRef.current = true;

      try {
        const loadedInfo =
          await fetchBaseInfo(effectiveNegotiationId);

        if (!loadedInfo) {
          setLoadError(
            baseInfoErrorRef.current
              ? getApiErrorMessage(
                  baseInfoErrorRef.current,
                  "Không thể tải cuộc trò chuyện. Vui lòng thử lại.",
                )
              : "Không thể tải cuộc trò chuyện. Vui lòng thử lại.",
          );

          return;
        }

        await fetchMessagesOnly(effectiveNegotiationId);

        await markCurrentContextAsRead({
          conversationId: targetConversationId ?? conversationId,
          negotiationId: effectiveNegotiationId,
        });
      } finally {
        setIsLoading(false);
      }
    }, [
      currentUserId,
      conversationId,
      fetchBaseInfo,
      fetchMessagesOnly,
      markCurrentContextAsRead,
      negotiationId,
    ]);

  useFocusEffect(
    useCallback(() => {
      isScreenFocusedRef.current = true;

      return () => {
        isScreenFocusedRef.current = false;
        focusedRouteLoadKeyRef.current = null;
      };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      if (isAuthLoading) {
        setIsLoading(true);
        return;
      }

      if (!routeId) {
        setLoadError(
          "Không tìm thấy cuộc trò chuyện này.",
        );
        setIsLoading(false);
        setIsResolvingRoute(false);
        return;
      }

      if (!currentUserId) {
        setLoadError(
          "Bạn cần đăng nhập để xem cuộc trò chuyện.",
        );
        setIsLoading(false);
        setIsResolvingRoute(false);
        return;
      }

      const focusLoadKey = [
        String(routeId),
        String(requestedNegotiationId ?? ""),
        String(currentUserId),
      ].join(":");

      if (focusedRouteLoadKeyRef.current === focusLoadKey) {
        return;
      }

      focusedRouteLoadKeyRef.current = focusLoadKey;
      let cancelled = false;

      const loadResolvedRoute = async () => {
        setIsLoading(true);

        const resolved =
          await resolveRouteContext();

        if (
          cancelled ||
          !resolved?.negotiationId
        ) {
          if (!cancelled) {
            setIsLoading(false);
          }
          return;
        }

        if (resolved.conversationId) {
          void fetchConversationNegotiations(
            resolved.conversationId,
          );
        }

        await initialLoad(
          resolved.negotiationId,
          resolved.conversationId,
        );
      };

      void loadResolvedRoute();

      return () => {
        cancelled = true;
      };
    }, [
      currentUserId,
      fetchConversationNegotiations,
      initialLoad,
      isAuthLoading,
      requestedNegotiationId,
      resolveRouteContext,
      routeId,
    ]),
  );

  useEffect(() => {
    if (!connection || !negotiationId) {
      return;
    }

    let isMounted = true;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let refreshing = false;
    let refreshPending = false;
    let lastConversationActivity = "";
    const refreshTransaction = async () => {
      if (refreshing || !isMounted) return;
      refreshing = true;
      do {
        refreshPending = false;
        await fetchBaseInfo();
        if (isMounted) await fetchMessagesOnly();
      } while (isMounted && refreshPending);
      refreshing = false;
    };
    const scheduleTransactionRefresh = () => {
      refreshPending = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => { if (refreshPending) void refreshTransaction(); }, 150);
    };
    const handleTransactionNotification = (event: any) => {
      const type = normalizeTargetType(event?.targetType ?? event?.TargetType);
      const targetId = String(event?.targetId ?? event?.TargetId ?? "").toLowerCase();
      const agreementId = String(negotiationInfoRef.current?.agreementPreview?.agreementId ?? "").toLowerCase();
      if ((type === "agreement" && agreementId && targetId === agreementId) || type === "order") {
        scheduleTransactionRefresh();
      }
    };

    const isForActiveNegotiation = (payload: any) => {
      const eventNegotiationId =
        payload?.negotiationId ??
        payload?.NegotiationId;

      if (!eventNegotiationId) {
        return true;
      }

      return (
        String(eventNegotiationId).toLowerCase() ===
        String(negotiationId).toLowerCase()
      );
    };

    const isForActiveConversation = (payload: any) => {
      if (!conversationId) {
        return true;
      }

      const eventConversationId =
        payload?.conversationId ??
        payload?.ConversationId;

      if (!eventConversationId) {
        return true;
      }

      return (
        String(eventConversationId).toLowerCase() ===
        String(conversationId).toLowerCase()
      );
    };

    const handleMessageCreated = async (newMsg: any) => {
      if (
        !isMounted ||
        !isForActiveNegotiation(newMsg)
      ) {
        return;
      }

      const messageId = String(
        newMsg?.messageId ??
          newMsg?.MessageId ??
          "",
      );

      if (
        messageId &&
        processedRealtimeMessageIdsRef.current.has(
          messageId,
        )
      ) {
        return;
      }

      if (messageId) {
        processedRealtimeMessageIdsRef.current.add(
          messageId,
        );
      }

      const eventSenderId =
        newMsg?.senderId ??
        newMsg?.SenderId ??
        "";
      const eventMessageType =
        newMsg?.messageType ??
        newMsg?.MessageType;

      const isMe =
        String(eventSenderId).toLowerCase() ===
        String(currentUserId).toLowerCase();

      if (isMe || isNearLatestRef.current) {
        shouldScrollToLatestRef.current = true;
        animateNextScrollToLatestRef.current = true;
      }

      if (!isMe && isScreenFocusedRef.current) {
        void markCurrentContextAsRead({
          conversationId,
          negotiationId,
        });
      }

      updatePreviewFromMessage(
        newMsg?.negotiationId ?? newMsg?.NegotiationId ?? negotiationId,
        newMsg,
      );

      const normalizedNewMessageType = String(
        eventMessageType ?? "",
      )
        .trim()
        .toLowerCase();

      const isSpecialEvent =
        eventMessageType === 2 ||
        eventMessageType === 3 ||
        normalizedNewMessageType === "offer" ||
        normalizedNewMessageType === "counteroffer" ||
        normalizedNewMessageType === "system" ||
        normalizedNewMessageType === "4" ||
        normalizedNewMessageType === "agreement" ||
        normalizedNewMessageType === "5" ||
        normalizedNewMessageType === "agreementcard" ||
        Number(newMsg.offerPrice) > 0 ||
        (newMsg.messageContent &&
          newMsg.messageContent
            .toLowerCase()
            .includes("đã chỉnh sửa hợp đồng"));

      if (isSpecialEvent) {
        scheduleTransactionRefresh();
      } else {
        setMessages((prev) => {
          if (
            prev.some(
              (message) =>
                message.id ===
                (newMsg.messageId ||
                  newMsg.MessageId),
            )
          ) {
            return prev;
          }

          const info = negotiationInfoRef.current;

          const formatted = {
            id:
              newMsg.messageId ||
              newMsg.MessageId ||
              Date.now().toString(),
            sourceMessageId: String(
              newMsg.messageId || newMsg.MessageId || "",
            ),
            sourceMessageType: eventMessageType,
            timelineItemOrder: 0,
            type: "text",
            text:
              newMsg.messageContent ||
              newMsg.MessageContent ||
              "",
            price: 0,
            quantity: 1,
            status: "pending",
            isRead:
              newMsg.isRead === true ||
              newMsg.IsRead === true,
            sender: isMe ? "me" : "them",
            avatar: isMe
              ? info?.myAvatar
              : info?.partnerAvatar,
            senderName: isMe
              ? "Bạn"
              : info?.partnerName,
            createdAt:
              newMsg.createdAt ||
              newMsg.CreatedAt ||
              new Date().toISOString(),
            time: new Date(
              newMsg.createdAt ||
                newMsg.CreatedAt ||
                Date.now(),
            ).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          };

          return applyTimelineGrouping(
            markLatestAgreementCard(
              mergeTimelineMessages(prev, [formatted], "authoritative"),
            ),
          );
        });
      }
    };

    const handleMessageUpdated = async (payload: any) => {
      if (
        !isMounted ||
        !isForActiveNegotiation(payload)
      ) {
        return;
      }

      scheduleTransactionRefresh();
    };

    const handleMessagesRead = (payload?: any) => {
      if (
        !isMounted ||
        !isForActiveNegotiation(payload)
      ) {
        return;
      }

      const readerId =
        payload?.readerId ?? payload?.ReaderId;

      if (
        readerId &&
        String(readerId).toLowerCase() ===
          String(currentUserId).toLowerCase()
      ) {
        return;
      }

      setMessages((prev) =>
        applyTimelineGrouping(prev.map((message) =>
          message.sender === "me"
            ? { ...message, isRead: true }
            : message,
        )),
      );
    };

    const handleConversationMessagesRead = (
      payload?: any,
    ) => {
      if (
        !isMounted ||
        !isForActiveConversation(payload)
      ) {
        return;
      }

      const readerId =
        payload?.readerId ?? payload?.ReaderId;

      if (
        readerId &&
        String(readerId).toLowerCase() ===
          String(currentUserId).toLowerCase()
      ) {
        return;
      }

      setMessages((prev) =>
        applyTimelineGrouping(prev.map((message) =>
          message.sender === "me"
            ? { ...message, isRead: true }
            : message,
        )),
      );
    };

    const handleConversationUpdated = async (
      payload: any,
    ) => {
      if (
        !isMounted ||
        !isForActiveConversation(payload)
      ) {
        return;
      }

      const updatedNegotiationId =
        payload?.negotiationId ??
        payload?.NegotiationId;

      // Xem trước của phiên khác trong cùng cuộc trò chuyện: cập nhật rẻ từ payload
      // khi đủ dữ liệu, nếu không thì đánh dấu cũ để tải lại lúc mở bộ chọn.
      if (updatedNegotiationId) {
        const lastType = payload?.lastMessageType ?? payload?.LastMessageType;
        const lastPreview = payload?.lastMessagePreview ?? payload?.LastMessagePreview;
        const lastAt = payload?.lastMessageAt ?? payload?.LastMessageAt;
        const lastTypeText = String(lastType ?? "").trim().toLowerCase();
        const isOfferLike = lastTypeText === "offer" || lastTypeText === "counteroffer" || lastTypeText === "2" || lastTypeText === "3";
        const offerPrice = Number(payload?.currentOfferPrice ?? payload?.CurrentOfferPrice ?? 0);
        if (lastType !== undefined && lastType !== null && (lastPreview != null || (isOfferLike && offerPrice > 0))) {
          updatePreviewFromMessage(updatedNegotiationId, {
            messageType: lastType,
            messageContent: isOfferLike ? "" : lastPreview,
            offerPrice: isOfferLike ? offerPrice : 0,
            offerQuantity: payload?.currentOfferQuantity ?? payload?.CurrentOfferQuantity ?? 1,
            createdAt: lastAt,
          });
        } else {
          markNegotiationPreviewStale(updatedNegotiationId);
        }
      }

      if (
        updatedNegotiationId &&
        String(updatedNegotiationId).toLowerCase() !==
          String(negotiationId).toLowerCase()
      ) {
        return;
      }

      // Read-count updates can repeat the same conversation activity. They
      // must not trigger a REST -> mark-read -> realtime -> REST refresh loop.
      const activity = JSON.stringify([
        updatedNegotiationId,
        payload?.lastMessageAt ?? payload?.LastMessageAt,
        payload?.lastMessageType ?? payload?.LastMessageType,
        payload?.lastMessagePreview ?? payload?.LastMessagePreview,
        payload?.negotiationStatus ?? payload?.NegotiationStatus,
        payload?.currentOfferVersion ?? payload?.CurrentOfferVersion,
      ]);
      if (activity === lastConversationActivity) return;
      lastConversationActivity = activity;
      scheduleTransactionRefresh();
    };

    const joinRooms = async () => {
      const tasks: Promise<void>[] = [
        joinNegotiation(negotiationId),
      ];

      if (conversationId) {
        tasks.push(
          joinConversation(conversationId),
        );
      }

      await Promise.allSettled(tasks);
    };

    connection.on(
      "MessageCreated",
      handleMessageCreated,
    );
    connection.on(
      "ConversationMessageCreated",
      handleMessageCreated,
    );
    connection.on(
      "MessageUpdated",
      handleMessageUpdated,
    );
    connection.on(
      "ConversationMessageUpdated",
      handleMessageUpdated,
    );
    connection.on(
      "MessagesRead",
      handleMessagesRead,
    );
    connection.on(
      "ConversationMessagesRead",
      handleConversationMessagesRead,
    );
    connection.on(
      "ConversationUpdated",
      handleConversationUpdated,
    );

    void joinRooms();
    connection.on("NotificationCreated", handleTransactionNotification);

    return () => {
      isMounted = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      connection.off("NotificationCreated", handleTransactionNotification);

      connection.off(
        "MessageCreated",
        handleMessageCreated,
      );
      connection.off(
        "ConversationMessageCreated",
        handleMessageCreated,
      );
      connection.off(
        "MessageUpdated",
        handleMessageUpdated,
      );
      connection.off(
        "ConversationMessageUpdated",
        handleMessageUpdated,
      );
      connection.off(
        "MessagesRead",
        handleMessagesRead,
      );
      connection.off(
        "ConversationMessagesRead",
        handleConversationMessagesRead,
      );
      connection.off(
        "ConversationUpdated",
        handleConversationUpdated,
      );

      void leaveNegotiation(
        negotiationId,
      );

      if (conversationId) {
        void leaveConversation(
          conversationId,
        );
      }
    };
  }, [
    markNegotiationPreviewStale,
    updatePreviewFromMessage,
    connection,
    conversationId,
    currentUserId,
    fetchBaseInfo,
    fetchMessagesOnly,
    joinConversation,
    joinNegotiation,
    leaveConversation,
    leaveNegotiation,
    markCurrentContextAsRead,
    negotiationId,
  ]);

  useEffect(() => {
    if (
      reconnectVersion <= 0 ||
      !negotiationId ||
      !isScreenFocusedRef.current
    ) {
      return;
    }

    const recoverAfterReconnect = async () => {
      const loadedInfo = await fetchBaseInfo();
      await fetchMessagesOnly();

      if (loadedInfo) {
        setLoadError(null);
      }

      await markCurrentContextAsRead({
        conversationId,
        negotiationId,
      });

      if (conversationId) {
        await fetchConversationNegotiations(conversationId);
      }
    };

    void recoverAfterReconnect();
  }, [
    conversationId,
    fetchBaseInfo,
    fetchConversationNegotiations,
    fetchMessagesOnly,
    markCurrentContextAsRead,
    negotiationId,
    reconnectVersion,
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
    setIsLoading(true);

    try {
      const loadedInfo =
        await fetchBaseInfo();

      if (!loadedInfo) {
        setLoadError(
          baseInfoErrorRef.current
            ? getApiErrorMessage(
                baseInfoErrorRef.current,
                "Không thể tải cuộc trò chuyện. Vui lòng thử lại.",
              )
            : "Không thể tải cuộc trò chuyện. Vui lòng thử lại.",
        );

        return;
      }

      await fetchMessagesOnly();
      await markCurrentContextAsRead({
        conversationId,
        negotiationId,
      });

      if (conversationId) {
        await fetchConversationNegotiations(conversationId);
      }
    } finally {
      setIsLoading(false);
    }
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
    if (negotiationActionInFlightRef.current) return;

    if (!negotiationId) {
      return;
    }

    const lockKey = `accept:${proposalMessageId}`;
    negotiationActionInFlightRef.current = lockKey;

    try {
      setIsProcessing(true);

      await negotiationApi.acceptProposal(
        negotiationId,
        proposalMessageId,
      );

      await reloadAll();
    } catch (error: any) {
      Alert.alert(
        "Lỗi",
        getApiErrorMessage(
          error,
          "Không thể chấp nhận đề xuất.",
        ),
      );
    } finally {
      if (negotiationActionInFlightRef.current === lockKey) {
        negotiationActionInFlightRef.current = null;
      }
      setIsProcessing(false);
    }
  };

  const handleRejectOffer = async (
    proposalMessageId: string,
  ) => {
    if (negotiationActionInFlightRef.current) return;

    if (!negotiationId) {
      return;
    }

    const lockKey = `reject:${proposalMessageId}`;
    negotiationActionInFlightRef.current = lockKey;

    try {
      setIsProcessing(true);

      await negotiationApi.rejectProposal(
        negotiationId,
        proposalMessageId,
      );

      await reloadAll();
    } catch (error: any) {
      Alert.alert(
        "Lỗi",
        getApiErrorMessage(
          error,
          "Không thể từ chối đề xuất.",
        ),
      );
    } finally {
      if (negotiationActionInFlightRef.current === lockKey) {
        negotiationActionInFlightRef.current = null;
      }
      setIsProcessing(false);
    }
  };

  const submitCounterOffer = async () => {
    if (negotiationActionInFlightRef.current) return;

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
      Alert.alert(
        "Lỗi",
        "Vui lòng nhập mức giá hợp lệ.",
      );

      return;
    }

    const lockKey = `counter:${negotiationId}`;
    negotiationActionInFlightRef.current = lockKey;

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
      Alert.alert(
        "Lỗi",
        getApiErrorMessage(
          error,
          "Không thể gửi đề xuất mới.",
        ),
      );
    } finally {
      if (negotiationActionInFlightRef.current === lockKey) {
        negotiationActionInFlightRef.current = null;
      }
      setIsProcessing(false);
    }
  };

  const handleCancelNegotiation = () => {
    if (negotiationActionInFlightRef.current) return;

    if (!negotiationId) {
      return;
    }

    const executeCancel = async () => {
      if (negotiationActionInFlightRef.current) return;

      const lockKey = `cancel:${negotiationId}`;
      negotiationActionInFlightRef.current = lockKey;

      try {
        setIsProcessing(true);

        await negotiationApi.cancelNegotiation(
          negotiationId,
        );

        Alert.alert(
          "Thành công",
          "Đã hủy phiên thương lượng.",
        );

        await reloadAll();
      } catch (error: any) {
        Alert.alert(
          "Lỗi",
          getApiErrorMessage(
            error,
            "Không thể hủy phiên thương lượng.",
          ),
        );
      } finally {
        if (negotiationActionInFlightRef.current === lockKey) {
          negotiationActionInFlightRef.current = null;
        }
        setIsProcessing(false);
      }
    };

    Alert.alert(
      "Hủy phiên thương lượng",
      "Bạn có chắc chắn muốn hủy phiên thương lượng này không?",
      [
        {
          text: "Không",
          style: "cancel",
        },
        {
          text: "Hủy phiên thương lượng",
          style: "destructive",
          onPress: () =>
            void executeCancel(),
        },
      ],
    );
  };

  const handleSendMessage = async () => {
    if (messageSendInFlightRef.current) return;

    if (
      !inputText.trim() ||
      !negotiationId
    ) {
      return;
    }

    const content = inputText.trim();

    if (isWaitingForNetwork) {
      return;
    }

    messageSendInFlightRef.current = true;
    shouldScrollToLatestRef.current = true;
    animateNextScrollToLatestRef.current = true;
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
      setInputText((current) => current || content);

      Alert.alert(
        "Lỗi",
        getApiErrorMessage(
          error,
          "Không thể gửi tin nhắn lúc này.",
        ),
      );
    } finally {
      messageSendInFlightRef.current = false;
    }
  };

  // Chỉ mở bộ chọn khi mọi dòng đã có tên sản phẩm và xem trước tin nhắn cuối
  // (hoặc dự phòng xác định) — không hiển thị "Phiên 2/3…" tạm thời.
  const openNegotiationPicker = async () => {
    if (conversationNegotiations.length <= 1) return;
    if (pickerPrepareInFlightRef.current || isNegotiationPickerVisible) return;

    const items = conversationNegotiations;
    const activeId = String(negotiationId ?? "").toLowerCase();
    const needsLabels = items.some((item) => {
      const itemPostId = String(item?.postId ?? "");
      const isActive = String(item?.negotiationId ?? "").toLowerCase() === activeId;
      return itemPostId && !negotiationLabels[itemPostId] && !(isActive && negotiationInfo?.name);
    });
    const needsPreviews = items.some((item) => !isPreviewCurrent(item));

    if (!needsLabels && !needsPreviews) {
      setNegotiationPickerVisible(true);
      return;
    }

    pickerPrepareInFlightRef.current = true;
    const generation = ++pickerGenerationRef.current;
    setIsPreparingPicker(true);
    try {
      await Promise.allSettled([
        needsLabels ? hydrateNegotiationLabels(items) : Promise.resolve(),
        needsPreviews ? hydrateNegotiationPreviews(items) : Promise.resolve(),
      ]);
      // Đổi phiên/cuộc trò chuyện hoặc rời màn hình trong lúc chuẩn bị: bỏ kết quả.
      if (generation !== pickerGenerationRef.current) return;
      setNegotiationPickerVisible(true);
    } finally {
      if (generation === pickerGenerationRef.current) {
        pickerPrepareInFlightRef.current = false;
        setIsPreparingPicker(false);
      }
    }
  };

  const selectNegotiation = (item: any) => {
    const nextNegotiationId = String(item?.negotiationId ?? "");

    if (!nextNegotiationId) {
      return;
    }

    setNegotiationPickerVisible(false);

    if (
      nextNegotiationId.toLowerCase() ===
      String(negotiationId ?? "").toLowerCase()
    ) {
      return;
    }

    router.replace({
      pathname: "/chat/[id]",
      params: {
        id: String(conversationId || routeId),
        negotiationId: nextNegotiationId,
      },
    });
  };

  const renderProductBanner = () => {
    return (
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
      {!isBuyPostType(negotiationInfo?.postType) ? (
        <Image
          source={{
            uri:
              negotiationInfo?.image ||
              "https://placehold.co/100x100/png",
          }}
          style={styles.productImg}
        />
      ) : null}

      <View style={styles.productInfo}>
        <Text
          style={styles.productName}
          numberOfLines={1}
        >
          {negotiationInfo?.name}
        </Text>

        <View style={styles.productMetaRow}>
          {getPostTypeLabel(negotiationInfo?.postType) ? (
            <View style={styles.postTypeTag}>
              <Text style={styles.postTypeTagText}>
                {getPostTypeLabel(negotiationInfo?.postType)}
              </Text>
            </View>
          ) : null}

          <Text
            style={styles.productSubText}
            numberOfLines={1}
          >
            {negotiationInfo?.productTypeName ||
              "Khác"}{" "}
            •{" "}
            {negotiationInfo?.city || "Chưa cập nhật"}
          </Text>
        </View>

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
  };

  const renderHeader = () => {
    const partnerName =
      negotiationInfo?.partnerName ||
      "Đối tác giao dịch";

    const avatarUri = getRobustAvatar(
      negotiationInfo?.partnerAvatar,
      partnerName,
    );
    const partnerRoles = getTransactionRoleLabels(
      negotiationInfo?.partnerUserId,
      negotiationInfo,
    );
    // Chỉ vùng giữa (ảnh + tên đối tác) mở hồ sơ công khai; nút quay lại và
    // các nút bên phải (chọn phiên, tải lại) là vùng chạm riêng, không bị chặn.
    const partnerUserId = String(negotiationInfo?.partnerUserId ?? "").trim();

    const centerContent = (
      <TouchableOpacity
        style={styles.headerCenter}
        onPress={() => {
          if (!partnerUserId) return;
          router.push(`/users/${partnerUserId}` as any);
        }}
        disabled={!partnerUserId}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Xem hồ sơ đối tác"
      >
        <Image
          source={{ uri: avatarUri }}
          style={styles.headerAvatar}
        />

        <View style={styles.headerTextBlock}>
          <Text
            style={styles.headerName}
            numberOfLines={1}
          >
            {partnerName}
          </Text>
          {partnerRoles.length > 0 ? (
            <Text style={styles.headerRoleText} numberOfLines={1}>
              {partnerRoles.join(" · ")}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );

    const rightContent = (
      <View style={styles.headerActions}>
        {conversationNegotiations.length > 1 ? (
          <TouchableOpacity
            style={styles.headerNegotiationButton}
            onPress={() => void openNegotiationPicker()}
            activeOpacity={0.75}
            disabled={isPreparingPicker}
            accessibilityState={{ busy: isPreparingPicker }}
          >
            {isPreparingPicker ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Ionicons
                name="layers-outline"
                size={14}
                color={COLORS.primary}
              />
            )}
            <Text style={styles.headerNegotiationButtonText}>
              {conversationNegotiations.length} phiên
            </Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={styles.headerIcon}
          onPress={() =>
            void reloadAll()
          }
          activeOpacity={0.75}
        >
          <Ionicons
            name="reload"
            size={20}
            color={COLORS.primary}
          />
        </TouchableOpacity>
      </View>
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

    if (item.type === "system") {
      const systemMessageId = String(item.id);
      const systemAvatarUri = getRobustAvatar(
        item.avatar,
        item.actorName ||
          item.accepterName ||
          item.senderName ||
          "Người dùng",
      );

      const isTimestampVisible =
        revealedSystemMessageIds.has(
          systemMessageId,
        );

      const systemTimestamp = item.createdAt
        ? new Date(item.createdAt).toLocaleString(
            "vi-VN",
            {
              hour: "2-digit",
              minute: "2-digit",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            },
          )
        : "";

      return (
        <TouchableOpacity
          activeOpacity={0.75}
          style={[
            styles.systemNoticeContainer,
            item.groupWithNext && styles.systemNoticeContainerGrouped,
          ]}
          onPress={() => {
            setRevealedSystemMessageIds(
              (previousIds) => {
                const nextIds = new Set(
                  previousIds,
                );

                if (nextIds.has(systemMessageId)) {
                  nextIds.delete(systemMessageId);
                } else {
                  nextIds.add(systemMessageId);
                }

                return nextIds;
              },
            );
          }}
        >
          <View
            style={[
              styles.systemNoticePill,
              item.hideAvatar && styles.systemNoticePillWithoutAvatar,
            ]}
          >
            {!item.hideAvatar ? (
              <Image
                source={{ uri: systemAvatarUri }}
                style={styles.systemNoticeAvatar}
              />
            ) : null}
            <Text style={styles.systemNoticeText}>
              {item.text}
            </Text>
          </View>

          {isTimestampVisible && systemTimestamp ? (
            <Text style={styles.systemNoticeTime}>
              {systemTimestamp}
            </Text>
          ) : null}
        </TouchableOpacity>
      );
    }

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
        const agreementTitle = item.isPaidAgreement
          ? "Hợp đồng đã thanh toán"
          : getAgreementTimelineTitle(item.agreementTimelineKind);

        return (
          <View
            style={[
              styles.offerCard,
              styles.fullWidth,
              styles.flowCard,
            ]}
          >
            <View style={styles.flowCardHeader}>
              <Ionicons
                name="document-text"
                size={17}
                color={COLORS.primary}
                style={styles.offerIcon}
              />

              <Text style={styles.flowCardTitle}>
                {agreementTitle}
              </Text>
            </View>

            <View style={styles.flowCardMetaRow}>
              <Text style={styles.flowCardPrice}>
                {formatCurrency(item.agreementData?.finalPrice)}
              </Text>

              <Text style={styles.flowCardQuantity}>
                Số lượng: {item.agreementData?.quantity}
              </Text>
            </View>

            {item.isLatestAgreement ? (
              <>
                <TouchableOpacity
                  style={styles.viewAgreementBtnFill}
                  onPress={() => {
                    router.push({
                      pathname: "/agreements/preview",
                      params: {
                        agreementId: String(item.agreementId),
                        negotiationId: String(negotiationId),
                      },
                    });
                  }}
                >
                  <Text style={styles.viewAgreementBtnFillText}>
                    Xem chi tiết hợp đồng
                  </Text>
                </TouchableOpacity>

                {item.isPaidAgreement &&
                (item.orderId || item.appointmentId) ? (
                  <View style={styles.commerceShortcutColumn}>
                    {item.orderId ? (
                      <TouchableOpacity
                        style={styles.commerceShortcutBtn}
                        onPress={() =>
                          router.push(`/orders/${String(item.orderId)}` as any)
                        }
                      >
                        <Ionicons
                          name="receipt-outline"
                          size={16}
                          color={COLORS.primary}
                        />

                        <Text style={styles.commerceShortcutText}>
                          Xem đơn hàng
                        </Text>
                      </TouchableOpacity>
                    ) : null}

                    {item.appointmentId ? (
                      <TouchableOpacity
                        style={styles.commerceShortcutBtn}
                        onPress={() =>
                          router.push(
                            `/appointments/${String(item.appointmentId)}` as any,
                          )
                        }
                      >
                        <Ionicons
                          name="calendar-outline"
                          size={16}
                          color={COLORS.primary}
                        />

                        <Text style={styles.commerceShortcutText}>
                          Xem lịch hẹn
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </>
            ) : null}
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
              styles.fullWidth,
              styles.flowCard,
              (!isLatestOffer ||
                item.status === "superseded") &&
                styles.outdatedCard,
            ]}
          >
            <View style={styles.flowCardHeader}>
              <Ionicons
                name="pricetag"
                size={17}
                color={COLORS.primary}
                style={styles.offerIcon}
              />

              <Text style={styles.flowCardTitle}>
                {title}
              </Text>
            </View>

            <View style={styles.flowCardMetaRow}>
              <Text style={styles.flowCardPrice}>
                {formatCurrency(item.price)}
              </Text>

              <Text style={styles.flowCardQuantity}>
                Số lượng: {item.quantity}
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
            item.groupWithPrevious &&
              (isMe
                ? styles.bubbleMeGroupedTop
                : styles.bubbleThemGroupedTop),
            item.groupWithNext &&
              (isMe
                ? styles.bubbleMeGroupedBottom
                : styles.bubbleThemGroupedBottom),
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
          item.groupWithNext && styles.messageWrapperGrouped,
          isMe
            ? styles.messageWrapperMe
            : styles.messageWrapperThem,
        ]}
      >
        {!isMe &&
          (item.type === "text" && item.groupWithNext ? (
            <View style={styles.chatAvatarSpacer} />
          ) : (
            avatarComponent
          ))}

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

          {item.type !== "text" || !item.groupWithNext ? (
            <View
              style={[
                styles.timeRow,
                isMe
                  ? styles.timeRowMe
                  : styles.timeRowThem,
              ]}
            >
              <Text style={styles.timeText}>
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
          ) : null}
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
            : Platform.OS === "android" &&
                isKeyboardVisible
              ? "padding"
              : undefined
        }
        keyboardVerticalOffset={0}
        style={styles.mobileWrapper}
      >
        <>
          {renderHeader()}

          {isWaitingForNetwork ? (
            <View style={styles.networkStatusBanner}>
              <ActivityIndicator
                size="small"
                color={COLORS.primary}
              />
              <Text style={styles.networkStatusText}>
                Đang chờ mạng…
              </Text>
            </View>
          ) : null}

          {negotiationInfo ? renderProductBanner() : null}

          {isAuthLoading || isLoading || isResolvingRoute ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator
                size="large"
                color={COLORS.primary}
              />
              <Text style={styles.loadingText}>
                Đang tải tin nhắn...
              </Text>
            </View>
          ) : loadError || !negotiationInfo ? (
            <View style={styles.loadingContainer}>
              {isWaitingForNetwork ? (
                <ActivityIndicator
                  size="large"
                  color={COLORS.primary}
                />
              ) : (
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={42}
                  color={COLORS.textLight}
                />
              )}

              <Text style={styles.loadErrorText}>
                {isWaitingForNetwork
                  ? "Đang chờ mạng…"
                  : loadError ||
                    "Không thể tải cuộc trò chuyện."}
              </Text>

              {negotiationId && currentUserId ? (
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => void initialLoad()}
                >
                  <Text style={styles.retryButtonText}>
                    Thử lại
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => router.back()}
                >
                  <Text style={styles.retryButtonText}>
                    Quay lại
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <FlatList
              ref={messageListRef}
              style={styles.messageList}
              data={messages}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={
                Platform.OS === "ios"
                  ? "interactive"
                  : "on-drag"
              }
              keyExtractor={(item) =>
                String(item.id)
              }
              renderItem={
                renderMessage
              }
              contentContainerStyle={
                styles.chatList
              }
              showsVerticalScrollIndicator
              persistentScrollbar
              onScroll={(event) => {
                const {
                  layoutMeasurement,
                  contentOffset,
                  contentSize,
                } = event.nativeEvent;

                const distanceFromBottom =
                  contentSize.height -
                  (contentOffset.y +
                    layoutMeasurement.height);

                isNearLatestRef.current =
                  distanceFromBottom <= 120;
              }}
              onScrollBeginDrag={() => {
                if (
                  shouldScrollToLatestRef.current
                ) {
                  clearScheduledScrolls();
                  shouldScrollToLatestRef.current =
                    false;
                  animateNextScrollToLatestRef.current =
                    false;
                }
              }}
              scrollEventThrottle={16}
              ListHeaderComponent={
                <View>
                  {hasOlderMessages ? (
                    <TouchableOpacity
                      onPress={() => void loadOlderMessages()}
                      disabled={isLoadingOlderMessages}
                      style={{ alignItems: "center", paddingVertical: 12 }}
                    >
                      {isLoadingOlderMessages ? (
                        <ActivityIndicator size="small" color={COLORS.primary} />
                      ) : (
                        <Text style={{ color: COLORS.primary, fontWeight: "600" }}>
                          Tải tin nhắn cũ hơn
                        </Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.dateSeparator}>
                      Giao dịch bắt đầu
                    </Text>
                  )}
                </View>
              }
              onLayout={() => {
                if (
                  shouldScrollToLatestRef.current &&
                  messages.length > 0
                ) {
                  scrollToLatest(false);
                }
              }}
              onContentSizeChange={() => {
                if (
                  !shouldScrollToLatestRef.current ||
                  messages.length === 0
                ) {
                  return;
                }

                scrollToLatest(
                  animateNextScrollToLatestRef.current,
                );
              }}
            />
          )}

          <View
            style={[
              styles.inputContainer,
              {
                paddingBottom: composerBottomInset,
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.attachBtn,
                (!negotiationId ||
                  isAuthLoading ||
                  isResolvingRoute) && {
                  opacity: 0.45,
                },
              ]}
              disabled={
                !negotiationId ||
                isAuthLoading ||
                isResolvingRoute
              }
              onPress={() =>
                setActionMenuVisible(true)
              }
            >
              <Ionicons
                name="add-circle-outline"
                size={28}
                color={COLORS.primary}
              />
            </TouchableOpacity>

            <TextInput
              style={styles.textInput}
              placeholder={
                isAuthLoading ||
                isResolvingRoute ||
                !negotiationId
                  ? "Đang kết nối cuộc trò chuyện..."
                  : "Nhập tin nhắn..."
              }
              placeholderTextColor={
                COLORS.textLight
              }
              value={inputText}
              editable={
                !isAuthLoading &&
                !isResolvingRoute &&
                Boolean(negotiationId)
              }
              onChangeText={setInputText}
              onSubmitEditing={() =>
                void handleSendMessage()
              }
              blurOnSubmit={false}
            />

            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!inputText.trim() ||
                  !negotiationId ||
                  isAuthLoading ||
                  isResolvingRoute ||
                  isWaitingForNetwork) && {
                  opacity: 0.45,
                },
              ]}
              disabled={
                !inputText.trim() ||
                !negotiationId ||
                isAuthLoading ||
                isResolvingRoute ||
                isWaitingForNetwork
              }
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
      </KeyboardAvoidingView>

      <Modal
        visible={isNegotiationPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNegotiationPickerVisible(false)}
      >
        <ModalBackdrop
          style={styles.negotiationPickerOverlay}
          onPress={() => setNegotiationPickerVisible(false)}
        >
          <ModalSurface style={styles.negotiationPickerCard}>
            <View style={styles.negotiationPickerHeader}>
              <View>
                <Text style={styles.negotiationPickerTitle}>
                  Đi đến phiên thương lượng
                </Text>
                <Text style={styles.negotiationPickerSubtitle}>
                  Chuyển phiên ngay trong cuộc trò chuyện này
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setNegotiationPickerVisible(false)}
                style={styles.negotiationPickerClose}
              >
                <Ionicons name="close" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {isLoadingNegotiations ? (
              <View style={styles.negotiationPickerLoading}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.negotiationPickerSubtitle}>
                  Đang tải các phiên…
                </Text>
              </View>
            ) : (
              <FlatList
                data={conversationNegotiations}
                keyExtractor={(item) => String(item?.negotiationId ?? "")}
                showsVerticalScrollIndicator={false}
                style={styles.negotiationPickerList}
                renderItem={({ item, index }) => {
                  const itemNegotiationId = String(
                    item?.negotiationId ?? "",
                  );
                  const itemPostId = String(item?.postId ?? "");
                  const isActive =
                    itemNegotiationId.toLowerCase() ===
                    String(negotiationId ?? "").toLowerCase();
                  // Bộ chọn chỉ mở sau khi đã tải xong; nhãn số chỉ là dự phòng cuối cùng
                  // khi Backend không có tên sản phẩm cho bài đăng đó.
                  const itemLabel =
                    negotiationLabels[itemPostId] ||
                    (isActive ? negotiationInfo?.name : "") ||
                    `Phiên thương lượng ${index + 1}`;
                  const itemPreview =
                    negotiationPreviews[itemNegotiationId.toLowerCase()] ||
                    NO_MESSAGE_PREVIEW;
                  const itemLastMessageTime = item?.lastMessageAt
                    ? new Date(item.lastMessageAt).toLocaleString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "2-digit",
                      })
                    : "";
                  const unreadCount = Math.max(
                    0,
                    Number(item?.unreadCount ?? 0),
                  );

                  return (
                    <TouchableOpacity
                      style={[
                        styles.negotiationPickerItem,
                        isActive ? styles.negotiationPickerItemActive : undefined,
                      ]}
                      onPress={() => selectNegotiation(item)}
                    >
                      <View style={styles.negotiationPickerItemMain}>
                        <Text
                          style={styles.negotiationPickerItemTitle}
                          numberOfLines={1}
                        >
                          {itemLabel}
                        </Text>
                        <Text style={styles.negotiationPickerItemMeta} numberOfLines={1}>
                          {getNegotiationStatusLabel(item?.negotiationStatus)}
                          {Number(item?.currentOfferPrice ?? 0) > 0
                            ? ` • ${formatCurrency(Number(item.currentOfferPrice))}`
                            : ""}
                          {itemLastMessageTime ? ` • ${itemLastMessageTime}` : ""}
                        </Text>

                        <Text
                          style={styles.negotiationPickerItemLastMessage}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          Tin nhắn gần nhất: {itemPreview}
                        </Text>
                      </View>

                      {unreadCount > 0 ? (
                        <View style={styles.negotiationUnreadBadge}>
                          <Text style={styles.negotiationUnreadBadgeText}>
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </Text>
                        </View>
                      ) : isActive ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={COLORS.primary}
                        />
                      ) : (
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color={COLORS.textLight}
                        />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </ModalSurface>
        </ModalBackdrop>
      </Modal>

      <Modal
        visible={isActionMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setActionMenuVisible(false)}
      >
        <ModalBackdrop
          style={styles.menuOverlay}
          onPress={() => setActionMenuVisible(false)}
        >
          <ModalSurface
            style={[
              styles.menuSheetContent,
              {
                // Android: ModalBackdrop đã chừa thanh điều hướng hệ thống.
                paddingBottom: Platform.OS === "android" ? 20 : 40,
              },
            ]}
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

            {negotiationInfo?.negotiationStatus === "Open" ? (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setActionMenuVisible(false);
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
                  Hủy phiên thương lượng
                </Text>
              </TouchableOpacity>
            ) : null}

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

                {negotiationInfo?.isPaidAgreement === true &&
                negotiationInfo?.orderId ? (
                  <>
                    <View style={styles.menuDivider} />
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => {
                        setActionMenuVisible(false);
                        router.push(
                          `/orders/${String(negotiationInfo.orderId)}` as any,
                        );
                      }}
                    >
                      <Ionicons
                        name="receipt-outline"
                        size={22}
                        color={COLORS.primary}
                      />
                      <Text style={styles.menuItemText}>
                        Xem đơn hàng
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : null}

                {negotiationInfo?.isPaidAgreement === true &&
                negotiationInfo?.appointmentId ? (
                  <>
                    <View style={styles.menuDivider} />
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => {
                        setActionMenuVisible(false);
                        router.push(
                          `/appointments/${String(
                            negotiationInfo.appointmentId,
                          )}` as any,
                        );
                      }}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={22}
                        color={COLORS.primary}
                      />
                      <Text style={styles.menuItemText}>
                        Xem lịch hẹn
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </>
            )}
          </ModalSurface>
        </ModalBackdrop>
      </Modal>

      <Modal
        visible={isCounterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isProcessing) setCounterModalVisible(false);
        }}
      >
        <ModalBackdrop
          style={styles.modalOverlay}
          disabled={isProcessing}
          onPress={() => setCounterModalVisible(false)}
        >
          <ModalSurface
            style={[
              styles.modalContent,
              {
                paddingBottom: 24,
              },
            ]}
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
                    placeholderTextColor="#547B7D"
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
                    placeholderTextColor="#547B7D"
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
          </ModalSurface>
        </ModalBackdrop>
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

  networkStatusBanner: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(84, 123, 125, 0.18)",
    backgroundColor: "rgba(84, 123, 125, 0.08)",
  },

  networkStatusText: {
    color: COLORS.textLight,
    fontSize: 12,
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
    borderColor: "#BAC2C1",
  },

  headerName: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },

  headerRoleText: {
    marginTop: 2,
    color: COLORS.textLight,
    fontSize: 10,
    fontWeight: "600",
  },

  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  headerNegotiationButton: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(84, 123, 125, 0.28)",
    backgroundColor: "rgba(84, 123, 125, 0.08)",
  },

  headerNegotiationButtonText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "800",
  },

  headerIcon: {
    padding: 8,
  },

  negotiationPickerOverlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: "rgba(23, 40, 48, 0.45)",
  },

  negotiationPickerCard: {
    width: "100%",
    maxWidth: 440,
    maxHeight: "70%",
    alignSelf: "center",
    borderRadius: 16,
    padding: 16,
    backgroundColor: COLORS.white,
  },

  negotiationPickerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  negotiationPickerTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
  },

  negotiationPickerSubtitle: {
    marginTop: 3,
    color: COLORS.textLight,
    fontSize: 11,
    lineHeight: 16,
  },

  negotiationPickerClose: {
    padding: 4,
  },

  negotiationPickerLoading: {
    minHeight: 110,
    alignItems: "center",
    justifyContent: "center",
  },

  negotiationPickerList: {
    marginTop: 8,
  },

  negotiationPickerItem: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },

  negotiationPickerItemActive: {
    borderColor: COLORS.primary,
    backgroundColor: "rgba(84, 123, 125, 0.08)",
  },

  negotiationPickerItemMain: {
    flex: 1,
  },

  negotiationPickerItemTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
  },

  negotiationPickerItemMeta: {
    marginTop: 4,
    color: COLORS.textLight,
    fontSize: 11,
  },

  negotiationPickerItemLastMessage: {
    marginTop: 3,
    color: COLORS.textLight,
    fontSize: 10,
    lineHeight: 14,
  },

  negotiationUnreadBadge: {
    minWidth: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: COLORS.error,
  },

  negotiationUnreadBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "800",
  },

  productBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#BAC2C1",
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

  productMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },

  postTypeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "rgba(84, 123, 125, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(84, 123, 125, 0.14)",
  },

  postTypeTagText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: "600",
  },

  productSubText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textLight,
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

  messageList: {
    flex: 1,
    minHeight: 0,
  },

  chatList: {
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 4,
  },

  dateSeparator: {
    alignSelf: "center",
    backgroundColor: "rgba(84, 123, 125, 0.08)",
    color: COLORS.textLight,
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
  },

  systemNoticeContainer: {
    alignSelf: "center",
    alignItems: "center",
    maxWidth: "88%",
    marginBottom: 16,
  },

  systemNoticeContainerGrouped: {
    marginBottom: 5,
  },

  systemNoticePill: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(84, 123, 125, 0.10)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },

  systemNoticePillWithoutAvatar: {
    paddingHorizontal: 14,
  },

  systemNoticeAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 7,
  },

  systemNoticeText: {
    color: COLORS.textLight,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    textAlign: "center",
  },

  systemNoticeTime: {
    marginTop: 4,
    color: COLORS.textLight,
    fontSize: 10,
    textAlign: "center",
  },

  systemAgreedContainer: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(84, 123, 125, 0.08)",
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

  messageWrapperGrouped: {
    marginBottom: 4,
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

  chatAvatarSpacer: {
    width: 36,
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
    backgroundColor: "rgba(84, 123, 125, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(84, 123, 125, 0.24)",
    borderBottomLeftRadius: 4,
  },

  bubbleMeGroupedTop: {
    borderTopRightRadius: 6,
  },

  bubbleMeGroupedBottom: {
    borderBottomRightRadius: 6,
  },

  bubbleThemGroupedTop: {
    borderTopLeftRadius: 6,
  },

  bubbleThemGroupedBottom: {
    borderBottomLeftRadius: 6,
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
    opacity: 0.82,
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
    backgroundColor: "#F8F9FA",
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
    backgroundColor: "rgba(84, 123, 125, 0.08)",
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

  flowCard: {
    padding: 14,
  },

  flowCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  flowCardTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },

  flowCardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: "#F8F9FA",
  },

  flowCardPrice: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: "800",
  },

  flowCardQuantity: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
  },

  commerceShortcutColumn: {
    marginTop: 8,
    gap: 8,
  },

  commerceShortcutBtn: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(84, 123, 125, 0.35)",
    backgroundColor: "rgba(84, 123, 125, 0.06)",
  },

  commerceShortcutText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "700",
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
    borderTopColor: "#BAC2C1",
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
    paddingTop: 10,
    paddingBottom: 10,
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
