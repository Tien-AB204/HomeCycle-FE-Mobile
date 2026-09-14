import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import CalendarDateField from "../../../src/components/shared/CalendarDateField";
import Header from "../../../src/components/shared/Header";
import { COLORS } from "../../../src/constants/theme";
import {
  getMyWithdrawals,
  WithdrawalListItem,
  WithdrawalPage,
  WithdrawalStatus,
} from "../../../src/services/apis/withdrawalApi";
import { getApiErrorMessage } from "../../../src/utils/apiFeedback";

const PAGE_SIZE = 10;

type StatusFilter = {
  label: string;
  value?: WithdrawalStatus;
};

const STATUS_FILTERS: StatusFilter[] = [
  { label: "Tất cả" },
  { label: "Đang chờ xử lý", value: "Pending" },
  { label: "Đã duyệt", value: "Approved" },
  { label: "Đang chuyển tiền", value: "Processing" },
  { label: "Hoàn tất", value: "Completed" },
  { label: "Bị từ chối", value: "Rejected" },
  { label: "Thất bại", value: "Failed" },
];

type ListFilters = {
  status?: WithdrawalStatus;
  fromDate: string;
  toDate: string;
};

const unwrap = <T,>(value: { data?: T } | T): T =>
  (value as { data?: T })?.data ?? (value as T);

// Ngày chọn là ngày địa phương; gửi mốc đầu/cuối ngày để Backend lọc RequestedAt trọn ngày.
const toDayStartIso = (value: string) => new Date(`${value}T00:00:00`).toISOString();
const toDayEndIso = (value: string) => new Date(`${value}T23:59:59.999`).toISOString();
const isValidDateValue = (value: string) =>
  Boolean(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());

const getStatusPresentation = (value: unknown) => {
  switch (String(value ?? "").trim().toLowerCase()) {
    case "pending":
      return { label: "Đang chờ xử lý", color: "#9A6418", background: "rgba(154, 100, 24, 0.10)" };
    case "approved":
      return { label: "Đã duyệt", color: "#2B5659", background: "rgba(84, 123, 125, 0.10)" };
    case "processing":
      return { label: "Đang chuyển tiền", color: "#2B5659", background: "rgba(84, 123, 125, 0.10)" };
    case "completed":
      return { label: "Hoàn tất", color: "#2F765D", background: "rgba(47, 118, 93, 0.10)" };
    case "rejected":
      return { label: "Bị từ chối", color: "#7A1012", background: "rgba(122, 16, 18, 0.08)" };
    case "failed":
      return { label: "Thất bại", color: "#7A1012", background: "rgba(122, 16, 18, 0.08)" };
    default:
      return { label: "Chưa rõ", color: COLORS.textLight, background: "#F8F9FA" };
  }
};

const formatCurrency = (value: unknown) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDateTime = (value?: string | null) => {
  if (!value) return "Chưa có";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const isRejectReasonRelevant = (status: unknown) => {
  const value = String(status ?? "").trim().toLowerCase();
  return value === "rejected" || value === "failed";
};

export default function WithdrawalHistoryScreen() {
  const router = useRouter();
  const requestGeneration = useRef(0);
  const [items, setItems] = useState<WithdrawalListItem[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<WithdrawalStatus | undefined>();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const filters = useMemo<ListFilters>(
    () => ({ status: selectedStatus, fromDate, toDate }),
    [fromDate, selectedStatus, toDate],
  );
  const rangeError =
    isValidDateValue(fromDate) && isValidDateValue(toDate) && fromDate > toDate
      ? "Từ ngày không được sau Đến ngày. Vui lòng chọn lại khoảng thời gian."
      : null;
  const hasActiveFilters = Boolean(selectedStatus || fromDate || toDate);

  const loadPage = useCallback(async (
    targetPage: number,
    activeFilters: ListFilters,
    refreshing = false,
  ) => {
    const generation = ++requestGeneration.current;
    try {
      if (refreshing) setIsRefreshing(true);
      else {
        setIsLoading(true);
        setItems([]);
      }
      setPageNumber(targetPage);
      setErrorText(null);

      const response = await getMyWithdrawals({
        PageNumber: targetPage,
        PageSize: PAGE_SIZE,
        ...(activeFilters.status ? { Status: activeFilters.status } : {}),
        ...(isValidDateValue(activeFilters.fromDate)
          ? { FromDate: toDayStartIso(activeFilters.fromDate) }
          : {}),
        ...(isValidDateValue(activeFilters.toDate)
          ? { ToDate: toDayEndIso(activeFilters.toDate) }
          : {}),
      });
      if (requestGeneration.current !== generation) return;

      const page = unwrap<WithdrawalPage>(response);
      if (!Array.isArray(page?.items)) {
        throw new Error("Không thể đọc danh sách rút tiền.");
      }
      setItems(page.items);
      setPageNumber(Number(page.pageNumber || targetPage));
      setTotalPages(Math.max(1, Number(page.totalPages || 1)));
      setTotalCount(Number(page.totalCount || 0));
    } catch (error) {
      if (requestGeneration.current !== generation) return;
      setItems([]);
      setTotalCount(0);
      setErrorText(
        getApiErrorMessage(error, "Không thể tải lịch sử rút tiền lúc này."),
      );
    } finally {
      if (requestGeneration.current === generation) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (rangeError) {
        // Khoảng ngày không hợp lệ được chặn tại chỗ, không gửi truy vấn.
        requestGeneration.current += 1;
        setItems([]);
        setTotalCount(0);
        setTotalPages(1);
        setPageNumber(1);
        setErrorText(null);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }
      void loadPage(1, filters);
      return () => {
        requestGeneration.current += 1;
      };
    }, [filters, loadPage, rangeError]),
  );

  const selectStatus = (status: WithdrawalStatus | undefined) => {
    if (status === selectedStatus) return;
    setSelectedStatus(status);
    setPageNumber(1);
  };

  const changeFromDate = (value: string) => {
    if (value === fromDate) return;
    setFromDate(value);
    setPageNumber(1);
  };

  const changeToDate = (value: string) => {
    if (value === toDate) return;
    setToDate(value);
    setPageNumber(1);
  };

  const resetFilters = () => {
    if (!hasActiveFilters) return;
    setSelectedStatus(undefined);
    setFromDate("");
    setToDate("");
    setPageNumber(1);
  };

  const renderItem = ({ item }: { item: WithdrawalListItem }) => {
    const status = getStatusPresentation(item.status);
    const bankText = [item.bankName, item.maskedAccountNumber]
      .map((part) => String(part ?? "").trim())
      .filter(Boolean)
      .join(" · ");

    return (
      <TouchableOpacity
        style={styles.withdrawalCard}
        activeOpacity={0.75}
        onPress={() =>
          router.push(`/wallet/withdrawals/${item.withdrawalId}` as any)
        }
      >
        <View style={styles.cardTopRow}>
          <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.background }]}>
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.label}
            </Text>
          </View>
        </View>

        {bankText ? <Text style={styles.bankText}>{bankText}</Text> : null}

        <View style={styles.dateRow}>
          <Text style={styles.dateLabel}>Yêu cầu</Text>
          <Text style={styles.dateValue}>{formatDateTime(item.requestedAt)}</Text>
        </View>
        {item.processedAt ? (
          <View style={styles.dateRow}>
            <Text style={styles.dateLabel}>Xử lý</Text>
            <Text style={styles.dateValue}>{formatDateTime(item.processedAt)}</Text>
          </View>
        ) : null}

        {isRejectReasonRelevant(item.status) && item.rejectReason ? (
          <Text style={styles.rejectReason}>Lý do: {item.rejectReason}</Text>
        ) : null}

        <View style={styles.detailRow}>
          <Text style={styles.detailText}>Xem chi tiết</Text>
          <Ionicons name="chevron-forward" size={17} color={COLORS.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Lịch sử rút tiền" showBack />
      <FlatList
        data={items}
        keyExtractor={(item) => item.withdrawalId}
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              if (!rangeError) void loadPage(pageNumber, filters, true);
            }}
            colors={[COLORS.primary]}
          />
        }
        ListHeaderComponent={
          <>
            <View style={styles.summaryCard}>
              <Ionicons name="cash-outline" size={26} color={COLORS.primary} />
              <View style={styles.flex}>
                <Text style={styles.summaryTitle}>Yêu cầu rút tiền</Text>
                <Text style={styles.summaryText}>{totalCount} yêu cầu</Text>
              </View>
            </View>

            <Text style={styles.filterTitle}>Trạng thái</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {STATUS_FILTERS.map((filter) => {
                const selected = filter.value === selectedStatus;
                return (
                  <TouchableOpacity
                    key={filter.value || "all"}
                    style={[styles.filterChip, selected ? styles.filterChipSelected : undefined]}
                    onPress={() => selectStatus(filter.value)}
                  >
                    <Text style={[styles.filterText, selected ? styles.filterTextSelected : undefined]}>
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.filterTitle}>Thời gian yêu cầu</Text>
            <View style={styles.dateFilterRow}>
              <View style={styles.dateFilterItem}>
                <Text style={styles.dateFilterLabel}>Từ ngày</Text>
                <CalendarDateField
                  value={fromDate}
                  onChange={changeFromDate}
                  placeholder="Chọn ngày"
                  clearable
                  hasError={Boolean(rangeError)}
                  maximumDate={new Date()}
                />
              </View>
              <View style={styles.dateFilterItem}>
                <Text style={styles.dateFilterLabel}>Đến ngày</Text>
                <CalendarDateField
                  value={toDate}
                  onChange={changeToDate}
                  placeholder="Chọn ngày"
                  clearable
                  hasError={Boolean(rangeError)}
                  defaultViewDate={fromDate || undefined}
                  maximumDate={new Date()}
                />
              </View>
            </View>
            {rangeError ? <Text style={styles.rangeErrorText}>{rangeError}</Text> : null}
            {hasActiveFilters ? (
              <TouchableOpacity style={styles.resetFiltersButton} onPress={resetFilters}>
                <Ionicons name="close-circle-outline" size={16} color={COLORS.primary} />
                <Text style={styles.resetFiltersText}>Xóa bộ lọc</Text>
              </TouchableOpacity>
            ) : null}

            {errorText ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorText}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => void loadPage(pageNumber, filters)}
                >
                  <Text style={styles.retryText}>Thử lại</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {isLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Đang tải lịch sử...</Text>
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          !isLoading && !errorText ? (
            <View style={styles.emptyCard}>
              <Ionicons name="cash-outline" size={42} color={COLORS.textLight} />
              <Text style={styles.emptyTitle}>
                {hasActiveFilters ? "Không có yêu cầu phù hợp" : "Chưa có yêu cầu rút tiền"}
              </Text>
              <Text style={styles.emptyText}>
                {hasActiveFilters
                  ? "Thử thay đổi trạng thái hoặc khoảng thời gian lọc."
                  : "Các yêu cầu rút tiền của bạn sẽ xuất hiện tại đây."}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          !isLoading && !errorText && totalPages > 1 ? (
            <View style={styles.paginationRow}>
              <TouchableOpacity
                style={[styles.pageButton, pageNumber <= 1 ? styles.disabled : undefined]}
                disabled={pageNumber <= 1}
                onPress={() => void loadPage(pageNumber - 1, filters)}
              >
                <Ionicons name="chevron-back" size={18} color={COLORS.primary} />
                <Text style={styles.pageButtonText}>Trước</Text>
              </TouchableOpacity>
              <Text style={styles.pageText}>Trang {pageNumber}/{totalPages}</Text>
              <TouchableOpacity
                style={[styles.pageButton, pageNumber >= totalPages ? styles.disabled : undefined]}
                disabled={pageNumber >= totalPages}
                onPress={() => void loadPage(pageNumber + 1, filters)}
              >
                <Text style={styles.pageButtonText}>Sau</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.white,
  },
  summaryTitle: { color: COLORS.text, fontSize: 15, fontWeight: "800" },
  summaryText: { marginTop: 3, color: COLORS.textLight, fontSize: 12 },
  filterTitle: { marginBottom: 8, color: COLORS.text, fontSize: 13, fontWeight: "700" },
  filterRow: { gap: 8, paddingBottom: 16 },
  dateFilterRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  dateFilterItem: { flex: 1 },
  dateFilterLabel: { marginBottom: 6, color: COLORS.textLight, fontSize: 12, fontWeight: "600" },
  rangeErrorText: { marginTop: 6, color: "#7A1012", fontSize: 12, lineHeight: 17 },
  resetFiltersButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8, marginBottom: 6, paddingVertical: 4 },
  resetFiltersText: { color: COLORS.primary, fontSize: 13, fontWeight: "700" },
  filterChip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    backgroundColor: COLORS.white,
  },
  filterChipSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  filterText: { color: COLORS.textLight, fontSize: 12, fontWeight: "700" },
  filterTextSelected: { color: COLORS.white },
  loadingBox: { alignItems: "center", paddingVertical: 45 },
  loadingText: { marginTop: 10, color: COLORS.textLight },
  errorBox: {
    padding: 13,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(122, 16, 18, 0.22)",
    borderRadius: 10,
    backgroundColor: "rgba(122, 16, 18, 0.08)",
  },
  errorText: { color: "#7A1012", fontSize: 13, lineHeight: 19 },
  retryButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 9,
    borderWidth: 1,
    borderColor: "#7A1012",
    borderRadius: 8,
  },
  retryText: { color: "#7A1012", fontSize: 12, fontWeight: "800" },
  emptyCard: {
    alignItems: "center",
    padding: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.white,
  },
  emptyTitle: { marginTop: 10, color: COLORS.text, fontSize: 16, fontWeight: "800" },
  emptyText: { marginTop: 6, color: COLORS.textLight, fontSize: 13, lineHeight: 19, textAlign: "center" },
  withdrawalCard: {
    padding: 15,
    marginBottom: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.white,
  },
  cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  amount: { flexShrink: 1, color: COLORS.primary, fontSize: 18, fontWeight: "900" },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: "800" },
  bankText: { marginTop: 9, color: COLORS.text, fontSize: 13, fontWeight: "700" },
  dateRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginTop: 7 },
  dateLabel: { color: COLORS.textLight, fontSize: 12 },
  dateValue: { flex: 1, color: COLORS.text, fontSize: 12, textAlign: "right" },
  rejectReason: { marginTop: 9, color: "#7A1012", fontSize: 12, lineHeight: 18 },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  detailText: { color: COLORS.primary, fontSize: 12, fontWeight: "700" },
  paginationRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 7 },
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
