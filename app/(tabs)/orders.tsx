import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
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

import { ModalBackdrop, ModalSurface } from "../../src/components/shared/ModalBackdrop";
import MainHeader from "../../src/components/shared/MainHeader";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import apiClient from "../../src/services/apis/axiosClient";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";

// Primary structural perspective: which side of the transaction.
type OrderTypeTab = "all" | "buyer" | "seller";
// Secondary status filter: processing state within that perspective.
type OrderStatusFilter = "all" | "processing" | "history" | "complaint";

// Same 4 options/labels/business mapping as before — only the container
// (funnel modal instead of a permanent chip row) changed.
const ORDER_STATUS_FILTER_OPTIONS: Array<{
  key: OrderStatusFilter;
  label: string;
}> = [
  { key: "all", label: "Tất cả trạng thái" },
  { key: "processing", label: "Đang xử lý" },
  { key: "history", label: "Lịch sử" },
  { key: "complaint", label: "Khiếu nại" },
];

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
  const normalized = String(status ?? "")
    .replace(/[\s_-]/g, "")
    .toLowerCase();

  switch (normalized) {
    case "0":
    case "pending":
    case "pendingpayment":
      return "Chờ thanh toán";
    case "1":
    case "processing":
      return "Đang xử lý";
    case "2":
    case "completed":
      return "Đã hoàn thành";
    case "3":
    case "cancelled":
    case "canceled":
      return "Đã hủy";
    case "4":
    case "disputing":
    case "disputed":
      return "Đang khiếu nại";

    case "5":
    case "returned":
      return "Đã hoàn trả";
    default:
      return "Đang cập nhật";
  }
};

export default function OrdersScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web" && width > 480;
  const { user } = useAuth();
  const currentUserId = user?.userId || user?.id;

  const [typeTab, setTypeTab] = useState<OrderTypeTab>("all");
  // Applied secondary status filter — the single source of truth the list
  // actually filters by. The funnel modal edits a separate draft copy so
  // "Đặt lại"/"Áp dụng" can be cancelled by tapping the backdrop.
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>("all");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [draftStatusFilter, setDraftStatusFilter] =
    useState<OrderStatusFilter>("all");
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
              order.orderCode || order.id?.substring?.(0, 8)?.toUpperCase?.() || "Chưa có mã",
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

  const openFilterModal = () => {
    setDraftStatusFilter(statusFilter);
    setShowFilterModal(true);
  };

  const closeFilterModal = () => setShowFilterModal(false);

  const handleResetFilter = () => {
    setDraftStatusFilter("all");
    setStatusFilter("all");
    setShowFilterModal(false);
  };

  const handleApplyFilter = () => {
    setStatusFilter(draftStatusFilter);
    setShowFilterModal(false);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value || 0);

  const getStatusColor = (statusCode: number) => {
    if (statusCode === 2) return { background: "rgba(47, 118, 93, 0.10)", text: "#2F765D" };
    if (statusCode === 3) return { background: "rgba(122, 16, 18, 0.08)", text: "#7A1012" };
    if (statusCode === 4) return { background: "rgba(154, 100, 24, 0.10)", text: "#9A6418" };
    return { background: "rgba(84, 123, 125, 0.10)", text: "#2B5659" };
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.mobileWrapper, isWeb ? styles.webWrapper : undefined]}>
          <MainHeader title="Quản lý Đơn hàng" />
          <View style={styles.unauthContainer}>
            <Ionicons name="receipt-outline" size={80} color={COLORS.border} />
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
    const matchesStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "processing"
          ? [0, 1].includes(order.statusCode)
          : statusFilter === "history"
            ? [2, 3].includes(order.statusCode)
            : order.statusCode === 4;

    if (!matchesStatus) return false;
    if (typeTab === "buyer") return order.roleKey === "buyer";
    if (typeTab === "seller") return order.roleKey === "seller";
    return true;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.mobileWrapper, isWeb ? styles.webWrapper : undefined]}>
        <MainHeader title="Quản lý Đơn hàng" />

        <View style={styles.tabRow}>
          <View style={styles.tabContainer}>
            {(
              [
                ["all", "Tất cả"],
                ["buyer", "Đơn mua"],
                ["seller", "Đơn bán"],
              ] as Array<[OrderTypeTab, string]>
            ).map(([value, label]) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.tabBtn,
                  typeTab === value ? styles.tabBtnActive : undefined,
                ]}
                onPress={() => {
                  setPageError(null);
                  setTypeTab(value);
                }}
              >
                <Text
                  style={[
                    styles.tabText,
                    typeTab === value ? styles.tabTextActive : undefined,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.filterIconBtn}
            onPress={openFilterModal}
            hitSlop={8}
          >
            <Ionicons name="filter-outline" size={20} color={COLORS.text} />
            {statusFilter !== "all" ? <View style={styles.filterActiveDot} /> : null}
          </TouchableOpacity>
        </View>

        {pageError ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={18} color="#7A1012" />
            <Text style={styles.errorText}>{pageError}</Text>
            <TouchableOpacity onPress={() => setPageError(null)} hitSlop={8}>
              <Ionicons name="close" size={18} color="#7A1012" />
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
                          <Ionicons name="image-outline" size={25} color="#547B7D" />
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

      <Modal
        visible={showFilterModal}
        transparent
        animationType="fade"
        onRequestClose={closeFilterModal}
      >
        <ModalBackdrop style={styles.filterModalBackdrop} onPress={closeFilterModal}>
          <ModalSurface style={styles.filterModalCard}>
            <Text style={styles.filterModalTitle}>Bộ lọc đơn hàng</Text>

            <View style={styles.filterOptionList}>
              {ORDER_STATUS_FILTER_OPTIONS.map((option) => {
                const selected = draftStatusFilter === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.filterOptionRow,
                      selected ? styles.filterOptionRowActive : undefined,
                    ]}
                    onPress={() => setDraftStatusFilter(option.key)}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        selected ? styles.filterOptionTextActive : undefined,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {selected ? (
                      <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.filterModalActions}>
              <TouchableOpacity
                style={styles.filterResetButton}
                onPress={handleResetFilter}
              >
                <Text style={styles.filterResetButtonText}>Đặt lại</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.filterApplyButton}
                onPress={handleApplyFilter}
              >
                <Text style={styles.filterApplyButtonText}>Áp dụng</Text>
              </TouchableOpacity>
            </View>
          </ModalSurface>
        </ModalBackdrop>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.border },
  mobileWrapper: { flex: 1, backgroundColor: "#F8F9FA" },
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
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  tabContainer: {
    flex: 1,
    flexDirection: "row",
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
  filterIconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  filterActiveDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  filterModalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  filterModalCard: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === "ios" ? 36 : 22,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: COLORS.white,
  },
  filterModalTitle: {
    marginBottom: 14,
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "800",
  },
  filterOptionList: { gap: 2 },
  filterOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 46,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  filterOptionRowActive: { backgroundColor: "rgba(43, 86, 89, 0.06)" },
  filterOptionText: { color: COLORS.text, fontSize: 15, fontWeight: "600" },
  filterOptionTextActive: { color: COLORS.primary, fontWeight: "800" },
  filterModalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  filterResetButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  filterResetButtonText: { color: COLORS.text, fontSize: 14, fontWeight: "700" },
  filterApplyButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
  },
  filterApplyButtonText: { color: COLORS.white, fontSize: 14, fontWeight: "800" },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(122, 16, 18, 0.22)",
    borderRadius: 10,
    backgroundColor: "rgba(122, 16, 18, 0.08)",
  },
  errorText: { flex: 1, color: "#7A1012", fontSize: 13, lineHeight: 18 },
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
    backgroundColor: "#F8F9FA",
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
