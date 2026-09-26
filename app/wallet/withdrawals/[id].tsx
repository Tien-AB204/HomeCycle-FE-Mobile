import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
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

import Header from "../../../src/components/shared/Header";
import SensitiveValue from "../../../src/components/shared/SensitiveValue";
import { COLORS } from "../../../src/constants/theme";
import {
  getMyWithdrawalDetail,
  WithdrawalDetail,
  WithdrawalFinancialEvent,
} from "../../../src/services/apis/withdrawalApi";
import { getApiErrorMessage } from "../../../src/utils/apiFeedback";

const unwrap = <T,>(value: { data?: T } | T): T =>
  (value as { data?: T })?.data ?? (value as T);

const getErrorCode = (error: any) =>
  String(
    error?.response?.data?.error?.code ??
      error?.response?.data?.code ??
      error?.error?.code ??
      error?.code ??
      "",
  ).trim();

const isNotFoundError = (error: any) =>
  Number(error?.response?.status || 0) === 404 ||
  getErrorCode(error).toLowerCase() === "withdrawal.notfound";

const getWithdrawalStatus = (value: unknown) => {
  switch (String(value ?? "").trim().toLowerCase()) {
    case "pending":
      return { label: "Đang chờ xử lý", color: "#9A6418", background: "rgba(154, 100, 24, 0.10)" };
    case "approved":
      return { label: "Đã duyệt", color: "#2B5659", background: "rgba(84, 123, 125, 0.10)" };
    case "processing":
      return { label: "Đang xử lý", color: "#2B5659", background: "rgba(84, 123, 125, 0.10)" };
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

const getBankVerificationLabel = (value: unknown) => {
  switch (String(value ?? "").trim().toLowerCase()) {
    case "unverified":
      return "Chưa xác thực";
    case "pending":
      return "Đang chờ xác thực";
    case "verified":
      return "Đã xác thực";
    case "rejected":
      return "Xác thực không thành công";
    default:
      return "Chưa rõ";
  }
};

const getFinancialEventLabel = (value: unknown) => {
  switch (String(value ?? "").trim().toLowerCase()) {
    case "withdrawal_lock":
      return "Tiền đã được giữ để chờ xử lý";
    case "withdrawal_success":
      return "Khoản rút đã hoàn tất";
    case "withdrawal_revert":
      return "Tiền đã được hoàn lại vào số dư khả dụng";
    default:
      return "Cập nhật số dư";
  }
};

const getTransactionStatus = (value: unknown) => {
  switch (String(value ?? "").trim().toLowerCase()) {
    case "pending":
      return { label: "Đang xử lý", color: "#9A6418" };
    case "completed":
      return { label: "Hoàn tất", color: "#2F765D" };
    case "failed":
      return { label: "Thất bại", color: "#7A1012" };
    case "cancelled":
      return { label: "Đã hủy", color: "#7A1012" };
    default:
      return { label: "Chưa rõ", color: COLORS.textLight };
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

export default function WithdrawalDetailScreen() {
  const params = useLocalSearchParams();
  const withdrawalId = Array.isArray(params.id) ? params.id[0] : params.id;
  const requestGeneration = useRef(0);
  const [withdrawal, setWithdrawal] = useState<WithdrawalDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const loadDetail = useCallback(async (refreshing = false) => {
    const generation = ++requestGeneration.current;
    if (!withdrawalId) {
      setWithdrawal(null);
      setErrorText("Không tìm thấy yêu cầu rút tiền này.");
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      if (refreshing) setIsRefreshing(true);
      else setIsLoading(true);
      setErrorText(null);

      const response = await getMyWithdrawalDetail(String(withdrawalId));
      if (requestGeneration.current !== generation) return;
      const detail = unwrap<WithdrawalDetail>(response);
      if (!detail?.withdrawalId) {
        // Kết quả isSuccess=false mang thông điệp BE; ném nguyên để hiển thị.
        throw (response as any)?.isSuccess === false
          ? response
          : new Error("Không thể đọc chi tiết rút tiền.");
      }
      setWithdrawal(detail);
    } catch (error) {
      if (requestGeneration.current !== generation) return;
      setWithdrawal(null);
      setErrorText(
        isNotFoundError(error)
          ? getApiErrorMessage(error, "Không tìm thấy yêu cầu rút tiền này.")
          : getApiErrorMessage(error, "Không thể tải chi tiết rút tiền lúc này."),
      );
    } finally {
      if (requestGeneration.current === generation) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [withdrawalId]);

  useFocusEffect(
    useCallback(() => {
      void loadDetail();
      return () => {
        requestGeneration.current += 1;
      };
    }, [loadDetail]),
  );

  const status = getWithdrawalStatus(withdrawal?.status);
  const isWithdrawalCompleted =
    String(withdrawal?.status ?? "").trim().toLowerCase() === "completed";
  const bank = withdrawal?.bankAccount;
  const events = Array.isArray(withdrawal?.financialEvents)
    ? withdrawal.financialEvents
    : [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Chi tiết rút tiền" showBack />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải chi tiết...</Text>
        </View>
      ) : errorText ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={44} color={COLORS.error} />
          <Text style={styles.errorText}>{errorText}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void loadDetail()}>
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : withdrawal ? (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void loadDetail(true)}
              colors={[COLORS.primary]}
            />
          }
        >
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>Số tiền rút</Text>
            <Text style={styles.amount}>{formatCurrency(withdrawal.amount)}</Text>
            <View style={[styles.statusBadge, { backgroundColor: status.background }]}>
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
            {isWithdrawalCompleted ? (
              <Text style={styles.completedHint}>
                Yêu cầu rút tiền đã được xử lý hoàn tất trên hệ thống.
              </Text>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Thông tin yêu cầu</Text>
            <DetailRow label="Thời gian yêu cầu" value={formatDateTime(withdrawal.requestedAt)} />
            {withdrawal.processedAt ? (
              <DetailRow label="Thời gian xử lý" value={formatDateTime(withdrawal.processedAt)} />
            ) : null}
            {withdrawal.rejectReason ? (
              <View style={styles.reasonBox}>
                <Text style={styles.reasonLabel}>Lý do</Text>
                <Text style={styles.reasonText}>{withdrawal.rejectReason}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Tài khoản ngân hàng</Text>
            <DetailRow label="Ngân hàng" value={bank?.bankName || "Chưa có"} />
            <DetailRow label="Chủ tài khoản" value={bank?.accountName || "Chưa có"} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Số tài khoản</Text>
              <SensitiveValue
                value={bank?.accountNumber}
                fallback="Chưa có"
                containerStyle={styles.sensitiveValue}
                textStyle={styles.detailValue}
              />
            </View>
            <DetailRow
              label="Xác thực"
              value={getBankVerificationLabel(bank?.verifyStatus)}
              last
            />
          </View>

          {events.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Tiến trình số dư</Text>
              {events.map((event, index) => (
                <FinancialEventRow
                  key={event.walletTransactionId || `${event.createdAt}-${index}`}
                  event={event}
                  last={index === events.length - 1}
                />
              ))}
            </View>
          ) : null}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

function DetailRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detailRow, last ? styles.lastRow : undefined]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function FinancialEventRow({ event, last }: { event: WithdrawalFinancialEvent; last: boolean }) {
  const status = getTransactionStatus(event.status);
  return (
    <View style={[styles.eventRow, last ? styles.lastEventRow : undefined]}>
      <View style={styles.timelineColumn}>
        <View style={styles.timelineDot} />
        {!last ? <View style={styles.timelineLine} /> : null}
      </View>
      <View style={styles.eventContent}>
        <Text style={styles.eventTitle}>{getFinancialEventLabel(event.transactionType)}</Text>
        <Text style={styles.eventAmount}>{formatCurrency(event.amount)}</Text>
        <View style={styles.eventMetaRow}>
          <Text style={[styles.eventStatus, { color: status.color }]}>{status.label}</Text>
          <Text style={styles.eventDate}>{formatDateTime(event.createdAt)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  loadingText: { marginTop: 10, color: COLORS.textLight },
  errorText: { marginTop: 10, maxWidth: 340, color: COLORS.error, fontSize: 14, lineHeight: 20, textAlign: "center" },
  retryButton: {
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 9,
  },
  retryText: { color: COLORS.primary, fontSize: 13, fontWeight: "800" },
  content: { padding: 16, paddingBottom: 40 },
  amountCard: {
    alignItems: "center",
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(47, 118, 93, 0.24)",
    borderRadius: 15,
    backgroundColor: "rgba(47, 118, 93, 0.10)",
  },
  amountLabel: { color: "#2F765D", fontSize: 13, fontWeight: "700" },
  amount: { marginTop: 6, color: "#2F765D", fontSize: 27, fontWeight: "900" },
  statusBadge: { paddingHorizontal: 11, paddingVertical: 6, marginTop: 12, borderRadius: 999 },
  statusText: { fontSize: 12, fontWeight: "800" },
  completedHint: {
    marginTop: 10,
    color: "#2F765D",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
  card: {
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.white,
  },
  sectionTitle: { marginBottom: 8, color: COLORS.text, fontSize: 16, fontWeight: "800" },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    minHeight: 45,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  lastRow: { borderBottomWidth: 0 },
  detailLabel: { color: COLORS.textLight, fontSize: 12 },
  detailValue: { flexShrink: 1, color: COLORS.text, fontSize: 13, fontWeight: "700", textAlign: "right" },
  sensitiveValue: { flex: 1, justifyContent: "flex-end" },
  reasonBox: { padding: 11, marginTop: 12, borderRadius: 9, backgroundColor: "rgba(122, 16, 18, 0.08)" },
  reasonLabel: { color: "#7A1012", fontSize: 11, fontWeight: "800" },
  reasonText: { marginTop: 4, color: "#7A1012", fontSize: 12, lineHeight: 18 },
  eventRow: { flexDirection: "row", minHeight: 86 },
  lastEventRow: { minHeight: 70 },
  timelineColumn: { width: 22, alignItems: "center" },
  timelineDot: { width: 10, height: 10, marginTop: 5, borderRadius: 5, backgroundColor: COLORS.primary },
  timelineLine: { flex: 1, width: 2, marginVertical: 4, backgroundColor: COLORS.border },
  eventContent: { flex: 1, paddingLeft: 8, paddingBottom: 16 },
  eventTitle: { color: COLORS.text, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  eventAmount: { marginTop: 4, color: COLORS.primary, fontSize: 13, fontWeight: "800" },
  eventMetaRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, marginTop: 6 },
  eventStatus: { fontSize: 11, fontWeight: "700" },
  eventDate: { flex: 1, color: COLORS.textLight, fontSize: 11, textAlign: "right" },
});
