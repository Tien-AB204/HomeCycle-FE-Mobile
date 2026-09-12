import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
  useLocalSearchParams,
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
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import Header from "../../src/components/shared/Header";
import {
  ModalBackdrop,
  ModalSurface,
} from "../../src/components/shared/ModalBackdrop";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import { useChatRealtime } from "../../src/contexts/ChatRealtimeContext";
import apiClient from "../../src/services/apis/axiosClient";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";
import { getAvatarSource } from "../../src/utils/avatar";

type ReceivedOfferItem = {
  offerId?: string;
  postId?: string;
  buyPostId?: string | null;

  productName?: string;
  postTitle?: string;
  postThumbnailUrl?: string | null;

  senderId?: string;
  senderName?: string;
  senderAvatarUrl?: string | null;

  offerPrice?: number | null;
  offerQuantity?: number | null;
  offerStatus?: string | number | null;

  version?: number | null;
  createdAt?: string | null;
};

type ComparisonProduct = {
  categoryId?: string | null;
  productTypeId?: string | null;
  categoryName?: string | null;
  productTypeName?: string | null;
  productName?: string | null;
};

type ComparisonPost = {
  postId?: string;
  productName?: string | null;
  categoryName?: string | null;
  productTypeName?: string | null;
  product?: ComparisonProduct | null;
};

type PostContext = ComparisonPost & {
  postId: string;
  postType: "Buy" | "Sell";
};

type BuyPostMatch = {
  sellPost?: ComparisonPost;
  matchSummary?: {
    matchedCriteriaCount: number;
    evaluatedCriteriaCount: number;
  } | null;
};

const PAGE_SIZE = 100;
const MAX_PAGE_GUARD = 1000;
const MAX_MATCH_PAGES = 10;
const REALTIME_DEBOUNCE_MS = 350;

const postApi = {
  getPostById: (postId: string) =>
    apiClient.get(`/posts/get-by-id/${postId}`).then((response) => response.data),
  getBuyPostMatches: (buyPostId: string, pageNumber: number) =>
    apiClient.get(`/posts/buy/${buyPostId}/matches`, {
      params: { PageNumber: pageNumber, PageSize: PAGE_SIZE },
    }).then((response) => response.data),
};

const offerApi = {
  getReceivedOffers: (params: {
    PageNumber: number;
    PageSize: number;
    PostId?: string;
    BuyPostId?: string;
  }) =>
    apiClient
      .get("/offers/received", { params })
      .then((response) => response.data),

  getOfferById: (offerId: string) =>
    apiClient
      .get(`/offers/${offerId}`)
      .then((response) => response.data),

  acceptOffer: (
    offerId: string,
    version: number,
  ) =>
    apiClient
      .patch(`/offers/${offerId}/accept`, {
        version,
      })
      .then((response) => response.data),

  rejectOffer: (offerId: string) =>
    apiClient
      .post(`/offers/${offerId}/reject`)
      .then((response) => response.data),

  counterOffer: (
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
};

const unwrapPage = (response: any) =>
  response?.data ?? response;

const getPageItems = (
  response: any,
): ReceivedOfferItem[] => {
  const page = unwrapPage(response);

  const items =
    page?.items ??
    page?.Items ??
    [];

  return Array.isArray(items)
    ? items
    : [];
};

const normalizeId = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const getPostType = (value: unknown): PostContext["postType"] | null => {
  const type = String(value ?? "").toLowerCase();
  if (type === "buy" || type === "2") return "Buy";
  if (type === "sell" || type === "1") return "Sell";
  return null;
};

const hasVerifiedTypeMismatch = (buy: ComparisonPost, sell: ComparisonPost) =>
  (["category", "productType"] as const).some((field) => {
    const idKey = `${field}Id` as const;
    const buyId = normalizeId(buy.product?.[idKey]);
    const sellId = normalizeId(sell.product?.[idKey]);
    if (buyId && sellId) return buyId !== sellId;

    // Post lists expose catalog names; product details also expose IDs.
    const nameKey = `${field}Name` as const;
    const buyName = buy.product?.[nameKey] ?? buy[nameKey];
    const sellName = sell.product?.[nameKey] ?? sell[nameKey];
    return typeof buyName === "string" && typeof sellName === "string" &&
      buyName.trim().length > 0 && sellName.trim().length > 0 && buyName !== sellName;
  });

const getSuitabilityCopy = (
  buy: ComparisonPost,
  match?: BuyPostMatch,
  reviewedSell?: ComparisonPost,
) => {
  if (match?.matchSummary) {
    return `Phù hợp ${match.matchSummary.matchedCriteriaCount}/${match.matchSummary.evaluatedCriteriaCount} tiêu chí`;
  }
  const sell = reviewedSell ?? match?.sellPost;
  return sell && hasVerifiedTypeMismatch(buy, sell)
    ? "Khác loại sản phẩm yêu cầu"
    : "Chưa có dữ liệu so sánh";
};

const hasMorePages = (page: any, pageNumber: number, itemCount: number) => {
  const hasNext = page?.hasNextPage ?? page?.HasNextPage;
  if (typeof hasNext === "boolean") return hasNext;
  const totalPages = Number(page?.totalPages ?? page?.TotalPages);
  return Number.isInteger(totalPages) && totalPages >= 0
    ? pageNumber < totalPages
    : itemCount === PAGE_SIZE;
};

// Real, user-selectable sort — replaces the old fixed price-desc/newest-only
// ordering. `offers` here is always the FULL deduped set for this exact Post
// (see fetchAllReceivedOffers's bounded pagination loop below), so sorting
// client-side is a genuine global sort, never a page-local one.
type OfferSortOption = "newest" | "oldest" | "priceDesc" | "priceAsc";

const OFFER_SORT_OPTIONS: Array<{ key: OfferSortOption; label: string }> = [
  { key: "newest", label: "Mới nhất" },
  { key: "oldest", label: "Cũ nhất" },
  { key: "priceDesc", label: "Giá cao → thấp" },
  { key: "priceAsc", label: "Giá thấp → cao" },
];

const getOfferSortLabel = (option: OfferSortOption) =>
  OFFER_SORT_OPTIONS.find((entry) => entry.key === option)?.label ?? "Mới nhất";

const sortReceivedOffers = (
  offers: ReceivedOfferItem[],
  sortOption: OfferSortOption,
) =>
  [...offers].sort((first, second) => {
    const firstTime = Date.parse(first.createdAt ?? "") || 0;
    const secondTime = Date.parse(second.createdAt ?? "") || 0;

    switch (sortOption) {
      case "oldest":
        return firstTime - secondTime;
      case "priceDesc": {
        const diff = Number(second.offerPrice ?? 0) - Number(first.offerPrice ?? 0);
        return diff !== 0 ? diff : secondTime - firstTime;
      }
      case "priceAsc": {
        const diff = Number(first.offerPrice ?? 0) - Number(second.offerPrice ?? 0);
        return diff !== 0 ? diff : secondTime - firstTime;
      }
      case "newest":
      default:
        return secondTime - firstTime;
    }
  });

const fetchBuyComparisons = async (
  buyPostId: string,
  offers: ReceivedOfferItem[],
  isCurrent: () => boolean,
): Promise<Record<string, BuyPostMatch>> => {
  const neededIds = new Set(offers.map((offer) => normalizeId(offer.postId)).filter(Boolean));
  const matches: Record<string, BuyPostMatch> = {};
  // Comparisons never determine which canonical Offers appear in the list.
  for (let pageNumber = 1; pageNumber <= MAX_MATCH_PAGES && neededIds.size > 0; pageNumber += 1) {
    if (!isCurrent()) return {};
    try {
      const response = await postApi.getBuyPostMatches(buyPostId, pageNumber);
      if (!isCurrent()) return {};
      if (response?.isSuccess === false) break;
      const page = unwrapPage(response);
      if (!Array.isArray(page?.items)) break;
      for (const match of page.items as BuyPostMatch[]) {
        const sellId = normalizeId(match.sellPost?.postId);
        if (!neededIds.has(sellId)) continue;
        matches[sellId] = match;
        if (match.matchSummary) neededIds.delete(sellId);
      }
      if (!hasMorePages(page, pageNumber, page.items.length)) break;
    } catch {
      // Keep real summaries from successful pages; unavailable comparisons remain neutral.
      break;
    }
  }
  return matches;
};

const normalizeStatus = (value: unknown) =>
  String(value ?? "")
    .trim()
    .replace(/[\s_-]/g, "")
    .toLowerCase();

const isPendingOffer = (value: unknown) => {
  const status = normalizeStatus(value);

  return status === "0" || status === "pending";
};

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

const getStatusLabel = (value: unknown) => {
  switch (normalizeStatus(value)) {
    case "0":
    case "pending":
      return "Đang chờ phản hồi";

    case "1":
    case "accepted":
      return "Đã chấp nhận";

    case "2":
    case "rejected":
      return "Đã từ chối";

    case "3":
    case "cancelled":
    case "canceled":
      return "Đã hủy";

    case "4":
    case "completed":
      return "Đã hoàn tất";

    case "5":
    case "closed":
      return "Đã đóng";

    case "6":
    case "expired":
      return "Đã hết hạn";

    default:
      return "Chưa xác định";
  }
};

const getStatusStyle = (value: unknown) => {
  switch (normalizeStatus(value)) {
    case "1":
    case "accepted":
    case "4":
    case "completed":
      return styles.statusAccepted;

    case "2":
    case "rejected":
    case "3":
    case "cancelled":
    case "canceled":
    case "5":
    case "closed":
    case "6":
    case "expired":
      return styles.statusRejected;

    default:
      return styles.statusPending;
  }
};

const formatPrice = (value: unknown) =>
  `${Number(value || 0).toLocaleString("vi-VN")} đ`;

const formatDate = (value: unknown) => {
  if (!value) return "";

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const fetchAllReceivedOffers =
  async (
    filter: {
      PostId?: string;
      BuyPostId?: string;
    },
    isCurrent: () => boolean,
  ): Promise<ReceivedOfferItem[]> => {
    const result: ReceivedOfferItem[] = [];
    // Newest-first pages shift when an Offer arrives mid-scan; never surface a row twice.
    const seenOfferIds = new Set<string>();

    let pageNumber = 1;

    while (pageNumber <= MAX_PAGE_GUARD) {
      if (!isCurrent()) return [];
      const response =
        await offerApi.getReceivedOffers({
          PageNumber: pageNumber,
          PageSize: PAGE_SIZE,
          ...filter,
        });

      if (!isCurrent()) return [];
      if (response?.isSuccess === false) throw response;
      const page = unwrapPage(response);
      if (!Array.isArray(page?.items ?? page?.Items)) {
        throw new Error("Không thể tải đầy đủ danh sách. Vui lòng thử lại.");
      }
      const items = getPageItems(response);

      for (const item of items) {
        const offerId = normalizeId(item?.offerId ?? (item as any)?.OfferId);
        if (offerId && seenOfferIds.has(offerId)) continue;
        if (offerId) seenOfferIds.add(offerId);
        result.push(item);
      }

      if (!hasMorePages(page, pageNumber, items.length)) return result;

      pageNumber += 1;
    }

    throw new Error("Danh sách quá lớn. Vui lòng thử lại sau.");
  };

export default function OffersByPostScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { connection, reconnectVersion } = useChatRealtime();
  const currentUserId = user?.userId || user?.id;

  const postId = Array.isArray(params.postId)
    ? params.postId[0]
    : params.postId;

  const postTitleParam = Array.isArray(
    params.postTitle,
  )
    ? params.postTitle[0]
    : params.postTitle;

  const contextKey = `${normalizeId(currentUserId)}:${normalizeId(postId)}`;
  const [postContext, setPostContext] = useState<PostContext | null>(null);
  const isBuyPost = postContext?.postType === "Buy";
  const [comparisons, setComparisons] = useState<Record<string, BuyPostMatch>>({});
  const [reviewedSells, setReviewedSells] = useState<Record<string, ComparisonPost>>({});
  const contextRequest = useRef<{ key: string; promise: Promise<PostContext> } | null>(null);
  const loadGeneration = useRef(0);
  const comparisonGeneration = useRef(0);
  const actionGeneration = useRef(0);
  const actionLock = useRef(false);
  const focused = useRef(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handledReconnect = useRef(reconnectVersion);

  const [offers, setOffers] = useState<
    ReceivedOfferItem[]
  >([]);

  // Default stays "newest" for both Buy and Sell context — the Buy
  // procurement default must never be highest-price-first, and there is no
  // authoritative reason for Sell to default differently.
  const [sortOption, setSortOption] =
    useState<OfferSortOption>("newest");
  const [showSortMenu, setShowSortMenu] = useState(false);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const [errorText, setErrorText] =
    useState<string | null>(null);

  const [actionMode, setActionMode] =
    useState<
      "accept" | "reject" | "counter" | null
    >(null);

  const [selectedOffer, setSelectedOffer] =
    useState<any>(null);

  const [counterPrice, setCounterPrice] =
    useState("");

  const [counterQuantity, setCounterQuantity] =
    useState("");

  const [isProcessingAction, setIsProcessingAction] =
    useState(false);

  const [actionFeedback, setActionFeedback] =
    useState<{
      type: "success" | "error";
      text: string;
    } | null>(null);

  const resolvePostContext = useCallback((): Promise<PostContext> => {
    if (contextRequest.current?.key === contextKey) return contextRequest.current.promise;
    const promise = (async () => {
      if (!postId) throw new Error("Không tìm thấy bài đăng. Vui lòng mở lại từ bài đăng.");
      const response = await postApi.getPostById(String(postId));
      if (response?.isSuccess === false) throw response;
      const detail = unwrapPage(response);
      const postType = getPostType(detail?.postType);
      if (!postType || normalizeId(detail?.postId) !== normalizeId(postId)) {
        throw new Error("Chưa xác định được loại bài đăng. Vui lòng thử lại.");
      }
      return { ...detail, postType } as PostContext;
    })();
    const request = { key: contextKey, promise };
    contextRequest.current = request;
    void promise.catch(() => {
      if (contextRequest.current === request) contextRequest.current = null;
    });
    return promise;
  }, [contextKey, postId]);

  const cancelScheduledRefresh = useCallback(() => {
    if (refreshTimer.current !== null) clearTimeout(refreshTimer.current);
    refreshTimer.current = null;
  }, []);

  const loadOffers = useCallback(async (refreshing = false) => {
    if (!focused.current) return;
    cancelScheduledRefresh();
    const generation = ++loadGeneration.current;
    const comparisonVersion = ++comparisonGeneration.current;
    const isCurrent = () => focused.current && loadGeneration.current === generation;
    setIsRefreshing(refreshing);
    if (!refreshing) setIsLoading(true);
    setErrorText(null);
    setComparisons({});
    setReviewedSells({});
    try {
      // Resolve once per focus, sharing an in-flight request across refreshes.
      const context = await resolvePostContext();
      if (!isCurrent()) return;
      setPostContext(context);
      const isBuy = context.postType === "Buy";
      const received = await fetchAllReceivedOffers(
        isBuy ? { BuyPostId: context.postId } : { PostId: context.postId },
        isCurrent,
      );
      if (!isCurrent()) return;
      // The server filter owns list membership; matching only enriches these
      // rows. Display order is applied separately (see `sortedOffers`) so the
      // user's chosen sort survives a background refetch/realtime refresh.
      setOffers(received);
      if (isBuy) {
        const isComparisonCurrent = () => isCurrent() && comparisonGeneration.current === comparisonVersion;
        void fetchBuyComparisons(context.postId, received, isComparisonCurrent).then((matches) => {
          if (isComparisonCurrent()) setComparisons(matches);
        });
      }
    } catch (error) {
      if (!isCurrent()) return;
      setErrorText(getApiErrorMessage(error, "Không thể tải danh sách đã nhận. Vui lòng thử lại."));
    } finally {
      if (isCurrent()) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [cancelScheduledRefresh, resolvePostContext]);

  const scheduleRefresh = useCallback(() => {
    if (!focused.current) return;
    // Invalidate immediately, including requests completing during the debounce window.
    loadGeneration.current += 1;
    comparisonGeneration.current += 1;
    setComparisons({});
    setReviewedSells({});
    cancelScheduledRefresh();
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      void loadOffers(true);
    }, REALTIME_DEBOUNCE_MS);
  }, [cancelScheduledRefresh, loadOffers]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    contextRequest.current = null;
    setPostContext(null);
    setOffers([]);
    setActionFeedback(null);
    void loadOffers();
    return () => {
      focused.current = false;
      cancelScheduledRefresh();
      loadGeneration.current += 1;
      comparisonGeneration.current += 1;
      actionGeneration.current += 1;
      actionLock.current = false;
      setActionMode(null);
      setSelectedOffer(null);
      setCounterPrice("");
      setCounterQuantity("");
      setIsProcessingAction(false);
    };
  }, [cancelScheduledRefresh, loadOffers]));

  useFocusEffect(useCallback(() => {
    if (!connection) return;
    const handleOfferChanged = (payload: any) => {
      const event = payload?.data ?? payload;
      const receiverId = normalizeId(event?.receiver?.userId ?? event?.Receiver?.UserId);
      if (receiverId && currentUserId && receiverId !== normalizeId(currentUserId)) return;
      const buyId = normalizeId(event?.buyPostId ?? event?.BuyPostId);
      const sellId = normalizeId(event?.postId ?? event?.PostId);
      const targetId = normalizeId(postId);
      if (postContext?.postType === "Buy" && buyId && buyId !== targetId) return;
      if (postContext?.postType === "Sell" && sellId && sellId !== targetId) return;
      // Missing identifiers cannot safely exclude an event. Refetch canonical data.
      scheduleRefresh();
    };
    connection.on("OfferCreated", handleOfferChanged);
    connection.on("OfferUpdated", handleOfferChanged);
    return () => {
      connection.off("OfferCreated", handleOfferChanged);
      connection.off("OfferUpdated", handleOfferChanged);
    };
  }, [connection, currentUserId, postContext?.postType, postId, scheduleRefresh]));

  useEffect(() => {
    if (handledReconnect.current === reconnectVersion) return;
    handledReconnect.current = reconnectVersion;
    scheduleRefresh();
  }, [reconnectVersion, scheduleRefresh]);

  const sortedOffers = useMemo(
    () => sortReceivedOffers(offers, sortOption),
    [offers, sortOption],
  );

  const highestPrice = useMemo(() => {
    const prices = offers
      .map((offer) =>
        Number(offer?.offerPrice),
      )
      .filter(
        (value) =>
          Number.isFinite(value) &&
          value > 0,
      );

    return prices.length > 0
      ? Math.max(...prices)
      : null;
  }, [offers]);

  const productName =
    postContext?.product?.productName || postContext?.productName ||
    String(postTitleParam || "").trim() ||
    (!isBuyPost && (offers[0]?.productName || offers[0]?.postTitle)) ||
    "Bài đăng hiện tại";

  const offerNoun = isBuyPost ? "chào bán" : "đề nghị";
  const headerTitle = isBuyPost ? "Chào bán đã nhận" : postContext ? "Đề nghị cho bài đăng" : "Danh sách đã nhận";

  const closeOfferAction = () => {
    if (actionLock.current) return;

    actionGeneration.current += 1;
    setActionMode(null);
    setSelectedOffer(null);
    setCounterPrice("");
    setCounterQuantity("");
    setActionFeedback(null);
  };

  const handleOpenOfferAction = async (
    mode: "accept" | "reject" | "counter",
    listOffer: ReceivedOfferItem,
  ) => {
    if (actionLock.current || !focused.current) return;
    const generation = ++actionGeneration.current;
    const comparisonVersion = comparisonGeneration.current;
    const isCurrentAction = () => focused.current && actionGeneration.current === generation;
    const offerId = String(
      listOffer.offerId ?? "",
    ).trim();

    if (!offerId) {
      setActionFeedback({
        type: "error",
        text: `Không xác định được ${offerNoun}.`,
      });
      return;
    }

    if (!isPendingOffer(listOffer.offerStatus)) {
      setActionFeedback({
        type: "error",
        text: `${isBuyPost ? "Chào bán" : "Đề nghị"} này không còn ở trạng thái chờ phản hồi.`,
      });
      await loadOffers(true);
      return;
    }

    try {
      actionLock.current = true;
      setIsProcessingAction(true);
      setActionFeedback(null);

      const response =
        await offerApi.getOfferById(offerId);

      if (!isCurrentAction()) return;
      if (response?.isSuccess === false) throw response;
      const detail = unwrapPage(response);
      if (normalizeId(detail?.offerId ?? detail?.OfferId) !== normalizeId(offerId)) {
        throw new Error(`Không xác định được ${offerNoun}. Vui lòng thử lại.`);
      }

      if (isBuyPost && comparisonGeneration.current === comparisonVersion &&
        normalizeId(detail?.buyPostId) === normalizeId(postId) &&
        normalizeId(detail?.sellPost?.postId) === normalizeId(listOffer.postId)) {
        // Reuse the detail already needed for actions; never fetch details per card.
        setReviewedSells((current) => ({
          ...current,
          [normalizeId(listOffer.postId)]: { ...detail.sellPost, product: detail.product },
        }));
      }

      const currentStatus =
        detail?.offerStatus ??
        detail?.OfferStatus;

      if (!isPendingOffer(currentStatus)) {
        await loadOffers(true);
        if (!isCurrentAction()) return;

        setActionFeedback({
          type: "error",
          text: `${isBuyPost ? "Chào bán" : "Đề nghị"} vừa thay đổi trạng thái. Danh sách đã được làm mới.`,
        });
        return;
      }

      const canAccept =
        detail?.canAccept ??
        detail?.CanAccept;

      const canReject =
        detail?.canReject ??
        detail?.CanReject;

      if (
        mode === "accept" &&
        canAccept !== true
      ) {
        await loadOffers(true);
        if (!isCurrentAction()) return;

        setActionFeedback({
          type: "error",
          text: `${isBuyPost ? "Chào bán" : "Đề nghị"} này hiện không thể được chấp nhận.`,
        });
        return;
      }

      if (
        mode === "reject" &&
        canReject !== true
      ) {
        await loadOffers(true);
        if (!isCurrentAction()) return;

        setActionFeedback({
          type: "error",
          text: `${isBuyPost ? "Chào bán" : "Đề nghị"} này hiện không thể bị từ chối.`,
        });
        return;
      }

      const hydratedOffer = {
        ...listOffer,
        ...detail,
        offerId:
          detail?.offerId ??
          detail?.OfferId ??
          offerId,
        offerStatus: currentStatus,
        offerPrice: detail?.offerPrice ?? detail?.OfferPrice,
        offerQuantity: detail?.offerQuantity ?? detail?.OfferQuantity,
        version:
          detail?.version ??
          detail?.Version,
      };

      setSelectedOffer(hydratedOffer);

      if (mode === "counter") {
        setCounterPrice(
          String(
            hydratedOffer.offerPrice ??
              hydratedOffer.OfferPrice ??
              "",
          ),
        );

        setCounterQuantity(
          String(
            hydratedOffer.offerQuantity ??
              hydratedOffer.OfferQuantity ??
              1,
          ),
        );
      }

      setActionMode(mode);
    } catch (error) {
      if (!isCurrentAction()) return;
      setActionFeedback({
        type: "error",
        text: getApiErrorMessage(
          error,
          `Không thể tải trạng thái mới nhất của ${offerNoun}.`,
        ),
      });
    } finally {
      if (isCurrentAction()) {
        actionLock.current = false;
        setIsProcessingAction(false);
      }
    }
  };

  const handleSubmitOfferAction = async () => {
    if (!selectedOffer || !actionMode || actionLock.current || !focused.current) {
      return;
    }
    const generation = ++actionGeneration.current;
    const isCurrentAction = () => focused.current && actionGeneration.current === generation;

    const offerId = String(
      selectedOffer.offerId ??
        selectedOffer.OfferId ??
        "",
    ).trim();

    const rawVersion = selectedOffer.version ?? selectedOffer.Version;
    const version = rawVersion == null ? NaN : Number(rawVersion);

    if (!offerId) {
      setActionFeedback({
        type: "error",
        text: `Không xác định được ${offerNoun}.`,
      });
      return;
    }

    if (
      (actionMode === "accept" ||
        actionMode === "counter") &&
      (
        !Number.isInteger(version) ||
        version < 0
      )
    ) {
      setActionMode(null);
      setSelectedOffer(null);

      await loadOffers(true);
      if (!isCurrentAction()) return;

      setActionFeedback({
        type: "error",
        text: `Chưa cập nhật được ${offerNoun}. Danh sách đã được làm mới, vui lòng xem lại trước khi thao tác.`,
      });
      return;
    }

    const price = Number(
      counterPrice.trim(),
    );

    const quantity = Number(
      counterQuantity.trim(),
    );

    if (
      actionMode === "counter" &&
      (
        !Number.isFinite(price) ||
        price <= 0 ||
        !Number.isInteger(quantity) ||
        quantity <= 0
      )
    ) {
      setActionFeedback({
        type: "error",
        text: "Vui lòng nhập giá và số lượng hợp lệ.",
      });
      return;
    }

    try {
      actionLock.current = true;
      setIsProcessingAction(true);
      setActionFeedback(null);

      let response: any;

      if (actionMode === "accept") {
        response =
          await offerApi.acceptOffer(
            offerId,
            version,
          );
      } else if (actionMode === "reject") {
        response =
          await offerApi.rejectOffer(
            offerId,
          );
      } else {
        response =
          await offerApi.counterOffer(
            offerId,
            {
              offerPrice: price,
              offerQuantity: quantity,
              version,
            },
          );
      }

      if (!isCurrentAction()) return;
      if (response?.isSuccess === false) {
        throw response;
      }

      const completedMode = actionMode;

      setActionMode(null);
      setSelectedOffer(null);
      setCounterPrice("");
      setCounterQuantity("");

      await loadOffers(true);
      if (!isCurrentAction()) return;

      setActionFeedback({
        type: "success",
        text:
          completedMode === "accept"
            ? isBuyPost
              ? "Đã chấp nhận chào bán. Phòng chat đã được mở."
              : "Đã chấp nhận thương lượng. Phòng chat đã được mở."
            : completedMode === "reject"
              ? `Đã từ chối ${offerNoun}.`
              : "Đã gửi đề xuất giá mới.",
      });
    } catch (error) {
      if (!isCurrentAction()) return;
      const code =
        getOfferErrorCode(error);

      setActionMode(null);
      setSelectedOffer(null);
      setCounterPrice("");
      setCounterQuantity("");

      await loadOffers(true);
      if (!isCurrentAction()) return;

      if (
        code === "OFFER_TERMS_CHANGED"
      ) {
        setActionFeedback({
          type: "error",
          text: `${isBuyPost ? "Chào bán" : "Đề nghị"} vừa được cập nhật. Danh sách đã được làm mới, vui lòng xem lại trước khi thao tác.`,
        });
        return;
      }

      setActionFeedback({
        type: "error",
        text: getApiErrorMessage(
          error,
          `Không thể xử lý ${offerNoun} lúc này.`,
        ),
      });
    } finally {
      if (isCurrentAction()) {
        actionLock.current = false;
        setIsProcessingAction(false);
      }
    }
  };

  const openOfferDetail = (
    offerId: unknown,
  ) => {
    const targetOfferId =
      String(offerId ?? "").trim();

    if (!targetOfferId) return;

    router.push({
      pathname: "/offers/[id]",
      params: {
        id: targetOfferId,
      },
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header
          title={headerTitle}
          showBack
        />

        <View style={styles.centered}>
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
          />

          <Text style={styles.loadingText}>
            {isBuyPost ? "Đang tải chào bán..." : "Đang tải danh sách..."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title={headerTitle}
        showBack
      />

      <FlatList
        data={sortedOffers}
        keyExtractor={(item, index) =>
          String(
            item.offerId ||
              `offer-${index}`,
          )
        }
        contentContainerStyle={
          styles.content
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() =>
              void loadOffers(true)
            }
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text
              style={styles.productName}
              numberOfLines={2}
            >
              {productName}
            </Text>

            <View style={styles.summaryCard}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>
                  {offers.length}
                </Text>

                <Text style={styles.summaryLabel}>
                  {isBuyPost ? "Chào bán đã nhận" : "Lời đề nghị"}
                </Text>
              </View>

              {!isBuyPost && postContext ? (
                <>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryPrice} numberOfLines={1} adjustsFontSizeToFit>
                      {highestPrice ? formatPrice(highestPrice) : "Chưa có"}
                    </Text>
                    <Text style={styles.summaryLabel}>Giá cao nhất</Text>
                  </View>
                </>
              ) : null}
            </View>

            <TouchableOpacity
              style={styles.sortBadge}
              onPress={() => setShowSortMenu(true)}
              disabled={!postContext}
            >
              <Ionicons
                name="swap-vertical-outline"
                size={15}
                color={COLORS.primary}
              />

              <Text style={styles.sortText}>
                {postContext
                  ? getOfferSortLabel(sortOption)
                  : "Đang xác định bài đăng"}
              </Text>

              {postContext ? (
                <Ionicons
                  name="chevron-down"
                  size={13}
                  color={COLORS.primary}
                />
              ) : null}
            </TouchableOpacity>

            {actionFeedback && !actionMode ? (
              <View
                style={[
                  styles.actionFeedbackBox,
                  actionFeedback.type === "error"
                    ? styles.actionFeedbackError
                    : styles.actionFeedbackSuccess,
                ]}
              >
                <Ionicons
                  name={
                    actionFeedback.type === "error"
                      ? "alert-circle-outline"
                      : "checkmark-circle-outline"
                  }
                  size={19}
                  color={
                    actionFeedback.type === "error"
                      ? COLORS.error
                      : COLORS.success
                  }
                />

                <Text
                  style={[
                    styles.actionFeedbackText,
                    {
                      color:
                        actionFeedback.type === "error"
                          ? COLORS.error
                          : COLORS.success,
                    },
                  ]}
                >
                  {actionFeedback.text}
                </Text>
              </View>
            ) : null}

            {errorText ? (
              <View style={styles.errorBox}>
                <Ionicons
                  name="alert-circle-outline"
                  size={19}
                  color={COLORS.error}
                />

                <Text style={styles.errorText}>
                  {errorText}
                </Text>
                <TouchableOpacity onPress={() => void loadOffers(true)} disabled={isRefreshing}>
                  <Text style={styles.detailLinkText}>Thử lại</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const senderName =
            String(
              item.senderName || "",
            ).trim() || (isBuyPost ? "Người bán" : "Người gửi");
          const sellId = normalizeId(item.postId);
          const comparison = comparisons[sellId];
          const reviewedSell = reviewedSells[sellId];
          const sellProductName = item.productName || item.postTitle ||
            reviewedSell?.product?.productName || reviewedSell?.productName ||
            comparison?.sellPost?.productName || "Tin bán";

          return (
            <TouchableOpacity
              style={styles.offerCard}
              activeOpacity={0.8}
              onPress={() =>
                openOfferDetail(
                  item.offerId,
                )
              }
            >
              <Image
                source={getAvatarSource(
                  item.senderAvatarUrl,
                )}
                style={styles.avatar}
                resizeMode="cover"
              />

              <View style={styles.offerContent}>
                {isBuyPost ? (
                  <Text style={styles.sellProductName} numberOfLines={2}>
                    {sellProductName}
                  </Text>
                ) : null}
                <View style={styles.offerTopRow}>
                  <Text
                    style={styles.senderName}
                    numberOfLines={1}
                  >
                    {senderName}
                  </Text>

                  <Text style={styles.offerPrice}>
                    {formatPrice(
                      item.offerPrice,
                    )}
                  </Text>

                  {isPendingOffer(item.offerStatus) ? (
                    <TouchableOpacity
                      style={styles.rejectIconButton}
                      hitSlop={8}
                      disabled={isProcessingAction}
                      onPress={(event) => {
                        event.stopPropagation();
                        void handleOpenOfferAction(
                          "reject",
                          item,
                        );
                      }}
                    >
                      <Ionicons
                        name="close"
                        size={14}
                        color={COLORS.error}
                      />
                    </TouchableOpacity>
                  ) : null}
                </View>

                <View style={styles.offerMetaRow}>
                  <Text style={styles.offerQuantity}>
                    Số lượng:{" "}
                    {Number(
                      item.offerQuantity || 0,
                    )}
                  </Text>

                  <Text style={styles.offerDate}>
                    {formatDate(
                      item.createdAt,
                    )}
                  </Text>
                </View>

                {isBuyPost && postContext ? (
                  <Text style={styles.suitabilityText}>
                    {getSuitabilityCopy(postContext, comparison, reviewedSell)}
                  </Text>
                ) : null}

                <View style={styles.offerBottomRow}>
                  <View
                    style={[
                      styles.statusBadge,
                      getStatusStyle(
                        item.offerStatus,
                      ),
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {getStatusLabel(
                        item.offerStatus,
                      )}
                    </Text>
                  </View>

                  <View style={styles.detailLink}>
                    <Text
                      style={
                        styles.detailLinkText
                      }
                    >
                      Xem chi tiết
                    </Text>

                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={COLORS.primary}
                    />
                  </View>
                </View>

                {isPendingOffer(
                  item.offerStatus,
                ) ? (
                  <View style={styles.offerActionRow}>
                    <TouchableOpacity
                      style={styles.counterActionButton}
                      disabled={isProcessingAction}
                      onPress={(event) => {
                        event.stopPropagation();
                        void handleOpenOfferAction(
                          "counter",
                          item,
                        );
                      }}
                    >
                      <Text style={styles.counterActionText}>
                        Trao đổi
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.acceptActionButton}
                      disabled={isProcessingAction}
                      onPress={(event) => {
                        event.stopPropagation();
                        void handleOpenOfferAction(
                          "accept",
                          item,
                        );
                      }}
                    >
                      <Text style={styles.acceptActionText}>
                        Đồng ý
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          !errorText ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="chatbubbles-outline"
                size={44}
                color={COLORS.textLight}
              />

              <Text style={styles.emptyTitle}>
                {isBuyPost ? "Chưa có chào bán" : "Chưa có đề nghị"}
              </Text>

              <Text style={styles.emptyText}>
                {isBuyPost
                  ? "Tin thu mua này chưa nhận được chào bán nào từ người bán."
                  : "Bài đăng này chưa nhận được đề nghị thương lượng nào."}
              </Text>
            </View>
          ) : null
        }
      />

      <Modal
        visible={actionMode !== null}
        transparent
        animationType="fade"
        onRequestClose={closeOfferAction}
      >
        <ModalBackdrop
          style={styles.modalBackdrop}
          disabled={isProcessingAction}
          onPress={closeOfferAction}
        >
          <KeyboardAvoidingView
            style={styles.modalKeyboard}
            behavior={
              Platform.OS === "ios"
                ? "padding"
                : "height"
            }
          >
            <ModalSurface style={styles.actionModal}>
              <View style={styles.actionModalHeader}>
                <Text style={styles.actionModalTitle}>
                  {actionMode === "accept"
                    ? `Đồng ý ${offerNoun}`
                    : actionMode === "reject"
                      ? `Từ chối ${offerNoun}`
                      : `Trao đổi ${offerNoun}`}
                </Text>

                <TouchableOpacity
                  disabled={isProcessingAction}
                  onPress={closeOfferAction}
                >
                  <Ionicons
                    name="close"
                    size={23}
                    color={COLORS.text}
                  />
                </TouchableOpacity>
              </View>

              {actionMode === "counter" ? (
                <>
                  <Text style={styles.actionInputLabel}>
                    Giá đề xuất mới (VNĐ)
                  </Text>

                  <TextInput
                    style={styles.actionInput}
                    value={counterPrice}
                    keyboardType="number-pad"
                    editable={!isProcessingAction}
                    onChangeText={(value) => {
                      setCounterPrice(
                        value.replace(
                          /[^0-9]/g,
                          "",
                        ),
                      );
                      setActionFeedback(null);
                    }}
                    placeholder="Nhập giá mới"
                    placeholderTextColor={
                      COLORS.textLight
                    }
                  />

                  <Text style={styles.actionInputLabel}>
                    Số lượng
                  </Text>

                  <TextInput
                    style={styles.actionInput}
                    value={counterQuantity}
                    keyboardType="number-pad"
                    editable={!isProcessingAction}
                    onChangeText={(value) => {
                      setCounterQuantity(
                        value.replace(
                          /[^0-9]/g,
                          "",
                        ),
                      );
                      setActionFeedback(null);
                    }}
                    placeholder="Nhập số lượng"
                    placeholderTextColor={
                      COLORS.textLight
                    }
                  />
                </>
              ) : (
                <Text style={styles.actionModalMessage}>
                  {actionMode === "accept"
                    ? `Bạn có muốn đồng ý với ${offerNoun} này và mở phiên thương lượng?`
                    : `Bạn có chắc muốn từ chối ${offerNoun} này?`}
                </Text>
              )}

              {actionFeedback?.type === "error" ? (
                <Text style={styles.actionModalError}>
                  {actionFeedback.text}
                </Text>
              ) : null}

              <View style={styles.actionModalButtons}>
                <TouchableOpacity
                  style={styles.actionCancelButton}
                  disabled={isProcessingAction}
                  onPress={closeOfferAction}
                >
                  <Text style={styles.actionCancelText}>
                    Quay lại
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionSubmitButton,
                    actionMode === "reject"
                      ? styles.actionRejectSubmitButton
                      : undefined,
                  ]}
                  disabled={isProcessingAction}
                  onPress={() =>
                    void handleSubmitOfferAction()
                  }
                >
                  {isProcessingAction ? (
                    <ActivityIndicator
                      size="small"
                      color={COLORS.white}
                    />
                  ) : (
                    <Text style={styles.actionSubmitText}>
                      {actionMode === "accept"
                        ? "Đồng ý"
                        : actionMode === "reject"
                          ? "Từ chối"
                          : "Gửi đề xuất"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ModalSurface>
          </KeyboardAvoidingView>
        </ModalBackdrop>
      </Modal>

      <Modal
        visible={showSortMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortMenu(false)}
      >
        <ModalBackdrop
          style={styles.sortMenuBackdrop}
          onPress={() => setShowSortMenu(false)}
        >
          <ModalSurface style={styles.sortMenuCard}>
            <Text style={styles.sortMenuTitle}>Sắp xếp theo</Text>

            {OFFER_SORT_OPTIONS.map((option) => {
              const selected = option.key === sortOption;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={styles.sortMenuOption}
                  onPress={() => {
                    setSortOption(option.key);
                    setShowSortMenu(false);
                  }}
                >
                  <Text
                    style={[
                      styles.sortMenuOptionText,
                      selected ? styles.sortMenuOptionTextActive : undefined,
                    ]}
                  >
                    {option.label}
                  </Text>

                  {selected ? (
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={COLORS.primary}
                    />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ModalSurface>
        </ModalBackdrop>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textLight,
    fontSize: 14,
  },
  content: {
    padding: 16,
    paddingBottom: 36,
  },
  listHeader: {
    gap: 12,
    marginBottom: 12,
  },
  productName: {
    color: COLORS.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  summaryCard: {
    minHeight: 76,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.white,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  summaryDivider: {
    width: 1,
    marginVertical: 12,
    backgroundColor: COLORS.border,
  },
  summaryValue: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
  },
  summaryPrice: {
    maxWidth: "100%",
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: "800",
  },
  summaryLabel: {
    marginTop: 4,
    color: COLORS.textLight,
    fontSize: 11,
  },
  sortBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor:
      "rgba(43, 86, 89, 0.08)",
  },
  sortText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  sortMenuBackdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sortMenuCard: {
    width: "100%",
    maxWidth: 360,
    alignSelf: "center",
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: COLORS.white,
  },
  sortMenuTitle: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  sortMenuOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 46,
    paddingHorizontal: 16,
  },
  sortMenuOptionText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "600",
  },
  sortMenuOptionTextActive: {
    color: COLORS.primary,
    fontWeight: "800",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 11,
    borderWidth: 1,
    borderColor:
      "rgba(122, 16, 18, 0.22)",
    borderRadius: 9,
    backgroundColor:
      "rgba(122, 16, 18, 0.07)",
  },
  errorText: {
    flex: 1,
    color: COLORS.error,
    fontSize: 12,
    lineHeight: 18,
  },
  actionFeedbackBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 11,
    borderWidth: 1,
    borderRadius: 9,
  },
  actionFeedbackError: {
    borderColor:
      "rgba(122, 16, 18, 0.22)",
    backgroundColor:
      "rgba(122, 16, 18, 0.07)",
  },
  actionFeedbackSuccess: {
    borderColor:
      "rgba(47, 118, 93, 0.24)",
    backgroundColor:
      "rgba(47, 118, 93, 0.08)",
  },
  actionFeedbackText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  offerCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    marginBottom: 10,
    padding: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.white,
  },
  rejectIconButton: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: "rgba(122, 16, 18, 0.08)",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EEF2F2",
  },
  offerContent: {
    flex: 1,
    minWidth: 0,
  },
  sellProductName: {
    marginBottom: 8,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
  },
  suitabilityText: {
    marginTop: 8,
    color: COLORS.textLight,
    fontSize: 12,
    lineHeight: 18,
  },
  offerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  senderName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },
  offerPrice: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  offerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 6,
  },
  offerQuantity: {
    color: COLORS.textLight,
    fontSize: 12,
  },
  offerDate: {
    flexShrink: 1,
    color: COLORS.textLight,
    fontSize: 10,
    textAlign: "right",
  },
  offerBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPending: {
    backgroundColor:
      "rgba(154, 100, 24, 0.10)",
  },
  statusAccepted: {
    backgroundColor:
      "rgba(47, 118, 93, 0.10)",
  },
  statusRejected: {
    backgroundColor:
      "rgba(122, 16, 18, 0.08)",
  },
  statusText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "700",
  },
  detailLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  detailLinkText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  offerActionRow: {
    flexDirection: "row",
    gap: 7,
    marginTop: 12,
  },
  counterActionButton: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    backgroundColor: COLORS.white,
  },
  counterActionText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  acceptActionButton: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  acceptActionText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalKeyboard: {
    width: "100%",
    alignItems: "center",
  },
  actionModal: {
    width: "100%",
    maxWidth: 420,
    padding: 18,
    borderRadius: 14,
    backgroundColor: COLORS.white,
  },
  actionModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  actionModalTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "800",
  },
  actionModalMessage: {
    marginTop: 12,
    color: COLORS.textLight,
    fontSize: 13,
    lineHeight: 19,
  },
  actionInputLabel: {
    marginTop: 15,
    marginBottom: 7,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  actionInput: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 9,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  actionModalError: {
    marginTop: 12,
    color: COLORS.error,
    fontSize: 12,
    lineHeight: 18,
  },
  actionModalButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  actionCancelButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 9,
  },
  actionCancelText: {
    color: COLORS.text,
    fontWeight: "700",
  },
  actionSubmitButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: COLORS.primary,
  },
  actionRejectSubmitButton: {
    backgroundColor: COLORS.error,
  },
  actionSubmitText: {
    color: COLORS.white,
    fontWeight: "800",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 54,
  },
  emptyTitle: {
    marginTop: 12,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
  },
  emptyText: {
    marginTop: 6,
    maxWidth: 300,
    color: COLORS.textLight,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
});
