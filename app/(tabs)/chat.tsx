import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
  useRouter,
} from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
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
  useWindowDimensions,
  View,
} from "react-native";

import {
  InlineFeedback,
  useActionFeedback,
  useConfirmAction,
} from "../../src/components/shared/ActionFeedback";
import { useChatRealtime } from "../../src/contexts/ChatRealtimeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MainHeader from "../../src/components/shared/MainHeader";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import apiClient from "../../src/services/apis/axiosClient";
import {
  getApiErrorMessage,
  getApiSuccessMessage,
} from "../../src/utils/apiFeedback";

type ActiveTab =
  | "chat"
  | "received"
  | "sent";

type OfferTab = "received" | "sent";

type OfferTabChanges = Record<
  OfferTab,
  boolean
>;

const OFFER_POLLING_DELAYS: number[] = [
  // Lần polling đầu tiên sau 10 giây
  10_000,

  // 5 lần, mỗi lần cách 5 giây
  5_000,
  5_000,
  5_000,
  5_000,
  5_000,

  // 3 lần, mỗi lần cách 7 giây
  7_000,
  7_000,
  7_000,

  // 3 lần, mỗi lần cách 11 giây
  11_000,
  11_000,
  11_000,

  // 3 lần, mỗi lần cách 13 giây
  13_000,
  13_000,
  13_000,

  // 3 lần, mỗi lần cách 17 giây
  17_000,
  17_000,
  17_000,

  // 3 lần, mỗi lần cách 19 giây
  19_000,
  19_000,
  19_000,
];

// Sau khi chạy hết lịch trên, tiếp tục polling mỗi 19 giây.
const MAX_OFFER_POLLING_DELAY = 19_000;

const getOfferItems = (
  response: any,
): any[] => {
  const items =
    response?.items ??
    response?.data?.items ??
    [];

  return Array.isArray(items)
    ? items
    : [];
};

const getPendingOffers = (
  response: any,
): any[] => {
  return getOfferItems(response)
    .filter((offer: any) => {
      return (
        offer.offerStatus === "Pending" ||
        offer.offerStatus === 0
      );
    })
    .sort((first: any, second: any) => {
      return (
        new Date(
          second.createdAt,
        ).getTime() -
        new Date(
          first.createdAt,
        ).getTime()
      );
    });
};

/**
 * Snapshot chỉ chứa các trường có ý nghĩa với tab Offer:
 * - Offer mới.
 * - Thay đổi giá.
 * - Thay đổi số lượng.
 * - Thay đổi trạng thái.
 *
 * Không dùng updatedAt để tránh báo chấm đỏ vì metadata
 * không liên quan bị Backend cập nhật.
 */
const createOfferSnapshot = (
  offers: any[],
): string => {
  return offers
    .map((offer: any) => {
      return [
        String(offer.offerId ?? ""),
        String(offer.offerPrice ?? ""),
        String(
          offer.offerQuantity ?? "",
        ),
        String(offer.offerStatus ?? ""),
      ].join(":");
    })
    .sort()
    .join("|");
};

type FeedbackTarget =
  | {
      type: "page";
    }
  | {
      type: "offer";
      offerId: string;
    }
  | {
      type: "counter";
    }
  | null;

const negotiationApi = {
  getNegotiations: (params?: {
    PageNumber?: number;
    PageSize?: number;
  }) =>
    apiClient
      .get("/negotiations", {
        params,
      })
      .then((response) => response.data),
};

const offerApi = {
  getSentOffers: (params?: {
    PageNumber?: number;
    PageSize?: number;
  }) =>
    apiClient
      .get("/offers/sent", {
        params,
      })
      .then((response) => response.data),

  getReceivedOffers: (params?: {
    PageNumber?: number;
    PageSize?: number;
  }) =>
    apiClient
      .get("/offers/received", {
        params,
      })
      .then((response) => response.data),

  acceptOffer: (offerId: string) =>
    apiClient
      .patch(`/offers/${offerId}/accept`)
      .then((response) => response.data),

  rejectOffer: (offerId: string) =>
    apiClient
      .post(`/offers/${offerId}/reject`)
      .then((response) => response.data),

  counterInitialOffer: (
    offerId: string,
    data: {
      offerPrice: number;
      offerQuantity: number;
      messageContent?: string;
    },
  ) =>
    apiClient
      .patch(
        `/offers/${offerId}/counter`,
        data,
      )
      .then((response) => response.data),
};

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });

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
    if (
      url.includes(
        "googleusercontent.com",
      )
    ) {
      return `https://wsrv.nl/?url=${encodeURIComponent(
        url,
      )}`;
    }

    return url;
  }

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "U",
  )}&background=547B7D&color=fff`;
};

const normalizeSearchText = (
  value: unknown,
) => {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("vi-VN");
};

export default function ChatListScreen() {
  const router = useRouter();

  const {
    width: screenWidth,
  } = useWindowDimensions();

  const width =
    Platform.OS === "web" &&
    screenWidth > 480
      ? 480
      : screenWidth;

  const { user } = useAuth();
  const { connection } = useChatRealtime();

  const currentUserId =
  user?.userId || user?.id;

  /**
   * Dùng để loại bỏ response cũ khi:
   * - Người dùng đổi tab.
   * - Người dùng rời màn hình.
   * - Có hai request vô tình chạy gần nhau.
   */
  const fetchRequestIdRef = useRef(0);

  const [activeTab, setActiveTab] =
    useState<ActiveTab>("chat");

  const activeTabRef =
    useRef<ActiveTab>("chat");

  const seenOfferSnapshotsRef =
    useRef<
      Partial<Record<OfferTab, string>>
    >({});

  const latestOfferSnapshotsRef =
    useRef<
      Partial<Record<OfferTab, string>>
    >({});

  const [
    offerTabChanges,
    setOfferTabChanges,
  ] = useState<OfferTabChanges>({
    received: false,
    sent: false,
  });

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  /**
   * Khi đổi tài khoản phải bỏ cache trong RAM.
   * Key AsyncStorage bên dưới đã được tách theo userId.
   */
  useEffect(() => {
    seenOfferSnapshotsRef.current = {};
    latestOfferSnapshotsRef.current =
      {};

    setOfferTabChanges({
      received: false,
      sent: false,
    });
  }, [currentUserId]);

  const [
    searchQuery,
    setSearchQuery,
  ] = useState("");

  const [
    offersList,
    setOffersList,
  ] = useState<any[]>([]);

  const [
    negotiationsList,
    setNegotiationsList,
  ] = useState<any[]>([]);

  const [isLoading, setIsLoading] =
    useState(false);

  const [
    isProcessingAction,
    setIsProcessingAction,
  ] = useState(false);

  const [
    showCounterModal,
    setShowCounterModal,
  ] = useState(false);

  const [
    selectedOffer,
    setSelectedOffer,
  ] = useState<any>(null);

  const [
    counterPrice,
    setCounterPrice,
  ] = useState("");

  const [
    counterQuantity,
    setCounterQuantity,
  ] = useState("");

  const [
    counterMessage,
    setCounterMessage,
  ] = useState("");

  const [
    feedbackTarget,
    setFeedbackTarget,
  ] = useState<FeedbackTarget>(null);

  const {
    feedback,
    clearFeedback,
    showError,
    showSuccess,
  } = useActionFeedback();

  const {
    confirm,
    confirmationModal,
  } = useConfirmAction();

  const fetchData = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent === true;

      // Mỗi lần gọi có một ID riêng.
      const requestId =
        ++fetchRequestIdRef.current;

      if (!user) {
        setOffersList([]);
        setNegotiationsList([]);

        if (!silent) {
          setIsLoading(false);
        }

        return;
      }

      // Chỉ lần tải trực tiếp mới hiện loading.
      // Polling nền không làm giao diện nhấp nháy.
      if (!silent) {
        setIsLoading(true);
      }

      try {
        if (activeTab === "chat") {
          const response =
            await negotiationApi.getNegotiations({
              PageSize: 50,
              PageNumber: 1,
            });

          // Bỏ response cũ nếu đã có request mới hơn.
          if (
            requestId !==
            fetchRequestIdRef.current
          ) {
            return;
          }

          if (
            response?.isSuccess === false
          ) {
            throw response;
          }

          const items =
            response?.data?.items ||
            response?.items ||
            [];

          setNegotiationsList(
            Array.isArray(items)
              ? items
              : [],
          );

          return;
        }

        const response =
          activeTab === "received"
            ? await offerApi.getReceivedOffers({
                PageSize: 50,
                PageNumber: 1,
              })
            : await offerApi.getSentOffers({
                PageSize: 50,
                PageNumber: 1,
              });

        // Người dùng đã đổi tab hoặc có request mới:
        // không cho response cũ ghi đè danh sách mới.
        if (
          requestId !==
          fetchRequestIdRef.current
        ) {
          return;
        }

        if (
          response?.isSuccess === false
        ) {
          throw response;
        }

        const items =
          response?.items ||
          response?.data?.items ||
          [];

        const pendingOffers = (
          Array.isArray(items)
            ? items
            : []
        )
          .filter((offer: any) => {
            return (
              offer.offerStatus ===
                "Pending" ||
              offer.offerStatus === 0
            );
          })
          .sort((first: any, second: any) => {
            return (
              new Date(
                second.createdAt,
              ).getTime() -
              new Date(
                first.createdAt,
              ).getTime()
            );
          });

        setOffersList(pendingOffers);
      } catch (error: unknown) {
        // Không xử lý response của request đã lỗi thời.
        if (
          requestId !==
          fetchRequestIdRef.current
        ) {
          return;
        }

        console.error(
          `Lỗi lấy dữ liệu (${activeTab}):`,
          error,
        );

        /**
         * Polling nền lỗi thì giữ nguyên dữ liệu cũ.
         * Không bật thông báo liên tục mỗi 30 giây.
         *
         * Lần tải trực tiếp vẫn hiện lỗi inline như cũ.
         */
        if (!silent) {
          setFeedbackTarget({
            type: "page",
          });

          showError(
            getApiErrorMessage(
              error,
              "Không thể tải danh sách thương lượng.",
            ),
          );
        }
      } finally {
        /**
         * Chỉ request mới nhất và không phải polling nền
         * mới được tắt loading.
         */
        if (
          !silent &&
          requestId ===
            fetchRequestIdRef.current
        ) {
          setIsLoading(false);
        }
      }
    },
    [
      activeTab,
      showError,
      user,
    ],
  );

  /**
   * Danh sách Negotiation không polling.
   *
   * Khi BE phát ConversationUpdated, FE gọi lại /negotiations
   * đúng một lần để lấy dữ liệu đầy đủ của thẻ chat.
   */
  useFocusEffect(
    useCallback(() => {
      if (!connection) {
        return;
      }

      const handleConversationUpdated = () => {
        // Chỉ refresh khi người dùng đang xem tab Đoạn chat.
        if (activeTabRef.current !== "chat") {
          return;
        }

        void fetchData({
          silent: true,
        });
      };

      connection.on(
        "ConversationUpdated",
        handleConversationUpdated,
      );

      return () => {
        connection.off(
          "ConversationUpdated",
          handleConversationUpdated,
        );
      };
    }, [connection, fetchData]),
  );

  const filteredNegotiations =
    useMemo(() => {
      const query =
        normalizeSearchText(
          searchQuery,
        );

      if (!query) {
        return negotiationsList;
      }

      return negotiationsList.filter(
        (item) => {
          const searchableText = [
            item.otherPartyName,
            item.productName,
            item.postTitle,
            item.currentOfferPrice,
            item.currentOfferQuantity,
          ]
            .map(normalizeSearchText)
            .join(" ");

          return searchableText.includes(
            query,
          );
        },
      );
    }, [
      negotiationsList,
      searchQuery,
    ]);

  const getOfferSenderId = useCallback(
  (item: any) =>
    String(
      item?.senderId ??
        item?.sender?.userId ??
        item?.sender?.id ??
        item?.fromUserId ??
        "",
    ),
  [],
);

const getOfferReceiverId = useCallback(
  (item: any) =>
    String(
      item?.receiverId ??
        item?.receiver?.userId ??
        item?.receiver?.id ??
        item?.toUserId ??
        "",
    ),
  [],
);

const filteredOffers = useMemo(() => {
  const myUserId = String(
    currentUserId ?? "",
  );

  const offersOfCurrentTab =
    offersList.filter((item) => {
      const senderId =
        getOfferSenderId(item);

      const receiverId =
        getOfferReceiverId(item);

      if (activeTab === "received") {
        // Yêu cầu mới:
        // mình phải là người nhận và không phải người gửi.
        return (
          receiverId === myUserId &&
          senderId !== myUserId
        );
      }

      if (activeTab === "sent") {
        // Đã gửi:
        // mình phải là người gửi.
        return senderId === myUserId;
      }

      return false;
    });

  const query = normalizeSearchText(
    searchQuery,
  );

  if (!query) {
    return offersOfCurrentTab;
  }

  return offersOfCurrentTab.filter(
    (item) => {
      const searchableText = [
        item.senderName,
        item.sender?.displayName,
        item.receiverName,
        item.receiver?.displayName,
        item.productName,
        item.postTitle,
        item.offerPrice,
        item.offerQuantity,
      ]
        .map(normalizeSearchText)
        .join(" ");

      return searchableText.includes(
        query,
      );
    },
  );
}, [
  activeTab,
  currentUserId,
  getOfferReceiverId,
  getOfferSenderId,
  offersList,
  searchQuery,
]);

  const clearCurrentFeedback = () => {
    clearFeedback();
    setFeedbackTarget(null);
  };

  const updateOfferTabDot = useCallback(
  (
    tab: OfferTab,
    hasChanges: boolean,
  ) => {
    setOfferTabChanges((current) => {
      if (
        current[tab] === hasChanges
      ) {
        return current;
      }

      return {
        ...current,
        [tab]: hasChanges,
      };
    });
  },
  [],
);

const getSeenSnapshotKey = useCallback(
  (tab: OfferTab) => {
    return [
      "homecycle",
      "offer-seen-snapshot",
      String(currentUserId),
      tab,
    ].join(":");
  },
  [currentUserId],
);

const saveSeenOfferSnapshot =
  useCallback(
    async (
      tab: OfferTab,
      snapshot: string,
    ) => {
      if (!currentUserId) {
        return;
      }

      seenOfferSnapshotsRef.current[
        tab
      ] = snapshot;

      await AsyncStorage.setItem(
        getSeenSnapshotKey(tab),
        snapshot,
      );

      updateOfferTabDot(tab, false);
    },
    [
      currentUserId,
      getSeenSnapshotKey,
      updateOfferTabDot,
    ],
  );

const checkOfferTabChanges =
  useCallback(
    async (
      tab: OfferTab,
      response: any,
    ) => {
      if (
        response?.isSuccess === false
      ) {
        throw response;
      }

      const pendingOffers =
        getPendingOffers(response);

      const currentSnapshot =
        createOfferSnapshot(
          pendingOffers,
        );

      latestOfferSnapshotsRef.current[
        tab
      ] = currentSnapshot;

      let seenSnapshot =
        seenOfferSnapshotsRef.current[
          tab
        ];

      if (seenSnapshot === undefined) {
        const storedSnapshot =
          await AsyncStorage.getItem(
            getSeenSnapshotKey(tab),
          );

        if (storedSnapshot === null) {
          /**
           * Lần đầu chạy tính năng:
           * lấy dữ liệu hiện tại làm mốc đã xem.
           * Không đánh dấu toàn bộ Offer cũ là chưa đọc.
           */
          await saveSeenOfferSnapshot(
            tab,
            currentSnapshot,
          );

          seenSnapshot =
            currentSnapshot;
        } else {
          seenSnapshot =
            storedSnapshot;

          seenOfferSnapshotsRef.current[
            tab
          ] = storedSnapshot;
        }
      }

      const isViewingThisTab =
        activeTabRef.current === tab;

      if (isViewingThisTab) {
        // Người dùng đang nhìn thấy dữ liệu mới.
        setOffersList(pendingOffers);

        await saveSeenOfferSnapshot(
          tab,
          currentSnapshot,
        );

        return;
      }

      updateOfferTabDot(
        tab,
        currentSnapshot !==
          seenSnapshot,
      );
    },
    [
      getSeenSnapshotKey,
      saveSeenOfferSnapshot,
      updateOfferTabDot,
    ],
  );

const pollOfferTabs = useCallback(async () => {
  const [receivedResult, sentResult] =
    await Promise.allSettled([
      offerApi.getReceivedOffers({
        PageNumber: 1,
        PageSize: 50,
      }),
      offerApi.getSentOffers({
        PageNumber: 1,
        PageSize: 50,
      }),
    ]);

  if (
    receivedResult.status === "fulfilled"
  ) {
    await checkOfferTabChanges(
      "received",
      receivedResult.value,
    );
  } else {
    console.error(
      "Polling received offers thất bại:",
      receivedResult.reason,
    );
  }

  if (sentResult.status === "fulfilled") {
    await checkOfferTabChanges(
      "sent",
      sentResult.value,
    );
  } else {
    console.error(
      "Polling sent offers thất bại:",
      sentResult.reason,
    );
  }
}, [checkOfferTabChanges]);

const markOfferTabAsSeen =
  useCallback(
    (tab: OfferTab) => {
      updateOfferTabDot(tab, false);

      const latestSnapshot =
        latestOfferSnapshotsRef.current[
          tab
        ];

      if (
        latestSnapshot !== undefined
      ) {
        void saveSeenOfferSnapshot(
          tab,
          latestSnapshot,
        );
      }
    },
    [
      saveSeenOfferSnapshot,
      updateOfferTabDot,
    ],
  );

  /**
   * Polling chỉ dành cho:
   * - GET /offers/received
   * - GET /offers/sent
   *
   * Không gọi GET /negotiations ở đây.
   * Tab Đoạn chat được cập nhật bằng SignalR ConversationUpdated.
   */
  useFocusEffect(
  useCallback(() => {
    if (!user) {
      return;
    }

    let isCancelled = false;
    let pollingTimer:
      | ReturnType<typeof setTimeout>
      | null = null;

    let delayIndex = 0;

    /**
     * Mỗi khi vào màn hình hoặc chuyển tab:
     * - chat gọi negotiations một lần;
     * - received gọi received một lần;
     * - sent gọi sent một lần.
     */
    void fetchData();

    const scheduleNextPoll = () => {
      if (isCancelled) {
        return;
      }

      const nextDelay =
        delayIndex <
        OFFER_POLLING_DELAYS.length
          ? OFFER_POLLING_DELAYS[
              delayIndex
            ]
          : MAX_OFFER_POLLING_DELAY;

      pollingTimer = setTimeout(
        async () => {
          if (isCancelled) {
            return;
          }

          /**
           * Dùng chung một nhịp polling cho:
           * - dữ liệu tab offer đang mở;
           * - chấm đỏ của tab offer còn lại.
           *
           * Không có request riêng cho badge.
           */
          await pollOfferTabs();

          if (isCancelled) {
            return;
          }

          delayIndex += 1;
          scheduleNextPoll();
        },
        nextDelay,
      );
    };

    // Lần polling đầu tiên sau 10 giây.
    scheduleNextPoll();

    return () => {
      isCancelled = true;

      // Vô hiệu hóa request tải trực tiếp của tab cũ.
      fetchRequestIdRef.current += 1;

      if (pollingTimer) {
        clearTimeout(pollingTimer);
      }
    };
  }, [
    activeTab,
    fetchData,
    pollOfferTabs,
    user,
  ]),
);

  const handleChangeTab = useCallback(
    (nextTab: ActiveTab) => {
      if (nextTab === activeTabRef.current) {
        if (nextTab === "received" || nextTab === "sent") {
          void markOfferTabAsSeen(nextTab);
        }
        return;
      }

      // Hủy hiệu lực response cũ đang chạy.
      fetchRequestIdRef.current += 1;

      // Xóa dữ liệu tab cũ ngay lập tức để "Đã gửi"
      // không xuất hiện tạm thời trong "Yêu cầu mới" và ngược lại.
      setOffersList([]);

      activeTabRef.current = nextTab;
      setActiveTab(nextTab);

      if (nextTab === "received" || nextTab === "sent") {
        void markOfferTabAsSeen(nextTab);
      }
    },
    [markOfferTabAsSeen],
  );

  const handleAcceptOffer = async (
    offerId: string,
  ) => {
    const confirmed = await confirm({
      title: "Chấp nhận thương lượng",
      message:
        "Bạn đồng ý mở phiên thương lượng với mức giá này?",
      confirmLabel: "Đồng ý",
      cancelLabel: "Quay lại",
    });

    if (!confirmed) {
      return;
    }

    clearFeedback();

    setFeedbackTarget({
      type: "offer",
      offerId,
    });

    try {
      setIsProcessingAction(true);

      const response =
        await offerApi.acceptOffer(
          offerId,
        );

      if (
        response?.isSuccess === false
      ) {
        throw response;
      }

      showSuccess(
        getApiSuccessMessage(
          response,
          "Đã chấp nhận thương lượng. Phòng chat đã được mở.",
        ),
      );

      /*
       * Giữ message ngay dưới nút trong một khoảng ngắn
       * trước khi offer biến khỏi danh sách Pending.
       */
      await wait(1200);

      clearCurrentFeedback();

      await fetchData();
    } catch (error: unknown) {
      showError(
        getApiErrorMessage(
          error,
          "Không thể chấp nhận thương lượng.",
        ),
      );
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleRejectOffer = async (
    offerId: string,
  ) => {
    const confirmed = await confirm({
      title: "Từ chối đề nghị",
      message:
        "Bạn có chắc muốn từ chối đề nghị này?",
      confirmLabel: "Từ chối",
      cancelLabel: "Quay lại",
      destructive: true,
    });

    if (!confirmed) {
      return;
    }

    clearFeedback();

    setFeedbackTarget({
      type: "offer",
      offerId,
    });

    try {
      setIsProcessingAction(true);

      const response =
        await offerApi.rejectOffer(
          offerId,
        );

      if (
        response?.isSuccess === false
      ) {
        throw response;
      }

      showSuccess(
        getApiSuccessMessage(
          response,
          "Đã từ chối đề nghị.",
        ),
      );

      await wait(1200);

      clearCurrentFeedback();

      await fetchData();
    } catch (error: unknown) {
      showError(
        getApiErrorMessage(
          error,
          "Không thể từ chối đề nghị.",
        ),
      );
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleOpenCounterModal = (
    offer: any,
  ) => {
    clearCurrentFeedback();

    setSelectedOffer(offer);

    setCounterPrice(
      offer.offerPrice?.toString() || "",
    );

    setCounterQuantity(
      offer.offerQuantity?.toString() ||
        "1",
    );

    setCounterMessage(
      "Chào bạn, tôi muốn đề xuất mức giá mới này.",
    );

    setShowCounterModal(true);
  };

  const handleCloseCounterModal = () => {
    if (isProcessingAction) {
      return;
    }

    clearCurrentFeedback();
    setShowCounterModal(false);
    setSelectedOffer(null);
  };

  const handleSubmitCounter =
    async () => {
      if (!selectedOffer) {
        return;
      }

      clearFeedback();

      setFeedbackTarget({
        type: "counter",
      });

      const price = Number(
        counterPrice.trim(),
      );

      const quantity = Number(
        counterQuantity.trim(),
      );

      if (
        !Number.isFinite(price) ||
        price <= 0 ||
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        showError(
          "Vui lòng nhập giá và số lượng hợp lệ.",
        );
        return;
      }

      try {
        setIsProcessingAction(true);

        const response =
          await offerApi.counterInitialOffer(
            selectedOffer.offerId,
            {
              offerPrice: price,
              offerQuantity: quantity,
              messageContent:
                counterMessage.trim() ||
                undefined,
            },
          );

        if (
          response?.isSuccess === false
        ) {
          throw response;
        }

        showSuccess(
          getApiSuccessMessage(
            response,
            "Đã gửi đề xuất giá mới thành công.",
          ),
        );

        await wait(1200);

        clearCurrentFeedback();
        setShowCounterModal(false);
        setSelectedOffer(null);

        await fetchData();
      } catch (error: unknown) {
        showError(
          getApiErrorMessage(
            error,
            "Không thể gửi đề xuất.",
          ),
        );
      } finally {
        setIsProcessingAction(false);
      }
    };

  const renderNegotiationItem = ({
    item,
  }: {
    item: any;
  }) => {
    const rawTime =
      item.lastMessageAt ||
      item.createdAt;

    const timeString = rawTime
      ? new Date(
          rawTime,
        ).toLocaleString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          day: "2-digit",
          month: "2-digit",
        })
      : "";

    const partnerName =
      item.otherPartyName ||
      "Đối tác";

    const avatarUri =
      getRobustAvatar(
        item.otherPartyAvatarUrl,
        partnerName,
      );

    const unreadCount = Number(
      item.unreadCount || 0,
    );

    return (
      <TouchableOpacity
        style={styles.offerCard}
        onPress={() => {
          router.push(
            `/chat/${item.negotiationId}` as any,
          );
        }}
      >
        <View
          style={
            styles.negotiationRow
          }
        >
          <Image
            source={{ uri: avatarUri }}
            style={
              styles.negotiationAvatar
            }
          />

          <View style={styles.flex}>
            <View
              style={
                styles.negotiationHeader
              }
            >
              <Text
                style={styles.offerName}
                numberOfLines={1}
              >
                {partnerName}
              </Text>

              <Text
                style={styles.offerTime}
              >
                {timeString}
              </Text>
            </View>

            <View
              style={
                styles.negotiationPreviewRow
              }
            >
              <Text
                style={
                  styles.negotiationPrice
                }
                numberOfLines={1}
              >
                Mức giá:{" "}
                <Text
                  style={
                    styles.negotiationPriceValue
                  }
                >
                  {Number(
                    item.currentOfferPrice ||
                      0,
                  ).toLocaleString(
                    "vi-VN",
                  )}{" "}
                  đ
                </Text>{" "}
                (x
                {item.currentOfferQuantity ||
                  0}
                )
              </Text>

              {unreadCount > 0 ? (
                <View
                  style={
                    styles.unreadBadge
                  }
                >
                  <Text
                    style={
                      styles.unreadBadgeText
                    }
                  >
                    {unreadCount > 99
                      ? "99+"
                      : unreadCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderOfferItem = ({
    item,
  }: {
    item: any;
  }) => {
    const isMySentOffer =
      getOfferSenderId(item) ===
      String(currentUserId ?? "");

    const partnerName =
      (isMySentOffer
        ? item.receiverName
        : item.senderName) ||
      "Đối tác";

    const partnerAvatarUrl =
      isMySentOffer
        ? item.receiverAvatarUrl
        : item.senderAvatarUrl;

    const avatarUri =
      getRobustAvatar(
        partnerAvatarUrl,
        partnerName,
      );

    const timeString = item.createdAt
      ? new Date(
          item.createdAt,
        ).toLocaleString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "";

    const showOfferFeedback =
      feedbackTarget?.type ===
        "offer" &&
      feedbackTarget.offerId ===
        item.offerId;

    return (
      <View style={styles.offerCard}>
        <View style={styles.offerHeader}>
          <Image
            source={{ uri: avatarUri }}
            style={styles.offerAvatar}
          />

          <View style={styles.flex}>
            <Text style={styles.offerName}>
              {isMySentOffer
                ? `Bạn đã gửi cho ${partnerName}`
                : `${partnerName} đã gửi đề nghị`}
            </Text>

            <Text style={styles.offerTime}>
              {timeString}
            </Text>
          </View>
        </View>

        <View style={styles.offerDetails}>
          <Text
            style={styles.offerProduct}
            numberOfLines={1}
          >
            {item.productName ||
              item.postTitle ||
              "Sản phẩm"}
          </Text>

          <Text style={styles.offerPrice}>
            Giá thương lượng:{" "}
            {Number(
              item.offerPrice || 0,
            ).toLocaleString("vi-VN")}{" "}
            đ
          </Text>

          <Text style={styles.offerPrice}>
            Số lượng:{" "}
            {item.offerQuantity || 0}
          </Text>
        </View>

        {!isMySentOffer ? (
          <View style={styles.actionArea}>
            <View
              style={styles.actionRow}
            >
              <TouchableOpacity
                style={styles.rejectBtn}
                onPress={() => {
                  void handleRejectOffer(
                    item.offerId,
                  );
                }}
                disabled={
                  isProcessingAction
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
                style={styles.acceptBtn}
                onPress={() => {
                  void handleAcceptOffer(
                    item.offerId,
                  );
                }}
                disabled={
                  isProcessingAction
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
                styles.counterBtnOutline
              }
              onPress={() =>
                handleOpenCounterModal(
                  item,
                )
              }
              disabled={
                isProcessingAction
              }
            >
              <Text
                style={
                  styles.counterBtnText
                }
              >
                Đề xuất giá mới
              </Text>
            </TouchableOpacity>

            {showOfferFeedback ? (
              <InlineFeedback
                feedback={feedback}
                onDismiss={
                  clearCurrentFeedback
                }
                style={
                  styles.actionFeedback
                }
              />
            ) : null}
          </View>
        ) : (
          <View style={styles.actionArea}>
            <TouchableOpacity
              style={styles.fullActionButton}
              onPress={() => {
                router.push(
                  `/posts/${item.postId}` as any,
                );
              }}
            >
              <Text
                style={
                  styles.rejectBtnText
                }
              >
                Xem lại bài đăng
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const pageFeedback =
    feedbackTarget?.type === "page"
      ? feedback
      : null;

  const counterFeedback =
    feedbackTarget?.type === "counter"
      ? feedback
      : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View
        style={[
          styles.mobileWrapper,
          {
            width,
          },
        ]}
      >
        <MainHeader
          title="Tin nhắn"
          showBack={false}
        />

        <View
          style={styles.searchContainer}
        >
          <View style={styles.searchBox}>
            <Ionicons
              name="search"
              size={20}
              color={COLORS.textLight}
              style={styles.searchIcon}
            />

            <TextInput
              style={[
                styles.searchInput,
                Platform.OS === "web"
                  ? ({
                      outlineStyle:
                        "none",
                    } as any)
                  : undefined,
              ]}
              placeholder="Tìm kiếm đoạn chat..."
              placeholderTextColor={
                COLORS.textLight
              }
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === "chat"
                ? styles.tabBtnActive
                : undefined,
            ]}
            onPress={() =>
              handleChangeTab("chat")
            }
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "chat"
                  ? styles.tabTextActive
                  : undefined,
              ]}
            >
              Đoạn chat
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === "received"
                ? styles.tabBtnActive
                : undefined,
            ]}
            onPress={() =>
              handleChangeTab(
                "received",
              )
            }
          >
            <View style={styles.tabLabelRow}>
              <Text
                style={[
                  styles.tabText,
                  activeTab === "received"
                    ? styles.tabTextActive
                    : undefined,
                ]}
              >
                Yêu cầu mới
              </Text>

              {offerTabChanges.received ? (
                <View style={styles.tabUnreadDot} />
              ) : null}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === "sent"
                ? styles.tabBtnActive
                : undefined,
            ]}
            onPress={() =>
              handleChangeTab("sent")
            }
          >
            <View style={styles.tabLabelRow}>
              <Text
                style={[
                  styles.tabText,
                  activeTab === "sent"
                    ? styles.tabTextActive
                    : undefined,
                ]}
              >
                Đã gửi
              </Text>

              {offerTabChanges.sent ? (
                <View style={styles.tabUnreadDot} />
              ) : null}
            </View>
          </TouchableOpacity>
        </View>

        {pageFeedback ? (
          <InlineFeedback
            feedback={pageFeedback}
            onDismiss={
              clearCurrentFeedback
            }
            style={styles.pageFeedback}
          />
        ) : null}

        <View style={styles.contentArea}>
          {isLoading ? (
            <View
              style={styles.loadingContainer}
            >
              <ActivityIndicator
                size="large"
                color={COLORS.primary}
              />

              <Text
                style={styles.loadingText}
              >
                Đang tải dữ liệu...
              </Text>
            </View>
          ) : activeTab === "chat" ? (
            <FlatList
              data={
                filteredNegotiations
              }
              keyExtractor={(item) =>
                item.negotiationId
              }
              renderItem={
                renderNegotiationItem
              }
              showsVerticalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.listContent
              }
              ListEmptyComponent={
                <Text
                  style={
                    styles.emptyListText
                  }
                >
                  {searchQuery.trim()
                    ? "Không tìm thấy cuộc trò chuyện phù hợp."
                    : "Chưa có cuộc trò chuyện nào đang diễn ra."}
                </Text>
              }
            />
          ) : (
            <FlatList
              data={filteredOffers}
              keyExtractor={(item) =>
                item.offerId
              }
              renderItem={
                renderOfferItem
              }
              showsVerticalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.listContent
              }
              ListEmptyComponent={
                <Text
                  style={
                    styles.emptyListText
                  }
                >
                  {searchQuery.trim()
                    ? "Không tìm thấy yêu cầu thương lượng phù hợp."
                    : "Bạn chưa có yêu cầu thương lượng nào."}
                </Text>
              }
            />
          )}
        </View>

        <Modal
          visible={showCounterModal}
          transparent
          animationType="slide"
          onRequestClose={
            handleCloseCounterModal
          }
        >
          <KeyboardAvoidingView
            behavior={
              Platform.OS === "ios"
                ? "padding"
                : "height"
            }
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
                  Đề xuất giá mới
                </Text>

                <TouchableOpacity
                  onPress={
                    handleCloseCounterModal
                  }
                  disabled={
                    isProcessingAction
                  }
                  style={
                    styles.modalCloseButton
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
                <View
                  style={styles.inputGroup}
                >
                  <Text
                    style={
                      styles.inputLabel
                    }
                  >
                    Giá đề xuất (VNĐ){" "}
                    <Text
                      style={
                        styles.requiredMark
                      }
                    >
                      *
                    </Text>
                  </Text>

                  <TextInput
                    style={[
                      styles.input,
                      Platform.OS === "web"
                        ? ({
                            outlineStyle:
                              "none",
                          } as any)
                        : undefined,
                    ]}
                    keyboardType="numeric"
                    value={counterPrice}
                    onChangeText={
                      setCounterPrice
                    }
                    editable={
                      !isProcessingAction
                    }
                  />
                </View>

                <View
                  style={styles.inputGroup}
                >
                  <Text
                    style={
                      styles.inputLabel
                    }
                  >
                    Số lượng{" "}
                    <Text
                      style={
                        styles.requiredMark
                      }
                    >
                      *
                    </Text>
                  </Text>

                  <TextInput
                    style={[
                      styles.input,
                      Platform.OS === "web"
                        ? ({
                            outlineStyle:
                              "none",
                          } as any)
                        : undefined,
                    ]}
                    keyboardType="numeric"
                    value={counterQuantity}
                    onChangeText={
                      setCounterQuantity
                    }
                    editable={
                      !isProcessingAction
                    }
                  />
                </View>

                <View
                  style={styles.inputGroup}
                >
                  <Text
                    style={
                      styles.inputLabel
                    }
                  >
                    Lời nhắn cho khách hàng
                  </Text>

                  <TextInput
                    style={[
                      styles.input,
                      styles.messageInput,
                      Platform.OS === "web"
                        ? ({
                            outlineStyle:
                              "none",
                          } as any)
                        : undefined,
                    ]}
                    multiline
                    value={counterMessage}
                    onChangeText={
                      setCounterMessage
                    }
                    placeholder="Nhập lời nhắn..."
                    placeholderTextColor={
                      COLORS.textLight
                    }
                    editable={
                      !isProcessingAction
                    }
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    isProcessingAction
                      ? styles.disabledButton
                      : undefined,
                  ]}
                  onPress={() => {
                    void handleSubmitCounter();
                  }}
                  disabled={
                    isProcessingAction
                  }
                >
                  {isProcessingAction ? (
                    <ActivityIndicator
                      color={COLORS.white}
                    />
                  ) : (
                    <Text
                      style={
                        styles.primaryBtnText
                      }
                    >
                      Gửi đề xuất
                    </Text>
                  )}
                </TouchableOpacity>

                {counterFeedback ? (
                  <InlineFeedback
                    feedback={
                      counterFeedback
                    }
                    onDismiss={
                      clearCurrentFeedback
                    }
                    style={
                      styles.counterFeedback
                    }
                  />
                ) : null}
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {confirmationModal}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  safeArea: {
    flex: 1,
    backgroundColor: COLORS.border,
    alignItems: "center",
  },

  mobileWrapper: {
    flex: 1,
    backgroundColor: COLORS.background,

    ...(Platform.OS === "web"
      ? ({
          boxShadow:
            "0px 0px 20px rgba(0,0,0,0.1)",
        } as any)
      : {}),
  },

  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
  },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#F8FAFC",
  },

  searchIcon: {
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    height: "100%",
    color: COLORS.text,
    fontSize: 15,
  },

  tabContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 4,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },

  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 6,
  },

  tabBtnActive: {
    backgroundColor: COLORS.white,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  tabText: {
    color: COLORS.textLight,
    fontSize: 13,
    fontWeight: "600",
  },

  tabTextActive: {
    color: COLORS.primary,
  },

  tabLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  tabUnreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
  },

  contentArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  pageFeedback: {
    marginHorizontal: 16,
    marginBottom: 8,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 10,
    color: COLORS.textLight,
    fontSize: 13,
  },

  listContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },

  emptyListText: {
    marginTop: 40,
    color: COLORS.textLight,
    textAlign: "center",
  },

  offerCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  negotiationRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  negotiationAvatar: {
    width: 44,
    height: 44,
    marginRight: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  negotiationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },

  negotiationPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  negotiationPrice: {
    flex: 1,
    color: COLORS.textLight,
    fontSize: 13,
  },

  negotiationPriceValue: {
    color: COLORS.primary,
    fontWeight: "bold",
  },

  unreadBadge: {
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: COLORS.error,
  },

  unreadBadgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "800",
  },

  offerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  offerAvatar: {
    width: 40,
    height: 40,
    marginRight: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  offerName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "bold",
  },

  offerTime: {
    marginTop: 2,
    color: COLORS.textLight,
    fontSize: 12,
  },

  offerDetails: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
  },

  offerProduct: {
    marginBottom: 4,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "600",
  },

  offerPrice: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "bold",
  },

  actionArea: {
    gap: 8,
  },

  actionRow: {
    flexDirection: "row",
    gap: 12,
  },

  rejectBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F1F5F9",
  },

  rejectBtnText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },

  acceptBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },

  acceptBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "600",
  },

  counterBtnOutline: {
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },

  counterBtnText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "bold",
  },

  fullActionButton: {
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F1F5F9",
  },

  actionFeedback: {
    marginTop: 2,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },

  modalContent: {
    padding: 24,
    paddingBottom:
      Platform.OS === "ios" ? 40 : 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: COLORS.white,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  modalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "bold",
  },

  modalCloseButton: {
    padding: 4,
  },

  modalBody: {
    gap: 16,
  },

  inputGroup: {
    gap: 8,
  },

  inputLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
  },

  requiredMark: {
    color: COLORS.error,
  },

  input: {
    height: 50,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    color: COLORS.text,
    fontSize: 15,
    backgroundColor: "#F8FAFC",
  },

  messageInput: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: "top",
  },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },

  primaryBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "bold",
  },

  disabledButton: {
    opacity: 0.7,
  },

  counterFeedback: {
    marginTop: -4,
  },
});