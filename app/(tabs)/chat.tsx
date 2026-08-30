import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
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
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import MainHeader from "../../src/components/shared/MainHeader";
import { ModalBackdrop, ModalSurface } from "../../src/components/shared/ModalBackdrop";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import { useChatRealtime } from "../../src/contexts/ChatRealtimeContext";
import apiClient from "../../src/services/apis/axiosClient";
import {
  getApiErrorMessage,
  getApiSuccessMessage,
} from "../../src/utils/apiFeedback";

type ActiveTab = "chat" | "received" | "sent";
type OfferTab = "received" | "sent";
type OfferSort = "newest" | "highest";
type OfferTabChanges = Record<OfferTab, boolean>;

type FeedbackTarget =
  | { type: "page" }
  | { type: "offer"; offerId: string }
  | { type: "counter" }
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

const negotiationApi = {
  getNegotiations: (params?: { PageNumber?: number; PageSize?: number }) =>
    apiClient.get("/negotiations", { params }).then((response) => response.data),
};

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

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "U",
  )}&background=547B7D&color=fff`;
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

export default function ChatListScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const width = Platform.OS === "web" && screenWidth > 480 ? 480 : screenWidth;

  const { user } = useAuth();
  const {
    connection,
    reconnectVersion,
    joinNegotiation,
  } = useChatRealtime();
  const currentUserId = user?.userId || user?.id;

  const fetchRequestIdRef = useRef(0);
  const activeTabRef = useRef<ActiveTab>("chat");
  const handledReconnectVersionRef = useRef(0);
  const isScreenFocusedRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const offerSyncInFlightRef = useRef(false);
  const offerSyncPendingRef = useRef(false);
  const seenOfferSnapshotsRef = useRef<Partial<Record<OfferTab, string>>>({});
  const latestOfferSnapshotsRef = useRef<Partial<Record<OfferTab, string>>>({});

  const [activeTab, setActiveTab] = useState<ActiveTab>("chat");
  const [offerTabChanges, setOfferTabChanges] = useState<OfferTabChanges>({
    received: false,
    sent: false,
  });
  const [offerSort, setOfferSort] = useState<OfferSort>("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [offersList, setOffersList] = useState<any[]>([]);
  const [negotiationsList, setNegotiationsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
  const [counterPrice, setCounterPrice] = useState("");
  const [counterQuantity, setCounterQuantity] = useState("");

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
        setNegotiationsList([]);
        if (!silent) setIsLoading(false);
        return;
      }

      if (!silent) setIsLoading(true);

      try {
        if (activeTab === "chat") {
          const response = await negotiationApi.getNegotiations({
            PageSize: 50,
            PageNumber: 1,
          });

          if (requestId !== fetchRequestIdRef.current) return;
          if (response?.isSuccess === false) throw response;

          const items = response?.data?.items || response?.items || [];
          const negotiationItems = Array.isArray(items) ? items : [];
          setNegotiationsList(negotiationItems);

          await Promise.allSettled(
            negotiationItems
              .map((item: any) => String(item?.negotiationId || ""))
              .filter(Boolean)
              .map((negotiationId: string) => joinNegotiation(negotiationId)),
          );
          return;
        }

        const response =
          activeTab === "received"
            ? await offerApi.getReceivedOffers({ PageSize: 50, PageNumber: 1 })
            : await offerApi.getSentOffers({ PageSize: 50, PageNumber: 1 });

        if (requestId !== fetchRequestIdRef.current) return;
        if (response?.isSuccess === false) throw response;

        setOffersList(getPendingOffers(response));
      } catch (error: unknown) {
        if (requestId !== fetchRequestIdRef.current) return;

        if (!silent) {
          setFeedbackTarget({ type: "page" });
          showError(
            getApiErrorMessage(error, "Không thể tải danh sách thương lượng."),
          );
        }
      } finally {
        if (!silent && requestId === fetchRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [activeTab, joinNegotiation, showError, user],
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

  useFocusEffect(
    useCallback(() => {
      if (!connection) return;

      const handleConversationUpdated = () => {
        if (activeTabRef.current === "chat") {
          void fetchData({ silent: true });
        }
      };

      const handleMessageCreated = (payload: any) => {
        if (activeTabRef.current !== "chat") return;

        const rawType = payload?.messageType ?? payload?.MessageType;
        const isAgreementMessage =
          rawType === 4 ||
          rawType === 5 ||
          String(rawType ?? "").trim().toLowerCase() === "agreement";

        if (isAgreementMessage) {
          void fetchData({ silent: true });
        }
      };

      const handleOfferChanged = () => {
        void syncOfferTabs();
      };

      connection.on(
        "ConversationUpdated",
        handleConversationUpdated,
      );
      connection.on("MessageCreated", handleMessageCreated);
      connection.on("OfferCreated", handleOfferChanged);
      connection.on("OfferUpdated", handleOfferChanged);

      return () => {
        connection.off(
          "ConversationUpdated",
          handleConversationUpdated,
        );
        connection.off(
          "MessageCreated",
          handleMessageCreated,
        );
        connection.off("OfferCreated", handleOfferChanged);
        connection.off("OfferUpdated", handleOfferChanged);
      };
    }, [connection, fetchData, syncOfferTabs]),
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

    if (activeTabRef.current === "chat") {
      void fetchData({ silent: true });
    }

    void syncOfferTabs();
  }, [
    fetchData,
    reconnectVersion,
    syncOfferTabs,
    user,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;

      isScreenFocusedRef.current = true;

      if (activeTabRef.current === "chat") {
        void fetchData();
        void syncOfferTabs();
      } else {
        setIsLoading(true);

        void syncOfferTabs().finally(() => {
          if (isScreenFocusedRef.current) {
            setIsLoading(false);
          }
        });
      }

      return () => {
        isScreenFocusedRef.current = false;
        fetchRequestIdRef.current += 1;
      };
    }, [
      activeTab,
      fetchData,
      syncOfferTabs,
      user,
    ]),
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

        if (activeTabRef.current === "chat") {
          void fetchData({ silent: true });
        }

        void syncOfferTabs();
      },
    );

    return () => {
      subscription.remove();
    };
  }, [
    fetchData,
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

  const handleAcceptOffer = async (offer: any) => {
    const offerId = String(offer?.offerId || "");
    const version = Number(offer?.version ?? offer?.Version);

    if (!offerId || !Number.isInteger(version) || version < 0) {
      setFeedbackTarget({ type: "page" });
      showError(
        "Không xác định được phiên bản hiện tại của đề nghị. Vui lòng tải lại dữ liệu.",
      );
      await fetchData();
      return;
    }
    const confirmed = await confirm({
      title: "Chấp nhận thương lượng",
      message: "Bạn đồng ý mở phiên thương lượng với mức giá này?",
      confirmLabel: "Đồng ý",
      cancelLabel: "Quay lại",
    });
    if (!confirmed) return;

    clearFeedback();
    setFeedbackTarget({ type: "offer", offerId });

    try {
      setIsProcessingAction(true);
      const response = await offerApi.acceptOffer(offerId, version);
      if (response?.isSuccess === false) throw response;

      showSuccess(
        getApiSuccessMessage(
          response,
          "Đã chấp nhận thương lượng. Phòng chat đã được mở.",
        ),
      );
      await wait(900);
      clearCurrentFeedback();
      await fetchData();
    } catch (error: unknown) {
      if (getOfferErrorCode(error) === "OFFER_TERMS_CHANGED") {
        setFeedbackTarget({ type: "page" });
        showError(
          "Đề nghị vừa được đối tác cập nhật. Danh sách đã được làm mới, vui lòng xem lại trước khi chấp nhận.",
        );
        await fetchData();
        return;
      }

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

  const handleRejectOffer = async (offerId: string) => {
    const confirmed = await confirm({
      title: "Từ chối đề nghị",
      message: "Bạn có chắc muốn từ chối đề nghị này?",
      confirmLabel: "Từ chối",
      cancelLabel: "Quay lại",
      destructive: true,
    });
    if (!confirmed) return;

    clearFeedback();
    setFeedbackTarget({ type: "offer", offerId });

    try {
      setIsProcessingAction(true);
      const response = await offerApi.rejectOffer(offerId);
      if (response?.isSuccess === false) throw response;

      showSuccess(getApiSuccessMessage(response, "Đã từ chối đề nghị."));
      await wait(900);
      clearCurrentFeedback();
      await fetchData();
    } catch (error: unknown) {
      showError(getApiErrorMessage(error, "Không thể từ chối đề nghị."));
    } finally {
      setIsProcessingAction(false);
    }
  };

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

  const handleOpenCounterModal = (offer: any) => {
    clearCurrentFeedback();
    setSelectedOffer(offer);
    setCounterPrice(offer.offerPrice?.toString() || "");
    setCounterQuantity(offer.offerQuantity?.toString() || "1");
    setShowCounterModal(true);
  };

  const handleCloseCounterModal = () => {
    if (isProcessingAction) return;
    clearCurrentFeedback();
    setShowCounterModal(false);
    setSelectedOffer(null);
  };

  const handleSubmitCounter = async () => {
    if (!selectedOffer) return;

    clearFeedback();
    setFeedbackTarget({ type: "counter" });

    const price = Number(counterPrice.trim());
    const quantity = Number(counterQuantity.trim());
    const version = Number(
      selectedOffer?.version ?? selectedOffer?.Version,
    );

    if (!Number.isInteger(version) || version < 0) {
      setShowCounterModal(false);
      setSelectedOffer(null);
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
      const response = await offerApi.counterInitialOffer(
        selectedOffer.offerId,
        {
          offerPrice: price,
          offerQuantity: quantity,
          version,
        },
      );
      if (response?.isSuccess === false) throw response;

      showSuccess(
        getApiSuccessMessage(response, "Đã gửi đề xuất giá mới thành công."),
      );
      await wait(900);
      clearCurrentFeedback();
      setShowCounterModal(false);
      setSelectedOffer(null);
      await fetchData();
    } catch (error: unknown) {
      if (getOfferErrorCode(error) === "OFFER_TERMS_CHANGED") {
        setShowCounterModal(false);
        setSelectedOffer(null);
        setFeedbackTarget({ type: "page" });
        showError(
          "Đề nghị vừa được đối tác cập nhật. Danh sách đã được làm mới, vui lòng xem lại trước khi đề xuất lại.",
        );
        await fetchData();
        return;
      }

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

  const filteredNegotiations = useMemo(() => {
    const query = normalizeSearchText(searchQuery);
    if (!query) return negotiationsList;

    return negotiationsList.filter((item) =>
      [
        item.otherPartyName,
        item.productName,
        item.postTitle,
        item.currentOfferPrice,
        item.currentOfferQuantity,
      ]
        .map(normalizeSearchText)
        .join(" ")
        .includes(query),
    );
  }, [negotiationsList, searchQuery]);

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

  const renderNegotiationItem = ({ item }: { item: any }) => {
    const rawTime = item.lastMessageAt || item.createdAt;
    const timeString = rawTime
      ? new Date(rawTime).toLocaleString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          day: "2-digit",
          month: "2-digit",
        })
      : "";
    const partnerName = item.otherPartyName || "Đối tác";
    const avatarUri = getRobustAvatar(item.otherPartyAvatarUrl, partnerName);
    const unreadCount = Number(item.unreadCount || 0);

    return (
      <TouchableOpacity
        style={styles.offerCard}
        onPress={() => router.push(`/chat/${item.negotiationId}` as any)}
      >
        <View style={styles.negotiationRow}>
          <Image source={{ uri: avatarUri }} style={styles.negotiationAvatar} />
          <View style={styles.flex}>
            <View style={styles.negotiationHeader}>
              <Text style={styles.offerName} numberOfLines={1}>
                {partnerName}
              </Text>
              <Text style={styles.offerTime}>{timeString}</Text>
            </View>
            <View style={styles.negotiationPreviewRow}>
              <Text style={styles.negotiationPrice} numberOfLines={1}>
                Mức giá:{" "}
                <Text style={styles.negotiationPriceValue}>
                  {Number(item.currentOfferPrice || 0).toLocaleString("vi-VN")} đ
                </Text>{" "}
                (x{item.currentOfferQuantity || 0})
              </Text>
              {unreadCount > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderOfferItem = ({ item }: { item: any }) => {
    const isMySentOffer =
      getOfferSenderId(item) === String(currentUserId ?? "");
    const partnerName =
      (isMySentOffer ? item.receiverName : item.senderName) || "Đối tác";
    const partnerAvatarUrl = isMySentOffer
      ? item.receiverAvatarUrl
      : item.senderAvatarUrl;
    const avatarUri = getRobustAvatar(partnerAvatarUrl, partnerName);
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
          <Text style={styles.offerProduct} numberOfLines={1}>
            {item.productName || item.postTitle || "Sản phẩm"}
          </Text>
          <Text style={styles.offerPrice}>
            Giá thương lượng: {Number(item.offerPrice || 0).toLocaleString("vi-VN")} đ
          </Text>
          <Text style={styles.offerPrice}>Số lượng: {item.offerQuantity || 0}</Text>
        </View>

        {!isMySentOffer ? (
          <View style={styles.actionArea}>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.rejectBtn}
                onPress={() => void handleRejectOffer(item.offerId)}
                disabled={isProcessingAction}
              >
                <Text style={styles.rejectBtnText}>Từ chối</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={() => void handleAcceptOffer(item)}
                disabled={isProcessingAction}
              >
                <Text style={styles.acceptBtnText}>Đồng ý</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.counterBtnOutline}
              onPress={() => handleOpenCounterModal(item)}
              disabled={isProcessingAction}
            >
              <Text style={styles.counterBtnText}>Đề xuất giá mới</Text>
            </TouchableOpacity>

            {showOfferFeedback ? (
              <InlineFeedback
                feedback={feedback}
                onDismiss={clearCurrentFeedback}
                style={styles.actionFeedback}
              />
            ) : null}
          </View>
        ) : (
          <View style={styles.actionArea}>
            <TouchableOpacity
              style={styles.viewOfferBtn}
              onPress={() =>
                router.push(`/offers/${item.offerId}` as any)
              }
              disabled={isProcessingAction}
            >
              <Ionicons
                name="document-text-outline"
                size={17}
                color={COLORS.text}
              />
              <Text style={styles.viewOfferBtnText}>
                Xem chi tiết đề nghị
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.editOfferBtn}
              onPress={() => handleOpenEditOfferModal(item)}
              disabled={isProcessingAction}
            >
              <Ionicons
                name="create-outline"
                size={17}
                color={COLORS.primary}
              />
              <Text style={styles.editOfferBtnText}>
                Chỉnh sửa đề nghị
              </Text>
            </TouchableOpacity>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.cancelOfferBtn}
                onPress={() => void handleCancelOffer(item.offerId)}
                disabled={isProcessingAction}
              >
                <Text style={styles.cancelOfferBtnText}>Hủy đề nghị</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.viewPostBtn}
                onPress={() => router.push(`/posts/${item.postId}` as any)}
                disabled={isProcessingAction}
              >
                <Text style={styles.viewPostBtnText}>Xem bài đăng</Text>
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
        )}
      </View>
    );
  };

  const pageFeedback =
    feedbackTarget?.type === "page" ? feedback : null;
  const counterFeedback =
    feedbackTarget?.type === "counter" ? feedback : null;
  const editOfferFeedback =
    feedbackTarget?.type === "edit-offer" ? feedback : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.mobileWrapper, { width }]}>
        <MainHeader title="Tin nhắn" showBack={false} />

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
              placeholder="Tìm kiếm đoạn chat..."
              placeholderTextColor={COLORS.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        <View style={styles.tabContainer}>
          {([
            { key: "chat", label: "Đoạn chat" },
            { key: "received", label: "Yêu cầu mới" },
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
                {tab.key !== "chat" && offerTabChanges[tab.key] ? (
                  <View style={styles.tabUnreadDot} />
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {pageFeedback ? (
          <InlineFeedback
            feedback={pageFeedback}
            onDismiss={clearCurrentFeedback}
            style={styles.pageFeedback}
          />
        ) : null}

        <View style={styles.contentArea}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
            </View>
          ) : activeTab === "chat" ? (
            <FlatList
              data={filteredNegotiations}
              keyExtractor={(item) => item.negotiationId}
              renderItem={renderNegotiationItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <Text style={styles.emptyListText}>
                  {searchQuery.trim()
                    ? "Không tìm thấy cuộc trò chuyện phù hợp."
                    : "Chưa có cuộc trò chuyện nào đang diễn ra."}
                </Text>
              }
            />
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
                    <Ionicons
                      name="time-outline"
                      size={15}
                      color={
                        offerSort === "newest"
                          ? COLORS.white
                          : COLORS.textLight
                      }
                    />
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
                    <Ionicons
                      name="trophy-outline"
                      size={15}
                      color={
                        offerSort === "highest"
                          ? COLORS.white
                          : COLORS.textLight
                      }
                    />
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
                      style={styles.counterFeedback}
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

        <Modal
          visible={showCounterModal}
          transparent
          animationType="slide"
          onRequestClose={handleCloseCounterModal}
        >
          <ModalBackdrop
            style={styles.modalOverlay}
            disabled={isProcessingAction}
            onPress={handleCloseCounterModal}
          >
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
              <ModalSurface style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Đề xuất giá mới</Text>
                <TouchableOpacity
                  onPress={handleCloseCounterModal}
                  disabled={isProcessingAction}
                  style={styles.modalCloseButton}
                >
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Giá đề xuất (VNĐ) <Text style={styles.requiredMark}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      Platform.OS === "web"
                        ? ({ outlineStyle: "none" } as any)
                        : undefined,
                    ]}
                    keyboardType="numeric"
                    value={counterPrice}
                    onChangeText={setCounterPrice}
                    editable={!isProcessingAction}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Số lượng <Text style={styles.requiredMark}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      Platform.OS === "web"
                        ? ({ outlineStyle: "none" } as any)
                        : undefined,
                    ]}
                    keyboardType="numeric"
                    value={counterQuantity}
                    onChangeText={setCounterQuantity}
                    editable={!isProcessingAction}
                  />
                </View>


                {counterFeedback ? (
                  <InlineFeedback
                    feedback={counterFeedback}
                    onDismiss={clearCurrentFeedback}
                    style={styles.counterFeedback}
                  />
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    isProcessingAction ? styles.disabledButton : undefined,
                  ]}
                  onPress={() => void handleSubmitCounter()}
                  disabled={isProcessingAction}
                >
                  {isProcessingAction ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.primaryBtnText}>Gửi đề xuất</Text>
                  )}
                </TouchableOpacity>
              </View>
              </ModalSurface>
            </KeyboardAvoidingView>
          </ModalBackdrop>
        </Modal>

        {confirmationModal}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.border,
    alignItems: "center",
  },
  mobileWrapper: {
    flex: 1,
    backgroundColor: COLORS.background,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0px 0px 20px rgba(0,0,0,0.1)" } as any)
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
  pageFeedback: { marginHorizontal: 16, marginBottom: 8 },
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
  listContent: { padding: 16, gap: 12, paddingBottom: 40 },
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
  negotiationRow: { flexDirection: "row", alignItems: "center" },
  negotiationAvatar: {
    width: 44,
    height: 44,
    marginRight: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#BAC2C1",
  },
  negotiationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  negotiationPreviewRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  negotiationPrice: { flex: 1, color: COLORS.textLight, fontSize: 13 },
  negotiationPriceValue: { color: COLORS.primary, fontWeight: "bold" },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: COLORS.error,
  },
  unreadBadgeText: { color: COLORS.white, fontSize: 11, fontWeight: "800" },
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
  offerProduct: { marginBottom: 4, color: COLORS.text, fontSize: 15, fontWeight: "600" },
  offerPrice: { color: COLORS.primary, fontSize: 14, fontWeight: "bold" },
  actionArea: { gap: 8 },
  actionRow: { flexDirection: "row", gap: 12 },
  rejectBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BAC2C1",
    backgroundColor: "#F8F9FA",
  },
  rejectBtnText: { color: COLORS.text, fontSize: 14, fontWeight: "600" },
  acceptBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  acceptBtnText: { color: COLORS.white, fontSize: 14, fontWeight: "600" },
  counterBtnOutline: {
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  counterBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: "bold" },
  viewOfferBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#F8F9FA",
  },
  viewOfferBtnText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  editOfferBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  editOfferBtnText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  cancelOfferBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.error,
    backgroundColor: "rgba(122, 16, 18, 0.08)",
  },
  cancelOfferBtnText: { color: COLORS.error, fontSize: 13, fontWeight: "700" },
  viewPostBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#F8F9FA",
  },
  viewPostBtnText: { color: COLORS.text, fontSize: 13, fontWeight: "700" },
  actionFeedback: { marginTop: 2 },
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
  counterFeedback: { marginTop: -4 },
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
