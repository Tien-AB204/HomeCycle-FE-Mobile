import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
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
import { useAuth } from "../../src/contexts/AuthContext"; // IMPORT AUTH

export default function PostsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web" && width > 480;

  // Lấy role thật từ AuthContext
  const { user } = useAuth();
  const userRole = user?.role || "personal"; // Default là personal nếu rớt mạng

  const [activePersonalTab, setActivePersonalTab] = useState<
    "active" | "hidden"
  >("active");
  const [activeBusinessTab, setActiveBusinessTab] = useState<
    "buying" | "requests"
  >("buying");

  // ================= MOCK DATA (Tạm giữ UI Card, sẽ ghép API sau) =================
  const mockSellingPosts = [
    {
      id: 1,
      title: "Tủ lạnh Samsung Inverter 236L",
      price: "3.500.000 đ",
      image:
        "https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?q=80&w=200&auto=format&fit=crop",
      status: "Hoạt động tốt",
      expires: "30 ngày nữa",
    },
    {
      id: 2,
      title: "Sofa góc bọc da cao cấp xám nhạt",
      price: "2.100.000 đ",
      image:
        "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=200&auto=format&fit=crop",
      status: "Hư nhẹ",
      expires: "15 ngày nữa",
    },
  ];

  const mockBuyingPosts = [
    {
      id: 1,
      title: "Thu mua tủ lạnh hư hỏng, xác điều hòa",
      priceRange: "500k - 2tr / cái",
      quantity: "Không giới hạn",
      category: "Điện máy",
      expires: "30 ngày nữa",
    },
    {
      id: 2,
      title: "Thu mua bàn ghế văn phòng thanh lý",
      priceRange: "Thương lượng",
      quantity: "50 - 100 cái",
      category: "Nội thất",
      expires: "Đã đóng",
    },
  ];

  const renderCard = (post: any, isBuying: boolean) => (
    <View key={post.id} style={styles.card}>
      {isBuying ? (
        <View style={styles.buyingIconBox}>
          <Ionicons name="megaphone-outline" size={28} color={COLORS.primary} />
        </View>
      ) : (
        <Image source={{ uri: post.image }} style={styles.cardImage} />
      )}

      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {post.title}
        </Text>
        <Text style={styles.cardPrice}>
          {isBuying ? post.priceRange : post.price}
        </Text>

        <View style={styles.tagRow}>
          {isBuying ? (
            <>
              <View style={[styles.tag, { backgroundColor: "#E0F2FE" }]}>
                <Text style={[styles.tagText, { color: "#0369A1" }]}>
                  SL: {post.quantity}
                </Text>
              </View>
              <View style={[styles.tag, { backgroundColor: "#F3F4F6" }]}>
                <Text style={styles.tagText}>{post.category}</Text>
              </View>
            </>
          ) : (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{post.status}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardActions}>
          <Text
            style={[
              styles.statsText,
              post.expires === "Đã đóng"
                ? { color: COLORS.error, fontWeight: "bold" }
                : null,
            ]}
          >
            Thời hạn: {post.expires}
          </Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons
                name="pencil-outline"
                size={18}
                color={COLORS.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons
                name={isBuying ? "lock-closed-outline" : "eye-off-outline"}
                size={18}
                color={COLORS.error}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View
        style={[
          styles.mobileWrapper,
          isWeb ? { width: 480, alignSelf: "center" } : null,
        ]}
      >
        <MainHeader title="Quản lý tin đăng" />

        <View style={styles.tabContainer}>
          {userRole === "personal" ? (
            <>
              <TouchableOpacity
                style={[
                  styles.tabBtn,
                  activePersonalTab === "active" ? styles.tabBtnActive : null,
                ]}
                onPress={() => setActivePersonalTab("active")}
              >
                <Text
                  style={[
                    styles.tabText,
                    activePersonalTab === "active"
                      ? styles.tabTextActive
                      : null,
                  ]}
                >
                  Đang hiển thị (2)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tabBtn,
                  activePersonalTab === "hidden" ? styles.tabBtnActive : null,
                ]}
                onPress={() => setActivePersonalTab("hidden")}
              >
                <Text
                  style={[
                    styles.tabText,
                    activePersonalTab === "hidden"
                      ? styles.tabTextActive
                      : null,
                  ]}
                >
                  Đã ẩn / Đã bán (0)
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.tabBtn,
                  activeBusinessTab === "buying" ? styles.tabBtnActive : null,
                ]}
                onPress={() => setActiveBusinessTab("buying")}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeBusinessTab === "buying"
                      ? styles.tabTextActive
                      : null,
                  ]}
                >
                  Tin Thu Mua (2)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tabBtn,
                  activeBusinessTab === "requests" ? styles.tabBtnActive : null,
                ]}
                onPress={() => setActiveBusinessTab("requests")}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeBusinessTab === "requests"
                      ? styles.tabTextActive
                      : null,
                  ]}
                >
                  Yêu cầu chào hàng (5)
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {userRole === "personal" ? (
            activePersonalTab === "active" ? (
              mockSellingPosts.map((post) => renderCard(post, false))
            ) : (
              <Text style={styles.emptyText}>
                Bạn chưa có tin đăng nào bị ẩn.
              </Text>
            )
          ) : activeBusinessTab === "buying" ? (
            mockBuyingPosts.map((post) => renderCard(post, true))
          ) : (
            <Text style={styles.emptyText}>
              Chưa có ai gửi yêu cầu bán cho bạn.
            </Text>
          )}
          <View style={{ height: 80 }} />
        </ScrollView>

        <TouchableOpacity
          style={styles.fabButton}
          onPress={() => router.push("/posts/create-post")}
        >
          <Ionicons name="add" size={32} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.border },
  mobileWrapper: { flex: 1, backgroundColor: "#F8F9FA" },

  tabContainer: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabBtnActive: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: 14, fontWeight: "600", color: COLORS.textLight },
  tabTextActive: { color: COLORS.primary },

  scrollContent: { padding: 16 },
  emptyText: {
    textAlign: "center",
    marginTop: 40,
    color: COLORS.textLight,
    fontSize: 14,
  },

  card: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardImage: {
    width: 90,
    height: 90,
    borderRadius: 10,
    backgroundColor: COLORS.border,
  },
  buyingIconBox: {
    width: 90,
    height: 90,
    borderRadius: 10,
    backgroundColor: "#F0F9FF",
    justifyContent: "center",
    alignItems: "center",
  },
  cardContent: { flex: 1, marginLeft: 12, justifyContent: "space-between" },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 4,
  },
  cardPrice: {
    fontSize: 15,
    fontWeight: "bold",
    color: COLORS.error,
    marginBottom: 6,
  },

  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  tag: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: { fontSize: 11, color: "#475569", fontWeight: "500" },

  cardActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  statsText: { fontSize: 12, color: COLORS.textLight },
  actionButtons: { flexDirection: "row", gap: 12 },
  iconBtn: { padding: 4 },

  fabButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
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
