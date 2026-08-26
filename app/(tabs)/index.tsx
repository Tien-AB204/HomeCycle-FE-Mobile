import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
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
import apiClient from "../../src/services/apis/axiosClient";

const postApi = {
  getAllActivePosts: async (params?: any) => {
    try {
      const res = await apiClient.get("/posts/get-all-active", { params });
      return res.data;
    } catch {
      return { items: [] };
    }
  },
  getActiveCategories: async () => {
    try {
      const res = await apiClient.get("/categories/active", {
        params: { PageSize: 100, PageNumber: 1 },
      });
      return res.data;
    } catch {
      return { items: [] };
    }
  },
};

export default function HomeScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const width = Platform.OS === "web" && screenWidth > 480 ? 480 : screenWidth;
  const { user } = useAuth();

  const [categories, setCategories] = useState<any[]>([]);
  const [sellPosts, setSellPosts] = useState<any[]>([]);
  const [buyPosts, setBuyPosts] = useState<any[]>([]);
  const [activeCategoryName, setActiveCategoryName] = useState<string>("Tất cả");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasRedirectedSurvey, setHasRedirectedSurvey] = useState(false);

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

        const postsRes = await postApi.getAllActivePosts({
          PageNumber: 1,
          PageSize: 50,
        });
        const catRes = await postApi.getActiveCategories();

        const fetchedCats = catRes?.data?.items || catRes?.items || catRes || [];
        setCategories([
          { categoryId: "all", categoryName: "Tất cả" },
          ...fetchedCats,
        ]);

        const allPosts =
          postsRes?.items || postsRes?.data?.items || postsRes?.data || [];

        // Nghiệp vụ HomeCycle:
        // - Sell Post chỉ do Personal tạo và Personal/Business đều có thể mua.
        // - Buy Post chỉ do Business tạo và chỉ Personal được tương tác.
        // Vì vậy Business không nhìn thấy Buy Post của Business khác trong discovery.
        const visiblePosts = isBusiness
          ? allPosts.filter((post: any) => post.postType === "Sell")
          : allPosts;

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
    [isBusiness],
  );

  useFocusEffect(
    useCallback(() => {
      void fetchHomeData();
    }, [fetchHomeData]),
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    void fetchHomeData(true);
  };

  const displayedSells =
    activeCategoryName === "Tất cả"
      ? sellPosts
      : sellPosts.filter((post) => post.categoryName === activeCategoryName);

  const displayedBuys =
    activeCategoryName === "Tất cả"
      ? buyPosts
      : buyPosts.filter((post) => post.categoryName === activeCategoryName);

  const formatPrice = (price: number) => {
    if (!price) return "0 đ";
    return `${price.toLocaleString("vi-VN")} đ`;
  };

  const getCoverImage = (post: any) => {
    if (post.medias && post.medias.length > 0) {
      return { uri: post.medias[0].url || post.medias[0].mediaUrl };
    }

    return {
      uri: "https://placehold.co/400x400/E2E8F0/94A3B8.png?text=No+Image",
    };
  };

  const getFullAddress = (post: any) =>
    [post.streetAddress, post.ward, post.city].filter(Boolean).join(", ");

  const renderCard = ({ item: post }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/posts/${post.postId}`)}
      activeOpacity={0.8}
    >
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
          <View
            style={[
              styles.postTypeBadge,
              post.postType === "Buy" ? styles.buyPostBadge : styles.sellPostBadge,
            ]}
          >
            <Text style={styles.postTypeBadgeText}>
              {post.postType === "Buy" ? "Tin mua" : "Tin bán"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.infoWrapper}>
        {post.brandName ? (
          <View style={styles.brandBadgeWhite}>
            <Text style={styles.brandBadgeTextWhite}>{post.brandName}</Text>
          </View>
        ) : null}

        <Text style={styles.productName} numberOfLines={2}>
          {post.productName || post.description || "Sản phẩm"}
        </Text>

        <View style={styles.priceRow}>
          <Text style={styles.productPrice}>
            {formatPrice(post.basePrice || post.expectedPrice)}
          </Text>
          <Text style={styles.quantityText}>
            SL: {post.remainingQuantity ?? post.quantity ?? 1}/
            {post.quantity ?? 1}
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
        </View>
      </View>
    </TouchableOpacity>
  );

  const getCategoryIcon = (categoryName: string) => {
    if (!categoryName) return "grid-outline";
    const name = categoryName.toLowerCase();
    if (name === "tất cả") return "apps-outline";
    if (name.includes("điện máy")) return "tv-outline";
    if (name.includes("nội thất")) return "bed-outline";
    if (name.includes("sinh hoạt")) return "basket-outline";
    return "grid-outline";
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.mobileWrapper, { width }]}>
        <MainHeader title="HomeCycle" />

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
            <View style={styles.searchContainer}>
              <TouchableOpacity
                style={styles.searchInput}
                onPress={() => router.push("/search")}
              >
                <Ionicons
                  name="search"
                  size={20}
                  color={COLORS.textLight}
                />
                <Text style={styles.searchPlaceholder}>
                  Bạn đang tìm món đồ cũ nào?
                </Text>
              </TouchableOpacity>
            </View>

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

            <View style={styles.sectionContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriesRow}
              >
                {categories.map((cat) => {
                  const isActive = activeCategoryName === cat.categoryName;
                  return (
                    <TouchableOpacity
                      key={cat.categoryId || "all"}
                      style={styles.categoryItem}
                      onPress={() => setActiveCategoryName(cat.categoryName)}
                    >
                      <View
                        style={[
                          styles.categoryIconBox,
                          isActive ? styles.categoryIconBoxActive : undefined,
                        ]}
                      >
                        <Ionicons
                          name={getCategoryIcon(cat.categoryName) as any}
                          size={24}
                          color={isActive ? COLORS.white : COLORS.primary}
                        />
                      </View>
                      <Text
                        style={[
                          styles.categoryText,
                          isActive ? styles.categoryTextActive : undefined,
                        ]}
                        numberOfLines={2}
                      >
                        {cat.categoryName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {!isBusiness && displayedBuys.length > 0 ? (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    Tin thu mua từ Doanh nghiệp
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: "/search",
                        params: { autoSearch: "true", postType: "Mua" },
                      })
                    }
                  >
                    <Text style={styles.seeAllText}>Xem tất cả</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  horizontal
                  data={displayedBuys}
                  renderItem={renderCard}
                  contentContainerStyle={styles.horizontalListContent}
                  showsHorizontalScrollIndicator={false}
                />
              </View>
            ) : null}

            {displayedSells.length > 0 ? (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Tin đăng bán mới nhất</Text>
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: "/search",
                        params: { autoSearch: "true", postType: "Bán" },
                      })
                    }
                  >
                    <Text style={styles.seeAllText}>Xem tất cả</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  horizontal
                  data={displayedSells}
                  renderItem={renderCard}
                  contentContainerStyle={styles.horizontalListContent}
                  showsHorizontalScrollIndicator={false}
                />
              </View>
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
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 24,
  },
  searchInput: {
    flex: 1,
    height: 50,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
  },
  searchPlaceholder: { marginLeft: 8, color: COLORS.textLight, fontSize: 14 },
  sectionContainer: { marginBottom: 32 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#172830" },
  seeAllText: { fontSize: 14, color: "#547B7D", fontWeight: "600" },
  categoriesRow: { paddingHorizontal: 20, gap: 24, paddingRight: 40 },
  categoryItem: { alignItems: "center", gap: 8, width: 72 },
  categoryIconBox: {
    width: 56,
    height: 56,
    backgroundColor: "rgba(84, 123, 125, 0.08)",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryIconBoxActive: { backgroundColor: COLORS.primary },
  categoryText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: "500",
    textAlign: "center",
  },
  categoryTextActive: { color: COLORS.primary, fontWeight: "bold" },
  bannerContainer: {
    marginHorizontal: 20,
    marginBottom: 32,
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
  horizontalListContent: { paddingHorizontal: 20, gap: 16 },
  card: {
    backgroundColor: COLORS.white,
    width: 170,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 4,
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
  },
  productPrice: { fontSize: 14, fontWeight: "bold", color: "#7A1012" },
  quantityText: { fontSize: 11, color: "#547B7D", fontWeight: "600" },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  locationText: { fontSize: 11, color: "#547B7D", flex: 1 },
});