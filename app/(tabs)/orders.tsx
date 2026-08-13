import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
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
} from "react-native";

import {
  InlineFeedback,
  useActionFeedback,
} from "../../src/components/shared/ActionFeedback";
import MainHeader from "../../src/components/shared/MainHeader";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import apiClient from "../../src/services/apis/axiosClient";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";

type OrderTab = "processing" | "history" | "complaint";
type SubFilter = "all" | "buyer" | "seller";

type OrderItem = {
  id: string;
  orderCode: string;
  productName: string;
  price: number;
  imageUrl: string;
  role: string; // "Đơn mua" hoặc "Đơn bán"
  roleKey: "buyer" | "seller";
  statusCode: number;
  orderStatusText: string;
  createdAt: string;
};

type FeedbackTarget = { type: "page" } | null;

const orderApi = {
  getBuyerOrders: (params?: {
    PageNumber?: number;
    PageSize?: number;
    Status?: string;
    Keyword?: string;
  }) =>
    apiClient
      .get("/orders/buyer", { params })
      .then((response) => response.data),

  getSellerOrders: (params?: {
    PageNumber?: number;
    PageSize?: number;
    Status?: string;
    Keyword?: string;
  }) =>
    apiClient
      .get("/orders/seller", { params })
      .then((response) => response.data),
};

export default function OrdersScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web" && width > 480;

  const { user } = useAuth();
  const currentUserId = user?.userId || user?.id;

  const [activeTab, setActiveTab] = useState<OrderTab>("processing");
  const [subFilter, setSubFilter] = useState<SubFilter>("all"); // Mặc định là "Tất cả"
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState<FeedbackTarget>(null);

  const { feedback, clearFeedback, showError } = useActionFeedback();

  const translateOrderStatus = (status: number | string | null | undefined) => {
    const s = String(status);
    switch (s) {
      case "0":
        return "Chờ thanh toán";
      case "1":
        return "Đang xử lý";
      case "2":
        return "Đã hoàn thành";
      case "3":
        return "Đã hủy";
      case "4":
        return "Đang khiếu nại";
      default:
        return "Chưa rõ trạng thái";
    }
  };

  const fetchOrders = useCallback(
    async (isRefresh = false) => {
      if (!currentUserId) {
        setOrders([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      try {
        if (!isRefresh) setIsLoading(true);

        // Luôn call cả 2 API để lưu sẵn ở FE, khi chuyển subFilter (Tất cả / Đơn mua / Đơn bán) sẽ tự lọc không cần gọi lại API
        const [buyerResponse, sellerResponse] = await Promise.allSettled([
          orderApi.getBuyerOrders({ PageSize: 50, PageNumber: 1 }),
          orderApi.getSellerOrders({ PageSize: 50, PageNumber: 1 }),
        ]);

        let allRawOrders: any[] = [];

        if (buyerResponse.status === "fulfilled") {
          const items =
            buyerResponse.value?.items ||
            buyerResponse.value?.data?.items ||
            buyerResponse.value?.data ||
            [];
          allRawOrders = [
            ...allRawOrders,
            ...items.map((o: any) => ({
              ...o,
              roleKey: "buyer",
              role: "Đơn mua",
            })),
          ];
        }

        if (sellerResponse.status === "fulfilled") {
          const items =
            sellerResponse.value?.items ||
            sellerResponse.value?.data?.items ||
            sellerResponse.value?.data ||
            [];
          allRawOrders = [
            ...allRawOrders,
            ...items.map((o: any) => ({
              ...o,
              roleKey: "seller",
              role: "Đơn bán",
            })),
          ];
        }

        const mappedOrders: OrderItem[] = allRawOrders.map((order) => {
          return {
            id: String(order.orderId || order.id || ""),
            orderCode: String(
              order.orderCode ||
                order.id?.substring(0, 8)?.toUpperCase() ||
                "N/A",
            ),
            productName: String(order.productName || "Sản phẩm giao dịch"),
            price: Number(order.finalTotalAmount || order.price || 0),
            imageUrl: String(
              order.thumbnailUrl ||
                "https://ui-avatars.com/api/?name=DH&background=F0F9FF&color=0EA5E9",
            ),
            role: String(order.role || "Đơn mua"),
            roleKey: order.roleKey,
            statusCode: Number(order.orderStatus ?? -1),
            orderStatusText: translateOrderStatus(order.orderStatus),
            createdAt: String(order.createdAt || new Date().toISOString()),
          };
        });

        mappedOrders.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setOrders(mappedOrders);
      } catch (error: unknown) {
        console.error("Lỗi tải danh sách đơn hàng:", error);
        setFeedbackTarget({ type: "page" });
        showError(
          getApiErrorMessage(error, "Không thể tải danh sách đơn hàng."),
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentUserId, showError],
  );

  useFocusEffect(
    useCallback(() => {
      void fetchOrders(false);
    }, [fetchOrders]),
  );

  const onRefresh = () => {
    clearFeedback();
    setFeedbackTarget(null);
    setIsRefreshing(true);
    void fetchOrders(true);
  };

  const handleChangeTab = (nextTab: OrderTab) => {
    clearFeedback();
    setFeedbackTarget(null);
    setActiveTab(nextTab);
  };

  const dismissFeedback = () => {
    clearFeedback();
    setFeedbackTarget(null);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value || 0);
  };

  const getStatusColor = (statusCode: number) => {
    if (statusCode === 2) return { bg: "#D1FAE5", text: "#10B981" };
    if (statusCode === 3) return { bg: "#FEE2E2", text: "#EF4444" };
    if (statusCode === 4) return { bg: "#FEF3C7", text: "#F59E0B" };
    return { bg: "#DBEAFE", text: "#3B82F6" };
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View
          style={[styles.mobileWrapper, isWeb ? styles.webWrapper : undefined]}
        >
          <MainHeader title="Quản lý Đơn hàng" />
          <View style={styles.unauthContainer}>
            <Ionicons
              name="receipt-outline"
              size={80}
              color="#CBD5E1"
              style={styles.unauthIcon}
            />
            <Text style={styles.unauthTitle}>Bạn chưa đăng nhập</Text>
            <Text style={styles.unauthDesc}>
              Vui lòng đăng nhập để xem danh sách đơn hàng, lịch trình giao nhận
              và quản lý khiếu nại.
            </Text>
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() =>
                router.push({
                  pathname: "/(auth)/login",
                  params: { returnUrl: "/(tabs)/orders" },
                })
              }
            >
              <Text style={styles.loginBtnText}>Đăng nhập ngay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const pageFeedback = feedbackTarget?.type === "page" ? feedback : null;

  // Lọc theo Tab trạng thái và lọc theo Đơn mua / Đơn bán ngay tại FE
  const filteredOrders = orders.filter((o) => {
    // 1. Lọc theo Tab trạng thái
    let matchesTab = true;
    if (activeTab === "processing") matchesTab = [0, 1].includes(o.statusCode);
    else if (activeTab === "history")
      matchesTab = [2, 3].includes(o.statusCode);
    else if (activeTab === "complaint") matchesTab = o.statusCode === 4;

    if (!matchesTab) return false;

    // 2. Lọc theo Sub Filter (Tất cả / Đơn mua / Đơn bán)
    if (subFilter === "buyer") return o.roleKey === "buyer";
    if (subFilter === "seller") return o.roleKey === "seller";
    return true; // "all"
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View
        style={[styles.mobileWrapper, isWeb ? styles.webWrapper : undefined]}
      >
        <MainHeader title="Quản lý Đơn hàng" />

        {/* Tab Trạng Thái */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === "processing" ? styles.tabBtnActive : undefined,
            ]}
            onPress={() => handleChangeTab("processing")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "processing" ? styles.tabTextActive : undefined,
              ]}
            >
              Đang xử lý
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === "history" ? styles.tabBtnActive : undefined,
            ]}
            onPress={() => handleChangeTab("history")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "history" ? styles.tabTextActive : undefined,
              ]}
            >
              Lịch sử
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === "complaint" ? styles.tabBtnActive : undefined,
            ]}
            onPress={() => handleChangeTab("complaint")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "complaint" ? styles.tabTextActive : undefined,
              ]}
            >
              Khiếu nại
            </Text>
          </TouchableOpacity>
        </View>

        {/* 3 Nút Lọc Phụ: Tất cả / Đơn mua / Đơn bán */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              subFilter === "all" ? styles.filterChipActive : undefined,
            ]}
            onPress={() => setSubFilter("all")}
          >
            <Text
              style={[
                styles.filterChipText,
                subFilter === "all" ? styles.filterChipTextActive : undefined,
              ]}
            >
              Tất cả
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterChip,
              subFilter === "buyer" ? styles.filterChipActive : undefined,
            ]}
            onPress={() => setSubFilter("buyer")}
          >
            <Text
              style={[
                styles.filterChipText,
                subFilter === "buyer" ? styles.filterChipTextActive : undefined,
              ]}
            >
              Đơn mua
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterChip,
              subFilter === "seller" ? styles.filterChipActive : undefined,
            ]}
            onPress={() => setSubFilter("seller")}
          >
            <Text
              style={[
                styles.filterChipText,
                subFilter === "seller"
                  ? styles.filterChipTextActive
                  : undefined,
              ]}
            >
              Đơn bán
            </Text>
          </TouchableOpacity>
        </View>

        {pageFeedback ? (
          <InlineFeedback
            feedback={pageFeedback}
            onDismiss={dismissFeedback}
            style={styles.pageFeedback}
          />
        ) : null}

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Đang tải đơn hàng...</Text>
          </View>
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
            {filteredOrders.length > 0 ? (
              filteredOrders.map((order) => {
                const badgeColor = getStatusColor(order.statusCode);

                return (
                  <View key={order.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View>
                        <Text style={styles.orderCode}>
                          Mã: {order.orderCode}
                        </Text>
                        <Text style={styles.orderRole}>
                          <Text style={styles.roleValue}>{order.role}</Text>
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: badgeColor.bg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            { color: badgeColor.text },
                          ]}
                        >
                          {order.orderStatusText}
                        </Text>
                      </View>
                    </View>

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
                        <Text style={styles.productPrice}>
                          {formatCurrency(order.price)}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    <View style={styles.cardFooter}>
                      <TouchableOpacity
                        style={styles.primaryBtn}
                        onPress={() =>
                          router.push(`/orders/${order.id}` as any)
                        }
                      >
                        <Text style={styles.primaryBtnText}>
                          Chi tiết đơn hàng
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyText}>
                Chưa có đơn hàng nào cho mục này.
              </Text>
            )}
            <View style={styles.bottomSpacer} />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.border },
  mobileWrapper: { flex: 1, backgroundColor: "#F1F5F9" },
  webWrapper: { width: 480, alignSelf: "center" },
  unauthContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: COLORS.white,
  },
  unauthIcon: { marginBottom: 16 },
  unauthTitle: {
    marginBottom: 12,
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "bold",
  },
  unauthDesc: {
    marginBottom: 32,
    color: COLORS.textLight,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  loginBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  loginBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "bold" },

  tabContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabBtnActive: { borderBottomColor: COLORS.primary },
  tabText: { color: COLORS.textLight, fontSize: 14, fontWeight: "600" },
  tabTextActive: { color: COLORS.primary },

  filterContainer: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  filterChipActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
  },
  filterChipText: { fontSize: 13, color: "#475569", fontWeight: "600" },
  filterChipTextActive: { color: "#FFF" },

  pageFeedback: { marginHorizontal: 16, marginBottom: 8 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 10, color: COLORS.textLight, fontSize: 13 },
  scrollContent: { padding: 16 },
  emptyText: {
    marginTop: 40,
    color: COLORS.textLight,
    fontSize: 14,
    textAlign: "center",
  },
  card: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  orderCode: {
    marginBottom: 4,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "bold",
  },
  orderRole: { color: COLORS.textLight, fontSize: 12, fontWeight: "500" },
  roleValue: { color: COLORS.primary, fontWeight: "bold" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: "bold" },
  cardBody: { flexDirection: "row", alignItems: "center" },
  productImg: {
    width: 70,
    height: 70,
    marginRight: 12,
    borderRadius: 8,
    backgroundColor: "#E2E8F0",
  },
  productInfo: { flex: 1 },
  productName: {
    marginBottom: 8,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "bold",
    lineHeight: 20,
  },
  productPrice: { color: COLORS.error, fontSize: 15, fontWeight: "bold" },
  divider: { height: 1, marginVertical: 12, backgroundColor: "#F1F5F9" },
  cardFooter: { flexDirection: "row", marginTop: 4 },
  primaryBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  primaryBtnText: { color: COLORS.white, fontSize: 14, fontWeight: "bold" },
  bottomSpacer: { height: 40 },
});
