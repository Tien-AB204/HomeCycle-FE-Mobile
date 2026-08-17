import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import Header from "../../src/components/shared/Header";
import { COLORS } from "../../src/constants/theme";
import apiClient from "../../src/services/apis/axiosClient";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";

const PAGE_SIZE = 20;

const paymentApi = {
  getHistory: (pageNumber: number) =>
    apiClient
      .get("/payments/history", {
        params: {
          PageNumber: pageNumber,
          PageSize: PAGE_SIZE,
        },
      })
      .then((response) => response.data),
};

type PaymentHistoryItem = {
  paymentId: string;
  createdAt: string;
  description: string;
  amount: number;
  paymentMethod: number | string;
  paymentStatus: number | string;
  orderId?: string | null;
};

const unwrap = (value: any) => value?.data ?? value;

const formatCurrency = (value: unknown) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDateTime = (value?: string | null) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const translateMethod = (value: number | string) => {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "1" || normalized.includes("payos")) return "PayOS";
  if (
    normalized === "2" ||
    normalized.includes("internal_wallet") ||
    normalized.includes("wallet")
  ) {
    return "Ví HomeCycle";
  }
  if (normalized === "3" || normalized.includes("unknown")) return "Không xác định";
  return String(value || "Không xác định");
};

const translateStatus = (value: number | string) => {
  const normalized = String(value ?? "").toLowerCase();

  if (normalized === "0" || normalized.includes("pending")) {
    return { label: "Đang chờ", color: "#B45309", background: "#FFFBEB" };
  }
  if (normalized === "1" || normalized.includes("completed")) {
    return { label: "Thành công", color: "#047857", background: "#ECFDF5" };
  }
  if (normalized === "2" || normalized.includes("failed")) {
    return { label: "Thất bại", color: "#B91C1C", background: "#FEF2F2" };
  }
  if (normalized === "3" || normalized === "refunded") {
    return { label: "Đã hoàn tiền", color: "#1D4ED8", background: "#EFF6FF" };
  }
  if (normalized === "4" || normalized.includes("partiallyrefunded")) {
    return { label: "Hoàn tiền một phần", color: "#1D4ED8", background: "#EFF6FF" };
  }
  if (normalized === "5" || normalized.includes("expired")) {
    return { label: "Hết hạn", color: "#B91C1C", background: "#FEF2F2" };
  }
  if (normalized === "6" || normalized.includes("cancelled")) {
    return { label: "Đã hủy", color: "#B91C1C", background: "#FEF2F2" };
  }

  return {
    label: String(value || "Không rõ"),
    color: COLORS.textLight,
    background: "#F1F5F9",
  };
};

export default function PaymentHistoryScreen() {
  const router = useRouter();
  const [items, setItems] = useState<PaymentHistoryItem[]>([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadPage = useCallback(async (targetPage: number, refreshing = false) => {
    try {
      if (!refreshing) setIsLoading(true);
      setErrorMessage(null);

      const response = await paymentApi.getHistory(targetPage);
      const data = unwrap(response);
      const nextItems = data?.items || data?.data?.items || [];

      setItems(Array.isArray(nextItems) ? nextItems : []);
      setPageNumber(Number(data?.pageNumber || targetPage));
      setTotalPages(Math.max(1, Number(data?.totalPages || 1)));
      setTotalCount(Number(data?.totalCount || nextItems?.length || 0));
    } catch (error) {
      setItems([]);
      setErrorMessage(
        getApiErrorMessage(error, "Không thể tải lịch sử thanh toán lúc này."),
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPage(1);
    }, [loadPage]),
  );

  const refresh = () => {
    setIsRefreshing(true);
    void loadPage(pageNumber, true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Lịch sử thanh toán" showBack />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải lịch sử...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              colors={[COLORS.primary]}
            />
          }
        >
          <View style={styles.summaryCard}>
            <Ionicons name="receipt-outline" size={26} color={COLORS.primary} />
            <View style={styles.flex}>
              <Text style={styles.summaryTitle}>Giao dịch thanh toán</Text>
              <Text style={styles.summaryText}>{totalCount} giao dịch</Text>
            </View>
          </View>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => void loadPage(pageNumber)}
              >
                <Text style={styles.retryButtonText}>Thử lại</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!errorMessage && items.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="wallet-outline" size={42} color={COLORS.textLight} />
              <Text style={styles.emptyTitle}>Chưa có giao dịch</Text>
              <Text style={styles.emptyText}>
                Khi có thanh toán qua Ví HomeCycle hoặc PayOS, lịch sử sẽ hiển thị tại đây.
              </Text>
            </View>
          ) : null}

          {items.map((item) => {
            const status = translateStatus(item.paymentStatus);
            return (
              <TouchableOpacity
                key={item.paymentId}
                style={styles.paymentCard}
                activeOpacity={item.orderId ? 0.7 : 1}
                onPress={() => {
                  if (item.orderId) router.push(`/orders/${item.orderId}` as any);
                }}
              >
                <View style={styles.cardTopRow}>
                  <View style={styles.flex}>
                    <Text style={styles.description} numberOfLines={2}>
                      {item.description || "Thanh toán giao dịch"}
                    </Text>
                    <Text style={styles.date}>{formatDateTime(item.createdAt)}</Text>
                  </View>
                  <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
                </View>

                <View style={styles.cardBottomRow}>
                  <Text style={styles.method}>{translateMethod(item.paymentMethod)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: status.background }]}>
                    <Text style={[styles.statusText, { color: status.color }]}>
                      {status.label}
                    </Text>
                  </View>
                  {item.orderId ? (
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}

          {totalPages > 1 ? (
            <View style={styles.paginationRow}>
              <TouchableOpacity
                style={[styles.pageButton, pageNumber <= 1 ? styles.disabled : undefined]}
                disabled={pageNumber <= 1}
                onPress={() => void loadPage(pageNumber - 1)}
              >
                <Ionicons name="chevron-back" size={18} color={COLORS.primary} />
                <Text style={styles.pageButtonText}>Trước</Text>
              </TouchableOpacity>

              <Text style={styles.pageText}>
                Trang {pageNumber}/{totalPages}
              </Text>

              <TouchableOpacity
                style={[
                  styles.pageButton,
                  pageNumber >= totalPages ? styles.disabled : undefined,
                ]}
                disabled={pageNumber >= totalPages}
                onPress={() => void loadPage(pageNumber + 1)}
              >
                <Text style={styles.pageButtonText}>Sau</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 10, color: COLORS.textLight },
  scrollContent: { padding: 16, paddingBottom: 40 },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    marginBottom: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  summaryTitle: { color: COLORS.text, fontSize: 15, fontWeight: "800" },
  summaryText: { color: COLORS.textLight, marginTop: 3, fontSize: 12 },
  errorBox: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  errorText: { color: "#B91C1C", fontSize: 13, lineHeight: 18 },
  retryButton: {
    alignSelf: "flex-start",
    marginTop: 9,
    borderWidth: 1,
    borderColor: "#B91C1C",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  retryButtonText: { color: "#B91C1C", fontWeight: "800", fontSize: 12 },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 28,
    alignItems: "center",
  },
  emptyTitle: { color: COLORS.text, fontSize: 16, fontWeight: "800", marginTop: 10 },
  emptyText: {
    color: COLORS.textLight,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 6,
  },
  paymentCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 11,
  },
  cardTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  description: { color: COLORS.text, fontSize: 14, fontWeight: "800", lineHeight: 19 },
  date: { color: COLORS.textLight, fontSize: 11, marginTop: 4 },
  amount: { color: COLORS.primary, fontSize: 15, fontWeight: "900" },
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  method: { flex: 1, color: COLORS.textLight, fontSize: 12 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { fontSize: 11, fontWeight: "800" },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  pageButton: {
    minHeight: 42,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 9,
  },
  pageButtonText: { color: COLORS.primary, fontSize: 12, fontWeight: "800" },
  pageText: { color: COLORS.textLight, fontSize: 12 },
  disabled: { opacity: 0.4 },
});