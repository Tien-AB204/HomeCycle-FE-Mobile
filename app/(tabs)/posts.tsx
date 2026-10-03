import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
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
import { ModalBackdrop, ModalSurface } from "../../src/components/shared/ModalBackdrop";
import PriorityBadge from "../../src/components/shared/PriorityBadge";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import { useNotifications } from "../../src/contexts/NotificationContext";
import { formatBadgeCount, useOfferInbox } from "../../src/contexts/OfferInboxContext";
import apiClient from "../../src/services/apis/axiosClient";
import {
  getApiErrorMessage,
  getApiSuccessMessage,
} from "../../src/utils/apiFeedback";
import { formatBuyPostPrice, isBuyPostType } from "../../src/utils/postType";
import { useAutoDismissFeedback } from "../../src/utils/useAutoDismissFeedback";
import { useGuardedRouter } from "../../src/utils/tapGuard";

type PostTab = "all" | "active" | "closed" | "suspended";
type PostState = "active" | "expired" | "closed" | "suspended" | "draft";
type PostSort = "newest" | "oldest" | "expiring";
type PostRange = "all" | "7" | "30" | "90";

const SORT_OPTIONS: { key: PostSort; label: string }[] = [
  { key: "newest", label: "Mới nhất" },
  { key: "oldest", label: "Cũ nhất" },
  { key: "expiring", label: "Sắp hết hạn" },
];

const RANGE_OPTIONS: { key: PostRange; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "7", label: "7 ngày qua" },
  { key: "30", label: "30 ngày qua" },
  { key: "90", label: "3 tháng qua" },
];

const DAY_MS = 24 * 60 * 60 * 1000;
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

// Mỗi người dùng thường có ít bài: tải hết (tối đa PageSize BE cho phép) để lọc,
// sắp xếp và đếm theo trạng thái ở FE cho đúng, không bị lệch theo trang.
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

const toTime = (value: unknown) => {
  const time = new Date(String(value ?? "")).getTime();
  return Number.isNaN(time) ? null : time;
};

const pad2 = (value: number) => String(value).padStart(2, "0");

const formatDate = (time: number) => {
  const date = new Date(time);
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
};

const startOfDay = (time: number) => {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

// Mới đăng thì hiện tương đối cho dễ đọc; từ 7 ngày trở lên hiện ngày cụ thể.
const formatPostedAt = (value: unknown) => {
  const time = toTime(value);
  if (time === null) return "Chưa rõ";

  const diffMinutes = Math.floor((Date.now() - time) / 60000);
  if (diffMinutes < 1) return "Vừa xong";
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;

  const diffDays = Math.round((startOfDay(Date.now()) - startOfDay(time)) / DAY_MS);
  if (diffDays <= 1) return "Hôm qua";
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return formatDate(time);
};

const getPostState = (post: any): PostState => {
  const status = String(post.status ?? "").trim().toLowerCase();
  if (status === "suspended" || status === "2") return "suspended";
  if (status === "closed" || status === "3") return "closed";
  if (status === "draft" || status === "0") return "draft";

  const expiry = toTime(post.expiryDate);
  return expiry !== null && expiry <= Date.now() ? "expired" : "active";
};

const POST_STATE_BADGE: Record<PostState, { text: string; color: string; background: string }> = {
  active: { text: "Đang hoạt động", color: "#2F765D", background: "rgba(47, 118, 93, 0.10)" },
  expired: { text: "Hết hạn", color: "#9A6418", background: "rgba(154, 100, 24, 0.10)" },
  closed: { text: "Đã đóng", color: "#547B7D", background: "#EEF2F2" },
  suspended: { text: "Bị đình chỉ", color: "#7A1012", background: "rgba(122, 16, 18, 0.10)" },
  draft: { text: "Bản nháp", color: "#547B7D", background: "#F8F9FA" },
};

// Chỉ bài đang hoạt động mới cần biết hạn; còn gần thì đếm ngày, xa thì hiện ngày cụ thể.
const getExpiryLabel = (post: any) => {
  const expiry = toTime(post.expiryDate);
  if (expiry === null) return null;

  const daysLeft = Math.ceil((expiry - Date.now()) / DAY_MS);
  if (daysLeft <= 30) {
    return { text: `Còn ${Math.max(daysLeft, 1)} ngày`, urgent: daysLeft <= 7 };
  }
  return { text: `Hết hạn ${formatDate(expiry)}`, urgent: false };
};

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
  const router = useGuardedRouter();
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
  const postActionInFlightRef = useRef<string | null>(null);
  const latestPostNotificationVersionRef = useRef(
    postNotificationSignal.version,
  );
  latestPostNotificationVersionRef.current = postNotificationSignal.version;

  const userRole = user?.role?.toLowerCase() || "personal";
  const currentUserId = user?.userId || user?.id;

  const [section, setSection] = useState<PostSection>(requestedSection);
  const [offerTab, setOfferTab] = useState<OfferTab>(requestedOfferTab);
  const {
    pendingCount: pendingOfferCount,
    unseenCount: unseenOfferCount,
    markOffersSeen,
  } = useOfferInbox();

  // Đang mở mục Đề nghị thì mọi đề nghị đang chờ coi như đã xem (tắt badge đỏ ở thanh dưới).
  useEffect(() => {
    if (isFocused && section === "offers" && unseenOfferCount > 0) markOffersSeen();
  }, [isFocused, markOffersSeen, section, unseenOfferCount]);
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
  useAutoDismissFeedback(pageMessage, () => setPageMessage(null));
  const [postMessage, setPostMessage] = useState<PostMessage>(null);
  const [sortBy, setSortBy] = useState<PostSort>("newest");
  const [range, setRange] = useState<PostRange>("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const fetchPosts = useCallback(
    async (isRefresh = false) => {
      if (!currentUserId) {
        setPosts([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      try {
        if (!isRefresh) setIsLoading(true);
        setPageMessage(null);

        const collected: any[] = [];
        const seenIds = new Set<string>();
        for (let page = 1; page <= MAX_PAGES; page += 1) {
          const response = await postApi.getPostsByUser(currentUserId, {
            PageNumber: page,
            PageSize: PAGE_SIZE,
          });
          if (response?.isSuccess === false) throw response;

          const raw =
            response?.items || response?.data?.items || response?.data || [];
          const data = Array.isArray(raw) ? raw : [];
          data.forEach((post) => {
            const id = String(post.postId);
            if (seenIds.has(id)) return;
            seenIds.add(id);
            collected.push(post);
          });

          if (data.length < PAGE_SIZE) break;
        }

        setPosts(collected);
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

      setPendingAction(null);
      setPostMessage(null);
      void fetchPosts(false);
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
    void fetchPosts(true);
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
    await fetchPosts(true);
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
    if (processingPostId || postActionInFlightRef.current) return;

    const lockKey = `${action}:${postId}`;
    postActionInFlightRef.current = lockKey;

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
      if (postActionInFlightRef.current === lockKey) {
        postActionInFlightRef.current = null;
      }
      setProcessingPostId(null);
    }
  };

  const dismissPostMessage = async () => {
    const shouldReload = postMessage?.type === "success";
    setPostMessage(null);
    if (shouldReload) {
      await fetchPosts(true);
    }
  };

  const formatPrice = (price: number) =>
    `${Number(price || 0).toLocaleString("vi-VN")} đ`;

  const translatePostType = (postType: unknown) => {
    const normalized = String(postType || "").trim().toLowerCase();

    if (normalized === "sell" || normalized === "1") return "Tin bán";
    if (normalized === "buy" || normalized === "2") return "Tin mua";
    return "Chưa xác định";
  };

  const validPosts = useMemo(
    () => posts.filter((post) => String(post.status ?? "").toLowerCase() !== "deleted"),
    [posts],
  );

  // Lọc theo thời gian đăng trước, rồi mới đếm theo trạng thái để số trên chip khớp danh sách.
  const rangedPosts = useMemo(() => {
    if (range === "all") return validPosts;
    const from = Date.now() - Number(range) * DAY_MS;
    return validPosts.filter((post) => (toTime(post.createdAt) ?? 0) >= from);
  }, [range, validPosts]);

  const tabCounts = useMemo(() => {
    const counts = { all: rangedPosts.length, active: 0, closed: 0, suspended: 0 };
    rangedPosts.forEach((post) => {
      const state = getPostState(post);
      if (state === "active") counts.active += 1;
      else if (state === "closed" || state === "expired") counts.closed += 1;
      else if (state === "suspended") counts.suspended += 1;
    });
    return counts;
  }, [rangedPosts]);

  const visiblePosts = useMemo(() => {
    const filtered = rangedPosts.filter((post) => {
      const state = getPostState(post);
      if (activeTab === "active") return state === "active";
      if (activeTab === "closed") return state === "closed" || state === "expired";
      if (activeTab === "suspended") return state === "suspended";
      return true;
    });

    const created = (post: any) => toTime(post.createdAt) ?? 0;
    return [...filtered].sort((a, b) => {
      if (sortBy === "oldest") return created(a) - created(b);
      if (sortBy === "expiring") {
        // Bài đang hoạt động sắp hết hạn lên đầu; bài đã đóng/hết hạn xuống cuối.
        const rank = (post: any) =>
          getPostState(post) === "active"
            ? toTime(post.expiryDate) ?? Number.MAX_SAFE_INTEGER
            : Number.MAX_SAFE_INTEGER;
        return rank(a) - rank(b) || created(b) - created(a);
      }
      return created(b) - created(a);
    });
  }, [activeTab, rangedPosts, sortBy]);

  // Bài vi phạm không còn thì đưa người dùng về "Tất cả".
  useEffect(() => {
    if (activeTab === "suspended" && tabCounts.suspended === 0) setActiveTab("all");
  }, [activeTab, tabCounts.suspended]);

  const isFiltering = sortBy !== "newest" || range !== "all";
  const filterSummary = [
    range !== "all" ? RANGE_OPTIONS.find((option) => option.key === range)?.label : null,
    sortBy !== "newest" ? SORT_OPTIONS.find((option) => option.key === sortBy)?.label : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const resetFilters = () => {
    setSortBy("newest");
    setRange("all");
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

  const renderCard = (post: any) => {
    const postState = getPostState(post);
    const status = POST_STATE_BADGE[postState];
    const expiryLabel = postState === "active" ? getExpiryLabel(post) : null;
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
            <Text style={styles.cardPrice}>
              {isBuyPost ? formatBuyPostPrice(post) : formatPrice(displayPrice)}
            </Text>
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
                  {post.postType === "Buy"
                    ? `Cần thu mua: ${post.quantity ?? 0}`
                    : `Số lượng: ${post.remainingQuantity ?? 0} / ${post.quantity ?? 0}`}
                </Text>
              </View>
              <PriorityBadge post={post} style={styles.priorityTag} />
            </View>

            <View style={styles.cardFooter}>
              <View style={styles.postedRow}>
                <Ionicons name="time-outline" size={12} color={COLORS.textLight} />
                <Text style={styles.statsText}>Đăng {formatPostedAt(post.createdAt).toLowerCase()}</Text>
              </View>
              <View style={styles.footerRight}>
                {expiryLabel ? (
                  <Text
                    style={[
                      styles.expiryText,
                      expiryLabel.urgent ? styles.expiryTextUrgent : undefined,
                    ]}
                  >
                    {expiryLabel.text}
                  </Text>
                ) : null}
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
                {item.key === "offers" && pendingOfferCount > 0 ? (
                  // Xanh = tổng đề nghị còn chờ phản hồi (kể cả đã xem).
                  <View style={[styles.sectionBadge, selected ? styles.sectionBadgeActive : undefined]}>
                    <Text style={[styles.sectionBadgeText, selected ? styles.sectionBadgeTextActive : undefined]}>
                      {formatBadgeCount(pendingOfferCount)}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {section === "offers" ? (
          <OfferManagementPanel initialTab={offerTab} />
        ) : (
          <>
        <View style={styles.statusFilterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.statusChipScroll}
            contentContainerStyle={styles.statusChipRow}
          >
            {([
              { key: "all", label: "Tất cả", count: tabCounts.all },
              {
                key: "active",
                label: userRole === "personal" ? "Đang hiển thị" : "Đang thu mua",
                count: tabCounts.active,
              },
              { key: "closed", label: "Đã đóng", count: tabCounts.closed },
              ...(tabCounts.suspended > 0
                ? [{ key: "suspended", label: "Vi phạm", count: tabCounts.suspended }]
                : []),
            ] as { key: PostTab; label: string; count: number }[]).map((item) => {
              const selected = activeTab === item.key;
              const isViolation = item.key === "suspended";
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.statusChip,
                    isViolation ? styles.statusChipDanger : undefined,
                    selected ? styles.statusChipActive : undefined,
                    selected && isViolation ? styles.statusChipDangerActive : undefined,
                  ]}
                  onPress={() => {
                    setPageMessage(null);
                    setActiveTab(item.key);
                  }}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      isViolation ? styles.statusChipDangerText : undefined,
                      selected ? styles.statusChipTextActive : undefined,
                    ]}
                  >
                    {item.label} ({item.count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[styles.filterButton, isFiltering ? styles.filterButtonActive : undefined]}
            onPress={() => setIsFilterOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Sắp xếp và lọc theo thời gian"
          >
            <Ionicons
              name="options-outline"
              size={18}
              color={isFiltering ? COLORS.white : COLORS.primary}
            />
          </TouchableOpacity>
        </View>

        {isFiltering ? (
          <View style={styles.filterSummaryRow}>
            <Ionicons name="funnel-outline" size={13} color={COLORS.primary} />
            <Text style={styles.filterSummaryText} numberOfLines={1}>
              {filterSummary}
            </Text>
            <TouchableOpacity onPress={resetFilters} hitSlop={8}>
              <Text style={styles.filterResetText}>Bỏ lọc</Text>
            </TouchableOpacity>
          </View>
        ) : null}

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

        {isLoading ? (
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
              if (visiblePosts.length > 0) {
                return visiblePosts.map(renderCard);
              }

              const emptyText =
                isFiltering && validPosts.length > 0
                  ? "Không có tin đăng nào khớp bộ lọc."
                  : activeTab === "active"
                    ? userRole === "personal"
                      ? "Chưa có tin đăng nào đang hoạt động."
                      : "Chưa có tin thu mua nào đang hoạt động."
                    : activeTab === "closed"
                      ? "Chưa có tin đăng nào đã đóng hoặc hết hạn."
                      : "Bạn chưa có tin đăng nào.";

              return <Text style={styles.emptyText}>{emptyText}</Text>;
            })()}

            <View style={styles.bottomSpacer} />
          </ScrollView>
        )}

        <TouchableOpacity style={styles.fabButton} onPress={() => router.push("/posts/post-form")}>
          <Ionicons name="add" size={32} color={COLORS.white} />
        </TouchableOpacity>

        <Modal
          visible={isFilterOpen}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setIsFilterOpen(false)}
        >
          <ModalBackdrop style={styles.sheetBackdrop} onPress={() => setIsFilterOpen(false)}>
            <ModalSurface style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Sắp xếp & lọc</Text>
                {isFiltering ? (
                  <TouchableOpacity onPress={resetFilters} hitSlop={8}>
                    <Text style={styles.filterResetText}>Đặt lại</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <Text style={styles.sheetLabel}>Sắp xếp</Text>
              <View style={styles.sheetOptions}>
                {SORT_OPTIONS.map((option) => {
                  const selected = sortBy === option.key;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      style={[styles.sheetOption, selected ? styles.sheetOptionActive : undefined]}
                      onPress={() => setSortBy(option.key)}
                    >
                      <Text
                        style={[
                          styles.sheetOptionText,
                          selected ? styles.sheetOptionTextActive : undefined,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sheetLabel}>Thời gian đăng</Text>
              <View style={styles.sheetOptions}>
                {RANGE_OPTIONS.map((option) => {
                  const selected = range === option.key;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      style={[styles.sheetOption, selected ? styles.sheetOptionActive : undefined]}
                      onPress={() => setRange(option.key)}
                    >
                      <Text
                        style={[
                          styles.sheetOptionText,
                          selected ? styles.sheetOptionTextActive : undefined,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={styles.sheetApplyButton}
                onPress={() => setIsFilterOpen(false)}
              >
                <Text style={styles.sheetApplyText}>Xem {visiblePosts.length} tin đăng</Text>
              </TouchableOpacity>
            </ModalSurface>
          </ModalBackdrop>
        </Modal>
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
  sectionBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
  },
  sectionBadgeActive: { backgroundColor: COLORS.white },
  sectionBadgeText: { color: COLORS.white, fontSize: 11, fontWeight: "800" },
  sectionBadgeTextActive: { color: COLORS.primary },
  statusFilterContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statusChipScroll: { flex: 1 },
  statusChipRow: { gap: 8, paddingRight: 4 },
  filterButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  filterButtonActive: { backgroundColor: COLORS.primary },
  filterSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(84, 123, 125, 0.08)",
  },
  filterSummaryText: { flex: 1, color: COLORS.primary, fontSize: 12, fontWeight: "600" },
  filterResetText: { color: COLORS.primary, fontSize: 13, fontWeight: "800" },
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
  statusChipDanger: { borderColor: "rgba(122, 16, 18, 0.35)", backgroundColor: "rgba(122, 16, 18, 0.06)" },
  statusChipDangerActive: { backgroundColor: "#7A1012", borderColor: "#7A1012" },
  statusChipDangerText: { color: "#7A1012" },
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
  priorityTag: { paddingVertical: 3 },
  cardFooter: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#BAC2C1",
  },
  postedRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 },
  statsText: { color: COLORS.textLight, fontSize: 12 },
  footerRight: { alignItems: "flex-end" },
  expiryText: { marginBottom: 2, color: COLORS.textLight, fontSize: 12, fontWeight: "600" },
  expiryTextUrgent: { color: COLORS.error, fontWeight: "bold" },
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
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(23, 40, 48, 0.48)",
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  sheetTitle: { color: COLORS.text, fontSize: 17, fontWeight: "800" },
  sheetLabel: {
    marginTop: 12,
    marginBottom: 8,
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  sheetOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sheetOption: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#F8F9FA",
  },
  sheetOptionActive: { borderColor: COLORS.primary, backgroundColor: "rgba(84, 123, 125, 0.12)" },
  sheetOptionText: { color: COLORS.text, fontSize: 13, fontWeight: "600" },
  sheetOptionTextActive: { color: COLORS.primary, fontWeight: "800" },
  sheetApplyButton: {
    marginTop: 20,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  sheetApplyText: { color: COLORS.white, fontSize: 15, fontWeight: "800" },
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
