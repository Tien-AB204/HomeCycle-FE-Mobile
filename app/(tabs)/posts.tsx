import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  getPostsByUser: (
    userId: string,
    params?: { PageNumber?: number; PageSize?: number },
  ) =>
    apiClient
      .get(`/posts/get-all/by-user/${userId}`, { params })
      .then((response) => response.data),
  closePost: (postId: string) =>
    apiClient
      .patch(`/posts/${postId}/close`)
      .then((response) => response.data),
  reactivatePost: (postId: string) =>
    apiClient
      .patch(`/posts/${postId}/reactivate`)
      .then((response) => response.data),
};

export default function PostsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web" && width > 480;

  const { user } = useAuth();
  const userRole = user?.role?.toLowerCase() || "personal";
  const currentUserId = user?.userId || user?.id;

  // Dùng chung 1 State cho Tab để code nhẹ hơn
  const [activeTab, setActiveTab] = useState<"active" | "closed">("active");

  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [pageNumber, setPageNumber] = useState(1);
  const pageSize = 10;
  const [hasMore, setHasMore] = useState(true);

  const fetchPosts = async (page = 1, isRefresh = false) => {
    if (!currentUserId) return;

    try {
      if (page === 1 && !isRefresh) setIsLoading(true);

      const res = await postApi.getPostsByUser(currentUserId, {
        PageNumber: page,
        PageSize: pageSize,
      });

      const data = res?.items || res?.data?.items || res?.data || [];

      if (isRefresh || page === 1) {
        setPosts(data);
      } else {
        setPosts((prev) => [...prev, ...data]);
      }

      setHasMore(data.length === pageSize);
    } catch (error) {
      console.error("Lỗi lấy danh sách bài đăng:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (currentUserId) {
        setPageNumber(1);
        fetchPosts(1, false);
      }
    }, [currentUserId]),
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    setPageNumber(1);
    await fetchPosts(1, true);
  };

  const loadMore = () => {
    if (!isLoading && hasMore) {
      const nextPage = pageNumber + 1;
      setPageNumber(nextPage);
      fetchPosts(nextPage);
    }
  };

  // === HÀNH ĐỘNG: ĐÓNG BÀI ĐĂNG ===
  const handleClosePost = (postId: string) => {
    const executeClose = async () => {
      try {
        setIsLoading(true);
        await postApi.closePost(postId);
        if (Platform.OS === "web") window.alert("Đã đóng bài đăng.");
        else Alert.alert("Thành công", "Đã đóng bài đăng.");
        setPageNumber(1);
        await fetchPosts(1, true);
      } catch (error: any) {
        console.error("Lỗi đóng bài:", error);
        const errorMsg =
          error.response?.data?.message || "Không thể đóng bài đăng lúc này.";
        if (Platform.OS === "web") window.alert("Lỗi: " + errorMsg);
        else Alert.alert("Lỗi", errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    if (Platform.OS === "web") {
      if (
        window.confirm(
          "Bạn có chắc chắn muốn đóng (kết thúc giao dịch) tin đăng này không?",
        )
      )
        executeClose();
    } else {
      Alert.alert(
        "Đóng bài đăng",
        "Bạn có chắc chắn muốn đóng (kết thúc giao dịch) tin đăng này không?",
        [
          { text: "Hủy", style: "cancel" },
          { text: "Đóng bài", style: "destructive", onPress: executeClose },
        ],
      );
    }
  };

  // === HÀNH ĐỘNG: MỞ LẠI BÀI ĐĂNG ===
  const handleReactivatePost = (postId: string) => {
    const executeReactivate = async () => {
      try {
        setIsLoading(true);
        await postApi.reactivatePost(postId);
        if (Platform.OS === "web") window.alert("Đã mở lại bài đăng.");
        else Alert.alert("Thành công", "Đã mở lại bài đăng.");
        setPageNumber(1);
        await fetchPosts(1, true);
      } catch (error: any) {
        console.error("Lỗi mở lại bài:", error);
        const errorMsg =
          error.response?.data?.message || "Không thể mở lại bài đăng lúc này.";
        if (Platform.OS === "web") window.alert("Lỗi: " + errorMsg);
        else Alert.alert("Lỗi", errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Bạn có chắc chắn muốn mở lại tin đăng này?"))
        executeReactivate();
    } else {
      Alert.alert(
        "Mở lại bài đăng",
        "Bạn có chắc chắn muốn mở lại tin đăng này?",
        [
          { text: "Hủy", style: "cancel" },
          { text: "Mở lại", onPress: executeReactivate },
        ],
      );
    }
  };

  const formatPrice = (price: number) => {
    if (!price) return "0 đ";
    return price.toLocaleString("vi-VN") + " đ";
  };

  const getTimeAgo = (dateString: string) => {
    if (!dateString) return "N/A";
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();

    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return "Vừa xong";
    if (diffHours < 24) return `${diffHours} giờ trước`;
    return `${diffDays} ngày trước`;
  };

  const getDaysLeft = (expiryDate: string) => {
    if (!expiryDate) return "Không rõ";
    const diff = new Date(expiryDate).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 3600 * 24));
    return days > 0 ? `${days} ngày nữa` : "Đã hết hạn";
  };

  const translateStatus = (status: string) => {
    switch (status) {
      case "Active":
        return { text: "Đang hoạt động", color: "#10B981", bg: "#D1FAE5" };
      case "Pending":
        return { text: "Chờ duyệt", color: "#F59E0B", bg: "#FEF3C7" };
      case "Deleted":
        return { text: "Đã xóa", color: "#EF4444", bg: "#FEE2E2" };
      case "Closed":
        return { text: "Đã đóng", color: "#64748B", bg: "#E2E8F0" };
      default:
        return { text: status || "N/A", color: "#475569", bg: "#F1F5F9" };
    }
  };

  // === KIỂM TRA ĐĂNG NHẬP ===
  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View
          style={[
            styles.mobileWrapper,
            isWeb ? { width: 480, alignSelf: "center" } : null,
          ]}
        >
          <MainHeader title="Quản lý tin đăng" />
          <View style={styles.unauthContainer}>
            <Ionicons
              name="document-text-outline"
              size={80}
              color="#CBD5E1"
              style={{ marginBottom: 16 }}
            />
            <Text style={styles.unauthTitle}>Bạn chưa đăng nhập</Text>
            <Text style={styles.unauthDesc}>
              Hãy đăng nhập để quản lý bài đăng, theo dõi trạng thái giao dịch
              và đăng tin mới nhé!
            </Text>
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() =>
                router.push("/(auth)/login?returnUrl=/(tabs)/posts")
              }
            >
              <Text style={styles.loginBtnText}>Đăng nhập ngay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Lọc bài đăng: Bỏ qua các bài đã bị Xóa (Deleted)
  const validPosts = posts.filter((p) => p.status !== "Deleted");
  const activePosts = validPosts.filter(
    (p) => p.status === "Active" || p.status === "Pending",
  );
  const closedPosts = validPosts.filter((p) => p.status === "Closed");

  const renderCard = (post: any) => {
    const statusObj = translateStatus(post.status);
    const address = [post.streetAddress, post.ward, post.city]
      .filter(Boolean)
      .join(", ");

    // Hỗ trợ cả 2 object Product (bán) hoặc Requirement (mua)
    const displayPrice = post.basePrice || post.expectedPrice || 0;

    return (
      <TouchableOpacity
        key={post.postId}
        style={styles.card}
        activeOpacity={0.7}
        onPress={() =>
          router.push({ pathname: "/posts/[id]", params: { id: post.postId } })
        }
      >
        {post.medias && post.medias.length > 0 ? (
          <Image
            source={{ uri: post.medias[0].url }}
            style={{
              width: 80,
              height: 80,
              borderRadius: 8,
              backgroundColor: "#F0F9FF",
            }}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.iconBox}>
            <Ionicons
              name={
                post.postType === "Sell" ? "cube-outline" : "megaphone-outline"
              }
              size={32}
              color={COLORS.primary}
            />
          </View>
        )}

        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {post.productName || post.description || "Không có tiêu đề"}
          </Text>
          <Text style={styles.cardPrice}>{formatPrice(displayPrice)}</Text>
          <Text style={styles.descText} numberOfLines={2}>
            {post.description}
          </Text>
          <Text style={styles.addressText} numberOfLines={1}>
            <Ionicons name="location-outline" size={12} />{" "}
            {address || "Chưa cập nhật địa chỉ"}
          </Text>

          <View style={styles.tagGrid}>
            <View style={[styles.tag, { backgroundColor: statusObj.bg }]}>
              <Text
                style={[
                  styles.tagText,
                  { color: statusObj.color, fontWeight: "bold" },
                ]}
              >
                {statusObj.text}
              </Text>
            </View>
            <View style={styles.tag}>
              <Text style={styles.tagText}>Loại: {post.postType}</Text>
            </View>
            <View style={styles.tag}>
              <Text style={styles.tagText}>
                SL: {post.remainingQuantity} / {post.quantity}
              </Text>
            </View>
            {post.deliveryMethod && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>
                  Giao hàng: {post.deliveryMethod}
                </Text>
              </View>
            )}
            {post.priorityLevel && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>
                  Ưu tiên: {post.priorityLevel}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.cardFooter}>
            <View>
              <Text style={styles.statsText}>{getTimeAgo(post.createdAt)}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text
                style={[
                  styles.statsText,
                  { color: COLORS.error, fontWeight: "bold" },
                ]}
              >
                Hết hạn: {getDaysLeft(post.expiryDate)}
              </Text>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    router.push({
                      pathname: "/posts/post-form",
                      params: { editId: post.postId, postType: post.postType },
                    });
                  }}
                >
                  <Ionicons
                    name="pencil-outline"
                    size={18}
                    color={COLORS.primary}
                  />
                </TouchableOpacity>

                {post.status === "Active" ? (
                  <TouchableOpacity
                    style={[styles.iconBtn, { borderColor: COLORS.error }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleClosePost(post.postId);
                    }}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={18}
                      color={COLORS.error}
                    />
                  </TouchableOpacity>
                ) : post.status === "Closed" ? (
                  <TouchableOpacity
                    style={[styles.iconBtn, { borderColor: COLORS.primary }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleReactivatePost(post.postId);
                    }}
                  >
                    <Ionicons
                      name="refresh-circle-outline"
                      size={18}
                      color={COLORS.primary}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

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
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === "active" ? styles.tabBtnActive : null,
            ]}
            onPress={() => setActiveTab("active")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "active" ? styles.tabTextActive : null,
              ]}
            >
              {userRole === "personal" ? "Đang hiển thị" : "Đang thu mua"} (
              {activePosts.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === "closed" ? styles.tabBtnActive : null,
            ]}
            onPress={() => setActiveTab("closed")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "closed" ? styles.tabTextActive : null,
              ]}
            >
              Đã đóng ({closedPosts.length})
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading && pageNumber === 1 ? (
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
            style={{ marginTop: 40 }}
          />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                colors={[COLORS.primary]}
              />
            }
          >
            {activeTab === "active" ? (
              activePosts.length > 0 ? (
                activePosts.map((post) => renderCard(post))
              ) : (
                <Text style={styles.emptyText}>
                  {userRole === "personal"
                    ? "Chưa có tin đăng nào đang hoạt động."
                    : "Chưa có tin thu mua nào đang hoạt động."}
                </Text>
              )
            ) : closedPosts.length > 0 ? (
              closedPosts.map((post) => renderCard(post))
            ) : (
              <Text style={styles.emptyText}>Bạn chưa đóng tin đăng nào.</Text>
            )}

            {hasMore && !isLoading && (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore}>
                <Text style={styles.loadMoreText}>Tải thêm</Text>
              </TouchableOpacity>
            )}
            {isLoading && pageNumber > 1 && (
              <ActivityIndicator
                color={COLORS.primary}
                style={{ marginTop: 20 }}
              />
            )}

            <View style={{ height: 80 }} />
          </ScrollView>
        )}

        <TouchableOpacity
          style={styles.fabButton}
          onPress={() => router.push("/posts/post-form")}
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

  unauthContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: COLORS.white,
  },
  unauthTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 12,
  },
  unauthDesc: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  loginBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  loginBtnText: { color: COLORS.white, fontWeight: "bold", fontSize: 16 },

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
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#F0F9FF",
    justifyContent: "center",
    alignItems: "center",
  },
  cardContent: { flex: 1, marginLeft: 12, justifyContent: "space-between" },
  cardTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 2,
  },
  cardPrice: {
    fontSize: 15,
    fontWeight: "bold",
    color: COLORS.error,
    marginBottom: 4,
  },

  descText: { fontSize: 12, color: COLORS.textLight, marginBottom: 4 },
  addressText: {
    fontSize: 11,
    color: "#64748B",
    marginBottom: 8,
    fontStyle: "italic",
  },

  tagGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  tag: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  tagText: { fontSize: 10, color: "#475569", fontWeight: "500" },

  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 8,
  },
  statsText: { fontSize: 12, color: COLORS.textLight, marginBottom: 2 },
  actionButtons: { flexDirection: "row", gap: 8, marginTop: 4 },
  iconBtn: {
    padding: 4,
    backgroundColor: "#F8FAFC",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  loadMoreBtn: {
    padding: 12,
    alignItems: "center",
    backgroundColor: "#E2E8F0",
    borderRadius: 8,
    marginVertical: 10,
  },
  loadMoreText: { color: COLORS.text, fontWeight: "bold" },

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
