import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
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
};

// DANH SÁCH MOCK DATA ĐỂ TRỘN VỚI API
const MOCK_STATUSES = [
  "Chờ xác nhận",
  "Đang xử lý",
  "Đã lấy hàng",
  "Đang giao",
];
const MOCK_SHIPPING = [
  "Chưa có thông tin",
  "Shipper đang trên đường lấy hàng",
  "Đang trung chuyển",
  "Đang giao đến bạn",
];
const MOCK_PARTNERS = [
  "Trần Hải Đăng",
  "Nguyễn Văn Đối Tác",
  "Công ty Thu Gom Xanh",
  "Lê Thị Mua Bán",
];

export default function OrdersScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web" && width > 480;

  const { user } = useAuth();
  const currentUserId = user?.userId || user?.id;

  const [activeTab, setActiveTab] = useState<
    "processing" | "history" | "complaint"
  >("processing");
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // LOGIC MOCK TINH VI: Kết hợp Data thật từ Post API và Data Random
  const fetchMockOrders = async (isRefresh = false) => {
    if (!currentUserId) {
      setIsLoading(false);
      return;
    }

    try {
      if (!isRefresh) setIsLoading(true);
      const storageKey = `MOCK_ORDERS_LIST_${currentUserId}`;

      // Nếu không phải pull-to-refresh, thử lấy data đã lưu trong máy
      if (!isRefresh) {
        const cached = await AsyncStorage.getItem(storageKey);
        if (cached) {
          setOrders(JSON.parse(cached));
          setIsLoading(false);
          return;
        }
      }

      // Nếu chưa có data, gọi API lấy bài đăng THẬT của user để làm phôi
      let generatedOrders: any[] = [];
      try {
        const res = await postApi.getPostsByUser(currentUserId, {
          PageNumber: 1,
          PageSize: 5,
        });
        const posts = res?.items || res?.data?.items || res?.data || [];

        generatedOrders = posts.map((post: any, index: number) => ({
          id: `AGR-${post.postId || index}`,
          orderCode: `HC-${Math.floor(10000000 + Math.random() * 90000000)}`,
          productName:
            post.productName || post.description || "Sản phẩm giao dịch",
          price: post.basePrice || post.expectedPrice || 0,
          imageUrl:
            post.medias?.[0]?.url ||
            "https://ui-avatars.com/api/?name=SP&background=F0F9FF&color=0EA5E9",
          role: user?.role === "business" ? "Người Mua" : "Người Bán",
          partnerName:
            MOCK_PARTNERS[Math.floor(Math.random() * MOCK_PARTNERS.length)],
          appointmentDate: new Date(
            Date.now() + 86400000 * (1 + Math.floor(Math.random() * 3)),
          ).toISOString(),
          orderStatus:
            MOCK_STATUSES[Math.floor(Math.random() * MOCK_STATUSES.length)],
          shippingStatus:
            MOCK_SHIPPING[Math.floor(Math.random() * MOCK_SHIPPING.length)],
        }));
      } catch (e) {
        console.log("Không lấy được Post, chuyển sang Fake data 100%");
      }

      // Nếu gọi API mà user chưa có bài nào, tạo Fake 100% cho đẹp màn hình
      if (generatedOrders.length === 0) {
        generatedOrders = [
          {
            id: "MOCK-1",
            orderCode: `HC-${Math.floor(10000000 + Math.random() * 90000000)}`,
            productName: "Smart Tivi Samsung UHD 4K 55 inch",
            price: 9870003,
            imageUrl:
              "https://ui-avatars.com/api/?name=TV&background=F0F9FF&color=0EA5E9",
            role: "Người Mua",
            partnerName: "Điện máy Nguyễn Kim",
            appointmentDate: new Date(Date.now() + 86400000 * 2).toISOString(),
            orderStatus: "Đang xử lý",
            shippingStatus: "Đơn vị vận chuyển đang lấy hàng",
          },
          {
            id: "MOCK-2",
            orderCode: `HC-${Math.floor(10000000 + Math.random() * 90000000)}`,
            productName: "Tủ lạnh LG Inverter 208 Lít",
            price: 2500000,
            imageUrl:
              "https://ui-avatars.com/api/?name=TL&background=FEF2F2&color=EF4444",
            role: "Người Bán",
            partnerName: "Trần Thị B",
            appointmentDate: new Date(Date.now() + 86400000 * 1).toISOString(),
            orderStatus: "Chờ xác nhận",
            shippingStatus: "Chưa có thông tin",
          },
        ];
      }

      // Lưu lại vào LocalStorage để tái sử dụng
      await AsyncStorage.setItem(storageKey, JSON.stringify(generatedOrders));
      setOrders(generatedOrders);
    } catch (error) {
      console.error("Lỗi tạo mock orders:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchMockOrders(false);
    }, [currentUserId]),
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchMockOrders(true); // Ép tạo lại mock data mới
  };

  const handleAction = (actionName: string) => {
    const msg = `Tính năng "${actionName}" đang được cấu hình API.`;
    Platform.OS === "web" ? window.alert(msg) : Alert.alert("Thông báo", msg);
  };

  const formatCurrency = (value: number) => {
    return value
      ? new Intl.NumberFormat("vi-VN", {
          style: "currency",
          currency: "VND",
        }).format(value)
      : "0 đ";
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
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
          <MainHeader title="Quản lý Đơn hàng" />
          <View style={styles.unauthContainer}>
            <Ionicons
              name="receipt-outline"
              size={80}
              color="#CBD5E1"
              style={{ marginBottom: 16 }}
            />
            <Text style={styles.unauthTitle}>Bạn chưa đăng nhập</Text>
            <Text style={styles.unauthDesc}>
              Vui lòng đăng nhập để xem danh sách đơn hàng, lịch trình giao nhận
              và quản lý khiếu nại.
            </Text>
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() =>
                router.push("/(auth)/login?returnUrl=/(tabs)/orders")
              }
            >
              <Text style={styles.loginBtnText}>Đăng nhập ngay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View
        style={[
          styles.mobileWrapper,
          isWeb ? { width: 480, alignSelf: "center" } : null,
        ]}
      >
        <MainHeader title="Quản lý Đơn hàng" />

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === "processing" && styles.tabBtnActive,
            ]}
            onPress={() => setActiveTab("processing")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "processing" && styles.tabTextActive,
              ]}
            >
              Đang xử lý
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === "history" && styles.tabBtnActive,
            ]}
            onPress={() => setActiveTab("history")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "history" && styles.tabTextActive,
              ]}
            >
              Lịch sử
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === "complaint" && styles.tabBtnActive,
            ]}
            onPress={() => setActiveTab("complaint")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "complaint" && styles.tabTextActive,
              ]}
            >
              Khiếu nại
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
            style={{ marginTop: 40 }}
          />
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                colors={[COLORS.primary]}
              />
            }
          >
            {activeTab === "processing" ? (
              orders.length > 0 ? (
                orders.map((order) => (
                  <View key={order.id} style={styles.card}>
                    {/* Header Card: Mã Đơn & Trạng Thái */}
                    <View style={styles.cardHeader}>
                      <View>
                        <Text style={styles.orderCode}>
                          Mã: {order.orderCode}
                        </Text>
                        <Text style={styles.orderRole}>
                          Vai trò:{" "}
                          <Text style={{ color: COLORS.primary }}>
                            {order.role}
                          </Text>
                        </Text>
                      </View>
                      <View style={styles.statusBadge}>
                        <Text style={styles.statusText}>
                          {order.orderStatus}
                        </Text>
                      </View>
                    </View>

                    {/* Body Card: Sản phẩm */}
                    <TouchableOpacity
                      style={styles.cardBody}
                      activeOpacity={0.7}
                      onPress={() => router.push(`/orders/${order.id}` as any)}
                    >
                      <Image
                        source={{ uri: order.imageUrl }}
                        style={styles.productImg}
                      />
                      <View style={styles.productInfo}>
                        <Text style={styles.productName} numberOfLines={2}>
                          {order.productName}
                        </Text>
                        <Text style={styles.partnerName}>
                          <Ionicons name="person-outline" size={12} /> Đối tác:{" "}
                          {order.partnerName}
                        </Text>
                        <Text style={styles.productPrice}>
                          {formatCurrency(order.price)}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    {/* Meta Info: Lịch hẹn & Vận chuyển */}
                    <View style={styles.metaBox}>
                      <View style={styles.metaRow}>
                        <Ionicons
                          name="calendar-outline"
                          size={14}
                          color={COLORS.textLight}
                        />
                        <Text style={styles.metaText}>
                          Lịch hẹn: {formatDate(order.appointmentDate)}
                        </Text>
                      </View>
                      <View style={styles.metaRow}>
                        <Ionicons
                          name="car-outline"
                          size={14}
                          color={COLORS.textLight}
                        />
                        <Text style={styles.metaText}>
                          Vận chuyển: {order.shippingStatus}
                        </Text>
                      </View>
                    </View>

                    {/* Footer Actions */}
                    <View style={styles.cardFooter}>
                      <TouchableOpacity
                        style={styles.outlineBtnError}
                        onPress={() => handleAction("Hủy đơn hàng")}
                      >
                        <Text style={styles.outlineBtnErrorText}>Hủy Đơn</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.outlineBtnWarning}
                        onPress={() => handleAction("Báo cáo sự cố")}
                      >
                        <Text style={styles.outlineBtnWarningText}>
                          Báo Cáo
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.primaryBtn}
                        onPress={() =>
                          router.push(`/orders/${order.id}` as any)
                        }
                      >
                        <Text style={styles.primaryBtnText}>Chi tiết</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>
                  Chưa có đơn hàng nào đang xử lý.
                </Text>
              )
            ) : (
              <Text style={styles.emptyText}>Chưa có dữ liệu cho mục này.</Text>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.border },
  mobileWrapper: { flex: 1, backgroundColor: "#F1F5F9" },

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
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  orderCode: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 4,
  },
  orderRole: { fontSize: 12, color: COLORS.textLight, fontWeight: "500" },
  statusBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: { fontSize: 11, fontWeight: "bold", color: "#F59E0B" },

  cardBody: { flexDirection: "row", alignItems: "center" },
  productImg: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    marginRight: 12,
  },
  productInfo: { flex: 1 },
  productName: {
    fontSize: 15,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 4,
  },
  partnerName: { fontSize: 12, color: COLORS.textLight, marginBottom: 4 },
  productPrice: { fontSize: 15, fontWeight: "bold", color: COLORS.error },

  divider: { height: 1, backgroundColor: "#F1F5F9", marginVertical: 12 },

  metaBox: {
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 6,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaText: { fontSize: 12, color: "#475569", fontWeight: "500" },

  cardFooter: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  outlineBtnError: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.error,
    alignItems: "center",
  },
  outlineBtnErrorText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: "bold",
  },
  outlineBtnWarning: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#F59E0B",
    alignItems: "center",
  },
  outlineBtnWarningText: { color: "#F59E0B", fontSize: 12, fontWeight: "bold" },
  primaryBtn: {
    flex: 1.2,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: "center",
  },
  primaryBtnText: { color: COLORS.white, fontSize: 12, fontWeight: "bold" },
});
