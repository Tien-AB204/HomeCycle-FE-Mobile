import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import MainHeader from "../../src/components/shared/MainHeader";
import PriorityBadge from "../../src/components/shared/PriorityBadge";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import {
  filterDiscoveryPosts,
  useDiscoveryPreferences,
} from "../../src/contexts/DiscoveryPreferencesContext";
import apiClient from "../../src/services/apis/axiosClient";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";
import { getAvatarSource } from "../../src/utils/avatar";
import { devLog } from "../../src/utils/devLog";
import { formatBuyPostPrice, isBuyPostType } from "../../src/utils/postType";
import { useAutoDismissFeedback } from "../../src/utils/useAutoDismissFeedback";
import { useGuardedRouter } from "../../src/utils/tapGuard";

// Mỗi mục trên Trang chủ chỉ xem trước tối đa 8 tin (2 trang x 4 tin); phần
// còn lại xem qua "Xem thêm". Không dùng dải cuộn ngang vô tận.
const MAX_SECTION_PREVIEW = 8;
const POSTS_PER_PAGE = 4;
const CARD_GAP = 12;
const SECTION_HORIZONTAL_PADDING = 20;
const HOME_POST_PAGE_SIZE = 100;
const BUY_ACCENT = COLORS.primary;
// Trang chủ Doanh nghiệp: Backend tự lọc theo khảo sát thu mua (khu vực, loại
// sản phẩm, mức hư hỏng, tình trạng, quy mô); FE không gửi tiêu chí và không lọc lại.
const BUSINESS_DISCOVER_PAGE_SIZE = 12;

const postApi = {
  // Tin nổi bật theo gói đăng ký: BE chọn tin của chủ tin đang có gói còn hạn,
  // tối đa 2 tin mỗi chủ, xếp theo điểm uy tín, tối đa 10 tin mỗi loại.
  getFeaturedPosts: async (postType: "sell" | "buy") => {
    try {
      const res = await apiClient.get(`/posts/featured/${postType}`);
      const data = res.data?.data ?? res.data;
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },
  getAllActivePosts: async (params?: any) => {
    try {
      const res = await apiClient.get("/posts/get-all-active", { params });
      return res.data;
    } catch {
      return { items: [] };
    }
  },
  getProductTypes: async () => {
    try {
      const res = await apiClient.get("/product-types/get-all", {
        params: { PageSize: 100, PageNumber: 1 },
      });
      return res.data;
    } catch {
      return { items: [] };
    }
  },
  // GET /posts/discover/business — chỉ Business đã đăng nhập; không swallow lỗi
  // vì 409 SURVEY_REQUIRED là một trạng thái màn hình, không phải lỗi mạng.
  getBusinessDiscoverPosts: async ({
    pageNumber = 1,
    pageSize = BUSINESS_DISCOVER_PAGE_SIZE,
  }: { pageNumber?: number; pageSize?: number } = {}) => {
    const res = await apiClient.get("/posts/discover/business", {
      params: { pageNumber, pageSize },
    });
    return res.data;
  },
};

type BusinessDiscoverState =
  | { status: "idle" | "loading" | "ready" | "empty" | "survey-required" }
  | { status: "error"; message: string };

const readErrorCode = (error: unknown) =>
  String(
    (error as any)?.response?.data?.code ??
      (error as any)?.response?.data?.error?.code ??
      "",
  ).trim().toUpperCase();

type HomeProductType = {
  productTypeId: string;
  categoryId: string;
  productTypeName: string;
};

// Chuẩn hóa tên để ghép tin bán với loại sản phẩm (không dấu, chữ thường).
const normalizeName = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .toLowerCase();

const MAX_PRODUCT_TYPE_TILES = 12;
const MAX_PRODUCT_TYPE_SECTIONS = 6;
const MIN_POSTS_PER_PRODUCT_TYPE_SECTION = 2;

const cartApi = {
  getCart: () => apiClient.get("/cart").then((response) => response.data),
  addToCart: (postId: string, quantity: number) =>
    apiClient.post(`/cart/${postId}`, { quantity }).then((response) => response.data),
};

const normalizeId = (value: unknown) => String(value ?? "").trim().toLowerCase();

const chunkPosts = (posts: any[], size: number) => {
  const pages: any[][] = [];
  for (let index = 0; index < posts.length; index += size) {
    pages.push(posts.slice(index, index + size));
  }
  return pages;
};

type HomeFeedback = { type: "success" | "error"; text: string } | null;

export default function HomeScreen() {
  const router = useGuardedRouter();
  const { width: screenWidth } = useWindowDimensions();
  const width = Platform.OS === "web" && screenWidth > 480 ? 480 : screenWidth;
  const { user } = useAuth();
  const { showOwnPostsInDiscovery } = useDiscoveryPreferences();
  const currentUserId = user?.userId || user?.id;

  const [productTypes, setProductTypes] = useState<HomeProductType[]>([]);
  const [sellPosts, setSellPosts] = useState<any[]>([]);
  const [buyPosts, setBuyPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasRedirectedSurvey, setHasRedirectedSurvey] = useState(false);
  const [businessDiscover, setBusinessDiscover] = useState<BusinessDiscoverState>({ status: "idle" });
  // Mục "Phù hợp với nhu cầu" (Doanh nghiệp) — tách khỏi lô tin bán chung.
  const [discoverPosts, setDiscoverPosts] = useState<any[]>([]);
  const [featuredPosts, setFeaturedPosts] = useState<any[]>([]);
  const homeRequestVersion = useRef(0);
  const [cartPostIds, setCartPostIds] = useState<Set<string>>(new Set());
  const [addingPostId, setAddingPostId] = useState<string | null>(null);
  // Thẩm quyền đồng thời cho thêm nhanh vào giỏ (state React cập nhật bất đồng bộ
  // nên addingPostId chỉ là trạng thái hiển thị): mỗi lúc chỉ MỘT yêu cầu thêm.
  const quickCartActionInFlightRef = useRef<string | null>(null);
  const [feedback, setFeedback] = useState<HomeFeedback>(null);
  useAutoDismissFeedback(feedback, () => setFeedback(null));
  const cartRequestVersion = useRef(0);

  const isBusiness = user?.role === "business";

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const checkBusinessOnboarding = async () => {
        if (!isBusiness || hasRedirectedSurvey) return;

        try {
          const response = await apiClient.get(
            "/business-profiles/onboarding-status",
          );
          const data = response.data?.data || response.data;

          if (active && data?.status === "SurveyPending") {
            setHasRedirectedSurvey(true);
            router.push("/profile/business-survey" as any);
          }
        } catch {
          // Profile vẫn là nơi chính để tiếp tục onboarding nếu status chưa tải được.
        }
      };

      void checkBusinessOnboarding();

      return () => {
        active = false;
      };
    }, [hasRedirectedSurvey, isBusiness, router]),
  );

  const fetchHomeData = useCallback(
    async (isRefresh = false) => {
      const version = ++homeRequestVersion.current;
      try {
        if (!isRefresh) setIsLoading(true);

        // Hai yêu cầu có giới hạn cho toàn bộ Trang chủ: một lô tin đang hoạt động
        // và một trang loại sản phẩm; các mục theo loại được gom từ lô tin này,
        // không gọi tìm kiếm riêng cho từng loại.
        // Doanh nghiệp: gọi thêm mục "Phù hợp với nhu cầu" song song (Backend lọc
        // theo khảo sát); lô tin bán chung vẫn tải và hiển thị như cũ.
        if (isBusiness) setBusinessDiscover({ status: "loading" });
        const [postsRes, typesRes, discoverResult, featuredSell, featuredBuy] = await Promise.all([
          postApi.getAllActivePosts({
            PageNumber: 1,
            PageSize: HOME_POST_PAGE_SIZE,
          }),
          postApi.getProductTypes(),
          isBusiness
            ? postApi
                .getBusinessDiscoverPosts({ pageNumber: 1, pageSize: BUSINESS_DISCOVER_PAGE_SIZE })
                .then((value) => ({ status: "fulfilled" as const, value }))
                .catch((reason: unknown) => ({ status: "rejected" as const, reason }))
            : Promise.resolve(null),
          postApi.getFeaturedPosts("sell"),
          // Doanh nghiệp không tương tác với tin thu mua của doanh nghiệp khác.
          isBusiness ? Promise.resolve([]) : postApi.getFeaturedPosts("buy"),
        ]);
        if (version !== homeRequestVersion.current) return;

        if (!isBusiness) {
          setDiscoverPosts([]);
          setBusinessDiscover({ status: "idle" });
        } else if (discoverResult?.status === "fulfilled") {
          const paged = discoverResult.value;
          const items = paged?.items || paged?.data?.items || [];
          const seen = new Set<string>();
          const posts = (Array.isArray(items) ? items : []).filter((post: any) => {
            const id = normalizeId(post?.postId);
            if (!id || seen.has(id)) return false;
            seen.add(id);
            return true;
          });
          setDiscoverPosts(posts);
          setBusinessDiscover({ status: posts.length > 0 ? "ready" : "empty" });
        } else if (discoverResult?.status === "rejected") {
          const error = discoverResult.reason;
          setDiscoverPosts([]);
          if (readErrorCode(error) === "SURVEY_REQUIRED") {
            setBusinessDiscover({ status: "survey-required" });
          } else {
            devLog("[home] Không tải được mục phù hợp với nhu cầu:", error);
            setBusinessDiscover({
              status: "error",
              message: getApiErrorMessage(error, "Không thể tải bài đăng phù hợp lúc này."),
            });
          }
        }

        const fetchedTypes = typesRes?.data?.items || typesRes?.items || typesRes?.data || typesRes || [];
        setProductTypes(
          (Array.isArray(fetchedTypes) ? fetchedTypes : [])
            .filter(
              (item: any) =>
                item?.isActive !== false &&
                typeof item?.productTypeId === "string" &&
                typeof item?.categoryId === "string" &&
                String(item?.productTypeName || "").trim(),
            )
            .map((item: any) => ({
              productTypeId: String(item.productTypeId),
              categoryId: String(item.categoryId),
              productTypeName: String(item.productTypeName).trim(),
            })),
        );

        const allPosts =
          postsRes?.items || postsRes?.data?.items || postsRes?.data || [];

        // Nghiệp vụ HomeCycle:
        // - Sell Post chỉ do Personal tạo và Personal/Business đều có thể mua.
        // - Buy Post chỉ do Business tạo và chỉ Personal được tương tác.
        // Vì vậy Business không nhìn thấy Buy Post của Business khác trong discovery.
        const discoveryPosts = filterDiscoveryPosts(
          Array.isArray(allPosts) ? allPosts : [],
          currentUserId,
          showOwnPostsInDiscovery,
        );
        const visiblePosts = isBusiness
          ? discoveryPosts.filter((post: any) => post.postType === "Sell")
          : discoveryPosts;

        // Cá nhân thấy cả tin bán lẫn tin thu mua nổi bật (xen kẽ); doanh nghiệp chỉ thấy tin bán.
        const featuredSellVisible = filterDiscoveryPosts(featuredSell, currentUserId, showOwnPostsInDiscovery);
        const featuredBuyVisible = filterDiscoveryPosts(featuredBuy, currentUserId, showOwnPostsInDiscovery);
        const mergedFeatured: any[] = [];
        for (let index = 0; index < Math.max(featuredSellVisible.length, featuredBuyVisible.length); index += 1) {
          if (featuredSellVisible[index]) mergedFeatured.push(featuredSellVisible[index]);
          if (featuredBuyVisible[index]) mergedFeatured.push(featuredBuyVisible[index]);
        }
        setFeaturedPosts(mergedFeatured);

        setSellPosts(
          visiblePosts.filter((post: any) => post.postType === "Sell"),
        );
        setBuyPosts(
          isBusiness
            ? []
            : visiblePosts.filter((post: any) => post.postType === "Buy"),
        );
      } finally {
        if (version === homeRequestVersion.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [currentUserId, isBusiness, showOwnPostsInDiscovery],
  );

  // Trạng thái giỏ hàng thật để biểu tượng giỏ trên thẻ phản ánh đúng
  // (không thêm trùng, không suy đoán từ lỗi Backend).
  const fetchCartMembership = useCallback(async () => {
    const version = ++cartRequestVersion.current;
    if (!user) {
      setCartPostIds(new Set());
      return;
    }
    try {
      const response = await cartApi.getCart();
      if (version !== cartRequestVersion.current) return;
      const data = response?.data || response || {};
      const items = Array.isArray(data?.items) ? data.items : [];
      setCartPostIds(
        new Set(
          items
            .map((item: any) => normalizeId(item?.postId || item?.post?.postId))
            .filter(Boolean),
        ),
      );
    } catch (error) {
      devLog("[home] Không đọc được giỏ hàng:", error);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void fetchHomeData();
      void fetchCartMembership();
      return () => {
        cartRequestVersion.current += 1;
      };
    }, [fetchCartMembership, fetchHomeData]),
  );

  const showFeedback = (next: HomeFeedback) => setFeedback(next);

  const onRefresh = () => {
    setIsRefreshing(true);
    void fetchHomeData(true);
    void fetchCartMembership();
  };

  const displayedSells = sellPosts;
  const displayedBuys = buyPosts;

  // Ghép tin bán với loại sản phẩm (theo tên đã chuẩn hóa) để có ProductTypeId.
  const productTypeGroups = useMemo(() => {
    const byName = new Map<string, HomeProductType>();
    for (const type of productTypes) {
      byName.set(normalizeName(type.productTypeName), type);
    }
    const groups = new Map<string, { type: HomeProductType; posts: any[] }>();
    for (const post of sellPosts) {
      const type = byName.get(normalizeName(post?.productTypeName));
      if (!type) continue;
      const group = groups.get(type.productTypeId) ?? { type, posts: [] };
      group.posts.push(post);
      groups.set(type.productTypeId, group);
    }
    return [...groups.values()].sort((a, b) => b.posts.length - a.posts.length);
  }, [productTypes, sellPosts]);

  // Ô loại sản phẩm: ưu tiên loại đang có tin; bù thêm loại đang hoạt động
  // khác để lưới không quá thưa. Chạm → tìm kiếm theo ProductTypeId thật.
  const productTypeTiles = useMemo(() => {
    const withPosts = productTypeGroups.map((group) => group.type);
    const seen = new Set(withPosts.map((type) => type.productTypeId));
    const filler = productTypes.filter((type) => !seen.has(type.productTypeId));
    return [...withPosts, ...filler].slice(0, MAX_PRODUCT_TYPE_TILES);
  }, [productTypeGroups, productTypes]);

  // Mục theo loại: chỉ loại có đủ tin, số mục có giới hạn.
  const productTypeSections = useMemo(
    () =>
      productTypeGroups
        .filter((group) => group.posts.length >= MIN_POSTS_PER_PRODUCT_TYPE_SECTION)
        .slice(0, MAX_PRODUCT_TYPE_SECTIONS),
    [productTypeGroups],
  );

  const openProductTypeSearch = (type: HomeProductType) =>
    router.push({
      pathname: "/search",
      params: {
        autoSearch: "true",
        postType: "Bán",
        categoryId: type.categoryId,
        productTypeId: type.productTypeId,
      },
    });

  const formatPrice = (price: number) => {
    if (!price) return "0 đ";
    return `${price.toLocaleString("vi-VN")} đ`;
  };

  const getCoverImage = (post: any) => {
    if (post.medias && post.medias.length > 0) {
      return { uri: post.medias[0].url || post.medias[0].mediaUrl };
    }

    return {
      uri: "https://placehold.co/400x400/E2E8F0/94A3B8.png?text=Kh%C3%B4ng+c%C3%B3+%E1%BA%A3nh",
    };
  };

  const getFullAddress = (post: any) =>
    [post.streetAddress, post.ward, post.city].filter(Boolean).join(", ");

  // Điều kiện hiển thị nút thêm nhanh vào giỏ: chỉ Tin bán, còn hoạt động,
  // còn số lượng và không phải bài của chính mình. Tin mua không bao giờ có.
  const getQuickCartState = (post: any) => {
    if (isBuyPostType(post.postType) || post.postType !== "Sell") return "hidden";
    if (post.status && post.status !== "Active") return "hidden";
    const remaining = Number(post.remainingQuantity ?? post.quantity ?? 0);
    if (!(remaining > 0)) return "hidden";
    if (currentUserId && post.ownerId && normalizeId(currentUserId) === normalizeId(post.ownerId)) {
      return "hidden";
    }
    if (cartPostIds.has(normalizeId(post.postId))) return "inCart";
    return "available";
  };

  const handleQuickAddToCart = (post: any) => {
    const postId = String(post?.postId || "");
    if (!postId) return;
    if (quickCartActionInFlightRef.current) return;

    if (!user) {
      router.push({
        pathname: "/(auth)/login",
        params: { returnUrl: "/(tabs)" },
      });
      return;
    }

    if (cartPostIds.has(normalizeId(postId))) {
      router.push("/(tabs)/cart");
      return;
    }

    // Xác nhận trước khi thêm để tránh bấm nhầm biểu tượng giỏ trên thẻ.
    const productName = post.productName || post.description || "sản phẩm này";
    Alert.alert(
      "Thêm vào giỏ hàng",
      `Thêm 1 "${productName}" (${formatPrice(post.basePrice || post.expectedPrice)}) vào giỏ hàng?`,
      [
        { text: "Hủy", style: "cancel" },
        { text: "Thêm vào giỏ", onPress: () => void addToCartConfirmed(post) },
      ],
    );
  };

  const addToCartConfirmed = async (post: any) => {
    const postId = String(post?.postId || "");
    if (!postId) return;
    if (quickCartActionInFlightRef.current) return;
    quickCartActionInFlightRef.current = postId;

    try {
      setAddingPostId(postId);
      // Không tự thử lại khi hết thời gian chờ/lỗi mạng: kết quả có thể không chắc
      // chắn; fetchCartMembership sẽ đối chiếu lại với Backend khi Trang chủ tải lại.
      const response = await cartApi.addToCart(postId, 1);
      if (response?.isSuccess === false) throw response;
      setCartPostIds((current) => new Set(current).add(normalizeId(postId)));
      Alert.alert(
        "Đã thêm vào giỏ hàng",
        `Đã thêm 1 "${post.productName || post.description || "sản phẩm"}" vào giỏ hàng.`,
        [
          { text: "Tiếp tục xem", style: "cancel" },
          { text: "Xem giỏ hàng", onPress: () => router.push("/(tabs)/cart") },
        ],
      );
    } catch (error) {
      devLog("[home] Thêm nhanh vào giỏ thất bại:", error);
      showFeedback({
        type: "error",
        text: getApiErrorMessage(error, "Không thể thêm sản phẩm vào giỏ hàng."),
      });
    } finally {
      if (quickCartActionInFlightRef.current === postId) {
        quickCartActionInFlightRef.current = null;
      }
      setAddingPostId(null);
    }
  };

  const cardWidth =
    (width - SECTION_HORIZONTAL_PADDING * 2 - CARD_GAP) / 2;

  // Chỉ API bài nổi bật trả kèm người đăng; mục nào thiếu tên thì ẩn dòng này.
  const getOwnerName = (post: any) =>
    String(post.ownerName || post.ownerUsername || "").trim();

  const isOwnerVerified = (post: any) =>
    post.verifyStatus === 2 || String(post.verifyStatus ?? "").toLowerCase() === "verified";

  const renderCard = (post: any) => {
    const quickCartState = getQuickCartState(post);
    const isAdding = addingPostId === String(post.postId);
    const ownerName = getOwnerName(post);

    return (
      <TouchableOpacity
        key={String(post.postId)}
        style={[styles.card, { width: cardWidth }]}
        onPress={() => router.push(`/posts/${post.postId}`)}
        activeOpacity={0.8}
      >
        {!isBuyPostType(post.postType) ? (
          <View style={styles.imageWrapper}>
            <Image source={getCoverImage(post)} style={styles.productImage} />
            <View style={styles.topBadgeRow}>
              {post.categoryName ? (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText} numberOfLines={1}>
                    {post.categoryName}
                  </Text>
                </View>
              ) : null}
              <View style={[styles.postTypeBadge, styles.sellPostBadge]}>
                <Text style={styles.postTypeBadgeText}>Tin bán</Text>
              </View>
              <PriorityBadge post={post} />
            </View>
          </View>
        ) : (
          // Tin thu mua không có ảnh: dải đầu thẻ làm điểm nhìn thay ảnh, gom
          // danh mục + thương hiệu + ưu tiên vào một chỗ thay vì nhiều tầng nhãn.
          <View style={styles.buyHeader}>
            <View style={styles.buyHeaderText}>
              <View style={styles.buyHeaderTopRow}>
                <View style={styles.buyHeaderLabelRow}>
                  <Ionicons name="pricetags" size={12} color={BUY_ACCENT} />
                  <Text style={styles.buyHeaderLabel} numberOfLines={1}>
                    THU MUA
                  </Text>
                </View>
                <PriorityBadge post={post} />
              </View>
              <Text style={styles.buyHeaderMeta} numberOfLines={1}>
                {[post.categoryName, post.brandName].filter(Boolean).join(" · ") || "Đồ cũ"}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.infoWrapper}>
          {!isBuyPostType(post.postType) && post.brandName ? (
            <View style={styles.brandBadgeWhite}>
              <Text style={styles.brandBadgeTextWhite}>{post.brandName}</Text>
            </View>
          ) : null}

          <Text style={styles.productName} numberOfLines={2}>
            {post.productName || post.description || "Sản phẩm"}
          </Text>

          {ownerName ? (
            <View style={styles.ownerRow}>
              <Image source={getAvatarSource(post.avatarUrl)} style={styles.ownerAvatar} />
              <Text style={styles.ownerName} numberOfLines={1}>
                {ownerName}
              </Text>
              {isOwnerVerified(post) ? (
                <Ionicons name="checkmark-circle" size={12} color={COLORS.primary} />
              ) : null}
            </View>
          ) : null}

          {isBuyPostType(post.postType) ? (
            <Text style={styles.buyPriceLabel}>Giá thu mua</Text>
          ) : null}
          <View style={styles.priceRow}>
            <Text
              style={styles.productPrice}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {isBuyPostType(post.postType)
                ? formatBuyPostPrice(post)
                : formatPrice(post.basePrice || post.expectedPrice)}
            </Text>
            {/* Tin thu mua không hiện "Cần thu mua" ở Trang chủ để giá hiển thị đủ. */}
            {!isBuyPostType(post.postType) ? (
              <Text style={styles.quantityText}>
                {`SL: ${post.remainingQuantity ?? post.quantity ?? 1}/${post.quantity ?? 1}`}
              </Text>
            ) : null}
          </View>

          <View style={styles.footerRow}>
            <View style={styles.locationContainer}>
              <Ionicons
                name="location-outline"
                size={13}
                color={COLORS.textLight}
              />
              <Text style={styles.locationText} numberOfLines={1}>
                {getFullAddress(post) || "Chưa cập nhật"}
              </Text>
            </View>
            {quickCartState !== "hidden" ? (
              <TouchableOpacity
                style={[
                  styles.quickCartButton,
                  quickCartState === "inCart" ? styles.quickCartButtonInCart : undefined,
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  quickCartState === "inCart" ? "Xem giỏ hàng" : "Thêm vào giỏ hàng"
                }
                hitSlop={6}
                disabled={isAdding}
                onPress={(event) => {
                  event.stopPropagation();
                  handleQuickAddToCart(post);
                }}
              >
                {isAdding ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Ionicons
                    name={quickCartState === "inCart" ? "cart" : "cart-outline"}
                    size={16}
                    color={COLORS.white}
                  />
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderPagedSection = (
    key: string,
    title: string,
    posts: any[],
    onSeeMore: (() => void) | null,
    previewLimit: number = MAX_SECTION_PREVIEW,
  ) => {
    if (posts.length === 0) return null;
    const previewPosts = posts.slice(0, previewLimit);
    const pages = chunkPosts(previewPosts, POSTS_PER_PAGE);

    return (
      <View key={key} style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle} numberOfLines={1}>
            {title}
          </Text>
          {onSeeMore ? (
            <TouchableOpacity onPress={onSeeMore} hitSlop={6}>
              <Text style={styles.seeAllText}>Xem thêm</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <FlatList
          horizontal
          pagingEnabled
          data={pages}
          keyExtractor={(_, index) => `${key}-page-${index}`}
          renderItem={({ item: page }) => (
            <View style={[styles.gridPage, { width }]}>
              {page.map(renderCard)}
            </View>
          )}
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          initialNumToRender={2}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        />
        {pages.length > 1 ? (
          <View style={styles.pageDots}>
            {pages.map((_, index) => (
              <View key={`${key}-dot-${index}`} style={styles.pageDot} />
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.mobileWrapper, { width }]}>
        <MainHeader variant="home" />

        {feedback ? (
          <View
            style={[
              styles.feedbackBar,
              feedback.type === "error" ? styles.feedbackBarError : styles.feedbackBarSuccess,
            ]}
          >
            <Ionicons
              name={feedback.type === "error" ? "alert-circle-outline" : "checkmark-circle-outline"}
              size={18}
              color={feedback.type === "error" ? "#7A1012" : "#2F765D"}
            />
            <Text
              style={[
                styles.feedbackText,
                feedback.type === "error" ? styles.feedbackTextError : styles.feedbackTextSuccess,
              ]}
            >
              {feedback.text}
            </Text>
            {feedback.type === "success" ? (
              <TouchableOpacity onPress={() => router.push("/(tabs)/cart")} hitSlop={6}>
                <Text style={styles.feedbackLink}>Xem giỏ</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <ScrollView
            style={styles.container}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                colors={[COLORS.primary]}
              />
            }
          >
            <View style={styles.bannerContainer}>
              {/* Vòng tròn mờ trang trí để khối nền có chiều sâu (không cần gradient). */}
              <View pointerEvents="none" style={[styles.bannerBlob, styles.bannerBlobLarge]} />
              <View pointerEvents="none" style={[styles.bannerBlob, styles.bannerBlobSmall]} />

              <View style={styles.bannerContent}>
                <Text style={styles.bannerTitle}>
                  {isBusiness ? "Đăng nhu cầu thu mua" : "Thanh lý nhanh chóng"}
                </Text>
                <Text style={styles.bannerSubtitle}>
                  {isBusiness
                    ? "Người bán quanh bạn sẽ chủ động gửi chào bán."
                    : "Đăng tin miễn phí, tìm người mua đồ cũ của bạn."}
                </Text>
                <TouchableOpacity
                  style={styles.bannerButton}
                  activeOpacity={0.85}
                  onPress={() => router.push("/posts/post-form")}
                >
                  <Ionicons name="add-circle" size={17} color={COLORS.primary} />
                  <Text style={styles.bannerButtonText}>
                    {isBusiness ? "Đăng tin thu mua" : "Đăng tin bán ngay"}
                  </Text>
                  <Ionicons name="arrow-forward" size={15} color={COLORS.primary} />
                </TouchableOpacity>
              </View>

              <View pointerEvents="none" style={styles.bannerIllustration}>
                <View style={styles.bannerIllustrationInner}>
                  <Ionicons
                    name={isBusiness ? "storefront" : "cube"}
                    size={34}
                    color={COLORS.white}
                  />
                </View>
                <View style={styles.bannerIllustrationBadge}>
                  <Ionicons
                    name={isBusiness ? "cart" : "pricetag"}
                    size={13}
                    color={COLORS.primary}
                  />
                </View>
              </View>
            </View>

            {productTypeTiles.length > 0 ? (
              <View style={styles.productTypeSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Khám phá theo loại sản phẩm</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.productTypeStrip}
                >
                  {chunkPosts(productTypeTiles, 2).map((column, columnIndex) => (
                    <View key={`pt-col-${columnIndex}`} style={styles.productTypeColumn}>
                      {column.map((type: HomeProductType) => (
                        <TouchableOpacity
                          key={type.productTypeId}
                          style={styles.productTypeTile}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityLabel={`Tìm ${type.productTypeName}`}
                          onPress={() => openProductTypeSearch(type)}
                        >
                          <Text
                            style={styles.productTypeText}
                            numberOfLines={2}
                            ellipsizeMode="tail"
                          >
                            {type.productTypeName}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {renderPagedSection(
              "featured-posts",
              "Bài đăng nổi bật",
              featuredPosts,
              null,
              20,
            )}

            {!isBusiness
              ? renderPagedSection(
                  "buy-posts",
                  "Tin thu mua từ Doanh nghiệp",
                  displayedBuys,
                  () =>
                    router.push({
                      pathname: "/search",
                      params: { autoSearch: "true", postType: "Mua" },
                    }),
                )
              : null}

            {isBusiness ? (
              <>
                {renderPagedSection(
                  "business-discover",
                  "Phù hợp với nhu cầu",
                  discoverPosts,
                  null,
                  BUSINESS_DISCOVER_PAGE_SIZE,
                )}
                {businessDiscover.status === "empty" ? (
                  <View style={styles.discoverStateCard}>
                    <Ionicons name="search-outline" size={22} color={COLORS.textLight} />
                    <Text style={styles.discoverStateText}>
                      Chưa có bài đăng phù hợp với nhu cầu doanh nghiệp của bạn.
                    </Text>
                  </View>
                ) : null}
                {businessDiscover.status === "survey-required" ? (
                  <View style={styles.discoverStateCard}>
                    <Ionicons name="clipboard-outline" size={22} color={COLORS.primary} />
                    <Text style={styles.discoverStateText}>
                      Hoàn thành khảo sát nhu cầu để xem các bài đăng phù hợp.
                    </Text>
                    <TouchableOpacity
                      style={styles.discoverStateButton}
                      accessibilityRole="button"
                      onPress={() => router.push("/profile/business-survey" as any)}
                    >
                      <Text style={styles.discoverStateButtonText}>Làm khảo sát nhu cầu</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {businessDiscover.status === "error" ? (
                  <View style={styles.discoverStateCard}>
                    <Ionicons name="alert-circle-outline" size={22} color={COLORS.error} />
                    <Text style={styles.discoverStateText}>{businessDiscover.message}</Text>
                    <TouchableOpacity
                      style={styles.discoverStateButton}
                      accessibilityRole="button"
                      onPress={() => void fetchHomeData()}
                    >
                      <Text style={styles.discoverStateButtonText}>Thử lại</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </>
            ) : null}

            {renderPagedSection(
              "sell-posts",
              "Tin đăng bán mới nhất",
              displayedSells,
              () =>
                router.push({
                  pathname: "/search",
                  params: { autoSearch: "true", postType: "Bán" },
                }),
            )}

            {productTypeSections.map((section) =>
              renderPagedSection(
                `product-type-${section.type.productTypeId}`,
                section.type.productTypeName,
                section.posts,
                () => openProductTypeSearch(section.type),
              ),
            )}

            {displayedBuys.length === 0 && displayedSells.length === 0 ? (
              <Text style={styles.emptyText}>Chưa có tin đăng phù hợp.</Text>
            ) : null}

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA", alignItems: "center" },
  mobileWrapper: {
    flex: 1,
    backgroundColor: COLORS.white,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0px 0px 20px rgba(0,0,0,0.1)" } as any)
      : {}),
  },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  feedbackBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  feedbackBarSuccess: {
    backgroundColor: "rgba(47, 118, 93, 0.10)",
    borderColor: "rgba(47, 118, 93, 0.24)",
  },
  feedbackBarError: {
    backgroundColor: "rgba(122, 16, 18, 0.08)",
    borderColor: "rgba(122, 16, 18, 0.22)",
  },
  feedbackText: { flex: 1, fontSize: 13, lineHeight: 18 },
  feedbackTextSuccess: { color: "#2F765D" },
  feedbackTextError: { color: "#7A1012" },
  feedbackLink: { color: COLORS.primary, fontSize: 13, fontWeight: "800" },
  sectionContainer: { marginBottom: 28 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SECTION_HORIZONTAL_PADDING,
    marginBottom: 14,
    gap: 12,
  },
  sectionTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: "#172830" },
  seeAllText: { fontSize: 14, color: "#547B7D", fontWeight: "600" },
  gridPage: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: SECTION_HORIZONTAL_PADDING,
    columnGap: CARD_GAP,
    rowGap: CARD_GAP,
  },
  pageDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
  },
  pageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(84, 123, 125, 0.35)",
  },
  emptyText: {
    marginTop: 12,
    marginHorizontal: SECTION_HORIZONTAL_PADDING,
    textAlign: "center",
    color: COLORS.textLight,
    fontSize: 14,
  },
  discoverStateCard: {
    marginHorizontal: SECTION_HORIZONTAL_PADDING,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: "center",
    gap: 8,
  },
  discoverStateText: { textAlign: "center", color: COLORS.text, fontSize: 14, lineHeight: 20 },
  discoverStateButton: {
    marginTop: 4,
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  discoverStateButtonText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },
  productTypeSection: { marginBottom: 20 },
  productTypeStrip: { paddingHorizontal: SECTION_HORIZONTAL_PADDING, gap: 8 },
  productTypeColumn: { gap: 8 },
  // Ô cố định kích thước: chữ không bao giờ làm đổi chiều cao/chiều rộng ô.
  productTypeTile: {
    width: 112,
    height: 46,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  productTypeText: {
    fontSize: 12,
    lineHeight: 15,
    color: COLORS.text,
    fontWeight: "600",
    textAlign: "center",
  },
  bannerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 28,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingVertical: 22,
    paddingLeft: 22,
    paddingRight: 16,
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0px 8px 18px rgba(43,86,89,0.28)" } as any)
      : {
          shadowColor: COLORS.primary,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.28,
          shadowRadius: 14,
          elevation: 6,
        }),
  },
  bannerBlob: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  bannerBlobLarge: { width: 180, height: 180, top: -70, right: -50 },
  bannerBlobSmall: { width: 90, height: 90, bottom: -40, right: 90 },
  bannerContent: { flex: 1, paddingRight: 12 },
  bannerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.white,
  },
  bannerSubtitle: {
    marginTop: 4,
    marginBottom: 14,
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: 13,
    lineHeight: 18,
  },
  bannerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.white,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignSelf: "flex-start",
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0px 3px 8px rgba(0,0,0,0.18)" } as any)
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.18,
          shadowRadius: 6,
          elevation: 3,
        }),
  },
  bannerButtonText: { color: COLORS.primary, fontSize: 13, fontWeight: "800" },
  bannerIllustration: { width: 76, height: 76 },
  bannerIllustrationInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.28)",
  },
  bannerIllustrationBadge: {
    position: "absolute",
    right: -2,
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#BAC2C1",
    elevation: 2,
  },
  imageWrapper: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#F8F9FA",
    position: "relative",
  },
  productImage: { width: "100%", height: "100%", resizeMode: "cover" },
  topBadgeRow: {
    position: "absolute",
    top: 6,
    left: 6,
    right: 6,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  buyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "rgba(84, 123, 125, 0.08)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(84, 123, 125, 0.16)",
  },
  buyHeaderText: { flex: 1, minWidth: 0 },
  buyHeaderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
    minHeight: 18,
  },
  buyHeaderLabelRow: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  buyHeaderLabel: {
    flexShrink: 1,
    color: BUY_ACCENT,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  buyHeaderMeta: { marginTop: 3, color: "#172830", fontSize: 11, fontWeight: "600" },
  buyPriceLabel: { marginBottom: 1, color: "#547B7D", fontSize: 10, fontWeight: "600" },
  categoryBadge: {
    backgroundColor: "rgba(23, 40, 48, 0.90)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  categoryBadgeText: { color: COLORS.white, fontSize: 9, fontWeight: "bold" },
  postTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  sellPostBadge: { backgroundColor: "rgba(43, 86, 89, 0.92)" },
  postTypeBadgeText: { color: COLORS.white, fontSize: 9, fontWeight: "bold" },
  infoWrapper: { padding: 10 },
  brandBadgeWhite: {
    alignSelf: "flex-start",
    backgroundColor: "#F8F9FA",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  brandBadgeTextWhite: { color: "#547B7D", fontSize: 10, fontWeight: "bold" },
  productName: {
    fontSize: 13,
    color: "#172830",
    fontWeight: "600",
    lineHeight: 18,
    marginBottom: 6,
    height: 36,
  },
  ownerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
  },
  ownerAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#E8EEEE",
  },
  ownerName: { flexShrink: 1, fontSize: 11, color: "#547B7D", fontWeight: "500" },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    gap: 6,
  },
  productPrice: { flexShrink: 1, fontSize: 14, fontWeight: "bold", color: "#7A1012" },
  quantityText: { fontSize: 11, color: "#547B7D", fontWeight: "600" },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 6,
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  locationText: { fontSize: 11, color: "#547B7D", flex: 1 },
  quickCartButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  quickCartButtonInCart: { backgroundColor: "#2F765D" },
});
