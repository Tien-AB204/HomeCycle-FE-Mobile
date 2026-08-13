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
import apiClient from "../../src/services/apis/axiosClient";

const postApi = {
  getAllActivePosts: async (params?: any) => {
    try {
      const res = await apiClient.get("/posts/get-all-active", { params });
      return res.data;
    } catch (error) {
      console.warn("Lỗi lấy bài đăng (có thể do chưa đăng nhập):", error);
      return { items: [] }; 
    }
  },
  getActiveCategories: async () => {
    try {
      const res = await apiClient.get("/categories/active", {
        params: { PageSize: 100, PageNumber: 1 },
      });
      return res.data;
    } catch (error) {
      console.warn("Lỗi lấy danh mục:", error);
      return { items: [] };
    }
  },
};

export default function HomeScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const width = Platform.OS === "web" && screenWidth > 480 ? 480 : screenWidth;

  const [categories, setCategories] = useState<any[]>([]);
  const [sellPosts, setSellPosts] = useState<any[]>([]);
  const [buyPosts, setBuyPosts] = useState<any[]>([]);
  const [suggestedPosts, setSuggestedPosts] = useState<any[]>([]);

  const [activeCategoryName, setActiveCategoryName] = useState<string>("Tất cả");

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchHomeData = async (isRefresh = false) => {
    try {
      if (!isRefresh) setIsLoading(true);

      const postsRes = await postApi.getAllActivePosts({ PageNumber: 1, PageSize: 50 });
      const catRes = await postApi.getActiveCategories();

      let fetchedCats = [];
      if (catRes?.data?.items) {
        fetchedCats = catRes.data.items;
      } else if (catRes?.items) {
        fetchedCats = catRes.items;
      } else if (Array.isArray(catRes)) {
        fetchedCats = catRes;
      }

      setCategories([{ categoryId: "all", categoryName: "Tất cả" }, ...fetchedCats]);

      const allPosts =
        postsRes?.items || postsRes?.data?.items || postsRes?.data || [];

      const sells = allPosts.filter((p: any) => p.postType === "Sell");
      const buys = allPosts.filter((p: any) => p.postType === "Buy");

      setSellPosts(sells);
      setBuyPosts(buys);

      const shuffled = [...allPosts].sort(() => 0.5 - Math.random());
      setSuggestedPosts(shuffled.slice(0, 10));
    } catch (error) {
      console.error("Lỗi hệ thống trang chủ:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchHomeData();
    }, []),
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchHomeData(true);
  };

  const handleCategoryToggle = (categoryName: string) => {
    setActiveCategoryName(categoryName);
  };

  const displayedSells = activeCategoryName === "Tất cả"
    ? sellPosts
    : sellPosts.filter((p) => p.categoryName === activeCategoryName);
    
  const displayedBuys = activeCategoryName === "Tất cả"
    ? buyPosts
    : buyPosts.filter((p) => p.categoryName === activeCategoryName);
    
  const displayedSuggested = activeCategoryName === "Tất cả"
    ? suggestedPosts
    : suggestedPosts.filter((p) => p.categoryName === activeCategoryName);

  const formatPrice = (price: number) => {
    if (!price) return "0 đ";
    return price.toLocaleString("vi-VN") + " đ";
  };

  const getCoverImage = (post: any) => {
    if (post.medias && post.medias.length > 0) {
      return { uri: post.medias[0].url || post.medias[0].mediaUrl };
    }
    return {
      uri: "https://placehold.co/400x400/E2E8F0/94A3B8.png?text=No+Image",
    };
  };

  const getFullAddress = (post: any) => {
    return [post.streetAddress, post.ward, post.city]
      .filter(Boolean)
      .join(", ");
  };

  const getPriorityLabel = (level: string, type: string) => {
    if (level === "Urgent") return "Khẩn cấp";
    if (level === "High") return type === "Buy" ? "Mua gấp" : "Bán gấp";
    return "";
  };

  const getPriorityColor = (level: string) => {
    if (level === "Urgent") return "#EF4444";
    if (level === "High") return "#EA580C";
    return "#10B981";
  };

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

          {post.priorityLevel &&
            post.priorityLevel !== "Medium" &&
            post.priorityLevel !== "Low" && (
              <Text
                style={[
                  styles.priorityText,
                  { color: getPriorityColor(post.priorityLevel) },
                ]}
              >
                {getPriorityLabel(post.priorityLevel, post.postType)}
              </Text>
            )}
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
    if (name.includes("đồ chơi")) return "apps-outline";
    if (name.includes("lặt vặt") || name.includes("nhỏ lẻ"))
      return "cube-outline";
    if (name.includes("quần áo")) return "shirt-outline";
    if (name.includes("sinh hoạt")) return "basket-outline";
    return "grid-outline";
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.mobileWrapper, { width: width }]}>
        <MainHeader title="HomeCycle" />

        {isLoading ? (
          <View
            style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          >
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
                style={[
                  styles.searchInput,
                  { flexDirection: "row", alignItems: "center" },
                ]}
                onPress={() => router.push("/search")}
              >
                <Ionicons
                  name="search"
                  size={20}
                  color={COLORS.textLight}
                  style={{ marginRight: 8 }}
                />
                <Text style={{ color: COLORS.textLight, fontSize: 14 }}>
                  Bạn đang tìm món đồ cũ nào?
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => router.push("/search")}
              >
                <Ionicons
                  name="options-outline"
                  size={20}
                  color={COLORS.white}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.bannerContainer}>
              <View style={styles.bannerContent}>
                <Text style={styles.bannerTitle}>Thanh lý nhanh chóng</Text>
                <Text style={styles.bannerSubtitle}>
                  Kết nối trực tiếp với các doanh nghiệp thu mua uy tín.
                </Text>
                <TouchableOpacity
                  style={styles.bannerButton}
                  onPress={() => router.push("/posts/post-form")}
                >
                  <Text style={styles.bannerButtonText}>Đăng tin bán ngay</Text>
                </TouchableOpacity>
              </View>
              <Image
                source={require("../../assets/images/logo-icon-light-transparent.png")}
                style={styles.bannerLogo}
                resizeMode="contain"
              />
            </View>

            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Danh mục nổi bật</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriesRow}
              >
                {categories.length > 0 ? (
                  categories.map((cat) => {
                    const isActive = activeCategoryName === cat.categoryName;
                    return (
                      <TouchableOpacity
                        key={cat.categoryId || "all"}
                        style={styles.categoryItem}
                        onPress={() => handleCategoryToggle(cat.categoryName)}
                      >
                        <View
                          style={[
                            styles.categoryIconBox,
                            isActive && styles.categoryIconBoxActive,
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
                            isActive && styles.categoryTextActive,
                          ]}
                          numberOfLines={2}
                        >
                          {cat.categoryName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <Text
                    style={{ color: COLORS.textLight, paddingHorizontal: 20 }}
                  >
                    Đang cập nhật danh mục...
                  </Text>
                )}
              </ScrollView>
            </View>

            {activeCategoryName !== "Tất cả" &&
              displayedBuys.length === 0 &&
              displayedSells.length === 0 &&
              displayedSuggested.length === 0 && (
                <View style={{ alignItems: "center", marginVertical: 30 }}>
                  <Ionicons
                    name="folder-open-outline"
                    size={48}
                    color={COLORS.border}
                  />
                  <Text style={{ color: COLORS.textLight, marginTop: 12 }}>
                    Chưa có bài đăng nào trong danh mục này.
                  </Text>
                </View>
              )}

            {displayedBuys.length > 0 && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    Tin thu mua từ Doanh nghiệp
                  </Text>
                  {/* TRUYỀN PARAM CHUYỂN SANG SEARCH VÀ FILTER "MUA" */}
                  <TouchableOpacity onPress={() => router.push({ pathname: "/search", params: { autoSearch: "true", postType: "Mua" } })}>
                    <Text style={styles.seeAllText}>Xem tất cả</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={displayedBuys}
                  keyExtractor={(item) => item.postId}
                  renderItem={renderCard}
                  contentContainerStyle={styles.horizontalListContent}
                />
              </View>
            )}

            {displayedSells.length > 0 && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Tin đăng bán mới nhất</Text>
                  {/* TRUYỀN PARAM CHUYỂN SANG SEARCH VÀ FILTER "BÁN" */}
                  <TouchableOpacity onPress={() => router.push({ pathname: "/search", params: { autoSearch: "true", postType: "Bán" } })}>
                    <Text style={styles.seeAllText}>Xem tất cả</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={displayedSells}
                  keyExtractor={(item) => item.postId}
                  renderItem={renderCard}
                  contentContainerStyle={styles.horizontalListContent}
                />
              </View>
            )}

            {displayedSuggested.length > 0 && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Gợi ý cho bạn</Text>
                </View>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={displayedSuggested}
                  keyExtractor={(item) => item.postId}
                  renderItem={renderCard}
                  contentContainerStyle={styles.horizontalListContent}
                />
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#E0E4EC", alignItems: "center" },
  mobileWrapper: {
    flex: 1,
    backgroundColor: COLORS.white,
    ...Platform.select({
      web: { boxShadow: "0px 0px 20px rgba(0,0,0,0.1)" } as any,
    }),
  },
  container: { flex: 1, backgroundColor: "#F8FAFC" }, 

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 24,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    height: 50,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterButton: {
    width: 50,
    height: 50,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  sectionContainer: { marginBottom: 32 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A" },
  seeAllText: { fontSize: 14, color: "#64748B", fontWeight: "600" },

  categoriesRow: { paddingHorizontal: 20, gap: 24, paddingRight: 40 },
  categoryItem: { alignItems: "center", gap: 8, width: 72 },
  categoryIconBox: {
    width: 56,
    height: 56,
    backgroundColor: "#EFFFFE",
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
    position: "relative",
  },
  bannerContent: { zIndex: 2, width: "75%" },
  bannerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.white,
    marginBottom: 8,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 20,
    marginBottom: 16,
  },
  bannerButton: {
    backgroundColor: COLORS.white,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  bannerButtonText: { color: COLORS.primary, fontSize: 13, fontWeight: "bold" },
  bannerLogo: {
    position: "absolute",
    right: -15,
    bottom: -20,
    width: 140,
    height: 140,
    opacity: 0.15,
    transform: [{ rotate: "-15deg" }],
  },

  horizontalListContent: { paddingHorizontal: 20, gap: 16 },

  card: {
    backgroundColor: COLORS.white,
    width: 170, 
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#EEF0F2",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  imageWrapper: {
    width: "100%",
    aspectRatio: 1, 
    backgroundColor: "#FAFAFA",
    position: "relative",
  },
  productImage: { width: "100%", height: "100%", resizeMode: "cover" },

  topBadgeRow: {
    position: "absolute",
    top: 6,
    left: 6,
    flexDirection: "row",
    gap: 4,
    flexWrap: "wrap",
    right: 6,
  },
  categoryBadge: {
    backgroundColor: "rgba(51, 65, 85, 0.9)", 
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  categoryBadgeText: { color: COLORS.white, fontSize: 9, fontWeight: "bold" },

  infoWrapper: { padding: 10 },
  
  brandBadgeWhite: {
    alignSelf: "flex-start",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  brandBadgeTextWhite: {
    color: "#475569",
    fontSize: 10,
    fontWeight: "bold",
  },

  productName: {
    fontSize: 13,
    color: "#1E293B",
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
  productPrice: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#B91C1C", 
  },
  quantityText: { fontSize: 11, color: "#64748B", fontWeight: "600" },

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
    paddingRight: 6,
  },
  locationText: { fontSize: 11, color: "#64748B", flex: 1 },
  priorityText: { fontSize: 10, fontWeight: "bold" },
});