import { Ionicons } from "@expo/vector-icons";
import { useIsFocused, usePreventRemove } from "@react-navigation/native";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import apiClient from "../../src/services/apis/axiosClient";
import {
  getApiErrorMessage,
  getApiSuccessMessage,
} from "../../src/utils/apiFeedback";
import { ModalBackdrop, ModalSurface } from "../../src/components/shared/ModalBackdrop";
import { getAvatarSource } from "../../src/utils/avatar";

type FeedbackType = "error" | "success" | "warning" | "info";
type LocalFeedback = {
  type: FeedbackType;
  message: string;
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

type SellerMatchPost = {
  postId?: string;
  ownerId?: string;
  productName?: string;
  categoryName?: string | null;
  productTypeName?: string | null;
  product?: {
    categoryId?: string | null;
    productTypeId?: string | null;
    categoryName?: string | null;
    productTypeName?: string | null;
  };
  remainingQuantity?: number;
  quantity?: number;
  basePrice?: number | null;
  status?: string | number;
  postType?: string | number;
  expiryDate?: string | null;
  isExpired?: boolean;
};

type MatchState = "Matched" | "NotMatched" | "NotSpecified" | "Unknown";
type MatchSummary = {
  category: MatchState;
  productType: MatchState;
  brand: MatchState;
  functionality: MatchState;
  usageDuration: MatchState;
  damageLevel: MatchState;
  price: MatchState;
  city: MatchState;
  attributes: Record<string, MatchState>;
  matchedCriteriaCount: number;
  evaluatedCriteriaCount: number;
};

type BuyPostMatch = {
  sellPost?: SellerMatchPost;
  matchSummary?: MatchSummary;
};

const normalizePostId = (value: unknown) => String(value ?? "").trim().toLowerCase();

const hasVerifiedTypeMismatch = (buyPost: SellerMatchPost, sellPost: SellerMatchPost) =>
  (["category", "productType"] as const).some((field) => {
    const idKey = `${field}Id` as const;
    const buyId = normalizePostId(buyPost.product?.[idKey]);
    const sellId = normalizePostId(sellPost.product?.[idKey]);
    if (buyId && sellId) return buyId !== sellId;

    // List responses expose catalog names; detail responses also expose IDs.
    const nameKey = `${field}Name` as const;
    const buyName = buyPost.product?.[nameKey] ?? buyPost[nameKey];
    const sellName = sellPost.product?.[nameKey] ?? sellPost[nameKey];
    return typeof buyName === "string" && typeof sellName === "string" &&
      buyName.trim().length > 0 && sellName.trim().length > 0 && buyName !== sellName;
  });

const isUsableOwnSell = (post: SellerMatchPost, userId: unknown) => {
  const type = String(post.postType ?? "").toLowerCase();
  const status = String(post.status ?? "").toLowerCase();
  const remaining = Number(post.remainingQuantity);
  const expiry = post.expiryDate == null ? null : Date.parse(post.expiryDate);
  return Boolean(post.postId && userId) &&
    normalizePostId(post.ownerId) === normalizePostId(userId) &&
    (type === "sell" || type === "1") &&
    (status === "active" || status === "1") &&
    post.isExpired !== true &&
    (expiry === null || (Number.isFinite(expiry) && expiry > Date.now())) &&
    Number.isFinite(remaining) && remaining > 0;
};

async function loadSellerPages<T>(loadPage: (page: number) => Promise<any>): Promise<T[]> {
  const result: T[] = [];
  for (let pageNumber = 1; pageNumber <= 1000; pageNumber += 1) {
    const response = await loadPage(pageNumber);
    if (response?.isSuccess === false) throw response;
    const page = response?.data ?? response;
    if (!Array.isArray(page?.items) || typeof page.hasNextPage !== "boolean") {
      throw new Error("Không thể tải đầy đủ danh sách. Vui lòng thử lại.");
    }
    result.push(...page.items);
    if (!page.hasNextPage) return result;
  }
  throw new Error("Danh sách quá lớn. Vui lòng thử lại sau.");
}

function useLocalFeedback() {
  const [feedback, setFeedback] = useState<LocalFeedback>(null);

  const clearFeedback = useCallback(() => setFeedback(null), []);
  const showError = useCallback(
    (message: string) => setFeedback({ type: "error", message }),
    [],
  );
  const showSuccess = useCallback(
    (message: string) => setFeedback({ type: "success", message }),
    [],
  );
  const showInfo = useCallback(
    (message: string) => setFeedback({ type: "info", message }),
    [],
  );

  return {
    feedback,
    clearFeedback,
    showError,
    showSuccess,
    showInfo,
  };
}

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
        : feedback.type === "warning"
          ? {
              backgroundColor: "rgba(154, 100, 24, 0.10)",
              borderColor: "rgba(154, 100, 24, 0.24)",
              color: "#9A6418",
              icon: "warning-outline" as const,
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
        {feedback.message}
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

const postApi = {
  getPostsByUser: (userId: string, pageNumber: number) =>
    apiClient.get(`/posts/get-all/by-user/${encodeURIComponent(userId)}`, {
      params: { PageNumber: pageNumber, PageSize: 100 },
    }).then((response) => response.data),
  getPostById: (postId: string) =>
    apiClient.get(`/posts/get-by-id/${postId}`).then((response) => response.data),

  closePost: (postId: string) =>
    apiClient.patch(`/posts/${postId}/close`).then((response) => response.data),

  reactivatePost: (postId: string) =>
    apiClient
      .patch(`/posts/${postId}/reactivate`)
      .then((response) => response.data),

  getBuyPostMatches: (
    buyPostId: string,
    params: {
      PageNumber: number;
      PageSize: number;
    },
  ) =>
    apiClient
      .get(`/posts/buy/${buyPostId}/matches`, { params })
      .then((response) => response.data),

  createSellerRequest: (
    buyPostId: string,
    data: {
      sellPostId: string;
      offerPrice: number;
      offerQuantity: number;
    },
  ) =>
    apiClient
      .post(`/posts/buy/${buyPostId}/seller-requests`, data)
      .then((response) => response.data),
};

/**
 * Chi tiết/hủy Offer nằm trong app/offers/[id].tsx.
 * PUT /offers/{offerId} vẫn cố ý tắt trên Mobile.
 */
const offerApi = {
  createOffer: (data: {
    postId: string;
    offerPrice: number;
    offerQuantity: number;
  }) => apiClient.post("/offers", data).then((response) => response.data),

  getSentOffers: (params?: {
    PageNumber?: number;
    PageSize?: number;
    PostId?: string;
    BuyPostId?: string;
    Status?: string | number;
  }) =>
    apiClient
      .get("/offers/sent", { params })
      .then((response) => response.data),
};

const isPendingSellerOffer = (item: any, buyPostId: string, senderId: unknown, receiverId: unknown) =>
  Boolean(item?.offerId && item?.postId && senderId && receiverId) &&
  normalizePostId(item.buyPostId) === normalizePostId(buyPostId) &&
  normalizePostId(item.senderId ?? item.sender?.userId) === normalizePostId(senderId) &&
  normalizePostId(item.receiverId ?? item.receiver?.userId) === normalizePostId(receiverId) &&
  ["pending", "0"].includes(String(item.offerStatus).toLowerCase());

async function loadPendingSellerOffers(
  buyPostId: string, senderId: unknown, receiverId: unknown, isCurrent: () => boolean,
): Promise<Record<string, string>> {
  const items = await loadSellerPages<any>((page) => isCurrent()
    ? offerApi.getSentOffers({ PageNumber: page, PageSize: 100, BuyPostId: buyPostId, Status: "Pending" })
    : Promise.reject(new Error("Đã dừng tải chào bán.")));
  const pending: Record<string, string> = {};
  for (const item of items) {
    if (isPendingSellerOffer(item, buyPostId, senderId, receiverId)) {
      pending[normalizePostId(item.postId)] = String(item.offerId);
    }
  }
  return pending;
}

const cartApi = {
  addToCart: (postId: string, quantity: number) =>
    apiClient.post(`/cart/${postId}`, { quantity }).then((response) => response.data),
};

const { width } = Dimensions.get("window");

export default function PostDetailScreen() {
  const { id, viewOnly, sellerRequestSellPostId, resumeSellerRequest } = useLocalSearchParams();
  const isViewOnly = viewOnly === "true";
  const router = useRouter();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  const { user } = useAuth();
  const currentUserId = user?.userId || user?.id;

  const [post, setPost] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [existingOfferId, setExistingOfferId] = useState<string | null>(null);

  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerQuantity, setOfferQuantity] = useState("1");
  const [offerPrice, setOfferPrice] = useState("");
  const [focusedPlaceholderField, setFocusedPlaceholderField] =
    useState<"quantity" | "offerPrice" | null>(null);
  const [isSubmittingOffer, setIsSubmittingOffer] = useState(false);

  const [showSellerRequestModal, setShowSellerRequestModal] = useState(false);
  const [sellerMatches, setSellerMatches] = useState<BuyPostMatch[]>([]);
  const [selectedSellPostId, setSelectedSellPostId] = useState<string | null>(
    null,
  );
  const [sellerRequestQuantity, setSellerRequestQuantity] = useState("1");
  const [sellerRequestPrice, setSellerRequestPrice] = useState("");
  const [sellerFocusedField, setSellerFocusedField] = useState<
    "quantity" | "price" | null
  >(null);
  const [isLoadingSellerMatches, setIsLoadingSellerMatches] = useState(false);
  const [isSubmittingSellerRequest, setIsSubmittingSellerRequest] =
    useState(false);
  const sellerSubmitLock = useRef(false);
  const sellerLoadVersion = useRef(0);
  const sellerLoadLock = useRef(false);
  const sellerNavigationLock = useRef(false);
  const handledContinuation = useRef("");
  const preferredSellerId = useRef<string | undefined>(undefined);
  const sellerContextVersion = useRef(0);
  const postLoadVersion = useRef(0);
  const [sellerLoadError, setSellerLoadError] = useState(false);
  const [pendingSellerOffers, setPendingSellerOffers] = useState<Record<string, string>>({});
  const pendingSellerVersion = useRef(0);
  const pendingSellerOfferId = pendingSellerOffers[normalizePostId(selectedSellPostId)] || null;
  const hasPendingSellerOffers = Object.keys(pendingSellerOffers).length > 0;
  usePreventRemove(isSubmittingSellerRequest, () => {});

  const [showCartModal, setShowCartModal] = useState(false);
  const [cartQuantity, setCartQuantity] = useState("1");
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [cartAdded, setCartAdded] = useState(false);

  const {
    feedback: pageFeedback,
    clearFeedback: clearPageFeedback,
    showError: showPageError,
    showSuccess: showPageSuccess,
  } = useLocalFeedback();

  const {
    feedback: offerFeedback,
    clearFeedback: clearOfferFeedback,
    showError: showOfferError,
  } = useLocalFeedback();

  const {
    feedback: sellerRequestFeedback,
    clearFeedback: clearSellerRequestFeedback,
    showError: showSellerRequestError,
  } = useLocalFeedback();

  const {
    feedback: cartFeedback,
    clearFeedback: clearCartFeedback,
    showError: showCartError,
    showSuccess: showCartSuccess,
  } = useLocalFeedback();

  const { confirm, confirmationModal } = useLocalConfirm();

  const rememberPendingSellerOffer = useCallback((sellPostId: string, offerId: string) => {
    pendingSellerVersion.current += 1;
    setPendingSellerOffers((current) => ({ ...current, [normalizePostId(sellPostId)]: offerId }));
  }, []);

  const openSellerOffer = useCallback((offerId: string) => {
    if (!offerId || sellerSubmitLock.current || sellerNavigationLock.current) return;
    sellerNavigationLock.current = true;
    setShowSellerRequestModal(false);
    router.push({ pathname: "/offers/[id]", params: { id: offerId } });
  }, [router]);

  const fetchPostData = useCallback(async () => {
    if (!id) return;
    const version = ++postLoadVersion.current;

    try {
      setIsLoading(true);
      const resPost = await postApi.getPostById(id as string);
      if (postLoadVersion.current !== version) return;
      const postData = resPost?.data || resPost;
      setPost(postData);

      const isForeignBusinessBuy =
        user?.role === "business" &&
        postData?.postType === "Buy" &&
        String(postData?.ownerId || "") !== String(currentUserId || "");

      if (
        user &&
        postData?.ownerId !== currentUserId &&
        postData?.postType !== "Buy" &&
        !isForeignBusinessBuy
      ) {
        const isBuyTarget =
          postData?.postType === "Buy";

        const targetId = String(
          Array.isArray(id) ? id[0] : id,
        );

        const resOffers =
          await offerApi.getSentOffers({
            PageSize: 50,
            PageNumber: 1,
            ...(isBuyTarget
              ? { BuyPostId: targetId }
              : { PostId: targetId }),
          });
        if (postLoadVersion.current !== version) return;

        const items =
          resOffers?.data?.items ||
          resOffers?.items ||
          [];

        const pendingOffer = items.find(
          (offer: any) => {
            const matchesTarget =
              isBuyTarget
                ? String(
                    offer?.buyPostId ?? "",
                  ) === targetId
                : String(
                    offer?.postId ?? "",
                  ) === targetId;

            return (
              matchesTarget &&
              (
                offer.offerStatus === 0 ||
                offer.offerStatus === "Pending" ||
                offer.offerStatus === "pending"
              )
            );
          },
        );
        setExistingOfferId(pendingOffer?.offerId || null);
      } else {
        setExistingOfferId(null);
      }
      if (postData?.postType === "Buy" && currentUserId &&
        String(user?.role).toLowerCase() === "personal" &&
        normalizePostId(postData.ownerId) !== normalizePostId(currentUserId)) {
        const pendingVersion = ++pendingSellerVersion.current;
        try {
          const pending = await loadPendingSellerOffers(String(postData.postId), currentUserId,
            postData.ownerId, () => postLoadVersion.current === version);
          if (postLoadVersion.current === version && pendingSellerVersion.current === pendingVersion) {
            setPendingSellerOffers(pending);
          }
        } catch (error) {
          if (postLoadVersion.current === version && pendingSellerVersion.current === pendingVersion) {
            showPageError(getApiErrorMessage(error, "Chưa cập nhật được các chào bán đã gửi. Vui lòng thử lại."));
          }
        }
      }
    } catch (error) {
      if (postLoadVersion.current !== version) return;
      showPageError(
        getApiErrorMessage(error, "Không thể tải thông tin bài đăng."),
      );
    } finally {
      if (postLoadVersion.current === version) setIsLoading(false);
    }
  }, [id, user, currentUserId, showPageError]);

  useFocusEffect(
    useCallback(() => {
      void fetchPostData();
      return () => { postLoadVersion.current += 1; };
    }, [fetchPostData]),
  );

  const isMyPost = Boolean(
    currentUserId &&
      post?.ownerId &&
      String(currentUserId) === String(post.ownerId),
  );

  const isBusinessViewingForeignBuy =
    user?.role === "business" && post?.postType === "Buy" && !isMyPost;

  const handleOpenReceivedOffers = () => {
    const targetPostId =
      post?.postId ||
      (Array.isArray(id) ? id[0] : id);

    if (!targetPostId) {
      showPageError(
        "Không tìm thấy bài đăng để xem đề nghị.",
      );
      return;
    }

    router.push({
      pathname: "/offers/by-post" as any,
      params: {
        postId: String(targetPostId),
        postTitle: String(
          post?.product?.productName ||
            post?.productName ||
            "",
        ),
        postType: String(
          post?.postType || "",
        ),
      },
    });
  };

  const handleClosePost = async () => {
    const targetPostId = post?.postId;
    if (!targetPostId) {
      showPageError("Không tìm thấy ID bài đăng.");
      return;
    }

    const confirmed = await confirm({
      title: "Đóng bài đăng",
      message:
        "Tin sẽ kết thúc giao dịch và không còn hiển thị trên trang chủ. Bạn có muốn tiếp tục?",
      confirmLabel: "Đóng bài",
      cancelLabel: "Quay lại",
      destructive: true,
    });
    if (!confirmed) return;

    try {
      setIsLoading(true);
      clearPageFeedback();
      const response = await postApi.closePost(targetPostId);
      showPageSuccess(getApiSuccessMessage(response, "Đã đóng bài đăng."));
      await fetchPostData();
    } catch (error) {
      showPageError(
        getApiErrorMessage(error, "Không thể đóng bài đăng lúc này."),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleReactivatePost = async () => {
    const targetPostId = post?.postId;
    if (!targetPostId) {
      showPageError("Không tìm thấy ID bài đăng.");
      return;
    }

    const confirmed = await confirm({
      title: "Mở lại bài đăng",
      message: "Bài đăng sẽ tiếp tục hiển thị và nhận tương tác.",
      confirmLabel: "Mở lại",
      cancelLabel: "Quay lại",
    });
    if (!confirmed) return;

    try {
      setIsLoading(true);
      clearPageFeedback();
      const response = await postApi.reactivatePost(targetPostId);
      showPageSuccess(getApiSuccessMessage(response, "Đã mở lại bài đăng."));
      await fetchPostData();
    } catch (error) {
      showPageError(
        getApiErrorMessage(error, "Không thể mở lại bài đăng lúc này."),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenOffer = () => {
    if (!user) {
      router.push(`/(auth)/login?returnUrl=/posts/${id}`);
      return;
    }

    // Buy Post sử dụng seller-request riêng. Không gửi generic Offer vào Buy Post.
    if (post?.postType === "Buy") {
      showPageError("Tin thu mua sử dụng luồng chào bán sản phẩm.");
      return;
    }

    if (existingOfferId) {
      clearPageFeedback();
      router.push({
        pathname: "/offers/[id]",
        params: { id: existingOfferId },
      });
      return;
    }

    clearOfferFeedback();
    setOfferQuantity("1");
    setOfferPrice("");
    setShowOfferModal(true);
  };

  const getSellerRequestMaxQuantity = (sellPost?: SellerMatchPost) => {
    const buyRemaining = Number(
      post?.remainingQuantity ?? post?.quantity ?? 0,
    );
    const sellRemaining = Number(
      sellPost?.remainingQuantity ?? sellPost?.quantity ?? 0,
    );

    if (
      !Number.isFinite(buyRemaining) ||
      !Number.isFinite(sellRemaining) ||
      buyRemaining <= 0 ||
      sellRemaining <= 0
    ) {
      return 0;
    }

    return Math.max(
      0,
      Math.min(
        Math.floor(buyRemaining),
        Math.floor(sellRemaining),
      ),
    );
  };

  const loadOwnSellPosts = useCallback(async (preferredId: string | undefined, version: number): Promise<BuyPostMatch[]> => {
    const ownPosts = await loadSellerPages<SellerMatchPost>((page) =>
      sellerLoadVersion.current === version
        ? postApi.getPostsByUser(String(currentUserId), page)
        : Promise.reject(new Error("Đã dừng tải danh sách.")),
    );
    if (sellerLoadVersion.current !== version) return [];
    // A just-created post can fall outside a changing paginated snapshot.
    if (preferredId && !ownPosts.some((item) =>
      normalizePostId(item.postId) === normalizePostId(preferredId))) {
      try {
        const response = await postApi.getPostById(preferredId);
        ownPosts.push(response?.data ?? response);
      } catch {
        // An unavailable previous selection must not hide the rest of the inventory.
      }
    }
    const unique = new Map<string, BuyPostMatch>();
    for (const sellPost of ownPosts) {
      if (sellPost && isUsableOwnSell(sellPost, currentUserId)) {
        unique.set(normalizePostId(sellPost.postId), { sellPost });
      }
    }
    return [...unique.values()];
  }, [currentUserId]);

  const loadSellerComparisons = useCallback(async (buyPostId: string, version: number) => {
    // One batch supplements the inventory; missing comparisons never remove a post.
    try {
      const response = await postApi.getBuyPostMatches(buyPostId, { PageNumber: 1, PageSize: 100 });
      if (response?.isSuccess === false) return;
      const page = response?.data ?? response;
      if (!Array.isArray(page?.items) || sellerLoadVersion.current !== version) return;
      const summaries = new Map<string, MatchSummary>();
      for (const item of page.items as BuyPostMatch[]) {
        if (item.sellPost?.postId && item.matchSummary) {
          summaries.set(normalizePostId(item.sellPost.postId), item.matchSummary);
        }
      }
      setSellerMatches((current) => sellerLoadVersion.current !== version ? current : current.map((item) => ({
        ...item,
        matchSummary: summaries.get(normalizePostId(item.sellPost?.postId)),
      })));
    } catch {
      // Inventory and terms remain usable without comparison data.
    }
  }, []);

  const findPendingSellerOffer = async (buyPostId: string, sellPostId: string) => {
    const contextVersion = sellerContextVersion.current;
    const items = await loadSellerPages<any>((page) =>
      sellerContextVersion.current === contextVersion
        ? offerApi.getSentOffers({
          PageNumber: page, PageSize: 100, BuyPostId: buyPostId,
          PostId: sellPostId, Status: "Pending",
        })
        : Promise.reject(new Error("Đã dừng kiểm tra chào bán.")),
    );
    return items.find((item) =>
      isPendingSellerOffer(item, buyPostId, currentUserId, post?.ownerId) &&
      normalizePostId(item.postId) === normalizePostId(sellPostId) &&
      item.offerId,
    );
  };

  const handleSelectSellerMatch = useCallback((
    sellPost: SellerMatchPost,
  ) => {
    if (!sellPost.postId || sellerSubmitLock.current) return;
    preferredSellerId.current = String(sellPost.postId);
    if (normalizePostId(sellPost.postId) === normalizePostId(selectedSellPostId)) return;

    setSelectedSellPostId(
      String(sellPost.postId),
    );
    setSellerRequestQuantity("1");

    const listedPrice = Number(
      sellPost.basePrice ?? 0,
    );

    setSellerRequestPrice(
      Number.isFinite(listedPrice) &&
        listedPrice > 0
        ? String(Math.trunc(listedPrice))
        : "",
    );

    clearSellerRequestFeedback();
  }, [selectedSellPostId, clearSellerRequestFeedback]);

  const handleOpenSellerRequest = useCallback(async (preferredId?: string) => {
    if (sellerSubmitLock.current || sellerLoadLock.current || sellerNavigationLock.current) return;
    const targetBuyPostId = String(
      post?.postId ||
        (Array.isArray(id) ? id[0] : id) ||
        "",
    );

    if (!user) {
      router.push({
        pathname: "/(auth)/login",
        params: {
          returnUrl:
            `/posts/${targetBuyPostId}`,
        },
      });
      return;
    }

    if (
      String(user?.role || "")
        .trim()
        .toLowerCase() !== "personal"
    ) {
      showPageError(
        "Chỉ tài khoản cá nhân mới có thể chào bán sản phẩm cho tin thu mua.",
      );
      return;
    }

    if (post?.postType !== "Buy" || isViewOnly || !currentUserId ||
      normalizePostId(post.ownerId) === normalizePostId(currentUserId)) {
      showPageError(
        "Chức năng chào bán chỉ áp dụng cho tin thu mua.",
      );
      return;
    }

    if (!targetBuyPostId) {
      showPageError(
        "Không tìm thấy tin thu mua.",
      );
      return;
    }

    clearPageFeedback();
    clearSellerRequestFeedback();
    setSellerLoadError(false);
    setShowSellerRequestModal(true);
    setIsLoadingSellerMatches(true);
    sellerLoadLock.current = true;
    const version = ++sellerLoadVersion.current;
    const pendingVersion = ++pendingSellerVersion.current;
    const requestedId = preferredId || preferredSellerId.current || selectedSellPostId || undefined;
    preferredSellerId.current = requestedId;

    try {
      const [ownMatches, pending] = await Promise.all([
        loadOwnSellPosts(requestedId, version),
        loadPendingSellerOffers(targetBuyPostId, currentUserId, post.ownerId,
          () => sellerLoadVersion.current === version),
      ]);
      if (sellerLoadVersion.current !== version) return;

      setSellerMatches(ownMatches);
      if (pendingSellerVersion.current === pendingVersion) setPendingSellerOffers(pending);
      const preferred = ownMatches.find((item) =>
        normalizePostId(item.sellPost?.postId) === normalizePostId(requestedId));
      const selection = preferred?.sellPost || (!requestedId && ownMatches.length === 1
        ? ownMatches[0].sellPost : undefined);
      if (selection) {
        handleSelectSellerMatch(selection);
      } else if (requestedId) {
        showSellerRequestError("Tin bán đã chọn hiện không thể chào bán. Vui lòng kiểm tra hoặc chọn tin khác.");
      }
      void loadSellerComparisons(targetBuyPostId, version);
    } catch (error) {
      if (sellerLoadVersion.current !== version) return;
      setSellerLoadError(true);
      showSellerRequestError(
        getApiErrorMessage(
          error,
          "Không thể tải các tin bán của bạn. Vui lòng thử lại.",
        ),
      );
    } finally {
      if (sellerLoadVersion.current === version) {
        setIsLoadingSellerMatches(false);
        sellerLoadLock.current = false;
      }
    }
  }, [post, id, user, currentUserId, isViewOnly, router, selectedSellPostId,
    clearPageFeedback, clearSellerRequestFeedback, showPageError, showSellerRequestError,
    loadOwnSellPosts, loadSellerComparisons, handleSelectSellerMatch]);

  useEffect(() => {
    sellerLoadVersion.current += 1;
    sellerContextVersion.current += 1;
    sellerLoadLock.current = false;
    sellerSubmitLock.current = false;
    setIsSubmittingSellerRequest(false);
    setShowSellerRequestModal(false);
    setSellerMatches([]);
    setSelectedSellPostId(null);
    setSellerRequestPrice("");
    setSellerRequestQuantity("1");
    pendingSellerVersion.current += 1;
    setPendingSellerOffers({});
    setSellerLoadError(false);
    setIsLoadingSellerMatches(false);
    handledContinuation.current = "";
    preferredSellerId.current = undefined;
    return () => {
      sellerLoadVersion.current += 1;
      sellerContextVersion.current += 1;
    };
  }, [id, currentUserId]);

  useFocusEffect(useCallback(() => {
    sellerNavigationLock.current = false;
    sellerLoadLock.current = false;
    setIsLoadingSellerMatches(false);
    setShowSellerRequestModal(false);
    return () => { sellerLoadVersion.current += 1; };
  }, []));

  useEffect(() => {
    const preferredId = Array.isArray(sellerRequestSellPostId)
      ? sellerRequestSellPostId[0] : sellerRequestSellPostId;
    const resume = resumeSellerRequest === "true";
    if (!preferredId && !resume) {
      handledContinuation.current = "";
      return;
    }
    if (!isFocused || isLoading || !post || !currentUserId || isViewOnly) return;
    if (sellerLoadLock.current || sellerSubmitLock.current) return;
    if (normalizePostId(post.postId) !== normalizePostId(Array.isArray(id) ? id[0] : id)) return;
    const key = `${post.postId}:${preferredId || "resume"}:${currentUserId}`;
    if (handledContinuation.current === key) return;
    handledContinuation.current = key;
    preferredSellerId.current = preferredId || undefined;
    router.setParams({ sellerRequestSellPostId: "", resumeSellerRequest: "false" });
    void handleOpenSellerRequest(preferredId);
  }, [id, post, isLoading, currentUserId, sellerRequestSellPostId, resumeSellerRequest,
    isViewOnly, isFocused, isLoadingSellerMatches, isSubmittingSellerRequest, router, handleOpenSellerRequest]);

  const handleCreateSellForBuy = () => {
    if (sellerSubmitLock.current || sellerLoadLock.current || sellerNavigationLock.current) return;
    sellerNavigationLock.current = true;
    setShowSellerRequestModal(false);
    router.push({
      pathname: "/posts/post-form",
      params: { postType: "Sell", buyPostId: String(post.postId) },
    });
  };

  const handleCreateSellerRequest =
    async () => {
      if (sellerSubmitLock.current || sellerLoadLock.current || sellerNavigationLock.current || sellerLoadError) return;
      if (pendingSellerOfferId) {
        openSellerOffer(pendingSellerOfferId);
        return;
      }
      const selectedMatch =
        sellerMatches.find(
          (match) =>
            String(
              match.sellPost?.postId || "",
            ) ===
            String(
              selectedSellPostId || "",
            ),
        );

      const selectedSellPost =
        selectedMatch?.sellPost;

      if (!selectedSellPost?.postId || !isUsableOwnSell(selectedSellPost, currentUserId)) {
        showSellerRequestError(
          "Vui lòng chọn một tin bán của bạn.",
        );
        return;
      }

      const quantity = Number(
        sellerRequestQuantity,
      );
      const price = Number(
        sellerRequestPrice,
      );

      const maxQuantity =
        getSellerRequestMaxQuantity(
          selectedSellPost,
        );

      if (
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        showSellerRequestError(
          "Số lượng phải là số nguyên lớn hơn 0.",
        );
        return;
      }

      if (
        maxQuantity <= 0 ||
        quantity > maxQuantity
      ) {
        showSellerRequestError(
          `Số lượng tối đa có thể chào bán là ${maxQuantity}.`,
        );
        return;
      }

      if (
        !Number.isFinite(price) ||
        price <= 0
      ) {
        showSellerRequestError(
          "Giá chào bán phải lớn hơn 0.",
        );
        return;
      }

      const targetBuyPostId = String(
        post?.postId ||
          (Array.isArray(id)
            ? id[0]
            : id) ||
          "",
      );

      if (!targetBuyPostId) {
        showSellerRequestError(
          "Không tìm thấy tin thu mua.",
        );
        return;
      }

      const contextVersion = sellerContextVersion.current;
      try {
        sellerSubmitLock.current = true;
        setIsSubmittingSellerRequest(true);
        clearSellerRequestFeedback();

        const pending = await findPendingSellerOffer(targetBuyPostId, String(selectedSellPost.postId));
        if (sellerContextVersion.current !== contextVersion) return;
        if (pending) {
          rememberPendingSellerOffer(String(selectedSellPost.postId), String(pending.offerId));
          showSellerRequestError("Tin bán này đã có chào bán đang chờ phản hồi cho tin thu mua này.");
          return;
        }

        const response =
          await postApi.createSellerRequest(
            targetBuyPostId,
            {
              sellPostId:
                String(
                  selectedSellPost.postId,
                ),
              offerPrice: price,
              offerQuantity: quantity,
            },
          );
        if (sellerContextVersion.current !== contextVersion) return;

        if (
          response?.isSuccess !== true || !response?.data?.offerId
        ) {
          throw response;
        }

        rememberPendingSellerOffer(String(selectedSellPost.postId), String(response.data.offerId));
        setShowSellerRequestModal(false);

        showPageSuccess(
          getApiSuccessMessage(
            response,
            "Đã gửi chào bán sản phẩm.",
          ),
        );

        // Pending does not change post capacity; retain the authoritative write result immediately.
      } catch (error) {
        if (sellerContextVersion.current !== contextVersion) return;
        const response = (error as { response?: { data?: any } })?.response?.data;
        const code = response?.code ?? response?.error?.code;
        if (code === "OFFER_DUPLICATE_PENDING") {
          try {
            const pending = await findPendingSellerOffer(targetBuyPostId, String(selectedSellPost.postId));
            if (sellerContextVersion.current !== contextVersion) return;
            if (pending) rememberPendingSellerOffer(String(selectedSellPost.postId), String(pending.offerId));
          } catch {
            // Keep the failed request and terms available for a later server check.
          }
        }
        if (sellerContextVersion.current !== contextVersion) return;
        showSellerRequestError(
          getApiErrorMessage(
            error,
            "Không thể gửi chào bán sản phẩm.",
          ),
        );
      } finally {
        if (sellerContextVersion.current === contextVersion) {
          sellerSubmitLock.current = false;
          setIsSubmittingSellerRequest(false);
        }
      }
    };

  const validateOfferForm = () => {
    const quantity = parseInt(offerQuantity, 10);
    const price = parseInt(offerPrice, 10);

    if (Number.isNaN(quantity) || quantity <= 0) {
      showOfferError("Số lượng phải là số nguyên lớn hơn 0.");
      return null;
    }

    if (quantity > Number(post?.remainingQuantity || 0)) {
      showOfferError(`Số lượng tối đa là ${post?.remainingQuantity || 0}.`);
      return null;
    }

    if (Number.isNaN(price) || price <= 0) {
      showOfferError("Giá thương lượng phải lớn hơn 0.");
      return null;
    }

    return { quantity, price };
  };

  const handleCreateOffer = async () => {
    if (post?.postType === "Buy") {
      showOfferError(
        "Tin thu mua sử dụng luồng chào bán sản phẩm.",
      );
      return;
    }

    const valid = validateOfferForm();
    if (!valid) return;

    const targetPostId =
      post?.postId || (Array.isArray(id) ? id[0] : id);
    if (!targetPostId) {
      showOfferError("Không tìm thấy bài đăng cần thương lượng.");
      return;
    }

    try {
      setIsSubmittingOffer(true);
      clearOfferFeedback();
      const response = await offerApi.createOffer({
        postId: targetPostId,
        offerPrice: valid.price,
        offerQuantity: valid.quantity,
      });
      setShowOfferModal(false);
      showPageSuccess(
        getApiSuccessMessage(response, "Đã gửi đề nghị thương lượng."),
      );
      await fetchPostData();
    } catch (error) {
      showOfferError(getApiErrorMessage(error, "Không thể gửi đề nghị."));
    } finally {
      setIsSubmittingOffer(false);
    }
  };

  const handleOpenCartModal = () => {
    const targetPostId =
      post?.postId || (Array.isArray(id) ? id[0] : id);

    if (!user) {
      router.push({
        pathname: "/(auth)/login",
        params: { returnUrl: `/posts/${targetPostId || ""}` },
      });
      return;
    }

    if (!targetPostId) {
      showPageError("Không tìm thấy bài đăng cần thêm vào giỏ hàng.");
      return;
    }

    // CartService BE chỉ nhận PostType.Sell. Buy Post không bao giờ được add cart.
    if (post?.postType !== "Sell") {
      showPageError("Tin thu mua không thể thêm vào giỏ hàng.");
      return;
    }

    if (
      currentUserId &&
      post?.ownerId &&
      String(currentUserId) === String(post.ownerId)
    ) {
      showPageError("Bạn không thể thêm bài đăng của chính mình vào giỏ hàng.");
      return;
    }

    if (post?.status !== "Active") {
      showPageError("Bài đăng này hiện không còn hoạt động.");
      return;
    }

    if (Number(post?.remainingQuantity || 0) <= 0) {
      showPageError("Sản phẩm này hiện đã hết số lượng.");
      return;
    }

    clearCartFeedback();
    setCartAdded(false);
    setCartQuantity("1");
    setShowCartModal(true);
  };

  const handleOpenOwnerReviews = () => {
    const ownerId = post?.ownerId;
    if (!ownerId) return;

    router.push(`/reviews/user/${String(ownerId)}` as any);
  };

  const handleAddToCart = async () => {
    const targetPostId =
      post?.postId || (Array.isArray(id) ? id[0] : id);
    const quantity = Number(cartQuantity);

    if (!targetPostId) {
      showCartError("Không tìm thấy bài đăng cần thêm.");
      return;
    }

    if (post?.postType !== "Sell") {
      showCartError("Tin thu mua không thể thêm vào giỏ hàng.");
      return;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      showCartError("Số lượng phải là số nguyên lớn hơn 0.");
      return;
    }

    if (quantity > Number(post?.remainingQuantity || 0)) {
      showCartError(`Số lượng tối đa là ${post?.remainingQuantity || 0}.`);
      return;
    }

    try {
      setIsAddingToCart(true);
      clearCartFeedback();
      const response = await cartApi.addToCart(targetPostId, quantity);

      if (response?.isSuccess === false) {
        throw new Error(
          response?.error?.message || "Không thể thêm sản phẩm vào giỏ hàng.",
        );
      }

      setCartAdded(true);
      showCartSuccess(
        getApiSuccessMessage(
          response,
          `Đã thêm ${quantity} sản phẩm vào giỏ hàng.`,
        ),
      );
    } catch (error) {
      showCartError(
        getApiErrorMessage(error, "Không thể thêm sản phẩm vào giỏ hàng."),
      );
    } finally {
      setIsAddingToCart(false);
    }
  };

  const formatPrice = (price: unknown) => {
    const value = Number(price);

    return Number.isFinite(value)
      ? `${value.toLocaleString("vi-VN")} đ`
      : "Chưa cập nhật";
  };

  const formatBuyPriceRange = (
    from: unknown,
    to: unknown,
  ) => {
    const fromNumber =
      from === null ||
      from === undefined ||
      from === ""
        ? null
        : Number(from);

    const toNumber =
      to === null ||
      to === undefined ||
      to === ""
        ? null
        : Number(to);

    const hasFrom =
      fromNumber !== null &&
      Number.isFinite(fromNumber);

    const hasTo =
      toNumber !== null &&
      Number.isFinite(toNumber);

    if (hasFrom && hasTo) {
      return `${Number(fromNumber).toLocaleString("vi-VN")} - ${Number(toNumber).toLocaleString("vi-VN")} đ`;
    }

    if (hasFrom) {
      return `Từ ${Number(fromNumber).toLocaleString("vi-VN")} đ`;
    }

    if (hasTo) {
      return `Tối đa ${Number(toNumber).toLocaleString("vi-VN")} đ`;
    }

    return "Giá thỏa thuận";
  };

  const translatePriorityLevel = (
    value: unknown,
  ) => {
    switch (
      String(value ?? "")
        .trim()
        .toLowerCase()
    ) {
      case "0":
      case "low":
        return "Thấp";

      case "1":
      case "medium":
        return "Bình thường";

      case "2":
      case "high":
        return "Cao";

      case "3":
      case "urgent":
        return "Khẩn cấp";

      default:
        return "Chưa cập nhật";
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "Chưa có";
    return new Date(dateString).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const translateFuncStatus = (status: string) => {
    if (status === "FullyFunctional") return "Hoạt động hoàn hảo";
    if (status === "PartiallyFunctional") return "Hoạt động một phần";
    if (status === "NonFunctional") return "Không hoạt động";
    return "Không rõ";
  };

  const translateDamage = (level: string) => {
    if (level === "None") return "Như mới";
    if (level === "Cosmetic_Damage") return "Trầy xước ngoại hình";
    if (level === "Minor_Damage") return "Hư hỏng nhẹ";
    if (level === "Moderate_Damage") return "Hư hỏng vừa";
    if (level === "Severe_Damage") return "Hư hỏng nặng";
    if (level === "Total_Loss") return "Mất chức năng";
    return "Không rõ";
  };

  const translateSpace = (space: string) => {
    const spaces: Record<string, string> = {
      Living_room: "Phòng khách",
      Kitchen: "Nhà bếp",
      Bedroom: "Phòng ngủ",
      Bathroom: "Phòng tắm",
      Laundry_room: "Phòng giặt",
      Balcony: "Ban công",
      Garage: "Nhà để xe",
      Restroom: "Nhà vệ sinh",
    };
    return spaces[space] || "Không rõ";
  };

  const translatePostDeliveryMethod = (value: unknown) => {
    const normalized = String(value ?? "")
      .trim()
      .replace(/[\s_-]/g, "")
      .toLowerCase();

    switch (normalized) {
      case "1":
      case "ghndelivery":
        return "Giao hàng GHN";

      case "2":
      case "sellerdelivers":
        return "Người bán tự giao";

      case "3":
      case "buyerpickup":
        return "Người mua tự lấy";

      case "":
      case "0":
      case "unknown":
        return "Chưa cập nhật";

      default:
        return "Chưa cập nhật";
    }
  };

  const getEavValue = (attribute: any) =>
    attribute.optionValue ||
    attribute.valueText ||
    attribute.valueNumber ||
    (attribute.valueBoolean !== null && attribute.valueBoolean !== undefined
      ? attribute.valueBoolean
        ? "Có"
        : "Không"
      : "Chưa cập nhật");

  if (isLoading && !post) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Đang tải chi tiết...</Text>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        {pageFeedback ? (
          <InlineFeedback
            feedback={pageFeedback}
            onDismiss={clearPageFeedback}
            style={styles.emptyFeedback}
          />
        ) : (
          <Text style={styles.notFoundText}>Không tìm thấy bài đăng!</Text>
        )}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Quay lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (isBusinessViewingForeignBuy) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Ionicons name="business-outline" size={52} color={COLORS.textLight} />
        <Text style={styles.restrictedTitle}>Tin không khả dụng</Text>
        <Text style={styles.restrictedText}>
          Tài khoản doanh nghiệp không thể xem hoặc tương tác với tin thu mua
          của doanh nghiệp khác.
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Quay lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const product = post.product || {};
  const address = [post.streetAddress, post.ward, post.city]
    .filter(Boolean)
    .join(", ");

  const ownerName =
    String(post.ownerName || post.ownerUsername || "").trim() ||
    "Người dùng HomeCycle";
  const ownerAvatarSource = getAvatarSource(post.avatarUrl);
  const normalizedVerifyStatus = String(post.verifyStatus ?? "").toLowerCase();
  const isOwnerVerified =
    post.verifyStatus === 2 || normalizedVerifyStatus === "verified";
  const averageRating = Number(post.averageRating ?? 0);
  const totalReviews = Math.max(0, Number(post.totalReviews ?? 0));
  const hasRating =
    Number.isFinite(averageRating) && averageRating > 0 && totalReviews > 0;
  const ownerRatingLabel = hasRating
    ? `${averageRating.toFixed(1)} (${totalReviews} đánh giá)`
    : "Chưa có đánh giá";

  const selectedSellerMatch =
    sellerMatches.find(
      (match) =>
        String(
          match.sellPost?.postId || "",
        ) ===
        String(
          selectedSellPostId || "",
        ),
    );

  const selectedSellerPost =
    selectedSellerMatch?.sellPost;

  const sellerRequestMaxQuantity =
    getSellerRequestMaxQuantity(
      selectedSellerPost,
    );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết tin đăng</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
        {post.postType !== "Buy" ? (
          <>
        <View style={styles.imageContainer}>
          {post.medias && post.medias.length > 0 ? (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
              {post.medias.map((image: any) => (
                <Image
                  key={image.mediaId}
                  source={{ uri: image.url || image.mediaUrl }}
                  style={styles.mainImage}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.mainImage, styles.imagePlaceholder]}>
              <Ionicons name="image-outline" size={48} color="#547B7D" />
              <Text style={styles.imagePlaceholderText}>Không có hình ảnh</Text>
            </View>
          )}

          {post.medias && post.medias.length > 1 ? (
            <View style={styles.imageBadge}>
              <Text style={styles.imageBadgeText}>1 / {post.medias.length}</Text>
            </View>
          ) : null}
        </View>

          </>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.productName}>
            {product.productName ||
              post.productName ||
              "Sản phẩm chưa cập nhật tên"}
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>
              {post.postType === "Buy"
                ? formatBuyPriceRange(
                    post.priceFrom,
                    post.priceTo ??
                      post.basePrice,
                  )
                : formatPrice(
                    post.basePrice,
                  )}
            </Text>
            {product.originalPrice ? (
              <Text style={styles.originalPrice}>
                {formatPrice(product.originalPrice)}
              </Text>
            ) : null}
          </View>
          <View style={styles.tagRow}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>
                {post.postType === "Sell" ? "Tin Bán" : "Tin Mua"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Người đăng</Text>
          <View style={styles.ownerCard}>
            <Image
              source={ownerAvatarSource}
              style={styles.ownerAvatar}
              resizeMode="cover"
            />
            <View style={styles.ownerInfo}>
              <View style={styles.ownerNameRow}>
                <Text style={styles.ownerName} numberOfLines={1}>
                  {ownerName}
                </Text>
                {isOwnerVerified ? (
                  <View style={styles.verifiedBadge}>
                    <Ionicons
                      name="checkmark-circle"
                      size={14}
                      color="#2F765D"
                    />
                    <Text style={styles.verifiedBadgeText}>Đã xác minh</Text>
                  </View>
                ) : null}
              </View>

              <TouchableOpacity
                style={styles.ownerRatingRow}
                onPress={handleOpenOwnerReviews}
                disabled={!post.ownerId}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={hasRating ? "star" : "star-outline"}
                  size={15}
                  color="#F5A623"
                />
                <Text style={styles.ownerRatingText}>{ownerRatingLabel}</Text>
                {post.ownerId ? (
                  <Ionicons
                    name="chevron-forward"
                    size={15}
                    color={COLORS.textLight}
                  />
                ) : null}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {isMyPost ? (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.receivedOffersCard}
              onPress={handleOpenReceivedOffers}
              activeOpacity={0.82}
            >
              <View style={styles.receivedOffersIcon}>
                <Ionicons
                  name="people-outline"
                  size={25}
                  color={COLORS.primary}
                />
              </View>

              <View style={styles.receivedOffersContent}>
                <Text style={styles.receivedOffersTitle}>
                  Đề nghị đã nhận
                </Text>

                <Text style={styles.receivedOffersSubtitle}>
                  Xem tất cả đề nghị cho bài đăng này
                </Text>
              </View>

              <View style={styles.receivedOffersAction}>
                <Text style={styles.receivedOffersActionText}>
                  Xem tất cả
                </Text>

                <Ionicons
                  name="chevron-forward"
                  size={17}
                  color={COLORS.primary}
                />
              </View>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mô tả chung</Text>
          <Text style={styles.description}>{post.description || "Chưa có mô tả."}</Text>
          {product.detailDescription ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Mô tả tình trạng chi tiết</Text>
              <Text style={styles.detailDescription}>
                {product.detailDescription}
              </Text>
            </>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông số kỹ thuật</Text>
          <View style={styles.specGrid}>
            {product.categoryName ? (
              <SpecItem
                icon="grid-outline"
                label="Danh mục"
                value={product.categoryName}
              />
            ) : null}
            {product.productTypeName ? (
              <SpecItem
                icon="layers-outline"
                label="Loại sản phẩm"
                value={product.productTypeName}
              />
            ) : null}
            {product.brandName ? (
              <SpecItem
                icon="shield-checkmark-outline"
                label="Thương hiệu"
                value={product.brandName}
              />
            ) : null}
            {product.modelNumber ? (
              <SpecItem
                icon="barcode-outline"
                label="Mã Model"
                value={product.modelNumber}
                fullWidth
              />
            ) : null}
            {product.functionalityStatus ? (
              <SpecItem
                icon="build-outline"
                label="Tình trạng"
                value={translateFuncStatus(product.functionalityStatus)}
              />
            ) : null}
            {product.damageLevel ? (
              <SpecItem
                icon="bandage-outline"
                label="Hư hại"
                value={translateDamage(product.damageLevel)}
              />
            ) : null}
            {product.usageDuration ? (
              <SpecItem
                icon="time-outline"
                label="Thời gian SD"
                value={`${product.usageDuration} năm`}
              />
            ) : null}
            {product.spaceUsage ? (
              <SpecItem
                icon="home-outline"
                label="Không gian"
                value={translateSpace(product.spaceUsage)}
              />
            ) : null}
            {product.length || product.width || product.height ? (
              <SpecItem
                icon="expand-outline"
                label="Kích thước (DxRxC)"
                value={`${product.length || 0} x ${product.width || 0} x ${
                  product.height || 0
                } cm`}
              />
            ) : null}
            {product.weight ? (
              <SpecItem
                icon="barbell-outline"
                label="Khối lượng"
                value={`${product.weight} kg`}
              />
            ) : null}
            {product.attributeValues?.map((attribute: any, index: number) => {
              const unitText =
                attribute.unit && attribute.unit !== "string"
                  ? ` ${attribute.unit}`
                  : "";
              return (
                <SpecItem
                  key={attribute.attributeId || index}
                  icon="pricetag-outline"
                  label={attribute.attributeName}
                  value={`${getEavValue(attribute)}${unitText}`}
                  fullWidth
                />
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông tin giao dịch</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Số lượng:</Text>
            <Text style={styles.infoValue}>
              {post.remainingQuantity} / {post.quantity}
            </Text>
          </View>
          {post.postType !== "Buy" ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                Vận chuyển:
              </Text>
              <Text style={styles.infoValue}>
                {translatePostDeliveryMethod(
                  post.deliveryMethod,
                )}
              </Text>
            </View>
          ) : (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                Mức ưu tiên:
              </Text>
              <Text style={styles.infoValue}>
                {translatePriorityLevel(
                  post.priorityLevel,
                )}
              </Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Địa chỉ:</Text>
            <Text style={styles.infoValue}>{address || "Chưa cập nhật"}</Text>
          </View>
        </View>

        <View style={[styles.section, styles.lastSection]}>
          <Text style={styles.dateText}>Ngày đăng: {formatDate(post.createdAt)}</Text>
          <Text style={styles.dateText}>
            Cập nhật lần cuối: {formatDate(post.updatedAt)}
          </Text>
          <Text style={styles.dateText}>
            Ngày hết hạn: {formatDate(post.expiryDate)}
          </Text>
        </View>
      </ScrollView>

      {pageFeedback ? (
        <Text
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={[
            styles.actionMessage,
            pageFeedback.type === "error"
              ? styles.actionMessageError
              : pageFeedback.type === "success"
                ? styles.actionMessageSuccess
                : pageFeedback.type === "warning"
                  ? styles.actionMessageWarning
                  : styles.actionMessageInfo,
          ]}
        >
          {pageFeedback.message}
        </Text>
      ) : null}

      {!isViewOnly && post.status !== "Deleted" && !showSellerRequestModal ? (
        <View style={styles.bottomBar}>
          {isMyPost ? (
            <>
              {post.status === "Active" ? (
                <TouchableOpacity style={styles.dangerBtn} onPress={handleClosePost}>
                  <Ionicons
                    name="close-circle-outline"
                    size={20}
                    color={COLORS.error}
                  />
                  <Text style={styles.dangerBtnText}>Đóng tin</Text>
                </TouchableOpacity>
              ) : post.status === "Closed" ? (
                <TouchableOpacity
                  style={styles.reactivateBtn}
                  onPress={handleReactivatePost}
                >
                  <Ionicons
                    name="refresh-circle-outline"
                    size={20}
                    color={COLORS.primary}
                  />
                  <Text style={styles.reactivateBtnText}>Mở lại tin</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() =>
                  router.push({
                    pathname: "/posts/post-form",
                    params: { editId: post.postId, postType: post.postType },
                  })
                }
              >
                <Ionicons name="pencil" size={20} color={COLORS.white} />
                <Text style={styles.primaryBtnText}>Sửa tin đăng</Text>
              </TouchableOpacity>
            </>
          ) : post.status === "Active" ? (
            <View style={styles.customerActions}>
              {post.postType === "Sell" ? (
                <TouchableOpacity
                  style={[
                    styles.cartBtn,
                    isAddingToCart ? styles.disabledButton : undefined,
                  ]}
                  onPress={handleOpenCartModal}
                  disabled={isAddingToCart}
                >
                  {isAddingToCart ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <Ionicons name="cart-outline" size={20} color={COLORS.primary} />
                  )}
                  <Text style={styles.cartBtnText}>
                    {isAddingToCart ? "Đang thêm..." : "Thêm giỏ hàng"}
                  </Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.negotiateBtn,
                  existingOfferId ? styles.sentOfferBtn : undefined,
                ]}
                onPress={
                  post.postType === "Buy"
                    ? () => void handleOpenSellerRequest()
                    : handleOpenOffer
                }
              >
                <Ionicons
                  name={
                    existingOfferId || (post.postType === "Buy" && hasPendingSellerOffers)
                      ? "document-text-outline"
                      : post.postType === "Buy"
                        ? "pricetag-outline"
                        : "chatbubbles"
                  }
                  size={20}
                  color={COLORS.white}
                />
                <Text style={styles.negotiateBtnText}>
                  {existingOfferId
                    ? "Xem đề nghị đã gửi"
                    : post.postType === "Buy"
                      ? hasPendingSellerOffers ? "Xem chào bán đã gửi" : "Chào bán sản phẩm"
                      : "Thương lượng"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.closedPostContainer}>
              <Text style={styles.closedPostText}>Tin đăng này hiện đã đóng</Text>
            </View>
          )}
        </View>
      ) : null}

      <Modal
        visible={showCartModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isAddingToCart) setShowCartModal(false);
        }}
      >
        <ModalBackdrop
          style={styles.modalOverlay}
          disabled={isAddingToCart}
          onPress={() => setShowCartModal(false)}
        >
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <ModalSurface style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Thêm vào giỏ hàng</Text>
              <TouchableOpacity
                onPress={() => setShowCartModal(false)}
                disabled={isAddingToCart}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {cartFeedback ? (
                <InlineFeedback
                  feedback={cartFeedback}
                  onDismiss={clearCartFeedback}
                />
              ) : null}

              <View>
                <Text style={styles.cartModalProductName} numberOfLines={2}>
                  {product.productName || post.productName || "Sản phẩm"}
                </Text>
                <Text style={styles.cartModalPrice}>
                  {formatPrice(post.basePrice)} / sản phẩm
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Số lượng (Tối đa: {post.remainingQuantity}){" "}
                  <Text style={{ color: COLORS.error }}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    Platform.OS === "web"
                      ? ({ outlineStyle: "none" } as any)
                      : undefined,
                  ]}
                  keyboardType="number-pad"
                  value={cartQuantity}
                  onChangeText={(value) => {
                    setCartQuantity(value.replace(/[^0-9]/g, ""));
                    setCartAdded(false);
                    clearCartFeedback();
                  }}
                  placeholder={
                    focusedPlaceholderField === "quantity"
                      ? ""
                      : "Nhập số lượng..."
                  }
                  placeholderTextColor="#A5B2B3"
                  onFocus={() => setFocusedPlaceholderField("quantity")}
                  onBlur={() => setFocusedPlaceholderField(null)}
                  editable={!isAddingToCart}
                  selectTextOnFocus
                />
              </View>

              <View style={styles.cartModalTotalRow}>
                <Text style={styles.cartModalTotalLabel}>Tạm tính</Text>
                <Text style={styles.cartModalTotalValue}>
                  {formatPrice(
                    Number(post.basePrice || 0) * Number(cartQuantity || 0),
                  )}
                </Text>
              </View>

              {cartAdded ? (
                <View style={styles.cartSuccessActions}>
                  <TouchableOpacity
                    style={styles.cartBtn}
                    onPress={() => setShowCartModal(false)}
                  >
                    <Text style={styles.cartBtnText}>Tiếp tục xem</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={() => {
                      setShowCartModal(false);
                      router.push("/(tabs)/cart");
                    }}
                  >
                    <Text style={styles.primaryBtnText}>Xem giỏ hàng</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    styles.modalSubmitBtn,
                    isAddingToCart ? styles.disabledButton : undefined,
                  ]}
                  onPress={() => void handleAddToCart()}
                  disabled={isAddingToCart}
                >
                  {isAddingToCart ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons name="cart-outline" size={20} color={COLORS.white} />
                      <Text style={styles.primaryBtnText}>Thêm vào giỏ hàng</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
            </ModalSurface>
          </KeyboardAvoidingView>
        </ModalBackdrop>
      </Modal>

      <Modal
        visible={showSellerRequestModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!sellerSubmitLock.current) {
            setShowSellerRequestModal(false);
          }
        }}
      >
        <ModalBackdrop
          style={styles.modalOverlay}
          disabled={isSubmittingSellerRequest}
          onPress={() => {
            if (!sellerSubmitLock.current) setShowSellerRequestModal(false);
          }}
        >
          <KeyboardAvoidingView
            style={[styles.sellerKeyboardContainer, { paddingTop: insets.top }]}
            pointerEvents="box-none"
            behavior={
              Platform.OS === "ios"
                ? "padding"
                : Platform.OS === "android" ? "height" : undefined
            }
          >
            <ModalSurface
              style={[
                styles.modalContent,
                styles.sellerRequestModalContent,
              ]}
            >
              <View style={[styles.modalHeader, styles.sellerModalHeader]}>
                <Text style={styles.modalTitle}>
                  Chào bán sản phẩm
                </Text>

                <TouchableOpacity
                  onPress={() => {
                    if (!sellerSubmitLock.current) setShowSellerRequestModal(false);
                  }}
                  disabled={
                    isSubmittingSellerRequest
                  }
                >
                  <Ionicons
                    name="close"
                    size={24}
                    color={COLORS.text}
                  />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.sellerModalScroll}
                contentContainerStyle={styles.sellerModalBody}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                {sellerRequestFeedback ? (
                  <InlineFeedback
                    feedback={
                      sellerRequestFeedback
                    }
                    onDismiss={
                      clearSellerRequestFeedback
                    }
                  />
                ) : null}

                <TouchableOpacity
                  style={[styles.primaryBtn, styles.modalSubmitBtn, styles.sellerModalButton]}
                  disabled={isSubmittingSellerRequest || isLoadingSellerMatches}
                  onPress={handleCreateSellForBuy}
                >
                  <Ionicons name="add-circle-outline" size={20} color={COLORS.white} />
                  <Text style={styles.primaryBtnText}>Tạo sản phẩm mới</Text>
                </TouchableOpacity>

                <View
                  style={
                    styles.inputGroup
                  }
                >
                  <Text
                    style={
                      styles.inputLabel
                    }
                  >
                    Mức giá doanh nghiệp mong muốn
                  </Text>

                  <View
                    style={
                      styles.readOnlyInput
                    }
                  >
                    <Text
                      style={
                        styles.readOnlyText
                      }
                    >
                      {formatBuyPriceRange(
                        post.priceFrom,
                        post.priceTo ??
                          post.basePrice,
                      )}
                    </Text>
                  </View>
                </View>

                {isLoadingSellerMatches ? (
                  <View
                    style={
                      styles.sellerLoadingState
                    }
                  >
                    <ActivityIndicator
                      color={COLORS.primary}
                    />
                    <Text
                      style={
                        styles.sellerEmptyText
                      }
                    >
                      Đang tải các tin bán của bạn...
                    </Text>
                  </View>
                ) : sellerLoadError ? (
                  <TouchableOpacity onPress={() => void handleOpenSellerRequest()}>
                    <Text style={styles.sellerEmptyText}>Thử tải lại danh sách tin bán</Text>
                  </TouchableOpacity>
                ) : sellerMatches.length ===
                  0 ? (
                  <View
                    style={
                      styles.sellerEmptyState
                    }
                  >
                    <Ionicons
                      name="cube-outline"
                      size={38}
                      color={
                        COLORS.textLight
                      }
                    />

                    <Text
                      style={
                        styles.sellerEmptyTitle
                      }
                    >
                      Chưa có tin bán có thể chào hàng
                    </Text>

                    <Text
                      style={
                        styles.sellerEmptyText
                      }
                    >
                      Bạn cần có tin bán đang hoạt động, chưa hết hạn và còn sản phẩm để gửi chào bán.
                    </Text>

                  </View>
                ) : (
                  <>
                    <View
                      style={
                        styles.inputGroup
                      }
                    >
                      <Text
                        style={
                          styles.inputLabel
                        }
                      >
                        Chọn tin bán của bạn{" "}
                        <Text
                          style={{
                            color:
                              COLORS.error,
                          }}
                        >
                          *
                        </Text>
                      </Text>

                      <ScrollView
                        style={
                          styles.sellerMatchList
                        }
                        nestedScrollEnabled
                        showsVerticalScrollIndicator
                      >
                        {sellerMatches.map(
                          (match) => {
                            const sellPost =
                              match.sellPost;

                            if (
                              !sellPost?.postId
                            ) {
                              return null;
                            }

                            const selected =
                              String(
                                sellPost.postId,
                              ) ===
                              String(
                                selectedSellPostId ||
                                  "",
                              );
                            const sentOfferId = pendingSellerOffers[normalizePostId(sellPost.postId)];

                            return (
                              <TouchableOpacity
                                key={
                                  sellPost.postId
                                }
                                style={[
                                  styles.sellerMatchCard,
                                  selected
                                    ? styles.sellerMatchCardSelected
                                    : undefined,
                                ]}
                                activeOpacity={
                                  0.8
                                }
                                disabled={isSubmittingSellerRequest}
                                onPress={() => sentOfferId
                                  ? openSellerOffer(sentOfferId) : handleSelectSellerMatch(sellPost)}
                              >
                                <View
                                  style={
                                    styles.sellerMatchContent
                                  }
                                >
                                  <Text
                                    style={
                                      styles.sellerMatchTitle
                                    }
                                    numberOfLines={
                                      2
                                    }
                                  >
                                    {sellPost.productName ||
                                      "Tin bán"}
                                  </Text>
                                  {sentOfferId ? (
                                    <Text style={styles.sellerPendingText}>Đã chào bán · Xem chào bán</Text>
                                  ) : null}

                                  <Text
                                    style={
                                      styles.sellerMatchMeta
                                    }
                                  >
                                    Giá tin bán:{" "}
                                    {formatPrice(
                                      sellPost.basePrice,
                                    )}
                                  </Text>

                                  <Text
                                    style={
                                      styles.sellerMatchMeta
                                    }
                                  >
                                    Còn{" "}
                                    {Number(
                                      sellPost.remainingQuantity ??
                                        0,
                                    )}{" "}
                                    sản phẩm
                                  </Text>
                                  <Text style={styles.sellerMatchMeta}>
                                    {match.matchSummary
                                      ? `Phù hợp ${match.matchSummary.matchedCriteriaCount}/${match.matchSummary.evaluatedCriteriaCount} tiêu chí`
                                      : hasVerifiedTypeMismatch(post, sellPost)
                                        ? "Khác loại sản phẩm yêu cầu"
                                        : "Chưa có dữ liệu so sánh"}
                                  </Text>
                                </View>

                                <Ionicons
                                  name={
                                    sentOfferId ? "document-text-outline" : selected
                                      ? "checkmark-circle"
                                      : "ellipse-outline"
                                  }
                                  size={22}
                                  color={
                                    selected
                                      ? COLORS.primary
                                      : COLORS.border
                                  }
                                />
                              </TouchableOpacity>
                            );
                          },
                        )}
                      </ScrollView>
                    </View>

                    {selectedSellerPost && !pendingSellerOfferId ? (
                      <>
                        <View
                          style={
                            styles.inputGroup
                          }
                        >
                          <Text
                            style={
                              styles.inputLabel
                            }
                          >
                            Số lượng (Tối đa:{" "}
                            {
                              sellerRequestMaxQuantity
                            }
                            ){" "}
                            <Text
                              style={{
                                color:
                                  COLORS.error,
                              }}
                            >
                              *
                            </Text>
                          </Text>

                          <TextInput
                            style={[
                              styles.input,
                              Platform.OS ===
                              "web"
                                ? ({
                                    outlineStyle:
                                      "none",
                                  } as any)
                                : undefined,
                            ]}
                            keyboardType="number-pad"
                            value={
                              sellerRequestQuantity
                            }
                            onChangeText={(
                              value,
                            ) => {
                              setSellerRequestQuantity(
                                value.replace(
                                  /[^0-9]/g,
                                  "",
                                ),
                              );
                              clearSellerRequestFeedback();
                            }}
                            placeholder={
                              sellerFocusedField ===
                              "quantity"
                                ? ""
                                : "Nhập số lượng..."
                            }
                            placeholderTextColor="#A5B2B3"
                            onFocus={() =>
                              setSellerFocusedField(
                                "quantity",
                              )
                            }
                            onBlur={() =>
                              setSellerFocusedField(
                                null,
                              )
                            }
                            editable={
                              !isSubmittingSellerRequest
                            }
                          />
                        </View>

                        <View
                          style={
                            styles.inputGroup
                          }
                        >
                          <Text
                            style={
                              styles.inputLabel
                            }
                          >
                            Giá chào bán (VNĐ){" "}
                            <Text
                              style={{
                                color:
                                  COLORS.error,
                              }}
                            >
                              *
                            </Text>
                          </Text>

                          <TextInput
                            style={[
                              styles.input,
                              Platform.OS ===
                              "web"
                                ? ({
                                    outlineStyle:
                                      "none",
                                  } as any)
                                : undefined,
                            ]}
                            keyboardType="number-pad"
                            value={
                              sellerRequestPrice
                            }
                            onChangeText={(
                              value,
                            ) => {
                              setSellerRequestPrice(
                                value.replace(
                                  /[^0-9]/g,
                                  "",
                                ),
                              );
                              clearSellerRequestFeedback();
                            }}
                            placeholder={
                              sellerFocusedField ===
                              "price"
                                ? ""
                                : "Nhập giá bạn muốn chào..."
                            }
                            placeholderTextColor="#A5B2B3"
                            onFocus={() =>
                              setSellerFocusedField(
                                "price",
                              )
                            }
                            onBlur={() =>
                              setSellerFocusedField(
                                null,
                              )
                            }
                            editable={
                              !isSubmittingSellerRequest
                            }
                          />
                        </View>

                      </>
                    ) : null}
                  </>
                )}
              </ScrollView>
              {!isLoadingSellerMatches && !sellerLoadError && (pendingSellerOfferId || selectedSellerPost) ? (
                <View style={[styles.sellerModalFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                  {pendingSellerOfferId ? (
                    <Text style={styles.sellerPendingText}>Đã chào bán · Đang chờ phản hồi</Text>
                  ) : null}
                  <TouchableOpacity
                    style={[styles.primaryBtn, styles.modalSubmitBtn, styles.sellerModalButton,
                      isSubmittingSellerRequest ? styles.disabledButton : undefined]}
                    disabled={isSubmittingSellerRequest}
                    onPress={() => pendingSellerOfferId
                      ? openSellerOffer(pendingSellerOfferId) : void handleCreateSellerRequest()}
                  >
                    {isSubmittingSellerRequest ? <ActivityIndicator color={COLORS.white} /> : (
                      <>
                        <Ionicons name={pendingSellerOfferId ? "document-text-outline" : "paper-plane-outline"}
                          size={20} color={COLORS.white} />
                        <Text style={styles.primaryBtnText}>
                          {pendingSellerOfferId ? "Xem chào bán đã gửi" : "Gửi chào bán"}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ) : null}
            </ModalSurface>
          </KeyboardAvoidingView>
        </ModalBackdrop>
      </Modal>

      <Modal
        visible={showOfferModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isSubmittingOffer) setShowOfferModal(false);
        }}
      >
        <ModalBackdrop
          style={styles.modalOverlay}
          disabled={isSubmittingOffer}
          onPress={() => setShowOfferModal(false)}
        >
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <ModalSurface style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Thương lượng giá</Text>
              <TouchableOpacity
                onPress={() => setShowOfferModal(false)}
                disabled={isSubmittingOffer}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {offerFeedback ? (
                <InlineFeedback
                  feedback={offerFeedback}
                  onDismiss={clearOfferFeedback}
                />
              ) : null}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Số lượng (Tối đa: {post.remainingQuantity}){" "}
                  <Text style={{ color: COLORS.error }}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    Platform.OS === "web"
                      ? ({ outlineStyle: "none" } as any)
                      : undefined,
                  ]}
                  keyboardType="number-pad"
                  value={offerQuantity}
                  onChangeText={(value) => {
                    setOfferQuantity(value.replace(/[^0-9]/g, ""));
                    clearOfferFeedback();
                  }}
                  placeholder={
                    focusedPlaceholderField === "quantity"
                      ? ""
                      : "Nhập số lượng..."
                  }
                  placeholderTextColor="#A5B2B3"
                  onFocus={() => setFocusedPlaceholderField("quantity")}
                  onBlur={() => setFocusedPlaceholderField(null)}
                  editable={!isSubmittingOffer}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {post.postType === "Buy"
                    ? "Giá dự kiến của người mua"
                    : "Giá mong muốn của người bán"}
                </Text>
                <View style={styles.readOnlyInput}>
                  <Text style={styles.readOnlyText}>{formatPrice(post.basePrice)}</Text>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Giá thương lượng (VNĐ){" "}
                  <Text style={{ color: COLORS.error }}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    Platform.OS === "web"
                      ? ({ outlineStyle: "none" } as any)
                      : undefined,
                  ]}
                  keyboardType="number-pad"
                  value={offerPrice}
                  onChangeText={(value) => {
                    setOfferPrice(value.replace(/[^0-9]/g, ""));
                    clearOfferFeedback();
                  }}
                  placeholder={
                    focusedPlaceholderField === "offerPrice"
                      ? ""
                      : "Ví dụ: 1500000"
                  }
                  placeholderTextColor="#A5B2B3"
                  onFocus={() => setFocusedPlaceholderField("offerPrice")}
                  onBlur={() => setFocusedPlaceholderField(null)}
                  editable={!isSubmittingOffer}
                />
              </View>

              <View style={styles.offerActions}>
                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    styles.modalSubmitBtn,
                    isSubmittingOffer ? styles.disabledButton : undefined,
                  ]}
                  onPress={() => void handleCreateOffer()}
                  disabled={isSubmittingOffer}
                >
                  {isSubmittingOffer ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons
                        name="paper-plane-outline"
                        size={20}
                        color={COLORS.white}
                      />
                      <Text style={styles.primaryBtnText}>Gửi đề nghị</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
            </ModalSurface>
          </KeyboardAvoidingView>
        </ModalBackdrop>
      </Modal>

      {confirmationModal}
    </SafeAreaView>
  );
}

function SpecItem({
  icon,
  label,
  value,
  fullWidth = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <View style={[styles.specItem, fullWidth ? styles.fullWidthSpec : undefined]}>
      <Ionicons name={icon} size={18} color={COLORS.textLight} />
      <View style={styles.specContent}>
        <Text style={styles.specLabel}>{label}</Text>
        <Text style={styles.specValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  scrollView: { backgroundColor: "#F8F9FA" },
  localFeedback: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  localFeedbackText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  feedbackDismissButton: { padding: 1 },
  confirmOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  confirmCard: {
    width: "100%",
    maxWidth: 420,
    padding: 18,
    borderRadius: 14,
    backgroundColor: COLORS.white,
  },
  confirmTitle: { color: COLORS.text, fontSize: 17, fontWeight: "800" },
  confirmMessage: {
    marginTop: 8,
    color: COLORS.textLight,
    fontSize: 13,
    lineHeight: 19,
  },
  confirmActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  confirmCancelButton: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  confirmCancelText: { color: COLORS.text, fontWeight: "700" },
  confirmPrimaryButton: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: COLORS.primary,
  },
  confirmDestructiveButton: { backgroundColor: COLORS.error },
  confirmPrimaryText: { color: COLORS.white, fontWeight: "800" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
  },
  loadingText: { marginTop: 12, color: COLORS.textLight },
  notFoundText: { color: COLORS.error, fontSize: 16, textAlign: "center" },
  restrictedTitle: {
    marginTop: 14,
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "800",
  },
  restrictedText: {
    marginTop: 8,
    maxWidth: 360,
    color: COLORS.textLight,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  emptyFeedback: { width: "100%", maxWidth: 420 },
  backBtn: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  backBtnText: { color: COLORS.white, fontWeight: "600" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: COLORS.text },
  headerIcon: { padding: 8 },
  headerSpacer: { width: 40, height: 40 },
  imageContainer: { position: "relative", backgroundColor: COLORS.white },
  mainImage: { width, height: 300 },
  imagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
  },
  imagePlaceholderText: { color: "#547B7D", marginTop: 8 },
  imageBadge: {
    position: "absolute",
    bottom: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  imageBadgeText: { color: COLORS.white, fontSize: 12, fontWeight: "bold" },
  section: {
    backgroundColor: COLORS.white,
    padding: 16,
    marginBottom: 8,
  },
  lastSection: { marginBottom: 30 },
  productName: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.text,
    lineHeight: 26,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  price: { fontSize: 22, fontWeight: "bold", color: COLORS.error },
  originalPrice: {
    fontSize: 14,
    color: COLORS.textLight,
    textDecorationLine: "line-through",
  },
  tagRow: { flexDirection: "row", gap: 8 },
  tag: {
    backgroundColor: "#F8F9FA",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: { fontSize: 12, color: "#547B7D", fontWeight: "600" },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 12,
  },
  ownerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ownerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#EEF2F2",
  },
  ownerInfo: { flex: 1, minWidth: 0 },
  ownerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },
  ownerName: {
    maxWidth: "70%",
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(47, 118, 93, 0.10)",
  },
  verifiedBadgeText: {
    color: "#2F765D",
    fontSize: 10,
    fontWeight: "700",
  },
  ownerRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    marginTop: 7,
  },
  ownerRatingText: {
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: "600",
  },
  receivedOffersCard: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(47, 118, 93, 0.30)",
    borderRadius: 12,
    backgroundColor: "rgba(47, 118, 93, 0.05)",
  },
  receivedOffersIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(43, 86, 89, 0.09)",
  },
  receivedOffersContent: {
    flex: 1,
    minWidth: 0,
  },
  receivedOffersTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },
  receivedOffersSubtitle: {
    marginTop: 4,
    color: COLORS.textLight,
    fontSize: 12,
    lineHeight: 17,
  },
  receivedOffersAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    backgroundColor: COLORS.white,
  },
  receivedOffersActionText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  specGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -8 },
  specItem: {
    width: "50%",
    flexDirection: "row",
    padding: 8,
    alignItems: "flex-start",
    gap: 8,
  },
  fullWidthSpec: { width: "100%" },
  specContent: { flex: 1 },
  specLabel: { fontSize: 12, color: COLORS.textLight, marginBottom: 2 },
  specValue: { fontSize: 14, color: COLORS.text, fontWeight: "500" },
  infoRow: { flexDirection: "row", marginBottom: 8 },
  infoLabel: { width: 100, fontSize: 14, color: COLORS.textLight },
  infoValue: { flex: 1, fontSize: 14, color: COLORS.text, fontWeight: "500" },
  description: { fontSize: 14, color: COLORS.text, lineHeight: 22 },
  detailDescription: {
    fontSize: 14,
    color: "#547B7D",
    lineHeight: 22,
    fontStyle: "italic",
  },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  dateText: { fontSize: 11, color: COLORS.textLight, marginBottom: 4 },
  bottomBar: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 12,
  },
  actionMessage: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: COLORS.white,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    textAlign: "right",
  },
  actionMessageError: { color: COLORS.error },
  actionMessageSuccess: { color: "#2F765D" },
  actionMessageWarning: { color: "#9A6418" },
  actionMessageInfo: { color: COLORS.primary },
  customerActions: { flex: 1, flexDirection: "row", gap: 12 },
  closedPostContainer: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
  },
  closedPostText: { color: COLORS.textLight, fontWeight: "bold" },
  dangerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.error,
    backgroundColor: "rgba(122, 16, 18, 0.08)",
  },
  dangerBtnText: { color: COLORS.error, fontWeight: "bold", fontSize: 15 },
  reactivateBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: "rgba(84, 123, 125, 0.10)",
  },
  reactivateBtnText: { color: COLORS.primary, fontWeight: "bold", fontSize: 15 },
  primaryBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  primaryBtnText: { color: COLORS.white, fontWeight: "bold", fontSize: 15 },
  cartBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  cartBtnText: { color: COLORS.primary, fontWeight: "bold", fontSize: 14 },
  disabledButton: { opacity: 0.65 },
  negotiateBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  negotiateBtnText: {
    color: COLORS.white,
    fontWeight: "bold",
    fontSize: 14,
    textAlign: "center",
  },
  sentOfferBtn: { backgroundColor: COLORS.primary },
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
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: COLORS.text },
  modalBody: { gap: 16 },
  modalSubmitBtn: {
    alignSelf: "center",
    flex: 0,
    width: "72%",
    minWidth: 230,
    maxWidth: 320,
    minHeight: 52,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
  },
  cartModalProductName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  cartModalPrice: {
    marginTop: 5,
    color: COLORS.error,
    fontSize: 14,
    fontWeight: "700",
  },
  cartModalTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cartModalTotalLabel: { color: COLORS.textLight, fontSize: 14 },
  cartModalTotalValue: { color: COLORS.error, fontSize: 18, fontWeight: "800" },
  cartSuccessActions: { flexDirection: "row", gap: 12 },
  inputGroup: { gap: 8 },
  inputLabel: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
    fontSize: 15,
    backgroundColor: "#F8F9FA",
    color: COLORS.text,
  },
  readOnlyInput: {
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
    justifyContent: "center",
    backgroundColor: "#F8F9FA",
  },
  readOnlyText: { fontSize: 15, color: COLORS.textLight, fontWeight: "bold" },

  sellerRequestModalContent: {
    maxHeight: "88%",
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    padding: 0,
    paddingBottom: 0,
    overflow: "hidden",
  },
  sellerKeyboardContainer: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
  },
  sellerModalHeader: {
    flexShrink: 0,
    padding: 24,
    marginBottom: 0,
  },
  sellerModalScroll: { flexShrink: 1, minHeight: 0 },
  sellerModalBody: { gap: 16, paddingHorizontal: 24, paddingBottom: 24 },
  sellerModalFooter: {
    flexShrink: 0,
    gap: 10,
    paddingTop: 16,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: "center",
  },
  sellerModalButton: { width: "100%", minWidth: 0 },
  sellerPendingText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  sellerLoadingState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 28,
  },
  sellerEmptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 24,
  },
  sellerEmptyTitle: {
    marginTop: 10,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  sellerEmptyText: {
    marginTop: 6,
    color: COLORS.textLight,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  sellerMatchList: {
    maxHeight: 230,
    marginTop: 8,
  },
  sellerMatchCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.white,
  },
  sellerMatchCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "rgba(43, 86, 89, 0.06)",
  },
  sellerMatchContent: {
    flex: 1,
  },
  sellerMatchTitle: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  sellerMatchMeta: {
    marginTop: 3,
    color: COLORS.textLight,
    fontSize: 12,
  },

  offerActions: { marginTop: 16 },
});
