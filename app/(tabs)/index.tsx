import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
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
  FlatList,
} from "react-native";
import MainHeader from "../../src/components/shared/MainHeader";
import { COLORS } from "../../src/constants/theme";
import { postApi } from "../../src/services/apis/postApi";

export default function HomeScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const width = Platform.OS === "web" && screenWidth > 480 ? 480 : screenWidth;

  // === STATES DỮ LIỆU ===
  const [categories, setCategories] = useState<any[]>([]);
  const [sellPosts, setSellPosts] = useState<any[]>([]);
  const [buyPosts, setBuyPosts] = useState<any[]>([]);
  const [suggestedPosts, setSuggestedPosts] = useState<any[]>([]);

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // === FETCH API TRANG CHỦ ===
  const fetchHomeData = async (isRefresh = false) => {
    try {
      if (!isRefresh) setIsLoading(true);

      const [postsRes, catRes] = await Promise.all([
        // Chỉ gọi API lấy tin Active
        postApi.getAllActivePosts({ PageNumber: 1, PageSize: 50 }),
        postApi.getActiveCategories(),
      ]);

      if (catRes?.data?.items) {
        setCategories(catRes.data.items);
      } else if (catRes?.items) {
        setCategories(catRes.items);
      } else if (Array.isArray(catRes)) {
        setCategories(catRes);
      }

      const allPosts = postsRes?.items || postsRes?.data?.items || postsRes?.data || [];

      // KHÔNG CẦN CHECK STATUS NỮA, BE ĐÃ LỌC SẴN ACTIVE
      const sells = allPosts.filter((p: any) => p.postType === "Sell");
      const buys = allPosts.filter((p: any) => p.postType === "Buy");

      setSellPosts(sells);
      setBuyPosts(buys);

      // Random bài cho mục Gợi ý
      const shuffled = [...allPosts].sort(() => 0.5 - Math.random());
      setSuggestedPosts(shuffled.slice(0, 10)); 
    } catch (error) {
      console.error("Lỗi lấy dữ liệu trang chủ:", error);
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

  const handleCategoryToggle = (categoryId: string) => {
    if (activeCategoryId === categoryId) {
      setActiveCategoryId(null);
    } else {
      setActiveCategoryId(categoryId);
    }
  };

  // === LỌC DỮ LIỆU THEO DANH MỤC ===
  const displayedSells = activeCategoryId ? sellPosts.filter(p => p.categoryId === activeCategoryId) : sellPosts;
  const displayedBuys = activeCategoryId ? buyPosts.filter(p => p.categoryId === activeCategoryId) : buyPosts;
  const displayedSuggested = activeCategoryId ? suggestedPosts.filter(p => p.categoryId === activeCategoryId) : suggestedPosts;

  // === FORMATTERS ===
  const formatPrice = (price: number) => {
    if (!price) return "0 đ";
    return price.toLocaleString("vi-VN") + " đ";
  };

  const getCoverImage = (post: any) => {
    if (post.medias && post.medias.length > 0) {
      return { uri: post.medias[0].url || post.medias[0].mediaUrl };
    }
    return { uri: "https://placehold.co/400x400/E2E8F0/94A3B8.png?text=No+Image" };
  };

  const getFullAddress = (post: any) => {
    return [post.streetAddress, post.ward, post.city].filter(Boolean).join(", ");
  };

  // ================= RENDER CARD =================
  const renderCard = ({ item: post }: { item: any }) => (
    <TouchableOpacity
      style={styles.horizontalCard}
      onPress={() => router.push(`/posts/${post.postId}`)}
    >
      <View style={styles.imageContainer}>
        <Image source={getCoverImage(post)} style={styles.productImage} />
        
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText} numberOfLines={1}>
            {post.categoryName || "Sản phẩm"}
          </Text>
        </View>
      </View>

      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>{post.productName || post.description}</Text>
        <Text style={styles.productPrice}>{formatPrice(post.basePrice || post.expectedPrice)}</Text>

        <Text style={styles.metaText} numberOfLines={1}>
          SL: {post.remainingQuantity}/{post.quantity} • {post.deliveryMethod}
        </Text>
        
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={12} color={COLORS.textLight} />
          <Text style={styles.locationText} numberOfLines={1}>
            {getFullAddress(post)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const getCategoryIcon = (categoryName: string) => {
    if (!categoryName) return "grid-outline";
    const name = categoryName.toLowerCase();
    if (name.includes("điện máy")) return "tv-outline";
    if (name.includes("nội thất")) return "bed-outline";
    if (name.includes("đồ chơi")) return "apps-outline";
    if (name.includes("lặt vặt") || name.includes("nhỏ lẻ")) return "cube-outline";
    if (name.includes("quần áo")) return "shirt-outline";
    if (name.includes("sinh hoạt")) return "basket-outline";
    return "grid-outline"; 
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.mobileWrapper, { width: width }]}>
        <MainHeader title="HomeCycle" />

        {isLoading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <ScrollView
            style={styles.container}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          >
            {/* Thanh tìm kiếm */}
            <View style={styles.searchContainer}>
              <TouchableOpacity
                style={[styles.searchInput, { flexDirection: "row", alignItems: "center" }]}
                onPress={() => router.push("/search")}
              >
                <Ionicons name="search" size={20} color={COLORS.textLight} style={{ marginRight: 8 }} />
                <Text style={{ color: COLORS.textLight, fontSize: 14 }}>
                  Bạn đang tìm món đồ cũ nào?
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterButton} onPress={() => router.push("/search")}>
                <Ionicons name="options-outline" size={20} color={COLORS.white} />
              </TouchableOpacity>
            </View>

            {/* Banner */}
            <View style={styles.bannerContainer}>
              <View style={styles.bannerContent}>
                <Text style={styles.bannerTitle}>Thanh lý nhanh chóng</Text>
                <Text style={styles.bannerSubtitle}>Kết nối trực tiếp với các doanh nghiệp thu mua uy tín.</Text>
                <TouchableOpacity style={styles.bannerButton} onPress={() => router.push("/posts/post-form")}>
                  <Text style={styles.bannerButtonText}>Đăng tin bán ngay</Text>
                </TouchableOpacity>
              </View>
              <Image
                source={require("../../assets/images/logo-icon-light-transparent.png")}
                style={styles.bannerLogo}
                resizeMode="contain"
              />
            </View>

            {/* Danh mục */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Danh mục nổi bật</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesRow}>
                {categories.length > 0 ? (
                  categories.map((cat) => {
                    const isActive = activeCategoryId === cat.categoryId;
                    return (
                      <TouchableOpacity
                        key={cat.categoryId}
                        style={styles.categoryItem}
                        onPress={() => handleCategoryToggle(cat.categoryId)}
                      >
                        <View style={[styles.categoryIconBox, isActive && styles.categoryIconBoxActive]}>
                          <Ionicons
                            name={getCategoryIcon(cat.categoryName) as any}
                            size={24}
                            color={isActive ? COLORS.white : COLORS.primary}
                          />
                        </View>
                        <Text style={[styles.categoryText, isActive && styles.categoryTextActive]} numberOfLines={2}>
                          {cat.categoryName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <Text style={{ color: COLORS.textLight, paddingHorizontal: 20 }}>Đang cập nhật danh mục...</Text>
                )}
              </ScrollView>
            </View>

            {activeCategoryId && displayedBuys.length === 0 && displayedSells.length === 0 && displayedSuggested.length === 0 && (
              <View style={{ alignItems: 'center', marginVertical: 30 }}>
                <Ionicons name="folder-open-outline" size={48} color={COLORS.border} />
                <Text style={{ color: COLORS.textLight, marginTop: 12 }}>Chưa có bài đăng nào trong danh mục này.</Text>
              </View>
            )}

            {/* Tin Thu Mua */}
            {displayedBuys.length > 0 && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Tin thu mua từ Doanh nghiệp</Text>
                  <TouchableOpacity><Text style={styles.seeAllText}>Xem tất cả</Text></TouchableOpacity>
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

            {/* Tin Đăng Bán */}
            {displayedSells.length > 0 && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Tin đăng bán mới nhất</Text>
                  <TouchableOpacity><Text style={styles.seeAllText}>Xem tất cả</Text></TouchableOpacity>
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

            {/* Gợi ý */}
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
  container: { flex: 1, backgroundColor: "#F8F9FA" },

  searchContainer: { flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginTop: 16, marginBottom: 24, gap: 12 },
  searchInput: { flex: 1, height: 50, backgroundColor: COLORS.white, borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: COLORS.border },
  filterButton: { width: 50, height: 50, backgroundColor: COLORS.primary, borderRadius: 12, justifyContent: "center", alignItems: "center" },

  sectionContainer: { marginBottom: 32 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  seeAllText: { fontSize: 14, color: COLORS.primary, fontWeight: "600" },

  categoriesRow: { paddingHorizontal: 20, gap: 24, paddingRight: 40 },
  categoryItem: { alignItems: "center", gap: 8, width: 72 },
  categoryIconBox: { width: 56, height: 56, backgroundColor: "#EFFFFE", borderRadius: 16, justifyContent: "center", alignItems: "center" },
  categoryIconBoxActive: { backgroundColor: COLORS.primary }, 
  categoryText: { fontSize: 12, color: COLORS.text, fontWeight: "500", textAlign: "center" },
  categoryTextActive: { color: COLORS.primary, fontWeight: "bold" },

  bannerContainer: { marginHorizontal: 20, marginBottom: 32, backgroundColor: COLORS.primary, borderRadius: 20, padding: 24, overflow: "hidden", position: "relative" },
  bannerContent: { zIndex: 2, width: "75%" },
  bannerTitle: { fontSize: 20, fontWeight: "bold", color: COLORS.white, marginBottom: 8 },
  bannerSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 20, marginBottom: 16 },
  bannerButton: { backgroundColor: COLORS.white, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, alignSelf: "flex-start" },
  bannerButtonText: { color: COLORS.primary, fontSize: 13, fontWeight: "bold" },
  bannerLogo: { position: "absolute", right: -15, bottom: -20, width: 140, height: 140, opacity: 0.15, transform: [{ rotate: "-15deg" }] },

  horizontalListContent: { paddingHorizontal: 20, gap: 16 },
  horizontalCard: { 
    backgroundColor: COLORS.white, 
    borderRadius: 12, 
    overflow: "hidden", 
    borderWidth: 1, 
    borderColor: COLORS.border,
    width: 160, 
  },
  
  imageContainer: { position: "relative", width: "100%", aspectRatio: 1, backgroundColor: "#F1F5F9" },
  productImage: { width: "100%", height: "100%" },
  
  categoryBadge: { 
    position: "absolute", 
    top: 8, 
    left: 8, 
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 6, 
    maxWidth: "85%" 
  },
  categoryBadgeText: { color: COLORS.white, fontSize: 10, fontWeight: "bold" },

  productInfo: { padding: 12 },
  productName: { fontSize: 13, color: COLORS.text, fontWeight: "600", lineHeight: 18, marginBottom: 6, height: 36 },
  productPrice: { fontSize: 15, fontWeight: "bold", color: "#E74C3C", marginBottom: 6 },
  metaText: { fontSize: 11, color: "#64748B", marginBottom: 6 },
  
  locationRow: { flexDirection: "row", alignItems: "center" },
  locationText: { fontSize: 11, color: COLORS.textLight, marginLeft: 4, flex: 1 },
});