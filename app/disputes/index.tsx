import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Header from "../../src/components/shared/Header";
import {
  ModalBackdrop,
  ModalSurface,
} from "../../src/components/shared/ModalBackdrop";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import apiClient from "../../src/services/apis/axiosClient";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 450;

type DisputeStatusValue =
  | "Pending"
  | "Resolved"
  | "Rejected"
  | "Closed"
  | "UnderReview"
  | "AwaitingReturn";

type DisputeCategoryValue =
  | "NoShow"
  | "ItemMismatch"
  | "SellerNotShipped"
  | "DamagedOrLost"
  | "ItemNotReceived"
  | "FraudOrScam"
  | "AbusiveReview"
  | "PaymentNotCompleted"
  | "CommitmentViolation"
  | "Other";

type DisputeTargetTypeValue = "Appointment" | "Order" | "Review";

type DisputeListItem = {
  disputeId: string;
  senderId: string;
  senderUsername: string;
  targetUserId?: string | null;
  targetUsername?: string | null;
  targetType?: number | string | null;
  targetId?: string | null;
  orderCode?: string | null;
  category?: number | string | null;
  status?: number | string | null;
  description?: string | null;
  resolutionOutcome?: number | string | null;
  returnDueAt?: string | null;
  createdAt: string;
};

const STATUS_FILTER_OPTIONS: { key: DisputeStatusValue | "all"; label: string }[] =
  [
    { key: "all", label: "Tất cả trạng thái" },
    { key: "Pending", label: "Đang chờ xử lý" },
    { key: "UnderReview", label: "Đang xem xét" },
    { key: "AwaitingReturn", label: "Đang chờ hoàn trả" },
    { key: "Resolved", label: "Đã giải quyết" },
    { key: "Rejected", label: "Đã từ chối" },
    { key: "Closed", label: "Đã đóng" },
  ];

const CATEGORY_FILTER_OPTIONS: {
  key: DisputeCategoryValue | "all";
  label: string;
}[] = [
  { key: "all", label: "Tất cả loại khiếu nại" },
  { key: "NoShow", label: "Không xuất hiện / bùng hẹn" },
  { key: "ItemMismatch", label: "Hàng hóa không đúng mô tả" },
  { key: "SellerNotShipped", label: "Người bán không giao hàng" },
  { key: "DamagedOrLost", label: "Hàng hóa hư hỏng hoặc thất lạc" },
  { key: "ItemNotReceived", label: "Không nhận được hàng" },
  { key: "FraudOrScam", label: "Gian lận / lừa đảo" },
  { key: "AbusiveReview", label: "Đánh giá có nội dung không phù hợp" },
  { key: "PaymentNotCompleted", label: "Không thanh toán theo thỏa thuận" },
  { key: "CommitmentViolation", label: "Vi phạm cam kết giao dịch" },
  { key: "Other", label: "Khác" },
];

const TARGET_TYPE_FILTER_OPTIONS: {
  key: DisputeTargetTypeValue | "all";
  label: string;
}[] = [
  { key: "all", label: "Tất cả đối tượng" },
  { key: "Appointment", label: "Lịch hẹn" },
  { key: "Order", label: "Đơn hàng" },
  { key: "Review", label: "Đánh giá" },
];

const normalizeKey = (value: unknown) =>
  String(value ?? "")
    .trim()
    .replace(/[\s_-]/g, "")
    .toLowerCase();

const statusLabels: Record<string, string> = {
  "0": "Đang chờ xử lý",
  pending: "Đang chờ xử lý",
  "1": "Đã giải quyết",
  resolved: "Đã giải quyết",
  "2": "Đã từ chối",
  rejected: "Đã từ chối",
  "3": "Đã đóng",
  closed: "Đã đóng",
  "4": "Đang xem xét",
  underreview: "Đang xem xét",
  "5": "Đang chờ hoàn trả",
  awaitingreturn: "Đang chờ hoàn trả",
};

const categoryLabels: Record<string, string> = {
  "1": "Không xuất hiện / bùng hẹn",
  noshow: "Không xuất hiện / bùng hẹn",
  "2": "Hàng hóa không đúng mô tả",
  itemmismatch: "Hàng hóa không đúng mô tả",
  "3": "Người bán không giao hàng",
  sellernotshipped: "Người bán không giao hàng",
  "4": "Hàng hóa hư hỏng hoặc thất lạc",
  damagedorlost: "Hàng hóa hư hỏng hoặc thất lạc",
  "5": "Không nhận được hàng",
  itemnotreceived: "Không nhận được hàng",
  "6": "Gian lận / lừa đảo",
  fraudorscam: "Gian lận / lừa đảo",
  "7": "Đánh giá có nội dung không phù hợp",
  abusivereview: "Đánh giá có nội dung không phù hợp",
  "8": "Không thanh toán theo thỏa thuận",
  paymentnotcompleted: "Không thanh toán theo thỏa thuận",
  "9": "Vi phạm cam kết giao dịch",
  commitmentviolation: "Vi phạm cam kết giao dịch",
  "99": "Khác",
  other: "Khác",
};

const targetTypeLabels: Record<string, string> = {
  "1": "Lịch hẹn",
  appointment: "Lịch hẹn",
  "2": "Đơn hàng",
  order: "Đơn hàng",
  "3": "Đánh giá",
  review: "Đánh giá",
};

const resolutionOutcomeLabels: Record<string, string> = {
  "1": "Có lợi cho người mua",
  buyerfavored: "Có lợi cho người mua",
  "2": "Có lợi cho người bán",
  sellerfavored: "Có lợi cho người bán",
};

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

export default function DisputeHistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const currentUserId = String(user?.userId || user?.id || "").toLowerCase();

  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");

  const [statusFilter, setStatusFilter] = useState<DisputeStatusValue | "all">(
    "all",
  );
  const [categoryFilter, setCategoryFilter] = useState<
    DisputeCategoryValue | "all"
  >("all");
  const [targetTypeFilter, setTargetTypeFilter] = useState<
    DisputeTargetTypeValue | "all"
  >("all");

  const [draftStatusFilter, setDraftStatusFilter] = useState<
    DisputeStatusValue | "all"
  >("all");
  const [draftCategoryFilter, setDraftCategoryFilter] = useState<
    DisputeCategoryValue | "all"
  >("all");
  const [draftTargetTypeFilter, setDraftTargetTypeFilter] = useState<
    DisputeTargetTypeValue | "all"
  >("all");
  const [showFilterModal, setShowFilterModal] = useState(false);

  const [items, setItems] = useState<DisputeListItem[]>([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const requestGenerationRef = useRef(0);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstFocusRef = useRef(true);

  const isFilterActive =
    statusFilter !== "all" || categoryFilter !== "all" || targetTypeFilter !== "all";

  const fetchList = useCallback(
    async (page: number, options?: { append?: boolean; silent?: boolean }) => {
      const generation = ++requestGenerationRef.current;
      const append = options?.append ?? false;
      const silent = options?.silent ?? false;

      if (append) {
        setIsLoadingMore(true);
      } else if (!silent) {
        setIsLoading(true);
      }
      setPageError(null);

      try {
        const response = await apiClient.get("/disputes", {
          params: {
            PageNumber: page,
            PageSize: PAGE_SIZE,
            Status: statusFilter === "all" ? undefined : statusFilter,
            Category: categoryFilter === "all" ? undefined : categoryFilter,
            TargetType:
              targetTypeFilter === "all" ? undefined : targetTypeFilter,
            Keyword: appliedKeyword || undefined,
          },
        });

        if (generation !== requestGenerationRef.current) return;

        const data = response.data?.data || response.data;
        const newItems: DisputeListItem[] = Array.isArray(data?.items)
          ? data.items
          : [];

        setPageNumber(Number(data?.pageNumber) || page);
        setHasNextPage(Boolean(data?.hasNextPage));

        setItems((current) => {
          if (!append) return newItems;
          const seen = new Set(current.map((entry) => entry.disputeId));
          return [
            ...current,
            ...newItems.filter((entry) => !seen.has(entry.disputeId)),
          ];
        });
      } catch (error) {
        if (generation !== requestGenerationRef.current) return;

        setPageError(
          getApiErrorMessage(
            error,
            "Không thể tải danh sách tranh chấp lúc này.",
          ),
        );
        if (!append) setItems([]);
      } finally {
        if (generation === requestGenerationRef.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
          setIsRefreshing(false);
        }
      }
    },
    [statusFilter, categoryFilter, targetTypeFilter, appliedKeyword],
  );

  React.useEffect(() => {
    void fetchList(1);
  }, [fetchList]);

  useFocusEffect(
    useCallback(() => {
      if (isFirstFocusRef.current) {
        isFirstFocusRef.current = false;
        return;
      }
      void fetchList(1);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchList]),
  );

  const handleKeywordChange = (text: string) => {
    setKeyword(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setAppliedKeyword(text.trim());
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    void fetchList(1, { silent: true });
  };

  const handleLoadMore = () => {
    if (isLoadingMore || !hasNextPage) return;
    void fetchList(pageNumber + 1, { append: true });
  };

  const openFilterModal = () => {
    setDraftStatusFilter(statusFilter);
    setDraftCategoryFilter(categoryFilter);
    setDraftTargetTypeFilter(targetTypeFilter);
    setShowFilterModal(true);
  };

  const closeFilterModal = () => setShowFilterModal(false);

  const handleResetFilter = () => {
    setDraftStatusFilter("all");
    setDraftCategoryFilter("all");
    setDraftTargetTypeFilter("all");
    setStatusFilter("all");
    setCategoryFilter("all");
    setTargetTypeFilter("all");
    setShowFilterModal(false);
  };

  const handleApplyFilter = () => {
    setStatusFilter(draftStatusFilter);
    setCategoryFilter(draftCategoryFilter);
    setTargetTypeFilter(draftTargetTypeFilter);
    setShowFilterModal(false);
  };

  const renderFilterGroup = <T extends string>(
    title: string,
    options: { key: T | "all"; label: string }[],
    draftValue: T | "all",
    onSelect: (value: T | "all") => void,
  ) => (
    <View style={styles.filterGroup}>
      <Text style={styles.filterGroupTitle}>{title}</Text>
      <View style={styles.filterOptionList}>
        {options.map((option) => {
          const selected = draftValue === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.filterOptionRow,
                selected ? styles.filterOptionRowActive : undefined,
              ]}
              onPress={() => onSelect(option.key)}
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
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Tranh chấp của tôi" showBack />

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={COLORS.textLight} />
          <TextInput
            value={keyword}
            onChangeText={handleKeywordChange}
            placeholder="Tìm theo mô tả, mã đơn, người dùng..."
            placeholderTextColor={COLORS.textLight}
            style={styles.searchInput}
          />
        </View>
        <TouchableOpacity
          style={styles.filterIconBtn}
          onPress={openFilterModal}
          hitSlop={8}
        >
          <Ionicons name="filter-outline" size={20} color={COLORS.text} />
          {isFilterActive ? <View style={styles.filterActiveDot} /> : null}
        </TouchableOpacity>
      </View>

      {pageError ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={18} color="#7A1012" />
          <Text style={styles.errorText}>{pageError}</Text>
          <TouchableOpacity onPress={() => void fetchList(1)} hitSlop={8}>
            <Text style={styles.retryInlineText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải danh sách tranh chấp...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        >
          {items.length === 0 ? (
            <Text style={styles.emptyText}>
              {appliedKeyword || isFilterActive
                ? "Không tìm thấy tranh chấp phù hợp."
                : "Bạn chưa có tranh chấp nào."}
            </Text>
          ) : (
            items.map((item) => {
              const isSender =
                String(item.senderId || "").toLowerCase() === currentUserId;
              const counterpartUsername = isSender
                ? item.targetUsername
                : item.senderUsername;
              const statusKey = normalizeKey(item.status);
              const categoryKey = normalizeKey(item.category);
              const targetTypeKey = normalizeKey(item.targetType);
              const outcomeKey = normalizeKey(item.resolutionOutcome);
              const statusLabel = statusLabels[statusKey] || "Chưa xác định";
              const categoryLabel =
                categoryLabels[categoryKey] || "Chưa xác định";
              const targetTypeLabel = targetTypeLabels[targetTypeKey] || null;
              const outcomeLabel = resolutionOutcomeLabels[outcomeKey] || null;

              return (
                <TouchableOpacity
                  key={item.disputeId}
                  style={styles.card}
                  activeOpacity={0.75}
                  onPress={() =>
                    router.push(`/disputes/${item.disputeId}` as any)
                  }
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.categoryText} numberOfLines={1}>
                      {categoryLabel}
                    </Text>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusBadgeText}>{statusLabel}</Text>
                    </View>
                  </View>

                  <Text style={styles.metaText}>
                    {[
                      targetTypeLabel,
                      item.orderCode ? `Mã đơn: ${item.orderCode}` : null,
                      counterpartUsername
                        ? isSender
                          ? `Gửi tới ${counterpartUsername}`
                          : `Từ ${counterpartUsername}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>

                  {item.description ? (
                    <Text style={styles.descriptionPreview} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}

                  {outcomeLabel ? (
                    <Text style={styles.outcomeText}>
                      Kết quả: {outcomeLabel}
                    </Text>
                  ) : null}

                  <View style={styles.cardFooter}>
                    <Text style={styles.timeText}>
                      {formatDateTime(item.createdAt)}
                    </Text>
                    {item.returnDueAt ? (
                      <Text style={styles.returnDueText}>
                        Hạn hoàn trả: {formatDateTime(item.returnDueAt)}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          {hasNextPage ? (
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={handleLoadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : (
                <Text style={styles.loadMoreText}>Xem thêm</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      )}

      <Modal
        visible={showFilterModal}
        transparent
        animationType="fade"
        onRequestClose={closeFilterModal}
      >
        <ModalBackdrop
          style={styles.filterModalBackdrop}
          onPress={closeFilterModal}
        >
          <ModalSurface style={styles.filterModalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.filterModalTitle}>Bộ lọc tranh chấp</Text>

              {renderFilterGroup(
                "Trạng thái",
                STATUS_FILTER_OPTIONS,
                draftStatusFilter,
                setDraftStatusFilter,
              )}
              {renderFilterGroup(
                "Loại khiếu nại",
                CATEGORY_FILTER_OPTIONS,
                draftCategoryFilter,
                setDraftCategoryFilter,
              )}
              {renderFilterGroup(
                "Đối tượng khiếu nại",
                TARGET_TYPE_FILTER_OPTIONS,
                draftTargetTypeFilter,
                setDraftTargetTypeFilter,
              )}
            </ScrollView>

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
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchBox: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#BAC2C1",
    borderRadius: 10,
    backgroundColor: "#F8F9FA",
  },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 14 },
  filterIconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  filterActiveDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 10,
    borderRadius: 9,
    backgroundColor: "rgba(122, 16, 18, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(122, 16, 18, 0.22)",
  },
  errorText: { flex: 1, color: "#7A1012", fontSize: 12, lineHeight: 17 },
  retryInlineText: { color: "#7A1012", fontSize: 12, fontWeight: "800" },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: { color: COLORS.textLight, fontSize: 13 },
  scrollContent: { padding: 16, paddingBottom: 36, gap: 12 },
  emptyText: {
    marginTop: 40,
    textAlign: "center",
    color: COLORS.textLight,
    fontSize: 13,
  },
  card: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 6,
  },
  categoryText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },
  statusBadge: {
    backgroundColor: "rgba(154, 100, 24, 0.10)",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusBadgeText: { color: "#9A6418", fontSize: 11, fontWeight: "800" },
  metaText: { color: COLORS.textLight, fontSize: 12, marginBottom: 6 },
  descriptionPreview: {
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
  },
  outcomeText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  timeText: { color: COLORS.textLight, fontSize: 11 },
  returnDueText: { color: "#9A6418", fontSize: 11, fontWeight: "700" },
  loadMoreButton: {
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
  },
  loadMoreText: { color: COLORS.primary, fontSize: 14, fontWeight: "800" },
  filterModalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  filterModalCard: {
    maxHeight: "80%",
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
  filterGroup: { marginBottom: 16 },
  filterGroupTitle: {
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  filterOptionList: { gap: 2 },
  filterOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 42,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  filterOptionRowActive: { backgroundColor: "rgba(43, 86, 89, 0.06)" },
  filterOptionText: { color: COLORS.text, fontSize: 14, fontWeight: "600" },
  filterOptionTextActive: { color: COLORS.primary, fontWeight: "800" },
  filterModalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
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
});
