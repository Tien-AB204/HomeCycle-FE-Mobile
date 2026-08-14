import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import MainHeader from "../../src/components/shared/MainHeader";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import apiClient from "../../src/services/apis/axiosClient";

const postApi = {
  getAllActivePosts: async (params?: any) => {
    try {
      const res = await apiClient.get("/posts/get-all-active", { params });
      return res.data;
    } catch (error) {
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
      return { items: [] };
    }
  },
};

// Data mẫu cho Survey (Pinterest style)
const SURVEY_CATEGORIES = [
  {
    id: "1",
    title: "Điện lạnh",
    image:
      "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=300&q=80",
  },
  {
    id: "2",
    title: "Thiết bị bếp",
    image:
      "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=300&q=80",
  },
  {
    id: "3",
    title: "Nội thất gỗ",
    image:
      "https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=300&q=80",
  },
  {
    id: "4",
    title: "Đồ công nghệ",
    image:
      "https://images.unsplash.com/photo-1550009158-9efff6c97068?auto=format&fit=crop&w=300&q=80",
  },
  {
    id: "5",
    title: "Bàn ghế văn phòng",
    image:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=300&q=80",
  },
  {
    id: "6",
    title: "Dụng cụ thể thao",
    image:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=300&q=80",
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const width = Platform.OS === "web" && screenWidth > 480 ? 480 : screenWidth;
  const { user } = useAuth();

  const [categories, setCategories] = useState<any[]>([]);
  const [sellPosts, setSellPosts] = useState<any[]>([]);
  const [buyPosts, setBuyPosts] = useState<any[]>([]);
  const [suggestedPosts, setSuggestedPosts] = useState<any[]>([]);
  const [activeCategoryName, setActiveCategoryName] =
    useState<string>("Tất cả");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // SURVEY MODAL STATE
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [selectedSurveyItems, setSelectedSurveyItems] = useState<string[]>([]);
  const [isSubmittingSurvey, setIsSubmittingSurvey] = useState(false);

  // === KIỂM TRA ONBOARDING STATUS KHI VÀO TRANG ===
  useFocusEffect(
    useCallback(() => {
      const checkStatus = async () => {
        if (user?.role === "business") {
          try {
            const res = await apiClient.get(
              "/business-profiles/onboarding-status",
            );
            const data = res.data?.data || res.data;
            if (data?.status === "SurveyPending" || data?.isActionRequired) {
              setShowSurveyModal(true);
            }
          } catch (e) {
            console.log("Lỗi check status:", e);
          }
        }
      };
      checkStatus();
    }, [user?.role]),
  );

  const fetchHomeData = async (isRefresh = false) => {
    try {
      if (!isRefresh) setIsLoading(true);
      const postsRes = await postApi.getAllActivePosts({
        PageNumber: 1,
        PageSize: 50,
      });
      const catRes = await postApi.getActiveCategories();

      let fetchedCats = catRes?.data?.items || catRes?.items || catRes || [];
      setCategories([
        { categoryId: "all", categoryName: "Tất cả" },
        ...fetchedCats,
      ]);

      const allPosts =
        postsRes?.items || postsRes?.data?.items || postsRes?.data || [];
      setSellPosts(allPosts.filter((p: any) => p.postType === "Sell"));
      setBuyPosts(allPosts.filter((p: any) => p.postType === "Buy"));

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

  const displayedSells =
    activeCategoryName === "Tất cả"
      ? sellPosts
      : sellPosts.filter((p) => p.categoryName === activeCategoryName);
  const displayedBuys =
    activeCategoryName === "Tất cả"
      ? buyPosts
      : buyPosts.filter((p) => p.categoryName === activeCategoryName);
  const displayedSuggested =
    activeCategoryName === "Tất cả"
      ? suggestedPosts
      : suggestedPosts.filter((p) => p.categoryName === activeCategoryName);

  const formatPrice = (price: number) => {
    if (!price) return "0 đ";
    return price.toLocaleString("vi-VN") + " đ";
  };

  const getCoverImage = (post: any) => {
    if (post.medias && post.medias.length > 0)
      return { uri: post.medias[0].url || post.medias[0].mediaUrl };
    return {
      uri: "https://placehold.co/400x400/E2E8F0/94A3B8.png?text=No+Image",
    };
  };

  const getFullAddress = (post: any) => {
    return [post.streetAddress, post.ward, post.city]
      .filter(Boolean)
      .join(", ");
  };

  // NỘP SURVEY
  const submitSurvey = async () => {
    if (selectedSurveyItems.length < 3) return; // Yêu cầu chọn ít nhất 3 cái
    setIsSubmittingSurvey(true);
    try {
      await apiClient.post("/business-profiles/survey", {
        preferences: selectedSurveyItems, // Gửi mảng các tag đã chọn
      });
      setShowSurveyModal(false);
    } catch (error) {
      alert("Lỗi nộp khảo sát, vui lòng thử lại.");
    } finally {
      setIsSubmittingSurvey(false);
    }
  };

  const renderCard = ({ item: post }: { item: any }) => (
    // ... (Giữ nguyên component Render Card cũ của ông, không đổi gì)
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
      <View style={[styles.mobileWrapper, { width: width }]}>
        <MainHeader title="HomeCycle" />

        {/* ===================== MODAL SURVEY PINTEREST STYLE ===================== */}
        <Modal
          visible={showSurveyModal}
          animationType="slide"
          transparent={false}
        >
          <SafeAreaView style={styles.surveyContainer}>
            <View style={styles.surveyHeader}>
              <View style={styles.surveyDragBar} />
              <Text style={styles.surveyTitle}>
                What are you in the mood to buy?
              </Text>
            </View>

            <ScrollView contentContainerStyle={styles.surveyGrid}>
              {SURVEY_CATEGORIES.map((item) => {
                const isSelected = selectedSurveyItems.includes(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.surveyItem,
                      isSelected && styles.surveyItemActive,
                    ]}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedSurveyItems((prev) =>
                          prev.filter((id) => id !== item.id),
                        );
                      } else {
                        setSelectedSurveyItems((prev) => [...prev, item.id]);
                      }
                    }}
                  >
                    <Image
                      source={{ uri: item.image }}
                      style={styles.surveyImage}
                    />
                    {isSelected && (
                      <View style={styles.surveyOverlay}>
                        <Ionicons
                          name="checkmark-circle"
                          size={40}
                          color={COLORS.white}
                        />
                      </View>
                    )}
                    <Text style={styles.surveyText}>{item.title}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.surveyFooter}>
              <TouchableOpacity
                style={[
                  styles.surveyBtn,
                  selectedSurveyItems.length < 3 && styles.surveyBtnDisabled,
                ]}
                disabled={selectedSurveyItems.length < 3 || isSubmittingSurvey}
                onPress={submitSurvey}
              >
                {isSubmittingSurvey ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.surveyBtnText}>
                    {selectedSurveyItems.length < 3
                      ? `Pick ${3 - selectedSurveyItems.length} or more to continue`
                      : "Hoàn tất khảo sát"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
        {/* ======================================================================= */}

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
            {/* Các UI ở trang chủ giữ nguyên không đổi */}
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
            </View>

            <View style={styles.bannerContainer}>
              <View style={styles.bannerContent}>
                <Text style={styles.bannerTitle}>Thanh lý nhanh chóng</Text>
                <TouchableOpacity
                  style={styles.bannerButton}
                  onPress={() => router.push("/posts/post-form")}
                >
                  <Text style={styles.bannerButtonText}>Đăng tin bán ngay</Text>
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
                })}
              </ScrollView>
            </View>

            {/* List Buys */}
            {displayedBuys.length > 0 && (
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
                />
              </View>
            )}

            {/* List Sells */}
            {displayedSells.length > 0 && (
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
  // Style cũ giữ nguyên...
  safeArea: { flex: 1, backgroundColor: "#E0E4EC", alignItems: "center" },
  mobileWrapper: {
    flex: 1,
    backgroundColor: COLORS.white,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0px 0px 20px rgba(0,0,0,0.1)" } as any)
      : {}),
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
    borderColor: "#EEF0F2",
    elevation: 2,
  },
  imageWrapper: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#FAFAFA",
    position: "relative",
  },
  productImage: { width: "100%", height: "100%", resizeMode: "cover" },
  topBadgeRow: { position: "absolute", top: 6, left: 6, flexDirection: "row" },
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
  brandBadgeTextWhite: { color: "#475569", fontSize: 10, fontWeight: "bold" },
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
  productPrice: { fontSize: 14, fontWeight: "bold", color: "#B91C1C" },
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
  },
  locationText: { fontSize: 11, color: "#64748B", flex: 1 },

  // ============= STYLE CHO PINTEREST SURVEY MODAL =============
  surveyContainer: { flex: 1, backgroundColor: COLORS.white },
  surveyHeader: { alignItems: "center", paddingTop: 16, paddingBottom: 24 },
  surveyDragBar: {
    width: 40,
    height: 5,
    backgroundColor: "#E60023",
    borderRadius: 3,
    marginBottom: 20,
  },
  surveyTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#111",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  surveyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 10,
    justifyContent: "space-between",
    paddingBottom: 100,
  },
  surveyItem: {
    width: "48%",
    aspectRatio: 1,
    marginBottom: 15,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },
  surveyItemActive: { borderWidth: 3, borderColor: "#111" },
  surveyImage: { width: "100%", height: "100%", resizeMode: "cover" },
  surveyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  surveyText: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    color: COLORS.white,
    fontWeight: "800",
    fontSize: 15,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  surveyFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  surveyBtn: {
    backgroundColor: "#E60023",
    height: 54,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  surveyBtnDisabled: { backgroundColor: "#E9ECEF" },
  surveyBtnText: { color: COLORS.white, fontWeight: "bold", fontSize: 16 },
});
