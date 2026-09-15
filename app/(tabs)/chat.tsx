import { DEFAULT_AVATAR_URI } from "../../src/utils/avatar";
import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRootNavigationState,
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
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import { useChatRealtime } from "../../src/contexts/ChatRealtimeContext";
import conversationApi from "../../src/services/apis/conversationApi";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";

type FeedbackTarget = { type: "page" } | null;

type LocalFeedback = {
  type: "error" | "success" | "info";
  text: string;
} | null;

const normalizeSearchText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLocaleLowerCase("vi-VN");

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

export default function ChatListScreen() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const params = useLocalSearchParams();
  const legacyTabParam = Array.isArray(params.tab)
    ? params.tab[0]
    : params.tab;
  const legacyOfferTab =
    legacyTabParam === "received" || legacyTabParam === "sent"
      ? legacyTabParam
      : null;

  useEffect(() => {
    if (!legacyOfferTab) return;
    // Navigator isn't mounted yet on a cold/direct load of this URL; wait for it
    // so router.replace doesn't throw "navigate before mounting the Root Layout".
    if (!rootNavigationState?.key) return;
    // On a cold static-web load this effect can still fire before the root
    // navigator ref finishes attaching; push the replace past that commit.
    const timeoutId = setTimeout(() => {
      // Offer management moved under Post → Đề nghị; keep old links working.
      router.replace({
        pathname: "/(tabs)/posts",
        params: { section: "offers", tab: legacyOfferTab },
      } as any);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [legacyOfferTab, router, rootNavigationState?.key]);

  const { width: screenWidth } = useWindowDimensions();
  const width = Platform.OS === "web" && screenWidth > 480 ? 480 : screenWidth;

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
  const handledReconnectVersionRef = useRef(0);
  const isScreenFocusedRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  const [searchQuery, setSearchQuery] = useState("");
  const [conversationsList, setConversationsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [feedbackTarget, setFeedbackTarget] = useState<FeedbackTarget>(null);
  const [feedback, setFeedback] = useState<LocalFeedback>(null);

  const clearFeedback = useCallback(() => setFeedback(null), []);
  const showError = useCallback(
    (text: string) => setFeedback({ type: "error", text }),
    [],
  );

  const clearCurrentFeedback = useCallback(() => {
    clearFeedback();
    setFeedbackTarget(null);
  }, [clearFeedback]);

  useEffect(() => {
    handledReconnectVersionRef.current = 0;
  }, [currentUserId]);

  const fetchData = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent === true;
      const requestId = ++fetchRequestIdRef.current;

      if (!user) {
        setConversationsList([]);
        if (!silent) setIsLoading(false);
        return false;
      }

      if (!silent) setIsLoading(true);

      try {
        const response = await conversationApi.getConversations({
          PageSize: 50,
          PageNumber: 1,
        });

        if (requestId !== fetchRequestIdRef.current) return;
        if (response?.isSuccess === false) throw response;

        const items = response?.data?.items || response?.items || [];
        const conversationItems = Array.isArray(items) ? items : [];
        setConversationsList(conversationItems);
        return true;
      } catch (error: unknown) {
        if (requestId !== fetchRequestIdRef.current) return;

        if (!silent) {
          setFeedbackTarget({ type: "page" });
          showError(
            getApiErrorMessage(error, "Không thể tải danh sách trò chuyện."),
          );
        }

        return false;
      } finally {
        if (!silent && requestId === fetchRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [showError, user],
  );

  useFocusEffect(
    useCallback(() => {
      if (!connection) return;

      const handleConversationUpdated = () => {
        void fetchData({ silent: true });
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

    void fetchData({ silent: true }).then((didLoad) => {
      if (didLoad) {
        clearCurrentFeedback();
      }
    });
  }, [
    clearCurrentFeedback,
    fetchData,
    reconnectVersion,
    user,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;

      isScreenFocusedRef.current = true;

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

        void fetchData({ silent: true });
      },
    );

    return () => {
      subscription.remove();
    };
  }, [fetchData, user]);

  const filteredConversations = useMemo(() => {
    const query = normalizeSearchText(searchQuery);
    if (!query) return conversationsList;

    return conversationsList.filter((item) =>
      [
        item?.otherParticipant?.displayName,
        item?.latestMessagePreview,
      ]
        .map(normalizeSearchText)
        .join(" ")
        .includes(query),
    );
  }, [conversationsList, searchQuery]);

  const renderConversationItem = ({ item }: { item: any }) => {
    const rawTime =
      item?.latestMessageAt ||
      item?.lastActivityAt ||
      item?.createdAt;
    const timeString = rawTime
      ? new Date(rawTime).toLocaleString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          day: "2-digit",
          month: "2-digit",
        })
      : "";

    const partnerName =
      item?.otherParticipant?.displayName ||
      "Đối tác";
    const avatarUri = getRobustAvatar(
      item?.otherParticipant?.avatarUrl,
      partnerName,
    );
    const unreadCount = Number(item?.unreadCount || 0);
    const preview =
      String(item?.latestMessagePreview || "").trim() ||
      "Chưa có tin nhắn";

    return (
      <TouchableOpacity
        style={styles.offerCard}
        onPress={() => {
          const conversationId = String(item?.conversationId || "");
          if (!conversationId) return;

          const latestNegotiationId = String(
            item?.latestNegotiationId || "",
          );

          router.push({
            pathname: "/chat/[id]",
            params: {
              id: conversationId,
              ...(latestNegotiationId
                ? { negotiationId: latestNegotiationId }
                : {}),
            },
          });
        }}
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
                {preview}
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

  const retryCurrentPage = useCallback(async () => {
    const didLoad = await fetchData();

    if (didLoad) {
      clearCurrentFeedback();
    }
  }, [clearCurrentFeedback, fetchData]);

  const pageFeedback =
    feedbackTarget?.type === "page" ? feedback : null;

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
            <FlatList
              data={filteredConversations}
              keyExtractor={(item) => String(item?.conversationId || "")}
              renderItem={renderConversationItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <Text style={styles.emptyListText}>
                  {searchQuery.trim()
                    ? "Không tìm thấy cuộc trò chuyện phù hợp."
                    : "Chưa có cuộc trò chuyện nào."}
                </Text>
              }
            />
          )}
        </View>
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
  contentArea: { flex: 1, backgroundColor: COLORS.white },
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
  // Zalo/Messenger-style density: near-zero external gap between rows,
  // internal touch padding kept reasonable.
  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },
  emptyListText: { marginTop: 40, color: COLORS.textLight, textAlign: "center" },
  offerCard: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(186, 194, 193, 0.22)",
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
  offerName: { color: COLORS.text, fontSize: 15, fontWeight: "bold" },
  offerTime: { marginTop: 2, color: COLORS.textLight, fontSize: 12 },
});
