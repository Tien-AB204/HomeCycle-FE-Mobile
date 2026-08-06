import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  Image,
  Platform,
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
import {
  buyingRequests,
  categories,
  sellingPosts,
  suggestedProducts,
} from "../../src/mocks/homeData";

export default function HomeScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const width = Platform.OS === "web" && screenWidth > 480 ? 480 : screenWidth;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.mobileWrapper, { width: width }]}>
        {/* 1. Header (Đã tự động hiển thị Logo nhờ MainHeader mới) */}
        <MainHeader title="HomeCycle" />

        <ScrollView
          style={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {/* 2. Thanh tìm kiếm */}
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
              <Ionicons name="options-outline" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          {/* 3. Danh mục sản phẩm */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Danh mục nổi bật</Text>
            </View>
            <View style={styles.categoriesRow}>
              {categories.map((cat) => (
                <TouchableOpacity key={cat.id} style={styles.categoryItem}>
                  <View style={styles.categoryIconBox}>
                    <Ionicons
                      name={cat.icon as any}
                      size={24}
                      color={COLORS.primary}
                    />
                  </View>
                  <Text style={styles.categoryText}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 4. Banner (HIỆU ỨNG LOGO IN CHÌM WATERMARK) */}
          <View style={styles.bannerContainer}>
            <View style={styles.bannerContent}>
              <Text style={styles.bannerTitle}>Thanh lý nhanh chóng</Text>
              <Text style={styles.bannerSubtitle}>
                Kết nối trực tiếp với các doanh nghiệp thu mua uy tín.
              </Text>
              <TouchableOpacity style={styles.bannerButton}>
                <Text style={styles.bannerButtonText}>Đăng tin bán ngay</Text>
              </TouchableOpacity>
            </View>
            <Image
              source={require("../../assets/images/logo-icon-light-transparent.png")}
              style={styles.bannerLogo}
              resizeMode="contain"
            />
          </View>

          {/* 5. Tin thu mua từ Doanh nghiệp */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Tin thu mua từ Doanh nghiệp
              </Text>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>Xem tất cả</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.buyingRequestsScroll}
            >
              {buyingRequests.map((req) => (
                <TouchableOpacity
                  key={req.id}
                  style={[styles.buyingCardHorizontal, { width: width * 0.85 }]}
                >
                  <View style={styles.buyingImageContainer}>
                    <Image
                      source={{ uri: req.image }}
                      style={styles.buyingImage}
                    />
                    <View style={styles.conditionBadge}>
                      <Text style={styles.conditionText}>{req.condition}</Text>
                    </View>
                  </View>
                  <View style={styles.buyingInfo}>
                    <Text style={styles.buyingTitle} numberOfLines={2}>
                      {req.title}
                    </Text>
                    <View style={styles.buyingPriceRow}>
                      <Text style={styles.buyingPrice}>{req.priceRange}</Text>
                      <View style={styles.collectionBadge}>
                        <Text style={styles.collectionText}>
                          {req.collectionMethod}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.buyingCompanyRow}>
                      <Image
                        source={{ uri: req.avatar }}
                        style={styles.sellerAvatar}
                      />
                      <Text style={styles.companyNameSmall} numberOfLines={1}>
                        {req.company}
                      </Text>
                      <Ionicons
                        name="checkmark-circle"
                        size={12}
                        color="#27AE60"
                        style={{ marginLeft: 4 }}
                      />
                    </View>
                    <View style={styles.buyingBottomRow}>
                      <View style={styles.buyingLocationRow}>
                        <Ionicons
                          name="location-outline"
                          size={11}
                          color={COLORS.textLight}
                        />
                        <Text
                          style={styles.buyingLocationText}
                          numberOfLines={1}
                        >
                          {req.location}{" "}
                          <Text style={styles.dotSeparator}>•</Text> {req.time}
                        </Text>
                      </View>
                      <TouchableOpacity style={styles.offerButtonSmall}>
                        <Text style={styles.offerButtonTextSmall}>
                          Gửi báo giá
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* 6. Tin đăng bán mới nhất */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Tin đăng bán mới nhất</Text>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>Xem tất cả</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.productGrid}>
              {sellingPosts.map((prod) => (
                <TouchableOpacity
                  key={prod.id}
                  style={[styles.productCard, { width: (width - 56) / 2 }]}
                >
                  <View style={styles.imageContainer}>
                    <Image
                      source={{ uri: prod.image }}
                      style={styles.productImage}
                    />
                    <View style={styles.conditionBadge}>
                      <Text style={styles.conditionText}>{prod.condition}</Text>
                    </View>
                  </View>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {prod.name}
                    </Text>
                    <Text style={styles.productPrice}>{prod.price}</Text>
                    <View style={styles.sellerRow}>
                      <Image
                        source={{ uri: prod.sellerAvatar }}
                        style={styles.sellerAvatar}
                      />
                      <Text style={styles.sellerName} numberOfLines={1}>
                        {prod.sellerName}
                      </Text>
                      <Text style={styles.dotSeparator}>•</Text>
                      <Text style={styles.productTime}>{prod.time}</Text>
                    </View>
                    <View style={styles.productLocationRow}>
                      <Ionicons
                        name="location-outline"
                        size={11}
                        color={COLORS.textLight}
                      />
                      <Text style={styles.productLocation} numberOfLines={1}>
                        {prod.location}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.negotiateBtnSmall}>
                      <Ionicons
                        name="chatbubbles-outline"
                        size={12}
                        color={COLORS.primary}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={styles.negotiateBtnText}>Thương lượng</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 7. Gợi ý cho bạn */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Gợi ý cho bạn</Text>
            </View>
            <View style={styles.productGrid}>
              {suggestedProducts.map((prod) => (
                <TouchableOpacity
                  key={prod.id}
                  style={[styles.productCard, { width: (width - 56) / 2 }]}
                >
                  <View style={styles.imageContainer}>
                    <Image
                      source={{ uri: prod.image }}
                      style={styles.productImage}
                    />
                    <View style={styles.conditionBadge}>
                      <Text style={styles.conditionText}>{prod.condition}</Text>
                    </View>
                  </View>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {prod.name}
                    </Text>
                    <Text style={styles.productPrice}>{prod.price}</Text>
                    <View style={styles.sellerRow}>
                      <Image
                        source={{ uri: prod.sellerAvatar }}
                        style={styles.sellerAvatar}
                      />
                      <Text style={styles.sellerName} numberOfLines={1}>
                        {prod.sellerName}
                      </Text>
                      <Text style={styles.dotSeparator}>•</Text>
                      <Text style={styles.productTime}>{prod.time}</Text>
                    </View>
                    <View style={styles.productLocationRow}>
                      <Ionicons
                        name="location-outline"
                        size={11}
                        color={COLORS.textLight}
                      />
                      <Text style={styles.productLocation} numberOfLines={1}>
                        {prod.location}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.negotiateBtnSmall}>
                      <Ionicons
                        name="chatbubbles-outline"
                        size={12}
                        color={COLORS.primary}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={styles.negotiateBtnText}>Thương lượng</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
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
    paddingLeft: 16,
    paddingRight: 16,
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
  sectionTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  seeAllText: { fontSize: 14, color: COLORS.primary, fontWeight: "600" },
  categoriesRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 32,
    paddingHorizontal: 20,
  },
  categoryItem: { alignItems: "center", gap: 8, width: 72 },
  categoryIconBox: {
    width: 56,
    height: 56,
    backgroundColor: "#EFFFFE",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "500",
    textAlign: "center",
  },

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

  // Style cho Logo In Chìm ở Banner
  bannerLogo: {
    position: "absolute",
    right: -15,
    bottom: -20,
    width: 140,
    height: 140,
    opacity: 0.15, // Tạo hiệu ứng mờ sang trọng
    transform: [{ rotate: "-15deg" }], // Nghiêng nhẹ phá cách
  },

  buyingRequestsScroll: { paddingHorizontal: 20, gap: 16 },
  buyingCardHorizontal: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  buyingImageContainer: {
    position: "relative",
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#F5F5F5",
  },
  buyingImage: { width: "100%", height: "100%" },
  buyingInfo: { flex: 1, marginLeft: 12, justifyContent: "space-between" },
  buyingTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: 4,
  },
  buyingPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 4,
  },
  buyingPrice: { fontSize: 14, fontWeight: "bold", color: "#E74C3C" },
  collectionBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  collectionText: { color: "#27AE60", fontSize: 10, fontWeight: "bold" },
  buyingCompanyRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  companyNameSmall: { fontSize: 11, color: COLORS.textLight, flexShrink: 1 },
  buyingBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  buyingLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 8,
  },
  buyingLocationText: { fontSize: 10, color: COLORS.textLight, marginLeft: 2 },
  offerButtonSmall: {
    backgroundColor: "#F0F7F6",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  offerButtonTextSmall: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "bold",
  },

  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    gap: 16,
  },
  productCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 4,
  },
  imageContainer: {
    position: "relative",
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#F5F5F5",
  },
  productImage: { width: "100%", height: "100%" },
  conditionBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  conditionText: { color: COLORS.white, fontSize: 10, fontWeight: "bold" },
  productInfo: { padding: 10 },
  productName: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "600",
    lineHeight: 18,
    marginBottom: 6,
    height: 36,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#E74C3C",
    marginBottom: 8,
  },
  sellerRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  sellerAvatar: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 4,
    backgroundColor: "#F0F0F0",
  },
  sellerName: { fontSize: 10, color: COLORS.textLight, flexShrink: 1 },
  dotSeparator: { fontSize: 10, color: COLORS.textLight, marginHorizontal: 4 },
  productTime: { fontSize: 10, color: COLORS.textLight },
  productLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  productLocation: {
    fontSize: 10,
    color: COLORS.textLight,
    marginLeft: 2,
    flex: 1,
  },
  negotiateBtnSmall: {
    flexDirection: "row",
    width: "100%",
    height: 30,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.white,
  },
  negotiateBtnText: { color: COLORS.primary, fontSize: 11, fontWeight: "700" },
});
