import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import {
  filterDiscoveryPosts,
  useDiscoveryPreferences,
} from "../../src/contexts/DiscoveryPreferencesContext";
import apiClient from "../../src/services/apis/axiosClient";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";
import { devLog } from "../../src/utils/devLog";
import { isBuyPostType } from "../../src/utils/postType";
import { useAutoDismissFeedback } from "../../src/utils/useAutoDismissFeedback";
import { useGuardedRouter } from "../../src/utils/tapGuard";

// Mỗi mục trên Trang chủ chỉ xem trước tối đa 8 tin (2 trang x 4 tin); phần
// còn lại xem qua "Xem thêm". Không dùng dải cuộn ngang vô tận.
const MAX_SECTION_PREVIEW = 8;
const POSTS_PER_PAGE = 4;
const CARD_GAP = 12;
const SECTION_HORIZONTAL_PADDING = 20;
const HOME_POST_PAGE_SIZE = 100;

const postApi = {
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
};

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
  const [cartPostIds, setCartPostIds] = useState<Set<string>>(new Set());
  const [addingPostId, setAddingPostId] = useState<string | null>(null);
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
      try {
        if (!isRefresh) setIsLoading(true);

        // Hai yêu cầu có giới hạn cho toàn bộ Trang chủ: một lô tin đang hoạt động
        // và một trang loại sản phẩm; các mục theo loại được gom từ lô tin này,
        // không gọi tìm kiếm riêng cho từng loại.
        const [postsRes, typesRes] = await Promise.all([
          postApi.getAllActivePosts({
            PageNumber: 1,
            PageSize: HOME_POST_PAGE_SIZE,
          }),
          postApi.getProductTypes(),
        ]);

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

        setSellPosts(
          visiblePosts.filter((post: any) => post.postType === "Sell"),
        );
        setBuyPosts(
          isBusiness
            ? []
            : visiblePosts.filter((post: any) => post.postType === "Buy"),
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
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

  const handleQuickAddToCart = async (post: any) => {
    const postId = String(post?.postId || "");
    if (!postId) return;

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

    if (addingPostId) return;

    try {
      setAddingPostId(postId);
      const response = await cartApi.addToCart(postId, 1);
      if (response?.isSuccess === false) {
        throw new Error(response?.error?.message || "Không thể thêm sản phẩm vào giỏ hàng.");
      }
      setCartPostIds((current) => new Set(current).add(normalizeId(postId)));
      showFeedback({ type: "success", text: "Đã thêm sản phẩm vào giỏ hàng." });
    } catch (error) {
      devLog("[home] Thêm nhanh vào giỏ thất bại:", error);
      showFeedback({
        type: "error",
        text: getApiErrorMessage(error, "Không thể thêm sản phẩm vào giỏ hàng."),
      });
    } finally {
      setAddingPostId(null);
    }
  };

  const cardWidth =
    (width - SECTION_HORIZONTAL_PADDING * 2 - CARD_GAP) / 2;

  const renderCard = (post: any) => {
    const quickCartState = getQuickCartState(post);
    const isAdding = addingPostId === String(post.postId);

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
            </View>
          </View>
        ) : null}

        <View style={styles.infoWrapper}>
          {isBuyPostType(post.postType) ? (
            <View style={styles.textBadgeRow}>
              {post.categoryName ? (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText} numberOfLines={1}>
                    {post.categoryName}
                  </Text>
                </View>
              ) : null}
              <View style={[styles.postTypeBadge, styles.buyPostBadge]}>
                <Text style={styles.postTypeBadgeText}>Tin mua</Text>
              </View>
            </View>
          ) : null}
          {post.brandName ? (
            <View style={styles.brandBadgeWhite}>
              <Text style={styles.brandBadgeTextWhite}>{post.brandName}</Text>
            </View>
          ) : null}

          <Text style={styles.productName} numberOfLines={2}>
            {post.productName || post.description || "Sản phẩm"}
          </Text>

          <View style={styles.priceRow}>
            <Text style={styles.productPrice} numberOfLines={1}>
              {formatPrice(post.basePrice || post.expectedPrice)}
            </Text>
            <Text style={styles.quantityText}>
              {isBuyPostType(post.postType)
                ? `Cần thu mua: ${post.quantity ?? 1}`
                : `SL: ${post.remainingQuantity ?? post.quantity ?? 1}/${post.quantity ?? 1}`}
            </Text>
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
                  void handleQuickAddToCart(post);
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
    onSeeMore: () => void,
  ) => {
    if (posts.length === 0) return null;
    const previewPosts = posts.slice(0, MAX_SECTION_PREVIEW);
    const pages = chunkPosts(previewPosts, POSTS_PER_PAGE);

    return (
      <View key={key} style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle} numberOfLines={1}>
            {title}
          </Text>
          <TouchableOpacity onPress={onSeeMore} hitSlop={6}>
            <Text style={styles.seeAllText}>Xem thêm</Text>
          </TouchableOpacity>
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
              <View style={styles.bannerContent}>
                <Text style={styles.bannerTitle}>
                  {isBusiness ? "Đăng nhu cầu thu mua" : "Thanh lý nhanh chóng"}
                </Text>
                <TouchableOpacity
                  style={styles.bannerButton}
                  onPress={() => router.push("/posts/post-form")}
                >
                  <Text style={styles.bannerButtonText}>
                    {isBusiness ? "Đăng tin thu mua" : "Đăng tin bán ngay"}
                  </Text>
                </TouchableOpacity>
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
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 28,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 24,
    overflow: "hidden",
  },
  bannerContent: { width: "75%" },
  bannerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.white,
    marginBottom: 8,
  },
  bannerButton: {
    backgroundColor: COLORS.white,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  bannerButtonText: { color: COLORS.primary, fontSize: 13, fontWeight: "bold" },
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
  textBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 7,
  },
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
  buyPostBadge: { backgroundColor: "rgba(154, 100, 24, 0.92)" },
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
