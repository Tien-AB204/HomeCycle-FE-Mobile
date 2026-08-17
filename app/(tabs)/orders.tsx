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
  imageUrl: string | null;
  role: string;
  roleKey: "buyer" | "seller";
  statusCode: number;
  orderStatusText: string;
  createdAt: string;
};

const orderApi = {
  getBuyerOrders: (params?: {
    PageNumber?: number;
    PageSize?: number;
    Status?: string;
    Keyword?: string;
  }) => apiClient.get("/orders/buyer", { params }).then((response) => response.data),
  getSellerOrders: (params?: {
    PageNumber?: number;
    PageSize?: number;
    Status?: string;
    Keyword?: string;
  }) => apiClient.get("/orders/seller", { params }).then((response) => response.data),
};

const translateOrderStatus = (status: number | string | null | undefined) => {
  switch (String(status)) {
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

export default function OrdersScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web" && width > 480;
  const { user } = useAuth();
  const currentUserId = user?.userId || user?.id;

  const [activeTab, setActiveTab] = useState<OrderTab>("processing");
  const [subFilter, setSubFilter] = useState<SubFilter>("all");
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

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
        setPageError(null);

        const [buyerResponse, sellerResponse] = await Promise.allSettled([
          orderApi.getBuyerOrders({ PageSize: 50, PageNumber: 1 }),
          orderApi.getSellerOrders({ PageSize: 50, PageNumber: 1 }),
        ]);

        const rawOrders: any[] = [];
        const failedMessages: string[] = [];

        if (buyerResponse.status === "fulfilled") {
          const items =
            buyerResponse.value?.items ||
            buyerResponse.value?.data?.items ||
            buyerResponse.value?.data ||
            [];
          if (Array.isArray(items)) {
            rawOrders.push(
              ...items.map((order: any) => ({
                ...order,
                roleKey: "buyer" as const,
                role: "Đơn mua",
              })),
            );
          }
        } else {
          failedMessages.push("đơn mua");
        }

        if (sellerResponse.status === "fulfilled") {
          const items =
            sellerResponse.value?.items ||
            sellerResponse.value?.data?.items ||
            sellerResponse.value?.data ||
            [];
          if (Array.isArray(items)) {
            rawOrders.push(
              ...items.map((order: any) => ({
                ...order,
                roleKey: "seller" as const,
                role: "Đơn bán",
              })),
            );
          }
        } else {
          failedMessages.push("đơn bán");
        }

        if (buyerResponse.status === "rejected" && sellerResponse.status === "rejected") {
          throw buyerResponse.reason || sellerResponse.reason;
        }

        const mappedOrders: OrderItem[] = rawOrders
          .map((order) => ({
            id: String(order.orderId || order.id || ""),
            orderCode: String(
              order.orderCode || order.id?.substring?.(0, 8)?.toUpperCase?.() || "N/A",
            ),
            productName: String(order.productName || "Sản phẩm giao dịch"),
            price: Number(order.finalTotalAmount || order.price || 0),
            imageUrl: order.thumbnailUrl ? String(order.thumbnailUrl) : null,
            role: String(order.role || "Đơn mua"),
            roleKey: order.roleKey,
            statusCode: Number(order.orderStatus ?? -1),
            orderStatusText: translateOrderStatus(order.orderStatus),
            createdAt: String(order.createdAt || ""),
          }))
          .filter((order) => Boolean(order.id));

        mappedOrders.sort(
          (first, second) =>
            new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
        );
        setOrders(mappedOrders);

        if (failedMessages.length > 0) {
          setPageError(
            `Không thể tải ${failedMessages.join(" và ")}. Danh sách còn lại vẫn được hiển thị.`,
          );
        }
      } catch (error: unknown) {
        setOrders([]);
        setPageError(
          getApiErrorMessage(error, "Không thể tải danh sách đơn hàng."),
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentUserId],
  );

  useFocusEffect(
    useCallback(() => {
      void fetchOrders(false);
    }, [fetchOrders]),
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    void fetchOrders(true);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value || 0);

  const getStatusColor = (statusCode: number) => {
    if (statusCode === 2) return { background: "#D1FAE5", text: "#10B981" };
    if (statusCode === 3) return { background: "#FEE2E2", text: "#EF4444" };
    if (statusCode === 4) return { background: "#FEF3C7", text: "#F59E0B" };
    return { background: "#DBEAFE", text: "#3B82F6" };
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.mobileWrapper, isWeb ? styles.webWrapper : undefined]}>
          <MainHeader title="Quản lý Đơn hàng" />
          <View style={styles.unauthContainer}>
            <Ionicons name="receipt-outline" size={80} color="#CBD5E1" />
            <Text style={styles.unauthTitle}>Bạn chưa đăng nhập</Text>
            <Text style={styles.unauthDesc}>
              Vui lòng đăng nhập để xem danh sách đơn hàng, lịch trình giao nhận và
              quản lý khiếu nại.
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

  const filteredOrders = orders.filter((order) => {
    const matchesTab =
      activeTab === "processing"
        ? [0, 1].includes(order.statusCode)
        : activeTab === "history"
          ? [2, 3].includes(order.statusCode)
          : order.statusCode === 4;

    if (!matchesTab) return false;
    if (subFilter === "buyer") return order.roleKey === "buyer";
    if (subFilter === "seller") return order.roleKey === "seller";
    return true;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.mobileWrapper, isWeb ? styles.webWrapper : undefined]}>
        <MainHeader title="Quản lý Đơn hàng" />

        <View style={styles.tabContainer}>
          {(
            [
              ["processing", "Đang xử lý"],
              ["history", "Lịch sử"],
              ["complaint", "Khiếu nại"],
            ] as Array<[OrderTab, string]>
          ).map(([value, label]) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.tabBtn,
                activeTab === value ? styles.tabBtnActive : undefined,
              ]}
              onPress={() => {
                setPageError(null);
                setActiveTab(value);
              }}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === value ? styles.tabTextActive : undefined,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.filterContainer}>
          {(
            [
              ["all", "Tất cả"],
              ["buyer", "Đơn mua"],
              ["seller", "Đơn bán"],
            ] as Array<[SubFilter, string]>
          ).map(([value, label]) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.filterChip,
                subFilter === value ? styles.filterChipActive : undefined,
              ]}
              onPress={() => setSubFilter(value)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  subFilter === value ? styles.filterChipTextActive : undefined,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {pageError ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
            <Text style={styles.errorText}>{pageError}</Text>
            <TouchableOpacity onPress={() => setPageError(null)} hitSlop={8}>
              <Ionicons name="close" size={18} color="#B91C1C" />
            </TouchableOpacity>
          </View>
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
                tintColor={COLORS.primary}
              />
            }
          >
            {filteredOrders.length > 0 ? (
              filteredOrders.map((order) => {
                const badge = getStatusColor(order.statusCode);
                return (
                  <View key={`${order.roleKey}-${order.id}`} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View>
                        <Text style={styles.orderCode}>Mã: {order.orderCode}</Text>
                        <Text style={styles.orderRole}>{order.role}</Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: badge.background },
                        ]}
                      >
                        <Text style={[styles.statusText, { color: badge.text }]}>
                          {order.orderStatusText}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.cardBody}
                      activeOpacity={0.7}
                      onPress={() => router.push(`/orders/${order.id}` as any)}
                    >
                      {order.imageUrl ? (
                        <Image source={{ uri: order.imageUrl }} style={styles.productImg} />
                      ) : (
                        <View style={[styles.productImg, styles.imagePlaceholder]}>
                          <Ionicons name="image-outline" size={25} color="#94A3B8" />
                        </View>
                      )}
                      <View style={styles.productInfo}>
                        <Text style={styles.productName} numberOfLines={2}>
                          {order.productName}
                        </Text>
                        <Text style={styles.productPrice}>{formatCurrency(order.price)}</Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.primaryBtn}
                      onPress={() => router.push(`/orders/${order.id}` as any)}
                    >
                      <Text style={styles.primaryBtnText}>Chi tiết đơn hàng</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyText}>Chưa có đơn hàng nào cho mục này.</Text>
            )}
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
  unauthTitle: {
    marginTop: 16,
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
  filterChipActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  filterChipText: { fontSize: 13, color: "#475569", fontWeight: "600" },
  filterChipTextActive: { color: COLORS.white },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 10,
    backgroundColor: "#FEF2F2",
  },
  errorText: { flex: 1, color: "#B91C1C", fontSize: 13, lineHeight: 18 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 10, color: COLORS.textLight, fontSize: 13 },
  scrollContent: { padding: 16, paddingBottom: 40 },
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
  orderCode: { color: COLORS.text, fontSize: 14, fontWeight: "bold" },
  orderRole: { marginTop: 4, color: COLORS.primary, fontSize: 12, fontWeight: "bold" },
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
  imagePlaceholder: { alignItems: "center", justifyContent: "center" },
  productInfo: { flex: 1 },
  productName: {
    marginBottom: 8,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "bold",
    lineHeight: 20,
  },
  productPrice: { color: COLORS.error, fontSize: 15, fontWeight: "bold" },
  primaryBtn: {
    alignItems: "center",
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  primaryBtnText: { color: COLORS.white, fontSize: 14, fontWeight: "bold" },
});
