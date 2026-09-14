import { DEFAULT_AVATAR_URI } from "../../utils/avatar";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  AppState,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ModalBackdrop, ModalSurface } from "../../components/shared/ModalBackdrop";
import { COLORS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useChatRealtime } from "../../contexts/ChatRealtimeContext";
import apiClient from "../../services/apis/axiosClient";
import {
  getApiErrorMessage,
  getApiSuccessMessage,
} from "../../utils/apiFeedback";

type OfferTab = "received" | "sent";
type ActiveTab = OfferTab;
type OfferSort = "newest" | "highest";
type OfferTabChanges = Record<OfferTab, boolean>;

type FeedbackTarget =
  | { type: "page" }
  | { type: "offer"; offerId: string }
  | { type: "edit-offer" }
  | null;

type LocalFeedback = {
  type: "error" | "success" | "info";
  text: string;
} | null;

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ConfirmState = {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
} | null;

const offerApi = {
  getSentOffers: (params?: { PageNumber?: number; PageSize?: number }) =>
    apiClient.get("/offers/sent", { params }).then((response) => response.data),

  getReceivedOffers: (params?: { PageNumber?: number; PageSize?: number }) =>
    apiClient
      .get("/offers/received", { params })
      .then((response) => response.data),

  acceptOffer: (offerId: string, version: number) =>
    apiClient
      .patch(`/offers/${offerId}/accept`, { version })
      .then((response) => response.data),

  rejectOffer: (offerId: string) =>
    apiClient
      .post(`/offers/${offerId}/reject`)
      .then((response) => response.data),

  cancelOffer: (offerId: string) =>
    apiClient
      .post(`/offers/${offerId}/cancel`)
      .then((response) => response.data),

  counterInitialOffer: (
    offerId: string,
    data: {
      offerPrice: number;
      offerQuantity: number;
      version: number;
    },
  ) =>
    apiClient
      .patch(`/offers/${offerId}/counter`, data)
      .then((response) => response.data),

  updateOffer: (
    offerId: string,
    data: {
      offerPrice: number;
      offerQuantity: number;
      version: number;
    },
  ) =>
    apiClient
      .put(`/offers/${offerId}`, data)
      .then((response) => response.data),

};

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const getOfferItems = (response: any): any[] => {
  const items = response?.items ?? response?.data?.items ?? [];
  return Array.isArray(items) ? items : [];
};

const getPendingOffers = (response: any): any[] =>
  getOfferItems(response)
    .filter(
      (offer: any) =>
        offer.offerStatus === "Pending" || offer.offerStatus === 0,
    )
    .sort(
      (first: any, second: any) =>
        new Date(second.createdAt).getTime() -
        new Date(first.createdAt).getTime(),
    );

const createOfferSnapshot = (offers: any[]) =>
  offers
    .map((offer) =>
      [
        String(offer.offerId ?? ""),
        String(offer.offerPrice ?? ""),
        String(offer.offerQuantity ?? ""),
        String(offer.offerStatus ?? ""),
      ].join(":"),
    )
    .sort()
    .join("|");

const normalizeSearchText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLocaleLowerCase("vi-VN");

const getOfferErrorCode = (error: any) =>
  String(
    error?.response?.data?.error?.code ??
      error?.response?.data?.code ??
      error?.error?.code ??
      error?.code ??
      "",
  )
    .trim()
    .toUpperCase();

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

function InlineFeedback({
  feedback,
  onDismiss,
  style,
}: {
  feedback: LocalFeedback;
  onDismiss?: () => void;
  style?: any;
}) {
  if (!feedback) return null;

  const palette =
    feedback.type === "error"
      ? {
          backgroundColor: "rgba(122, 16, 18, 0.08)",
          borderColor: "rgba(122, 16, 18, 0.22)",
          color: "#7A1012",
          icon: "alert-circle-outline" as const,
        }
      : feedback.type === "success"
        ? {
            backgroundColor: "rgba(47, 118, 93, 0.10)",
            borderColor: "rgba(47, 118, 93, 0.24)",
            color: "#2F765D",
            icon: "checkmark-circle-outline" as const,
          }
        : {
            backgroundColor: "rgba(84, 123, 125, 0.10)",
            borderColor: "rgba(84, 123, 125, 0.24)",
            color: "#2B5659",
            icon: "information-circle-outline" as const,
          };

  return (
    <View
      style={[
        styles.localFeedback,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
        },
        style,
      ]}
    >
      <Ionicons name={palette.icon} size={18} color={palette.color} />
      <Text style={[styles.localFeedbackText, { color: palette.color }]}>
        {feedback.text}
      </Text>
      {onDismiss ? (
        <TouchableOpacity onPress={onDismiss} style={styles.feedbackDismissButton}>
          <Ionicons name="close" size={17} color={palette.color} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function useLocalConfirm() {
  const [state, setState] = useState<ConfirmState>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setState({ options, resolve });
      }),
    [],
  );

  const finish = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  const confirmationModal = (
    <Modal
      visible={Boolean(state)}
      transparent
      animationType="fade"
      onRequestClose={() => finish(false)}
    >
      <ModalBackdrop style={styles.confirmOverlay} onPress={() => finish(false)}>
        <ModalSurface style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>{state?.options.title}</Text>
          <Text style={styles.confirmMessage}>{state?.options.message}</Text>
          <View style={styles.confirmActions}>
            <TouchableOpacity
              style={styles.confirmCancelButton}
              onPress={() => finish(false)}
            >
              <Text style={styles.confirmCancelText}>
                {state?.options.cancelLabel || "Hủy"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmPrimaryButton,
                state?.options.destructive
                  ? styles.confirmDestructiveButton
                  : undefined,
              ]}
              onPress={() => finish(true)}
            >
              <Text style={styles.confirmPrimaryText}>
                {state?.options.confirmLabel || "Xác nhận"}
              </Text>
            </TouchableOpacity>
          </View>
        </ModalSurface>
      </ModalBackdrop>
    </Modal>
  );

  return { confirm, confirmationModal };
}

export default function OfferManagementPanel({
  initialTab,
}: {
  initialTab?: OfferTab;
}) {
  const router = useRouter();
  const requestedTabParam = initialTab;
  const requestedTab: ActiveTab =
    initialTab === "sent" ? "sent" : "received";

  const { user } = useAuth();
  const {
    connection,
    connectionStatus,
    reconnectVersion,
  } = useChatRealtime();
  const currentUserId = user?.userId || user?.id;
  const isWaitingForNetwork =
    connectionStatus === "reconnecting" ||
    connectionStatus === "disconnected";

  const fetchRequestIdRef = useRef(0);
  const activeTabRef = useRef<ActiveTab>(requestedTab);
  const lastHandledRequestedTabRef = useRef<string | undefined>(
    undefined,
  );
  const handledReconnectVersionRef = useRef(0);
  const isScreenFocusedRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const offerSyncInFlightRef = useRef(false);
  const offerSyncPendingRef = useRef(false);
  const seenOfferSnapshotsRef = useRef<Partial<Record<OfferTab, string>>>({});
  const latestOfferSnapshotsRef = useRef<Partial<Record<OfferTab, string>>>({});

  const [activeTab, setActiveTab] =
    useState<ActiveTab>(requestedTab);
  const [offerTabChanges, setOfferTabChanges] = useState<OfferTabChanges>({
    received: false,
    sent: false,
  });
  const [offerSort, setOfferSort] = useState<OfferSort>("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [offersList, setOffersList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const [showEditOfferModal, setShowEditOfferModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState<any>(null);
  const [editOfferPrice, setEditOfferPrice] = useState("");
  const [editOfferQuantity, setEditOfferQuantity] = useState("");

  const [feedbackTarget, setFeedbackTarget] = useState<FeedbackTarget>(null);
  const [feedback, setFeedback] = useState<LocalFeedback>(null);

  const { confirm, confirmationModal } = useLocalConfirm();

  const clearFeedback = useCallback(() => setFeedback(null), []);
  const showError = useCallback(
    (text: string) => setFeedback({ type: "error", text }),
    [],
  );
  const showSuccess = useCallback(
    (text: string) => setFeedback({ type: "success", text }),
    [],
  );

  const clearCurrentFeedback = useCallback(() => {
    clearFeedback();
    setFeedbackTarget(null);
  }, [clearFeedback]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    handledReconnectVersionRef.current = 0;
    seenOfferSnapshotsRef.current = {};
    latestOfferSnapshotsRef.current = {};
    setOfferTabChanges({ received: false, sent: false });
  }, [currentUserId]);

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

  const updateOfferTabDot = useCallback(
    (tab: OfferTab, hasChanges: boolean) => {
      setOfferTabChanges((current) =>
        current[tab] === hasChanges
          ? current
          : { ...current, [tab]: hasChanges },
      );
    },
    [],
  );

  const getSeenSnapshotKey = useCallback(
    (tab: OfferTab) =>
      [
        "homecycle",
        "offer-seen-snapshot",
        String(currentUserId),
        tab,
      ].join(":"),
    [currentUserId],
  );

  const saveSeenOfferSnapshot = useCallback(
    async (tab: OfferTab, snapshot: string) => {
      if (!currentUserId) return;

      seenOfferSnapshotsRef.current[tab] = snapshot;
      await AsyncStorage.setItem(getSeenSnapshotKey(tab), snapshot);
      updateOfferTabDot(tab, false);
    },
    [currentUserId, getSeenSnapshotKey, updateOfferTabDot],
  );

  const checkOfferTabChanges = useCallback(
    async (tab: OfferTab, response: any) => {
      if (response?.isSuccess === false) throw response;

      const pendingOffers = getPendingOffers(response);
      const currentSnapshot = createOfferSnapshot(pendingOffers);
      latestOfferSnapshotsRef.current[tab] = currentSnapshot;

      let seenSnapshot = seenOfferSnapshotsRef.current[tab];

      if (seenSnapshot === undefined) {
        const storedSnapshot = await AsyncStorage.getItem(getSeenSnapshotKey(tab));

        if (storedSnapshot === null) {
          await saveSeenOfferSnapshot(tab, currentSnapshot);
          seenSnapshot = currentSnapshot;
        } else {
          seenSnapshot = storedSnapshot;
          seenOfferSnapshotsRef.current[tab] = storedSnapshot;
        }
      }

      if (activeTabRef.current === tab) {
        setOffersList(pendingOffers);
        await saveSeenOfferSnapshot(tab, currentSnapshot);
        return;
      }

      updateOfferTabDot(tab, currentSnapshot !== seenSnapshot);
    },
    [getSeenSnapshotKey, saveSeenOfferSnapshot, updateOfferTabDot],
  );

  const fetchData = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent === true;
      const requestId = ++fetchRequestIdRef.current;

      if (!user) {
        setOffersList([]);
        if (!silent) setIsLoading(false);
        return false;
      }

      if (!silent) setIsLoading(true);

      try {
        const response =
          activeTab === "received"
            ? await offerApi.getReceivedOffers({ PageSize: 50, PageNumber: 1 })
            : await offerApi.getSentOffers({ PageSize: 50, PageNumber: 1 });

        if (requestId !== fetchRequestIdRef.current) return;
        if (response?.isSuccess === false) throw response;

        await checkOfferTabChanges(activeTab as OfferTab, response);
        return true;
      } catch (error: unknown) {
        if (requestId !== fetchRequestIdRef.current) return;

        if (!silent) {
          setFeedbackTarget({ type: "page" });
          showError(
            getApiErrorMessage(error, "Không thể tải danh sách đề nghị."),
          );
        }

        return false;
      } finally {
        if (!silent && requestId === fetchRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [activeTab, checkOfferTabChanges, showError, user],
  );

  const syncOfferTabs = useCallback(async () => {
    if (offerSyncInFlightRef.current) {
      offerSyncPendingRef.current = true;
      return;
    }

    offerSyncInFlightRef.current = true;

    try {
      do {
        offerSyncPendingRef.current = false;

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

        const syncTasks: Promise<void>[] = [];

        if (receivedResult.status === "fulfilled") {
          syncTasks.push(
            checkOfferTabChanges(
              "received",
              receivedResult.value,
            ),
          );
        }

        if (sentResult.status === "fulfilled") {
          syncTasks.push(
            checkOfferTabChanges(
              "sent",
              sentResult.value,
            ),
          );
        }

        await Promise.allSettled(syncTasks);
      } while (offerSyncPendingRef.current);
    } finally {
      offerSyncInFlightRef.current = false;
    }
  }, [checkOfferTabChanges]);

  const markOfferTabAsSeen = useCallback(
    (tab: OfferTab) => {
      updateOfferTabDot(tab, false);
      const latestSnapshot = latestOfferSnapshotsRef.current[tab];
      if (latestSnapshot !== undefined) {
        void saveSeenOfferSnapshot(tab, latestSnapshot);
      }
    },
    [saveSeenOfferSnapshot, updateOfferTabDot],
  );

  const applyRealtimeOfferChange = useCallback(
    (payload: any) => {
      const offer = payload?.data ?? payload;
      const offerId = String(
        offer?.offerId ?? offer?.OfferId ?? "",
      );

      if (!offerId || !currentUserId) return;

      const senderId = String(
        offer?.senderId ??
          offer?.SenderId ??
          offer?.sender?.userId ??
          offer?.sender?.UserId ??
          "",
      );
      const receiverId = String(
        offer?.receiverId ??
          offer?.ReceiverId ??
          offer?.receiver?.userId ??
          offer?.receiver?.UserId ??
          "",
      );
      const myUserId = String(currentUserId).toLowerCase();

      const affectedTab: OfferTab | null =
        receiverId.toLowerCase() === myUserId
          ? "received"
          : senderId.toLowerCase() === myUserId
            ? "sent"
            : null;

      if (!affectedTab) {
        // UpdateAsync currently publishes OfferResponse from the locked
        // entity returned by GetByIdForUpdateAsync. That entity may not
        // contain Sender/Receiver navigation data, so the event can still
        // identify the Offer but not the affected tab. If the Offer is
        // already visible in the active list, update it safely by offerId.
        setOffersList((current) => {
          const existingIndex = current.findIndex(
            (item) => String(item?.offerId ?? "") === offerId,
          );

          if (existingIndex < 0) return current;

          const fallbackStatus = String(
            offer?.offerStatus ?? offer?.OfferStatus ?? "",
          )
            .trim()
            .toLowerCase();
          const fallbackIsPending =
            fallbackStatus === "pending" || fallbackStatus === "0";

          if (!fallbackIsPending) {
            return current.filter(
              (item) => String(item?.offerId ?? "") !== offerId,
            );
          }

          return current.map((item) =>
            String(item?.offerId ?? "") === offerId
              ? {
                  ...item,
                  postId:
                    offer?.postId ??
                    offer?.PostId ??
                    item?.postId,
                  offerPrice:
                    offer?.offerPrice ??
                    offer?.OfferPrice ??
                    item?.offerPrice,
                  offerQuantity:
                    offer?.offerQuantity ??
                    offer?.OfferQuantity ??
                    item?.offerQuantity,
                  offerStatus:
                    offer?.offerStatus ??
                    offer?.OfferStatus ??
                    item?.offerStatus,
                  version:
                    offer?.version ??
                    offer?.Version ??
                    item?.version,
                  createdAt:
                    offer?.createdAt ??
                    offer?.CreatedAt ??
                    item?.createdAt,
                }
              : item,
          );
        });

        return;
      }

      const status = String(
        offer?.offerStatus ?? offer?.OfferStatus ?? "",
      )
        .trim()
        .toLowerCase();
      const isPending =
        status === "pending" || status === "0";

      const normalizedOffer = {
        ...offer,
        offerId,
        postId: offer?.postId ?? offer?.PostId ?? "",
        senderId,
        senderName:
          offer?.senderName ??
          offer?.SenderName ??
          offer?.sender?.displayName ??
          offer?.sender?.DisplayName ??
          "",
        senderAvatarUrl:
          offer?.senderAvatarUrl ??
          offer?.SenderAvatarUrl ??
          offer?.sender?.avatarUrl ??
          offer?.sender?.AvatarUrl ??
          null,
        receiverId,
        receiverName:
          offer?.receiverName ??
          offer?.ReceiverName ??
          offer?.receiver?.displayName ??
          offer?.receiver?.DisplayName ??
          "",
        receiverAvatarUrl:
          offer?.receiverAvatarUrl ??
          offer?.ReceiverAvatarUrl ??
          offer?.receiver?.avatarUrl ??
          offer?.receiver?.AvatarUrl ??
          null,
        offerPrice: offer?.offerPrice ?? offer?.OfferPrice ?? 0,
        offerQuantity:
          offer?.offerQuantity ?? offer?.OfferQuantity ?? 0,
        offerStatus: offer?.offerStatus ?? offer?.OfferStatus,
        version: offer?.version ?? offer?.Version,
        createdAt: offer?.createdAt ?? offer?.CreatedAt,
      };

      if (activeTabRef.current === affectedTab) {
        setOffersList((current) => {
          const withoutCurrentOffer = current.filter(
            (item) => String(item?.offerId ?? "") !== offerId,
          );

          return isPending
            ? [normalizedOffer, ...withoutCurrentOffer]
            : withoutCurrentOffer;
        });

        updateOfferTabDot(affectedTab, false);
        return;
      }

      updateOfferTabDot(affectedTab, true);
    },
    [currentUserId, updateOfferTabDot],
  );

  useFocusEffect(
    useCallback(() => {
      if (!connection) return;

      const handleOfferChanged = (payload: any) => {
        applyRealtimeOfferChange(payload);
      };

      connection.on("OfferCreated", handleOfferChanged);
      connection.on("OfferUpdated", handleOfferChanged);

      return () => {
        connection.off("OfferCreated", handleOfferChanged);
        connection.off("OfferUpdated", handleOfferChanged);
      };
    }, [applyRealtimeOfferChange, connection]),
  );

  useEffect(() => {
    if (
      !user ||
      reconnectVersion <= 0 ||
      handledReconnectVersionRef.current ===
        reconnectVersion
    ) {
      return;
    }

    handledReconnectVersionRef.current =
      reconnectVersion;

    void syncOfferTabs();
  }, [reconnectVersion, syncOfferTabs, user]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;

      isScreenFocusedRef.current = true;

      // Fetch only the active tab. Realtime Offer events update local state
      // directly; REST is kept for focus/reconnect/foreground recovery.
      void fetchData();

      return () => {
        isScreenFocusedRef.current = false;
        fetchRequestIdRef.current += 1;
      };
    }, [fetchData, user]),
  );

  useEffect(() => {
    if (!user) return;

    const subscription = AppState.addEventListener(
      "change",
      (nextState) => {
        const previousState = appStateRef.current;
        appStateRef.current = nextState;

        if (
          !isScreenFocusedRef.current ||
          previousState === "active" ||
          nextState !== "active"
        ) {
          return;
        }

        void syncOfferTabs();
      },
    );

    return () => {
      subscription.remove();
    };
  }, [
    syncOfferTabs,
    user,
  ]);

  const handleChangeTab = useCallback(
    (nextTab: ActiveTab) => {
      if (nextTab === activeTabRef.current) {
        if (nextTab === "received" || nextTab === "sent") {
          void markOfferTabAsSeen(nextTab);
        }
        return;
      }

      fetchRequestIdRef.current += 1;
      clearCurrentFeedback();
      setOffersList([]);
      activeTabRef.current = nextTab;
      setActiveTab(nextTab);

      if (nextTab === "received" || nextTab === "sent") {
        void markOfferTabAsSeen(nextTab);
      }
    },
    [clearCurrentFeedback, markOfferTabAsSeen],
  );

  useEffect(() => {
    if (!requestedTabParam) return;

    const requestedKey = String(requestedTabParam);

    if (
      lastHandledRequestedTabRef.current === requestedKey
    ) {
      return;
    }

    lastHandledRequestedTabRef.current = requestedKey;
    handleChangeTab(requestedTab);
  }, [
    handleChangeTab,
    requestedTab,
    requestedTabParam,
  ]);

  const handleCancelOffer = async (offerId: string) => {
    const confirmed = await confirm({
      title: "Hủy đề nghị đã gửi",
      message:
        "Đề nghị đang chờ phản hồi sẽ bị hủy và không thể tiếp tục được đối tác chấp nhận. Bạn có muốn tiếp tục?",
      confirmLabel: "Hủy đề nghị",
      cancelLabel: "Giữ lại",
      destructive: true,
    });
    if (!confirmed) return;

    clearFeedback();
    setFeedbackTarget({ type: "offer", offerId });

    try {
      setIsProcessingAction(true);
      const response = await offerApi.cancelOffer(offerId);
      if (response?.isSuccess === false) throw response;

      showSuccess(getApiSuccessMessage(response, "Đã hủy đề nghị."));
      await wait(900);
      clearCurrentFeedback();
      await fetchData();
    } catch (error: unknown) {
      showError(getApiErrorMessage(error, "Không thể hủy đề nghị lúc này."));
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleOpenEditOfferModal = (offer: any) => {
    clearCurrentFeedback();

    setEditingOffer(offer);
    setEditOfferPrice(String(offer?.offerPrice ?? ""));
    setEditOfferQuantity(String(offer?.offerQuantity ?? "1"));
    setShowEditOfferModal(true);
  };

  const handleCloseEditOfferModal = () => {
    if (isProcessingAction) return;

    clearCurrentFeedback();
    setShowEditOfferModal(false);
    setEditingOffer(null);
  };

  const handleSubmitEditOffer = async () => {
    if (!editingOffer) return;

    clearFeedback();
    setFeedbackTarget({ type: "edit-offer" });

    const price = Number(editOfferPrice.trim());
    const quantity = Number(editOfferQuantity.trim());
    const version = Number(
      editingOffer?.version ?? editingOffer?.Version,
    );

    if (!Number.isInteger(version) || version < 0) {
      setShowEditOfferModal(false);
      setEditingOffer(null);

      setFeedbackTarget({ type: "page" });
      showError(
        "Không xác định được phiên bản hiện tại của đề nghị. Danh sách đã được làm mới.",
      );

      await fetchData();
      return;
    }

    if (
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      showError("Vui lòng nhập giá và số lượng hợp lệ.");
      return;
    }

    try {
      setIsProcessingAction(true);

      const response = await offerApi.updateOffer(
        editingOffer.offerId,
        {
          offerPrice: price,
          offerQuantity: quantity,
          version,
        },
      );

      if (response?.isSuccess === false) throw response;

      showSuccess(
        getApiSuccessMessage(
          response,
          "Đã cập nhật đề nghị thành công.",
        ),
      );

      await wait(900);

      clearCurrentFeedback();
      setShowEditOfferModal(false);
      setEditingOffer(null);

      await fetchData();
    } catch (error: unknown) {
      if (getOfferErrorCode(error) === "OFFER_TERMS_CHANGED") {
        setShowEditOfferModal(false);
        setEditingOffer(null);

        setFeedbackTarget({ type: "page" });
        showError(
          "Đề nghị vừa có thay đổi. Danh sách đã được làm mới, vui lòng xem lại trước khi chỉnh sửa.",
        );

        await fetchData();
        return;
      }

      showError(
        getApiErrorMessage(
          error,
          "Không thể cập nhật đề nghị lúc này.",
        ),
      );
    } finally {
      setIsProcessingAction(false);
    }
  };


  const filteredOffers = useMemo(() => {
    const myUserId = String(currentUserId ?? "");

    const offersOfCurrentTab = offersList.filter((item) => {
      const senderId = getOfferSenderId(item);
      const receiverId = getOfferReceiverId(item);

      if (activeTab === "received") {
        return receiverId === myUserId && senderId !== myUserId;
      }

      if (activeTab === "sent") {
        return senderId === myUserId;
      }

      return false;
    });

    const query = normalizeSearchText(searchQuery);

    const searchedOffers = query
      ? offersOfCurrentTab.filter((item) =>
          [
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
            .join(" ")
            .includes(query),
        )
      : offersOfCurrentTab;

    return [...searchedOffers].sort((first, second) => {
      const firstCreatedAt =
        new Date(first?.createdAt ?? 0).getTime() || 0;
      const secondCreatedAt =
        new Date(second?.createdAt ?? 0).getTime() || 0;

      if (offerSort === "highest") {
        const firstPrice = Number(first?.offerPrice ?? 0);
        const secondPrice = Number(second?.offerPrice ?? 0);

        const priceDifference = secondPrice - firstPrice;

        if (priceDifference !== 0) {
          return priceDifference;
        }
      }

      return secondCreatedAt - firstCreatedAt;
    });
  }, [
    activeTab,
    currentUserId,
    getOfferReceiverId,
    getOfferSenderId,
    offerSort,
    offersList,
    searchQuery,
  ]);

  // RECEIVED is a two-layer IA: Level 1 groups every received Offer by the
  // OWN post it belongs to (so the user sees "this post has N offers", not a
  // flat mix of unrelated offers). Grouping key mirrors the param by-post.tsx
  // already fetches with: a Buy post's received offers carry `buyPostId`
  // (the Atomic B seller-offer case), a Sell post's offers only carry
  // `postId`. No extra request is made — this groups data already fetched
  // for the tab.
  const receivedPostGroups = useMemo(() => {
    if (activeTab !== "received") return [];

    const groups = new Map<
      string,
      {
        postId: string;
        isBuyPost: boolean;
        title: string;
        thumbnailUrl: string | null;
        offerCount: number;
        highestPrice: number;
        latestCreatedAt: number;
      }
    >();

    filteredOffers.forEach((item) => {
      const buyPostId = String(item?.buyPostId || "").trim();
      const isBuyPost = buyPostId.length > 0;
      const postId = isBuyPost ? buyPostId : String(item?.postId || "").trim();
      if (!postId) return;

      const price = Number(item?.offerPrice ?? 0) || 0;
      const createdAt = new Date(item?.createdAt ?? 0).getTime() || 0;
      const thumbnailUrl = String(item?.postThumbnailUrl || "").trim() || null;

      const existing = groups.get(postId);
      if (!existing) {
        groups.set(postId, {
          postId,
          isBuyPost,
          // The seller-offer's productName describes the seller's own
          // listing, not the buyer's Buy post — never show it as the Buy
          // post's title. Sell-post groups can safely use it: every item in
          // that group is an offer against that same Sell post.
          title: isBuyPost
            ? "Tin thu mua của bạn"
            : item?.productName || item?.postTitle || "Bài đăng",
          // Buy posts never render media here (locked Buy-image rule); only
          // a confirmed Sell-post group may carry a thumbnail.
          thumbnailUrl: isBuyPost ? null : thumbnailUrl,
          offerCount: 1,
          highestPrice: price,
          latestCreatedAt: createdAt,
        });
        return;
      }

      existing.offerCount += 1;
      if (price > existing.highestPrice) existing.highestPrice = price;
      if (createdAt > existing.latestCreatedAt) existing.latestCreatedAt = createdAt;
      if (!existing.thumbnailUrl && !isBuyPost && thumbnailUrl) {
        existing.thumbnailUrl = thumbnailUrl;
      }
    });

    return Array.from(groups.values());
  }, [activeTab, filteredOffers]);

  const openReceivedPostGroup = (group: { postId: string; title: string }) => {
    router.push({
      pathname: "/offers/by-post" as any,
      params: {
        postId: group.postId,
        postTitle: group.title,
      },
    });
  };

  const renderReceivedGroupItem = ({
    item,
  }: {
    item: (typeof receivedPostGroups)[number];
  }) => (
    <TouchableOpacity
      style={styles.postGroupCard}
      activeOpacity={0.75}
      onPress={() => openReceivedPostGroup(item)}
    >
      {item.thumbnailUrl ? (
        <Image
          source={{ uri: item.thumbnailUrl }}
          style={styles.postGroupThumbnail}
          resizeMode="cover"
        />
      ) : !item.isBuyPost ? (
        <View style={styles.postGroupThumbnailPlaceholder}>
          <Ionicons name="cube-outline" size={24} color={COLORS.primary} />
        </View>
      ) : null}

      <View style={styles.postGroupContent}>
        <Text style={styles.postGroupTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.postGroupCount}>
          {item.offerCount} đề nghị đã nhận
        </Text>
        <Text style={styles.postGroupHighest}>
          Giá cao nhất: {item.highestPrice.toLocaleString("vi-VN")} đ
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
    </TouchableOpacity>
  );

  const renderOfferItem = ({ item }: { item: any }) => {
    const isMySentOffer =
      getOfferSenderId(item) === String(currentUserId ?? "");
    const partnerName =
      (isMySentOffer ? item.receiverName : item.senderName) || "Đối tác";
    const partnerAvatarUrl = isMySentOffer
      ? item.receiverAvatarUrl
      : item.senderAvatarUrl;
    const avatarUri = getRobustAvatar(partnerAvatarUrl, partnerName);
    const postThumbnailUrl = String(item.postThumbnailUrl || "").trim();
    const isBuyContext = Boolean(String(item.buyPostId || "").trim());
    const timeString = item.createdAt
      ? new Date(item.createdAt).toLocaleString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "";

    const showOfferFeedback =
      feedbackTarget?.type === "offer" &&
      feedbackTarget.offerId === item.offerId;

    return (
      <View style={styles.offerCard}>
        <View style={styles.offerHeader}>
          <Image source={{ uri: avatarUri }} style={styles.offerAvatar} />
          <View style={styles.flex}>
            <Text style={styles.offerName}>
              {isMySentOffer
                ? `Bạn đã gửi cho ${partnerName}`
                : `${partnerName} đã gửi đề nghị`}
            </Text>
            <Text style={styles.offerTime}>{timeString}</Text>
          </View>
        </View>

        <View style={styles.offerDetails}>
          <View style={styles.offerSummaryRow}>
            {!isBuyContext ? (
              postThumbnailUrl ? (
                <Image
                  source={{ uri: postThumbnailUrl }}
                  style={styles.offerThumbnail}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.offerThumbnailPlaceholder}>
                  <Ionicons
                    name="image-outline"
                    size={22}
                    color={COLORS.textLight}
                  />
                </View>
              )
            ) : null}

            <View style={styles.offerDetailsText}>
              <Text style={styles.offerProduct} numberOfLines={2}>
                {item.productName || item.postTitle || "Sản phẩm"}
              </Text>
              <Text style={styles.offerPrice}>
                Giá thương lượng:{" "}
                {Number(item.offerPrice || 0).toLocaleString("vi-VN")} đ
              </Text>
              <Text style={styles.offerQuantityText}>
                Số lượng: {item.offerQuantity || 0}
              </Text>
            </View>
          </View>
        </View>

        {/* This list only ever renders the "sent" tab now (received Offers
            use the two-layer post-group IA above), so the action layout
            below is always the sender's own view: primary detail, compact
            secondary edit/view-post, and a compact destructive cancel. */}
        <View style={styles.actionArea}>
          <TouchableOpacity
            style={styles.viewOfferBtnPrimary}
            onPress={() =>
              router.push(`/offers/${item.offerId}` as any)
            }
            disabled={isProcessingAction}
          >
            <Text style={styles.viewOfferBtnPrimaryText}>
              Xem chi tiết
            </Text>
          </TouchableOpacity>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.editOfferBtnCompact}
              onPress={() => handleOpenEditOfferModal(item)}
              disabled={isProcessingAction}
            >
              <Ionicons name="pencil-outline" size={14} color={COLORS.primary} />
              <Text style={styles.editOfferBtnText}>Chỉnh sửa</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.viewPostBtnCompact}
              onPress={() => router.push(`/posts/${item.postId}` as any)}
              disabled={isProcessingAction}
            >
              <Ionicons name="document-text-outline" size={14} color={COLORS.text} />
              <Text style={styles.viewPostBtnText}>Xem bài đăng</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelIconBtn}
              onPress={() => void handleCancelOffer(item.offerId)}
              disabled={isProcessingAction}
              hitSlop={4}
            >
              <Ionicons name="close-circle-outline" size={18} color={COLORS.error} />
            </TouchableOpacity>
          </View>

          {showOfferFeedback ? (
            <InlineFeedback
              feedback={feedback}
              onDismiss={clearCurrentFeedback}
              style={styles.actionFeedback}
            />
          ) : null}
        </View>
      </View>
    );
  };

  const retryCurrentPage = useCallback(async () => {
    const didLoad = await fetchData();

    if (didLoad) {
      clearCurrentFeedback();
    }
  }, [clearCurrentFeedback, fetchData]);

  const pageFeedback =
    feedbackTarget?.type === "page" ? feedback : null;
  const editOfferFeedback =
    feedbackTarget?.type === "edit-offer" ? feedback : null;

  return (
    <View style={styles.flex}>
      <View style={styles.flex}>
        <View style={styles.searchContainer}>
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
                  ? ({ outlineStyle: "none" } as any)
                  : undefined,
              ]}
              placeholder="Tìm kiếm đề nghị..."
              placeholderTextColor={COLORS.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        <View style={styles.tabContainer}>
          {([
            { key: "received", label: "Đã nhận" },
            { key: "sent", label: "Đã gửi" },
          ] as const).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabBtn,
                activeTab === tab.key ? styles.tabBtnActive : undefined,
              ]}
              onPress={() => handleChangeTab(tab.key)}
            >
              <View style={styles.tabLabelRow}>
                <Text
                  style={[
                    styles.tabText,
                    activeTab === tab.key ? styles.tabTextActive : undefined,
                  ]}
                >
                  {tab.label}
                </Text>
                {offerTabChanges[tab.key] ? (
                  <View style={styles.tabUnreadDot} />
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {isWaitingForNetwork ? (
          <View style={styles.networkStatusBanner}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.networkStatusText}>Đang chờ mạng…</Text>
          </View>
        ) : null}

        {pageFeedback && !isWaitingForNetwork ? (
          <View style={styles.pageFeedbackBlock}>
            <InlineFeedback
              feedback={pageFeedback}
              onDismiss={clearCurrentFeedback}
              style={styles.pageFeedback}
            />
            {pageFeedback.type === "error" ? (
              <TouchableOpacity
                style={styles.pageRetryButton}
                onPress={() => void retryCurrentPage()}
              >
                <Ionicons name="reload" size={16} color={COLORS.primary} />
                <Text style={styles.pageRetryButtonText}>Thử lại</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <View style={styles.contentArea}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
            </View>
          ) : (
            <View style={styles.offerListArea}>
              <View style={styles.offerSortBar}>
                <View style={styles.offerSortHeading}>
                  <Ionicons
                    name="options-outline"
                    size={16}
                    color={COLORS.textLight}
                  />
                  <Text style={styles.offerSortLabel}>
                    Sắp xếp
                  </Text>
                </View>

                <View style={styles.offerSortActions}>
                  <TouchableOpacity
                    style={[
                      styles.offerSortChip,
                      offerSort === "newest"
                        ? styles.offerSortChipActive
                        : undefined,
                    ]}
                    onPress={() => setOfferSort("newest")}
                  >
                    <Text
                      style={[
                        styles.offerSortChipText,
                        offerSort === "newest"
                          ? styles.offerSortChipTextActive
                          : undefined,
                      ]}
                    >
                      Mới nhất
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.offerSortChip,
                      offerSort === "highest"
                        ? styles.offerSortChipActive
                        : undefined,
                    ]}
                    onPress={() => setOfferSort("highest")}
                  >
                    <Text
                      style={[
                        styles.offerSortChipText,
                        offerSort === "highest"
                          ? styles.offerSortChipTextActive
                          : undefined,
                      ]}
                    >
                      Giá cao nhất
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {offerSort === "highest" ? (
                <Text style={styles.offerSortHint}>
                  Xếp theo giá trong danh sách hiện có tại đây.
                </Text>
              ) : null}

              {activeTab === "received" ? (
                <FlatList
                  data={receivedPostGroups}
                  keyExtractor={(item) => item.postId}
                  renderItem={renderReceivedGroupItem}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.offerListContent}
                  ListEmptyComponent={
                    <Text style={styles.emptyListText}>
                      {searchQuery.trim()
                        ? "Không tìm thấy bài đăng phù hợp."
                        : "Bạn chưa nhận được đề nghị nào."}
                    </Text>
                  }
                />
              ) : (
                <FlatList
                  data={filteredOffers}
                  keyExtractor={(item) => item.offerId}
                  renderItem={renderOfferItem}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.offerListContent}
                  ListEmptyComponent={
                    <Text style={styles.emptyListText}>
                      {searchQuery.trim()
                        ? "Không tìm thấy yêu cầu thương lượng phù hợp."
                        : "Bạn chưa có yêu cầu thương lượng nào."}
                    </Text>
                  }
                />
              )}
            </View>
          )}
        </View>

        <Modal
          visible={showEditOfferModal}
          transparent
          animationType="slide"
          onRequestClose={handleCloseEditOfferModal}
        >
          <ModalBackdrop
            style={styles.modalOverlay}
            disabled={isProcessingAction}
            onPress={handleCloseEditOfferModal}
          >
            <KeyboardAvoidingView
              behavior={
                Platform.OS === "ios"
                  ? "padding"
                  : "height"
              }
            >
              <ModalSurface style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    Chỉnh sửa đề nghị
                  </Text>

                  <TouchableOpacity
                    onPress={handleCloseEditOfferModal}
                    disabled={isProcessingAction}
                    style={styles.modalCloseButton}
                  >
                    <Ionicons
                      name="close"
                      size={24}
                      color={COLORS.text}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalBody}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      Giá đề nghị (VNĐ){" "}
                      <Text style={styles.requiredMark}>
                        *
                      </Text>
                    </Text>

                    <TextInput
                      style={[
                        styles.input,
                        Platform.OS === "web"
                          ? ({ outlineStyle: "none" } as any)
                          : undefined,
                      ]}
                      keyboardType="numeric"
                      value={editOfferPrice}
                      onChangeText={setEditOfferPrice}
                      editable={!isProcessingAction}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      Số lượng{" "}
                      <Text style={styles.requiredMark}>
                        *
                      </Text>
                    </Text>

                    <TextInput
                      style={[
                        styles.input,
                        Platform.OS === "web"
                          ? ({ outlineStyle: "none" } as any)
                          : undefined,
                      ]}
                      keyboardType="numeric"
                      value={editOfferQuantity}
                      onChangeText={setEditOfferQuantity}
                      editable={!isProcessingAction}
                    />
                  </View>

                  {editOfferFeedback ? (
                    <InlineFeedback
                      feedback={editOfferFeedback}
                      onDismiss={clearCurrentFeedback}
                      style={styles.modalFeedback}
                    />
                  ) : null}

                  <TouchableOpacity
                    style={[
                      styles.primaryBtn,
                      isProcessingAction
                        ? styles.disabledButton
                        : undefined,
                    ]}
                    onPress={() =>
                      void handleSubmitEditOffer()
                    }
                    disabled={isProcessingAction}
                  >
                    {isProcessingAction ? (
                      <ActivityIndicator
                        color={COLORS.white}
                      />
                    ) : (
                      <Text style={styles.primaryBtnText}>
                        Lưu thay đổi
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ModalSurface>
            </KeyboardAvoidingView>
          </ModalBackdrop>
        </Modal>

        {confirmationModal}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
    backgroundColor: "#F8F9FA",
  },
  searchIcon: { marginRight: 8 },
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
    backgroundColor: "#F8F9FA",
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
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: { color: COLORS.textLight, fontSize: 13, fontWeight: "600" },
  tabTextActive: { color: COLORS.primary },
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
  contentArea: { flex: 1, backgroundColor: COLORS.white },
  offerListArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  offerSortBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  offerSortHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  offerSortLabel: {
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: "700",
  },
  offerSortActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  offerSortChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#F8F9FA",
  },
  offerSortChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  offerSortChipText: {
    color: COLORS.textLight,
    fontSize: 11,
    fontWeight: "700",
  },
  offerSortChipTextActive: {
    color: COLORS.white,
  },
  offerSortHint: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 2,
    color: COLORS.textLight,
    fontSize: 10,
  },
  offerListContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 12,
  },
  networkStatusBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(84, 123, 125, 0.22)",
    backgroundColor: "rgba(84, 123, 125, 0.08)",
  },
  networkStatusText: {
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: "700",
  },
  pageFeedbackBlock: {
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  pageFeedback: {},
  pageRetryButton: {
    alignSelf: "flex-start",
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  pageRetryButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  localFeedback: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 9,
    padding: 10,
  },
  localFeedbackText: { flex: 1, fontSize: 12, lineHeight: 17 },
  feedbackDismissButton: { padding: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 10, color: COLORS.textLight, fontSize: 13 },
  emptyListText: { marginTop: 40, color: COLORS.textLight, textAlign: "center" },
  offerCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  offerHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  offerAvatar: {
    width: 40,
    height: 40,
    marginRight: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#BAC2C1",
  },
  offerName: { color: COLORS.text, fontSize: 15, fontWeight: "bold" },
  offerTime: { marginTop: 2, color: COLORS.textLight, fontSize: 12 },
  offerDetails: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#F8F9FA",
  },
  offerSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  offerThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  offerThumbnailPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
  },
  offerDetailsText: {
    flex: 1,
    minWidth: 0,
  },
  offerProduct: { marginBottom: 4, color: COLORS.text, fontSize: 15, fontWeight: "600" },
  offerQuantityText: {
    marginTop: 3,
    color: COLORS.textLight,
    fontSize: 13,
  },
  offerPrice: { color: COLORS.primary, fontSize: 14, fontWeight: "bold" },
  actionArea: { gap: 8 },
  actionRow: { flexDirection: "row", gap: 12 },
  // Sent-offer card actions: one dominant primary action, two compact
  // secondary actions, and a compact icon-only destructive action — instead
  // of four equal-weight buttons in a 2x2 grid.
  viewOfferBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  viewOfferBtnPrimaryText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "700",
  },
  editOfferBtnCompact: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  editOfferBtnText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  viewPostBtnCompact: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#F8F9FA",
  },
  viewPostBtnText: { color: COLORS.text, fontSize: 12, fontWeight: "700" },
  cancelIconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.error,
    backgroundColor: "rgba(122, 16, 18, 0.08)",
  },
  actionFeedback: { marginTop: 2 },
  // Received tab, Level 1: own posts that received offers.
  postGroupCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  postGroupThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 9,
    backgroundColor: "#F8F9FA",
  },
  postGroupThumbnailPlaceholder: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: "rgba(43, 86, 89, 0.08)",
  },
  postGroupContent: { flex: 1, minWidth: 0 },
  postGroupTitle: {
    marginBottom: 4,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },
  postGroupCount: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  postGroupHighest: {
    marginTop: 2,
    color: COLORS.textLight,
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
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
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: "bold" },
  modalCloseButton: { padding: 4 },
  modalBody: { gap: 16 },
  inputGroup: { gap: 8 },
  inputLabel: { color: COLORS.text, fontSize: 13, fontWeight: "600" },
  requiredMark: { color: COLORS.error },
  input: {
    height: 50,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    color: COLORS.text,
    fontSize: 15,
    backgroundColor: "#F8F9FA",
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
  primaryBtnText: { color: COLORS.white, fontSize: 15, fontWeight: "bold" },
  disabledButton: { opacity: 0.7 },
  modalFeedback: { marginTop: -4 },
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  confirmCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
  },
  confirmTitle: { color: COLORS.text, fontSize: 17, fontWeight: "800", marginBottom: 8 },
  confirmMessage: { color: COLORS.textLight, fontSize: 13, lineHeight: 19 },
  confirmActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  confirmCancelButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmCancelText: { color: COLORS.text, fontWeight: "700" },
  confirmPrimaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmDestructiveButton: { backgroundColor: COLORS.error },
  confirmPrimaryText: { color: COLORS.white, fontWeight: "800" },
});
