import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import MainHeader from "../../src/components/shared/MainHeader";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import { postApi } from "../../src/services/apis/postApi";

export default function PostsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web" && width > 480;

  const { user } = useAuth();
  const userRole = user?.role || "personal";

  const [activePersonalTab, setActivePersonalTab] = useState<"active" | "hidden">("active");
  const [activeBusinessTab, setActiveBusinessTab] = useState<"buying" | "requests">("buying");

  // === STATE QUẢN LÝ DỮ LIỆU API ===
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // === GỌI API GET ALL ===
  const fetchPosts = async () => {
    try {
      const res = await postApi.getAllPosts();
      const data = res?.items || res?.data?.items || res?.data || [];
      setPosts(data);
    } catch (error) {
      console.error("Lỗi lấy danh sách bài đăng:", error);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchPosts().finally(() => setIsLoading(false));
  }, []);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await fetchPosts();
    setIsRefreshing(false);
  };

  const handleDelete = (postId: string) => {
    Alert.alert(
      "Xác nhận xóa",
      "Bạn có chắc chắn muốn xóa tin đăng này không? Hành động này không thể hoàn tác.",
      [
        { text: "Hủy", style: "cancel" },
        { 
          text: "Xóa", 
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);
              await postApi.deletePost(postId);
              Alert.alert("Thành công", "Đã xóa bài đăng.");
              await fetchPosts(); // Load lại danh sách
            } catch (error) {
              console.error("Lỗi xóa bài:", error);
              Alert.alert("Lỗi", "Không thể xóa bài đăng lúc này.");
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  // === HELPER FORMATTERS ===
  const formatPrice = (price: number) => {
    if (!price) return "0 đ";
    return price.toLocaleString("vi-VN") + " đ";
  };

  // Hàm tính thời gian trôi qua (Relative Time)
  const getTimeAgo = (dateString: string) => {
    if (!dateString) return "N/A";
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();

    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffSecs < 60) return "Vừa xong";
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 30) return `${diffDays} ngày trước`;
    if (diffMonths < 12) return `${diffMonths} tháng trước`;
    return `${diffYears} năm trước`;
  };

  const getDaysLeft = (expiryDate: string) => {
    if (!expiryDate) return "Không rõ";
    const diff = new Date(expiryDate).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 3600 * 24));
    return days > 0 ? `${days} ngày nữa` : "Đã đóng";
  };

  const translateStatus = (status: string) => {
    switch (status) {
      case "Active": return { text: "Đang hoạt động", color: "#10B981", bg: "#D1FAE5" };
      case "Pending": return { text: "Chờ duyệt", color: "#F59E0B", bg: "#FEF3C7" };
      case "Deleted": return { text: "Đã xóa/Ẩn", color: "#EF4444", bg: "#FEE2E2" };
      default: return { text: status || "N/A", color: "#475569", bg: "#F1F5F9" };
    }
  };

  // Lọc dữ liệu theo Tab hiện tại
  const activePosts = posts.filter(p => p.status === "Active" || p.status === "Pending");
  const hiddenPosts = posts.filter(p => p.status === "Deleted");

  const renderCard = (post: any) => {
    const statusObj = translateStatus(post.status);
    const address = [post.streetAddress, post.ward, post.city].filter(Boolean).join(", ");

    return (
      <TouchableOpacity 
        key={post.postId} 
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: "/posts/[id]", params: { id: post.postId } })}
      >
        {/* Placeholder Icon */}
        <View style={styles.iconBox}>
          <Ionicons name={post.postType === "Sell" ? "cube-outline" : "megaphone-outline"} size={32} color={COLORS.primary} />
        </View>

        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {post.productName}
          </Text>
          <Text style={styles.cardPrice}>
            {formatPrice(post.basePrice)}
          </Text>

          <Text style={styles.descText} numberOfLines={2}>
            {post.description}
          </Text>
          <Text style={styles.addressText} numberOfLines={1}>
            <Ionicons name="location-outline" size={12} /> {address || "Chưa cập nhật địa chỉ"}
          </Text>

          {/* GRID TẤT CẢ CÁC TRƯỜNG TRONG API */}
          <View style={styles.tagGrid}>
            <View style={[styles.tag, { backgroundColor: statusObj.bg }]}>
              <Text style={[styles.tagText, { color: statusObj.color, fontWeight: "bold" }]}>
                {statusObj.text}
              </Text>
            </View>
            <View style={styles.tag}>
              <Text style={styles.tagText}>Loại: {post.postType}</Text>
            </View>
            <View style={styles.tag}>
              <Text style={styles.tagText}>SL: {post.remainingQuantity} / {post.quantity}</Text>
            </View>
            <View style={styles.tag}>
              <Text style={styles.tagText}>Giao hàng: {post.deliveryMethod}</Text>
            </View>
            <View style={styles.tag}>
              <Text style={styles.tagText}>Ưu tiên: {post.priorityLevel}</Text>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <View>
              {/* CHỈ CÒN LẠI 1 DÒNG TÍNH THỜI GIAN TỪ LÚC TẠO BÀI */}
              <Text style={styles.statsText}>{getTimeAgo(post.createdAt)}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.statsText, { color: COLORS.error, fontWeight: "bold" }]}>
                Hết hạn: {getDaysLeft(post.expiryDate)}
              </Text>
              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={styles.iconBtn}
                  onPress={(e) => {
                    e.stopPropagation(); // Ngăn sự kiện bấm nhầm vào thẻ Card
                    router.push({
                      pathname: "/posts/post-form",
                      params: { editId: post.postId, postType: post.postType }
                    });
                  }}
                >
                  <Ionicons name="pencil-outline" size={18} color={COLORS.primary} />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.iconBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDelete(post.postId);
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                </TouchableOpacity>
              </View>

            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.mobileWrapper, isWeb ? { width: 480, alignSelf: "center" } : null]}>
        <MainHeader title="Quản lý tin đăng" />

        <View style={styles.tabContainer}>
          {userRole === "personal" ? (
            <>
              <TouchableOpacity
                style={[styles.tabBtn, activePersonalTab === "active" ? styles.tabBtnActive : null]}
                onPress={() => setActivePersonalTab("active")}
              >
                <Text style={[styles.tabText, activePersonalTab === "active" ? styles.tabTextActive : null]}>
                  Đang hiển thị ({activePosts.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, activePersonalTab === "hidden" ? styles.tabBtnActive : null]}
                onPress={() => setActivePersonalTab("hidden")}
              >
                <Text style={[styles.tabText, activePersonalTab === "hidden" ? styles.tabTextActive : null]}>
                  Đã ẩn / Đã bán ({hiddenPosts.length})
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.tabBtn, activeBusinessTab === "buying" ? styles.tabBtnActive : null]}
                onPress={() => setActiveBusinessTab("buying")}
              >
                <Text style={[styles.tabText, activeBusinessTab === "buying" ? styles.tabTextActive : null]}>
                  Tin Thu Mua ({activePosts.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, activeBusinessTab === "requests" ? styles.tabBtnActive : null]}
                onPress={() => setActiveBusinessTab("requests")}
              >
                <Text style={[styles.tabText, activeBusinessTab === "requests" ? styles.tabTextActive : null]}>
                  Yêu cầu ({hiddenPosts.length})
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          >
            {userRole === "personal" ? (
              activePersonalTab === "active" ? (
                activePosts.length > 0 ? (
                  activePosts.map((post) => renderCard(post))
                ) : (
                  <Text style={styles.emptyText}>Chưa có tin đăng nào đang hoạt động.</Text>
                )
              ) : hiddenPosts.length > 0 ? (
                hiddenPosts.map((post) => renderCard(post))
              ) : (
                <Text style={styles.emptyText}>Bạn chưa có tin đăng nào bị ẩn.</Text>
              )
            ) : activeBusinessTab === "buying" ? (
              activePosts.length > 0 ? (
                activePosts.map((post) => renderCard(post))
              ) : (
                <Text style={styles.emptyText}>Chưa có tin thu mua nào.</Text>
              )
            ) : (
              <Text style={styles.emptyText}>Chưa có ai gửi yêu cầu bán cho bạn.</Text>
            )}
            <View style={{ height: 80 }} />
          </ScrollView>
        )}

        <TouchableOpacity style={styles.fabButton} onPress={() => router.push("/posts/post-form")}>
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
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabBtnActive: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: 14, fontWeight: "600", color: COLORS.textLight },
  tabTextActive: { color: COLORS.primary },

  scrollContent: { padding: 16 },
  emptyText: { textAlign: "center", marginTop: 40, color: COLORS.textLight, fontSize: 14 },

  card: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  iconBox: { width: 80, height: 80, borderRadius: 8, backgroundColor: "#F0F9FF", justifyContent: "center", alignItems: "center" },
  cardContent: { flex: 1, marginLeft: 12, justifyContent: "space-between" },
  cardTitle: { fontSize: 15, fontWeight: "bold", color: COLORS.text, marginBottom: 2 },
  cardPrice: { fontSize: 15, fontWeight: "bold", color: COLORS.error, marginBottom: 4 },
  
  descText: { fontSize: 12, color: COLORS.textLight, marginBottom: 4 },
  addressText: { fontSize: 11, color: "#64748B", marginBottom: 8, fontStyle: "italic" },

  tagGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  tag: { backgroundColor: "#F1F5F9", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  tagText: { fontSize: 10, color: "#475569", fontWeight: "500" },

  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 8 },
  statsText: { fontSize: 12, color: COLORS.textLight, marginBottom: 2 },
  actionButtons: { flexDirection: "row", gap: 8, marginTop: 4 },
  iconBtn: { padding: 4, backgroundColor: "#F8FAFC", borderRadius: 4, borderWidth: 1, borderColor: "#E2E8F0" },

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