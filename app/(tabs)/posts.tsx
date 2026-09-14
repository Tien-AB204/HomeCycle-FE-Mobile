import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import OfferManagementPanel from "../../src/components/offers/OfferManagementPanel";
import MainHeader from "../../src/components/shared/MainHeader";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import { useNotifications } from "../../src/contexts/NotificationContext";
import apiClient from "../../src/services/apis/axiosClient";
import {
  getApiErrorMessage,
  getApiSuccessMessage,
} from "../../src/utils/apiFeedback";
import { isBuyPostType } from "../../src/utils/postType";

type PostTab = "all" | "active" | "closed";
type PostSection = "posts" | "offers";
type OfferTab = "received" | "sent";

const readParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;
type PostAction = "close" | "reactivate";

type PendingAction = {
  postId: string;
  action: PostAction;
} | null;

type InlineMessage = {
  type: "error" | "success";
  text: string;
} | null;

type PostMessage =
  | {
      postId?: string;
      type: "error" | "success";
      text: string;
    }
  | null;

const PAGE_SIZE = 10;

const postApi = {
  getPostsByUser: (
    userId: string,
    params?: { PageNumber?: number; PageSize?: number },
  ) =>
    apiClient
      .get(`/posts/get-all/by-user/${userId}`, { params })
      .then((response) => response.data),
  closePost: (postId: string) =>
    apiClient.patch(`/posts/${postId}/close`).then((response) => response.data),
  reactivatePost: (postId: string) =>
    apiClient.patch(`/posts/${postId}/reactivate`).then((response) => response.data),
};

export default function PostsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string; tab?: string }>();
  const requestedSection: PostSection =
    readParam(params.section) === "offers" ? "offers" : "posts";
  const requestedOfferTab: OfferTab =
    readParam(params.tab) === "sent" ? "sent" : "received";
  const requestedKey = `${readParam(params.section) ?? ""}:${readParam(params.tab) ?? ""}`;
  const handledRequestKeyRef = useRef(requestedKey);
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web" && width > 480;
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const { postNotificationSignal } = useNotifications();
  const handledPostNotificationVersionRef = useRef(
    postNotificationSignal.version,
  );
  const latestPostNotificationVersionRef = useRef(
    postNotificationSignal.version,
  );
  latestPostNotificationVersionRef.current = postNotificationSignal.version;

  const userRole = user?.role?.toLowerCase() || "personal";
  const currentUserId = user?.userId || user?.id;

  const [section, setSection] = useState<PostSection>(requestedSection);
  const [offerTab, setOfferTab] = useState<OfferTab>(requestedOfferTab);
  const [activeTab, setActiveTab] = useState<PostTab>("all");

  useEffect(() => {
    // Deep links (e.g. migrated /chat?tab=received) select the Đề nghị section.
    if (handledRequestKeyRef.current === requestedKey) return;
    handledRequestKeyRef.current = requestedKey;
    setSection(requestedSection);
    setOfferTab(requestedOfferTab);
  }, [requestedKey, requestedOfferTab, requestedSection]);
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingPostId, setProcessingPostId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [pageMessage, setPageMessage] = useState<InlineMessage>(null);
  const [postMessage, setPostMessage] = useState<PostMessage>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchPosts = useCallback(
    async (page = 1, isRefresh = false) => {
      if (!currentUserId) {
        setPosts([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      try {
        if (page === 1 && !isRefresh) setIsLoading(true);
        setPageMessage(null);

        const response = await postApi.getPostsByUser(currentUserId, {
          PageNumber: page,
          PageSize: PAGE_SIZE,
        });
        if (response?.isSuccess === false) throw response;

        const raw =
          response?.items || response?.data?.items || response?.data || [];
        const data = Array.isArray(raw) ? raw : [];

        if (isRefresh || page === 1) {
          setPosts(data);
        } else {
          setPosts((current) => {
            const existingIds = new Set(current.map((post) => post.postId));
            return [
              ...current,
              ...data.filter((post) => !existingIds.has(post.postId)),
            ];
          });
        }

        setHasMore(data.length === PAGE_SIZE);
      } catch (error: unknown) {
        setPageMessage({
          type: "error",
          text: getApiErrorMessage(error, "Không thể tải danh sách bài đăng."),
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentUserId],
  );

  useFocusEffect(
    useCallback(() => {
      handledPostNotificationVersionRef.current =
        latestPostNotificationVersionRef.current;
      if (!currentUserId) {
        setPosts([]);
        setIsLoading(false);
        return;
      }

      setPageNumber(1);
      setPendingAction(null);
      setPostMessage(null);
      void fetchPosts(1, false);
    }, [currentUserId, fetchPosts]),
  );

  useEffect(() => {
    if (
      !isFocused ||
      section !== "posts" ||
      !currentUserId ||
      postNotificationSignal.version <= handledPostNotificationVersionRef.current
    ) {
      return;
    }

    handledPostNotificationVersionRef.current = postNotificationSignal.version;
    setPageNumber(1);
    void fetchPosts(1, true);
  }, [
    currentUserId,
    fetchPosts,
    isFocused,
    postNotificationSignal.version,
    section,
  ]);

  const onRefresh = async () => {
    setPendingAction(null);
    setPostMessage(null);
    setIsRefreshing(true);
    setPageNumber(1);
    await fetchPosts(1, true);
  };

  const loadMore = () => {
    if (isLoading || isRefreshing || !hasMore) return;
    const nextPage = pageNumber + 1;
    setPageNumber(nextPage);
    void fetchPosts(nextPage);
  };

  const requestAction = (postId: string, action: PostAction) => {
    setPostMessage(null);
    setPendingAction((current) =>
      current?.postId === postId && current.action === action
        ? null
        : { postId, action },
    );
  };

  const confirmPostAction = async (postId: string, action: PostAction) => {
    if (processingPostId) return;

    try {
      setProcessingPostId(postId);
      setPostMessage(null);

      const response =
        action === "close"
          ? await postApi.closePost(postId)
          : await postApi.reactivatePost(postId);

      if (response?.isSuccess === false) throw response;

      setPendingAction(null);
      setPostMessage({
        postId,
        type: "success",
        text: getApiSuccessMessage(
          response,
          action === "close" ? "Đã đóng bài đăng." : "Đã mở lại bài đăng.",
        ),
      });
    } catch (error: unknown) {
      setPostMessage({
        postId,
        type: "error",
        text: getApiErrorMessage(
          error,
          action === "close"
            ? "Không thể đóng bài đăng lúc này."
            : "Không thể mở lại bài đăng lúc này.",
        ),
      });
    } finally {
      setProcessingPostId(null);
    }
  };

  const dismissPostMessage = async () => {
    const shouldReload = postMessage?.type === "success";
    setPostMessage(null);
    if (shouldReload) {
      setPageNumber(1);
      await fetchPosts(1, true);
    }
  };

  const formatPrice = (price: number) =>
    `${Number(price || 0).toLocaleString("vi-VN")} đ`;

  const getTimeAgo = (dateString: string) => {
    if (!dateString) return "Chưa có";
    const past = new Date(dateString);
    if (Number.isNaN(past.getTime())) return "Chưa có";

    const diffMinutes = Math.floor((Date.now() - past.getTime()) / (1000 * 60));
    if (diffMinutes < 60) return "Vừa xong";

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;

    return `${Math.floor(diffHours / 24)} ngày trước`;
  };

  const getDaysLeft = (expiryDate: string) => {
    if (!expiryDate) return "Không rõ";
    const expiry = new Date(expiryDate);
    if (Number.isNaN(expiry.getTime())) return "Không rõ";

    const days = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days > 0 ? `${days} ngày nữa` : "Đã hết hạn";
  };

  const translateStatus = (status: string) => {
    const normalized = String(status || "").trim().toLowerCase();

    switch (normalized) {
      case "active":
        return { text: "Đang hoạt động", color: "#2F765D", background: "rgba(47, 118, 93, 0.10)" };
      case "pending":
        return { text: "Chờ duyệt", color: "#9A6418", background: "rgba(154, 100, 24, 0.10)" };
      case "closed":
        return { text: "Đã đóng", color: "#547B7D", background: "#F8F9FA" };
      default:
        return { text: "Chưa xác định", color: "#547B7D", background: "#F8F9FA" };
    }
  };

  const translatePostType = (postType: unknown) => {
    const normalized = String(postType || "").trim().toLowerCase();

    if (normalized === "sell" || normalized === "1") return "Tin bán";
    if (normalized === "buy" || normalized === "2") return "Tin mua";
    return "Chưa xác định";
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.mobileWrapper, isWeb ? styles.webWrapper : undefined]}>
          <MainHeader title="Quản lý tin đăng" />
          <View style={styles.unauthContainer}>
            <Ionicons name="document-text-outline" size={80} color={COLORS.border} />
            <Text style={styles.unauthTitle}>Bạn chưa đăng nhập</Text>
            <Text style={styles.unauthDesc}>
              Hãy đăng nhập để quản lý bài đăng, theo dõi trạng thái giao dịch và
              đăng tin mới.
            </Text>
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() =>
                router.push({
                  pathname: "/(auth)/login",
                  params: { returnUrl: "/(tabs)/posts" },
                })
              }
            >
              <Text style={styles.loginBtnText}>Đăng nhập ngay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const validPosts = posts.filter((post) => post.status !== "Deleted");
  const activePosts = validPosts.filter(
    (post) => post.status === "Active" || post.status === "Pending",
  );
  const closedPosts = validPosts.filter((post) => post.status === "Closed");

  const renderCard = (post: any) => {
    const status = translateStatus(post.status);
    const address = [post.streetAddress, post.ward, post.city].filter(Boolean).join(", ");
    const displayPrice = post.basePrice || post.expectedPrice || 0;
    const isProcessing = processingPostId === post.postId;
    const action =
      pendingAction && pendingAction.postId === post.postId
        ? pendingAction.action
        : null;
    const message = postMessage?.postId === post.postId ? postMessage : null;
    const isBuyPost = isBuyPostType(post.postType);
    const imageUrl =
      !isBuyPost && Array.isArray(post.medias) ? post.medias[0]?.url : null;

    return (
      <View key={post.postId} style={styles.cardWrapper}>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.7}
          onPress={() =>
            router.push({
              pathname: "/posts/[id]",
              params: { id: post.postId },
            })
          }
        >
          {!isBuyPost ? (
            imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.postImage} resizeMode="cover" />
            ) : (
              <View style={styles.iconBox}>
                <Ionicons name="cube-outline" size={32} color={COLORS.primary} />
              </View>
            )
          ) : null}

          <View style={[styles.cardContent, isBuyPost ? styles.textOnlyCardContent : undefined]}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {post.productName || post.description || "Không có tiêu đề"}
            </Text>
            <Text style={styles.cardPrice}>{formatPrice(displayPrice)}</Text>
            <Text style={styles.descText} numberOfLines={2}>
              {post.description || "Chưa có mô tả"}
            </Text>

            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={12} color="#547B7D" />
              <Text style={styles.addressText} numberOfLines={1}>
                {address || "Chưa cập nhật địa chỉ"}
              </Text>
            </View>

            <View style={styles.tagGrid}>
              <View style={[styles.tag, { backgroundColor: status.background }]}>
                <Text style={[styles.tagText, { color: status.color, fontWeight: "bold" }]}>
                  {status.text}
                </Text>
              </View>
              <View style={styles.tag}>
                <Text style={styles.tagText}>
                  Loại: {translatePostType(post.postType)}
                </Text>
              </View>
              <View style={styles.tag}>
                <Text style={styles.tagText}>
                  Số lượng: {post.remainingQuantity ?? 0} / {post.quantity ?? 0}
                </Text>
              </View>
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.statsText}>{getTimeAgo(post.createdAt)}</Text>
              <View style={styles.footerRight}>
                <Text style={styles.expiryText}>Hết hạn: {getDaysLeft(post.expiryDate)}</Text>
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    accessibilityLabel={
                      post.status === "Closed" && Number(post.remainingQuantity) <= 0
                        ? "Bổ sung số lượng"
                        : "Sửa tin đăng"
                    }
                    onPress={(event) => {
                      event.stopPropagation();
                      router.push({
                        pathname: "/posts/post-form",
                        params: { editId: post.postId, postType: post.postType },
                      });
                    }}
                    disabled={isProcessing}
                  >
                    <Ionicons
                      name={
                        post.status === "Closed" && Number(post.remainingQuantity) <= 0
                          ? "add-circle-outline"
                          : "pencil-outline"
                      }
                      size={18}
                      color={COLORS.primary}
                    />
                  </TouchableOpacity>

                  {post.status === "Active" ? (
                    <TouchableOpacity
                      style={[styles.iconBtn, styles.closeButton]}
                      onPress={(event) => {
                        event.stopPropagation();
                        requestAction(post.postId, "close");
                      }}
                      disabled={isProcessing}
                    >
                      <Ionicons name="close-circle-outline" size={18} color={COLORS.error} />
                    </TouchableOpacity>
                  ) : post.status === "Closed" && Number(post.remainingQuantity) > 0 ? (
                    <TouchableOpacity
                      style={[styles.iconBtn, styles.reactivateButton]}
                      onPress={(event) => {
                        event.stopPropagation();
                        requestAction(post.postId, "reactivate");
                      }}
                      disabled={isProcessing}
                    >
                      <Ionicons name="refresh-circle-outline" size={18} color={COLORS.primary} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {action ? (
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>
              {action === "close"
                ? "Đóng bài đăng này? Bài sẽ kết thúc giao dịch và không còn hiển thị công khai."
                : "Mở lại bài đăng này để hiển thị trở lại với người dùng?"}
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.cancelActionButton}
                onPress={() => setPendingAction(null)}
                disabled={isProcessing}
              >
                <Text style={styles.cancelActionText}>
                  {action === "close" ? "Giữ bài" : "Chưa mở"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmActionButton,
                  action === "close" ? styles.destructiveButton : undefined,
                ]}
                onPress={() => void confirmPostAction(post.postId, action)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.confirmActionText}>
                    {action === "close" ? "Đóng bài" : "Mở lại"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {message ? (
          <View
            style={[
              styles.postMessage,
              message.type === "error"
                ? styles.postMessageError
                : styles.postMessageSuccess,
            ]}
          >
            <Text
              style={[
                styles.postMessageText,
                message.type === "error"
                  ? styles.postMessageErrorText
                  : styles.postMessageSuccessText,
              ]}
            >
              {message.text}
            </Text>
            <TouchableOpacity onPress={() => void dismissPostMessage()} hitSlop={8}>
              <Ionicons name="close" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.mobileWrapper, isWeb ? styles.webWrapper : undefined]}>
        <MainHeader title="Quản lý tin đăng" />

        <View style={styles.sectionSwitcher}>
          {([
            { key: "posts", label: "Bài đăng", icon: "document-text-outline" },
            { key: "offers", label: "Đề nghị", icon: "swap-horizontal-outline" },
          ] as const).map((item) => {
            const selected = section === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.sectionBtn, selected ? styles.sectionBtnActive : undefined]}
                onPress={() => {
                  setPageMessage(null);
                  setSection(item.key);
                }}
              >
                <Ionicons
                  name={item.icon}
                  size={16}
                  color={selected ? COLORS.white : COLORS.primary}
                />
                <Text style={[styles.sectionText, selected ? styles.sectionTextActive : undefined]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {section === "offers" ? (
          <OfferManagementPanel initialTab={offerTab} />
        ) : (
          <>
        <View style={styles.statusFilterContainer}>
          {([
            { key: "all", label: "Tất cả", count: validPosts.length },
            {
              key: "active",
              label: userRole === "personal" ? "Đang hiển thị" : "Đang thu mua",
              count: activePosts.length,
            },
            { key: "closed", label: "Đã đóng", count: closedPosts.length },
          ] as const).map((item) => {
            const selected = activeTab === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.statusChip, selected ? styles.statusChipActive : undefined]}
                onPress={() => {
                  setPageMessage(null);
                  setActiveTab(item.key);
                }}
              >
                <Text
                  style={[styles.statusChipText, selected ? styles.statusChipTextActive : undefined]}
                >
                  {item.label} ({item.count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {pageMessage ? (
          <View
            style={[
              styles.pageMessage,
              pageMessage.type === "error"
                ? styles.postMessageError
                : styles.postMessageSuccess,
            ]}
          >
            <Text
              style={[
                styles.postMessageText,
                pageMessage.type === "error"
                  ? styles.postMessageErrorText
                  : styles.postMessageSuccessText,
              ]}
            >
              {pageMessage.text}
            </Text>
            <TouchableOpacity onPress={() => setPageMessage(null)} hitSlop={8}>
              <Ionicons name="close" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          </View>
        ) : null}

        {isLoading && pageNumber === 1 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Đang tải tin đăng...</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => void onRefresh()}
                colors={[COLORS.primary]}
                tintColor={COLORS.primary}
              />
            }
          >
            {(() => {
              const visiblePosts =
                activeTab === "active"
                  ? activePosts
                  : activeTab === "closed"
                    ? closedPosts
                    : validPosts;

              if (visiblePosts.length > 0) {
                return visiblePosts.map(renderCard);
              }

              const emptyText =
                activeTab === "active"
                  ? userRole === "personal"
                    ? "Chưa có tin đăng nào đang hoạt động."
                    : "Chưa có tin thu mua nào đang hoạt động."
                  : activeTab === "closed"
                    ? "Bạn chưa đóng tin đăng nào."
                    : "Bạn chưa có tin đăng nào.";

              return <Text style={styles.emptyText}>{emptyText}</Text>;
            })()}

            {hasMore && !isLoading ? (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore}>
                <Text style={styles.loadMoreText}>Tải thêm</Text>
              </TouchableOpacity>
            ) : null}

            {isLoading && pageNumber > 1 ? (
              <ActivityIndicator color={COLORS.primary} style={styles.loadMoreIndicator} />
            ) : null}

            <View style={styles.bottomSpacer} />
          </ScrollView>
        )}

        <TouchableOpacity style={styles.fabButton} onPress={() => router.push("/posts/post-form")}>
          <Ionicons name="add" size={32} color={COLORS.white} />
        </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.border },
  mobileWrapper: { flex: 1, backgroundColor: "#F8F9FA" },
  webWrapper: { width: 480, alignSelf: "center" },
  unauthContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: COLORS.white,
  },
  unauthTitle: {
    marginTop: 16,
    marginBottom: 12,
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "bold",
  },
  unauthDesc: {
    marginBottom: 32,
    color: COLORS.textLight,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  loginBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  loginBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "bold" },
  sectionSwitcher: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
  },
  sectionBtn: {
    flex: 1,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  sectionBtnActive: { backgroundColor: COLORS.primary },
  sectionText: { color: COLORS.primary, fontSize: 14, fontWeight: "700" },
  sectionTextActive: { color: COLORS.white },
  statusFilterContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statusChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#F8F9FA",
  },
  statusChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  statusChipText: { color: COLORS.textLight, fontSize: 12, fontWeight: "600" },
  statusChipTextActive: { color: COLORS.white },
  pageMessage: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 10,
    borderWidth: 1,
    borderRadius: 10,
  },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 10, color: COLORS.textLight, fontSize: 13 },
  scrollContent: { padding: 16 },
  emptyText: { marginTop: 40, color: COLORS.textLight, fontSize: 14, textAlign: "center" },
  cardWrapper: { marginBottom: 16 },
  card: {
    flexDirection: "row",
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  postImage: { width: 80, height: 80, borderRadius: 8, backgroundColor: "rgba(84, 123, 125, 0.10)" },
  iconBox: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(84, 123, 125, 0.10)",
  },
  cardContent: { flex: 1, justifyContent: "space-between", marginLeft: 12 },
  textOnlyCardContent: { marginLeft: 0 },
  cardTitle: { marginBottom: 2, color: COLORS.text, fontSize: 15, fontWeight: "bold" },
  cardPrice: { marginBottom: 4, color: COLORS.error, fontSize: 15, fontWeight: "bold" },
  descText: { marginBottom: 4, color: COLORS.textLight, fontSize: 12 },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 8 },
  addressText: { flex: 1, color: "#547B7D", fontSize: 11, fontStyle: "italic" },
  tagGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  tag: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, backgroundColor: "#F8F9FA" },
  tagText: { color: "#547B7D", fontSize: 10, fontWeight: "500" },
  cardFooter: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#BAC2C1",
  },
  statsText: { marginBottom: 2, color: COLORS.textLight, fontSize: 12 },
  footerRight: { alignItems: "flex-end" },
  expiryText: { marginBottom: 2, color: COLORS.error, fontSize: 12, fontWeight: "bold" },
  actionButtons: { flexDirection: "row", gap: 8, marginTop: 4 },
  iconBtn: {
    minWidth: 30,
    minHeight: 30,
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
    borderWidth: 1,
    borderColor: "#BAC2C1",
    borderRadius: 4,
    backgroundColor: "#F8F9FA",
  },
  closeButton: { borderColor: COLORS.error },
  reactivateButton: { borderColor: COLORS.primary },
  confirmBox: {
    marginTop: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(154, 100, 24, 0.24)",
    borderRadius: 10,
    backgroundColor: "rgba(154, 100, 24, 0.10)",
  },
  confirmTitle: { color: COLORS.text, fontSize: 13, fontWeight: "700", lineHeight: 19 },
  confirmActions: { flexDirection: "row", gap: 10, marginTop: 10 },
  cancelActionButton: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.white,
  },
  cancelActionText: { color: COLORS.text, fontWeight: "700" },
  confirmActionButton: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  destructiveButton: { backgroundColor: COLORS.error },
  confirmActionText: { color: COLORS.white, fontWeight: "800" },
  postMessage: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 8,
    padding: 10,
    borderWidth: 1,
    borderRadius: 10,
  },
  postMessageError: { backgroundColor: "rgba(122, 16, 18, 0.08)", borderColor: "rgba(122, 16, 18, 0.22)" },
  postMessageSuccess: { backgroundColor: "rgba(47, 118, 93, 0.10)", borderColor: "rgba(47, 118, 93, 0.24)" },
  postMessageText: { flex: 1, fontSize: 13, lineHeight: 18 },
  postMessageErrorText: { color: "#7A1012" },
  postMessageSuccessText: { color: "#2F765D" },
  loadMoreBtn: {
    alignItems: "center",
    marginVertical: 10,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#F8F9FA",
  },
  loadMoreText: { color: COLORS.text, fontWeight: "bold" },
  loadMoreIndicator: { marginTop: 20 },
  bottomSpacer: { height: 80 },
  fabButton: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0px 4px 6px rgba(0,0,0,0.3)" } as any)
      : {
          shadowColor: COLORS.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 6,
          elevation: 6,
        }),
  },
});
