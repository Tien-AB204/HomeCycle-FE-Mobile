import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import Header from "../src/components/shared/Header";
import { COLORS } from "../src/constants/theme";
import { useAuth } from "../src/contexts/AuthContext";
import apiClient from "../src/services/apis/axiosClient";

const PAGE_SIZE = 10;
const REFERENCE_TYPE_WITHDRAWAL = 4;

const walletApi = {
  getMyWallet: () => apiClient.get("/wallet/me").then((response) => response.data),

  getLedger: (pageNumber: number) =>
    apiClient
      .get("/wallet/me/ledger", {
        params: {
          PageNumber: pageNumber,
          PageSize: PAGE_SIZE,
        },
      })
      .then((response) => response.data),

  createWithdrawal: (amount: number) =>
    apiClient
      .post("/wallet/withdrawals", { amount })
      .then((response) => response.data),

  syncWithdrawal: (withdrawalId: string) =>
    apiClient
      .post(`/wallet/withdrawals/${withdrawalId}/sync`)
      .then((response) => response.data),
};

type InlineMessage = {
  type: "error" | "success" | "warning" | "info";
  text: string;
} | null;

type WalletLedgerItem = {
  ledgerId?: string;
  createdAt?: string;
  direction?: number | string;
  balanceType?: number | string;
  amount?: number;
  balanceBefore?: number;
  balanceAfter?: number;
  description?: string;
  transactionType?: number | string | null;
  referenceType?: number | string | null;
  referenceId?: string | null;
};

const unwrap = (value: any) => value?.data ?? value;

const getErrorCode = (error: any) =>
  String(
    error?.response?.data?.code ||
      error?.response?.data?.error?.code ||
      error?.response?.data?.error?.Code ||
      error?.code ||
      "",
  );

const getErrorMessage = (error: any, fallback: string) =>
  String(
    error?.response?.data?.message ||
      error?.response?.data?.error?.message ||
      error?.response?.data?.error?.Message ||
      fallback,
  );

const formatCurrency = (value: unknown) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDateTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const normalizeEnum = (value: unknown) => String(value ?? "").trim().toLowerCase();

const isDirectionIn = (value: unknown) => {
  const normalized = normalizeEnum(value);
  return normalized === "0" || normalized === "in";
};

const getBalanceTypeLabel = (value: unknown) => {
  const normalized = normalizeEnum(value);
  return normalized === "1" || normalized === "hold" ? "Tiền đang giữ" : "Số dư khả dụng";
};

const isWithdrawalReference = (value: unknown) => {
  const normalized = normalizeEnum(value);
  return normalized === String(REFERENCE_TYPE_WITHDRAWAL) || normalized === "withdrawal";
};

export default function WalletScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [wallet, setWallet] = useState<any>(null);
  const [ledger, setLedger] = useState<WalletLedgerItem[]>([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [syncingWithdrawalId, setSyncingWithdrawalId] = useState<string | null>(null);
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [message, setMessage] = useState<InlineMessage>(null);
  const [latestWithdrawalId, setLatestWithdrawalId] = useState<string | null>(null);

  const isBusiness = String(user?.role || "").toLowerCase() === "business";
  const availableBalance = Number(wallet?.availableBalance ?? wallet?.AvailableBalance ?? 0);
  const holdBalance = Number(wallet?.holdBalance ?? wallet?.HoldBalance ?? 0);

  const loadWallet = useCallback(async () => {
    const response = await walletApi.getMyWallet();
    setWallet(unwrap(response));
  }, []);

  const loadLedger = useCallback(async (page: number) => {
    const response = await walletApi.getLedger(page);
    const data = unwrap(response);
    const items = data?.items || data?.data?.items || [];

    setLedger(Array.isArray(items) ? items : []);
    setPageNumber(Number(data?.pageNumber || page));
    setTotalPages(Math.max(1, Number(data?.totalPages || 1)));
    setTotalCount(Number(data?.totalCount || 0));
  }, []);

  const loadPage = useCallback(
    async (page: number, refreshing = false) => {
      try {
        if (refreshing) setIsRefreshing(true);
        else setIsLoading(true);

        setMessage(null);
        await Promise.all([loadWallet(), loadLedger(page)]);
      } catch (error) {
        setMessage({
          type: "error",
          text: getErrorMessage(error, "Không thể tải thông tin ví lúc này."),
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [loadLedger, loadWallet],
  );

  useFocusEffect(
    useCallback(() => {
      void loadPage(1);
    }, [loadPage]),
  );

  const parsedWithdrawalAmount = useMemo(
    () => Number(withdrawalAmount.replace(/[^0-9]/g, "")),
    [withdrawalAmount],
  );

  const validateWithdrawal = () => {
    setAmountError(null);
    setMessage(null);

    if (isBusiness) {
      setMessage({
        type: "warning",
        text: "Backend hiện đang xử lý yêu cầu rút tiền bằng ví Personal. Tạm thời chưa cho phép tài khoản Doanh nghiệp gửi yêu cầu rút để tránh thao tác sai ví.",
      });
      return false;
    }

    if (!Number.isInteger(parsedWithdrawalAmount) || parsedWithdrawalAmount <= 0) {
      setAmountError("Số tiền rút phải là số nguyên lớn hơn 0.");
      return false;
    }

    if (parsedWithdrawalAmount > availableBalance) {
      setAmountError("Số tiền rút vượt quá số dư khả dụng.");
      return false;
    }

    return true;
  };

  const createWithdrawal = async () => {
    if (!validateWithdrawal()) return;

    try {
      setIsWithdrawing(true);
      setMessage(null);

      const response = await walletApi.createWithdrawal(parsedWithdrawalAmount);
      const data = unwrap(response);
      const withdrawalId = String(
        data?.withdrawalId || response?.withdrawalId || "",
      ).trim();

      setLatestWithdrawalId(withdrawalId || null);
      setWithdrawalAmount("");
      setMessage({
        type: "success",
        text: withdrawalId
          ? `Đã tạo yêu cầu rút tiền. Mã yêu cầu: ${withdrawalId}`
          : "Đã tạo yêu cầu rút tiền.",
      });

      await Promise.all([loadWallet(), loadLedger(1)]);
    } catch (error: any) {
      const code = getErrorCode(error);
      const fallback =
        code === "Withdrawal.BankAccountNotVerified"
          ? "Tài khoản ngân hàng chưa được xác thực nên chưa thể rút tiền."
          : code === "Wallet.InsufficientBalance"
            ? "Số dư khả dụng không đủ để rút số tiền này."
            : code === "Withdrawal.InvalidRequest"
              ? "Số tiền rút chưa hợp lệ."
              : "Không thể tạo yêu cầu rút tiền lúc này.";

      setMessage({ type: "error", text: getErrorMessage(error, fallback) });
    } finally {
      setIsWithdrawing(false);
    }
  };

  const syncWithdrawal = async (withdrawalId: string) => {
    if (!withdrawalId) return;

    try {
      setSyncingWithdrawalId(withdrawalId);
      setMessage(null);
      await walletApi.syncWithdrawal(withdrawalId);
      setMessage({
        type: "success",
        text: "Đã đồng bộ trạng thái yêu cầu rút tiền.",
      });
      await Promise.all([loadWallet(), loadLedger(pageNumber)]);
    } catch (error) {
      setMessage({
        type: "error",
        text: getErrorMessage(error, "Không thể đồng bộ trạng thái rút tiền."),
      });
    } finally {
      setSyncingWithdrawalId(null);
    }
  };

  if (isLoading && !wallet) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Ví HomeCycle" showBack />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải thông tin ví...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Ví HomeCycle" showBack />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadPage(pageNumber, true)}
          />
        }
      >
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <View>
              <Text style={styles.balanceLabel}>Số dư khả dụng</Text>
              <Text style={styles.balanceValue}>{formatCurrency(availableBalance)}</Text>
            </View>
            <View style={styles.walletIconWrap}>
              <Ionicons name="wallet-outline" size={28} color={COLORS.primary} />
            </View>
          </View>
          <View style={styles.holdRow}>
            <Text style={styles.holdLabel}>Đang giữ</Text>
            <Text style={styles.holdValue}>{formatCurrency(holdBalance)}</Text>
          </View>
        </View>

        {message ? (
          <View
            style={[
              styles.messageBox,
              message.type === "error"
                ? styles.messageError
                : message.type === "success"
                  ? styles.messageSuccess
                  : message.type === "warning"
                    ? styles.messageWarning
                    : styles.messageInfo,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                message.type === "error"
                  ? styles.messageErrorText
                  : message.type === "success"
                    ? styles.messageSuccessText
                    : message.type === "warning"
                      ? styles.messageWarningText
                      : styles.messageInfoText,
              ]}
            >
              {message.text}
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Rút tiền</Text>
          <Text style={styles.helperText}>
            Tiền rút sẽ được khóa khỏi số dư khả dụng và chuyển sang trạng thái đang giữ trong lúc chờ xử lý.
          </Text>

          {isBusiness ? (
            <View style={styles.businessWarning}>
              <Ionicons name="warning-outline" size={18} color="#B45309" />
              <Text style={styles.businessWarningText}>
                Tạm khóa rút tiền cho Business vì backend hiện đang lấy nhầm ví Personal khi tạo withdrawal. Bạn vẫn có thể xem số dư và lịch sử ví.
              </Text>
            </View>
          ) : null}

          <Text style={styles.inputLabel}>Số tiền muốn rút *</Text>
          <TextInput
            style={[styles.amountInput, amountError ? styles.inputError : undefined]}
            value={withdrawalAmount}
            onChangeText={(value) => {
              setWithdrawalAmount(value.replace(/[^0-9]/g, ""));
              setAmountError(null);
              setMessage(null);
            }}
            keyboardType="number-pad"
            placeholder="VD: 100000"
            placeholderTextColor={COLORS.textLight}
            editable={!isBusiness && !isWithdrawing}
          />
          {amountError ? <Text style={styles.fieldError}>{amountError}</Text> : null}

          {withdrawalAmount ? (
            <Text style={styles.amountPreview}>
              Sẽ yêu cầu rút: {formatCurrency(parsedWithdrawalAmount)}
            </Text>
          ) : null}

          <TouchableOpacity
            style={[
              styles.primaryButton,
              (isWithdrawing || isBusiness) ? styles.disabledButton : undefined,
            ]}
            disabled={isWithdrawing || isBusiness}
            onPress={() => void createWithdrawal()}
          >
            {isWithdrawing ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="arrow-up-circle-outline" size={20} color={COLORS.white} />
                <Text style={styles.primaryButtonText}>GỬI YÊU CẦU RÚT TIỀN</Text>
              </>
            )}
          </TouchableOpacity>

          {latestWithdrawalId ? (
            <TouchableOpacity
              style={styles.syncLatestButton}
              disabled={syncingWithdrawalId === latestWithdrawalId}
              onPress={() => void syncWithdrawal(latestWithdrawalId)}
            >
              {syncingWithdrawalId === latestWithdrawalId ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : (
                <Ionicons name="sync-outline" size={18} color={COLORS.primary} />
              )}
              <Text style={styles.syncLatestText}>Đồng bộ yêu cầu vừa tạo</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Biến động ví</Text>
              <Text style={styles.countText}>{totalCount} giao dịch ledger</Text>
            </View>
            <TouchableOpacity style={styles.refreshButton} onPress={() => void loadPage(pageNumber, true)}>
              <Ionicons name="refresh" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {ledger.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="receipt-outline" size={32} color={COLORS.textLight} />
              <Text style={styles.emptyTitle}>Chưa có biến động ví</Text>
              <Text style={styles.emptyText}>Các khoản cộng, trừ hoặc tiền đang giữ sẽ xuất hiện tại đây.</Text>
            </View>
          ) : (
            ledger.map((item, index) => {
              const incoming = isDirectionIn(item.direction);
              const withdrawalReference =
                isWithdrawalReference(item.referenceType) && Boolean(item.referenceId);
              const referenceId = String(item.referenceId || "");

              return (
                <View
                  key={item.ledgerId || `${item.createdAt}-${index}`}
                  style={[
                    styles.ledgerItem,
                    index === ledger.length - 1 ? styles.lastLedgerItem : undefined,
                  ]}
                >
                  <View style={[styles.directionIcon, incoming ? styles.directionIn : styles.directionOut]}>
                    <Ionicons
                      name={incoming ? "arrow-down" : "arrow-up"}
                      size={18}
                      color={incoming ? "#047857" : "#B91C1C"}
                    />
                  </View>

                  <View style={styles.ledgerContent}>
                    <View style={styles.ledgerTopRow}>
                      <Text style={styles.ledgerDescription} numberOfLines={2}>
                        {item.description || "Biến động số dư"}
                      </Text>
                      <Text style={[styles.ledgerAmount, incoming ? styles.amountIn : styles.amountOut]}>
                        {incoming ? "+" : "-"}{formatCurrency(item.amount)}
                      </Text>
                    </View>
                    <Text style={styles.ledgerMeta}>
                      {getBalanceTypeLabel(item.balanceType)} · {formatDateTime(item.createdAt)}
                    </Text>
                    <Text style={styles.balanceAfterText}>
                      {formatCurrency(item.balanceBefore)} → {formatCurrency(item.balanceAfter)}
                    </Text>

                    {withdrawalReference ? (
                      <TouchableOpacity
                        style={styles.syncRowButton}
                        disabled={syncingWithdrawalId === referenceId}
                        onPress={() => void syncWithdrawal(referenceId)}
                      >
                        {syncingWithdrawalId === referenceId ? (
                          <ActivityIndicator size="small" color={COLORS.primary} />
                        ) : (
                          <Ionicons name="sync-outline" size={16} color={COLORS.primary} />
                        )}
                        <Text style={styles.syncRowText}>Đồng bộ trạng thái rút tiền</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}

          {totalPages > 1 ? (
            <View style={styles.paginationRow}>
              <TouchableOpacity
                style={[styles.pageButton, pageNumber <= 1 ? styles.disabledButton : undefined]}
                disabled={pageNumber <= 1}
                onPress={() => void loadPage(pageNumber - 1)}
              >
                <Ionicons name="chevron-back" size={18} color={COLORS.primary} />
                <Text style={styles.pageButtonText}>Trước</Text>
              </TouchableOpacity>

              <Text style={styles.pageText}>Trang {pageNumber}/{totalPages}</Text>

              <TouchableOpacity
                style={[styles.pageButton, pageNumber >= totalPages ? styles.disabledButton : undefined]}
                disabled={pageNumber >= totalPages}
                onPress={() => void loadPage(pageNumber + 1)}
              >
                <Text style={styles.pageButtonText}>Sau</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <TouchableOpacity style={styles.paymentHistoryButton} onPress={() => router.push("/payments/history" as any)}>
          <Ionicons name="receipt-outline" size={19} color={COLORS.primary} />
          <Text style={styles.paymentHistoryText}>Xem lịch sử thanh toán</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  loadingText: { marginTop: 10, color: COLORS.textLight },
  scrollContent: { padding: 16, paddingBottom: 40 },
  balanceCard: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  balanceHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  balanceLabel: { color: "#047857", fontSize: 13, fontWeight: "700" },
  balanceValue: { color: "#065F46", fontSize: 28, fontWeight: "900", marginTop: 5 },
  walletIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
  },
  holdRow: {
    marginTop: 15,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#A7F3D0",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  holdLabel: { color: "#047857", fontSize: 12 },
  holdValue: { color: "#065F46", fontSize: 13, fontWeight: "800" },
  card: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardTitle: { color: COLORS.text, fontSize: 17, fontWeight: "800", marginBottom: 6 },
  countText: { color: COLORS.textLight, fontSize: 11 },
  helperText: { color: COLORS.textLight, fontSize: 12, lineHeight: 18, marginBottom: 14 },
  businessWarning: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#FDE68A",
    backgroundColor: "#FFFBEB",
    borderRadius: 10,
    padding: 11,
    marginBottom: 14,
  },
  businessWarningText: { flex: 1, color: "#92400E", fontSize: 12, lineHeight: 17 },
  inputLabel: { color: COLORS.text, fontSize: 13, fontWeight: "700", marginBottom: 7 },
  amountInput: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    color: COLORS.text,
    fontSize: 15,
  },
  inputError: { borderColor: COLORS.error },
  fieldError: { color: COLORS.error, fontSize: 12, marginTop: 6 },
  amountPreview: { color: COLORS.primary, fontSize: 12, fontWeight: "700", marginTop: 8 },
  primaryButton: {
    minHeight: 50,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
  },
  primaryButtonText: { color: COLORS.white, fontWeight: "900", fontSize: 13 },
  disabledButton: { opacity: 0.45 },
  syncLatestButton: {
    minHeight: 44,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  syncLatestText: { color: COLORS.primary, fontWeight: "800", fontSize: 12 },
  messageBox: { borderWidth: 1, borderRadius: 10, padding: 11, marginBottom: 14 },
  messageText: { fontSize: 12, lineHeight: 18 },
  messageError: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  messageErrorText: { color: "#B91C1C" },
  messageSuccess: { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
  messageSuccessText: { color: "#047857" },
  messageWarning: { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" },
  messageWarningText: { color: "#92400E" },
  messageInfo: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
  messageInfoText: { color: "#1D4ED8" },
  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBox: { alignItems: "center", paddingVertical: 28 },
  emptyTitle: { color: COLORS.text, fontWeight: "700", marginTop: 9 },
  emptyText: { color: COLORS.textLight, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 5 },
  ledgerItem: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  lastLedgerItem: { borderBottomWidth: 0 },
  directionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  directionIn: { backgroundColor: "#ECFDF5" },
  directionOut: { backgroundColor: "#FEF2F2" },
  ledgerContent: { flex: 1 },
  ledgerTopRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  ledgerDescription: { flex: 1, color: COLORS.text, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  ledgerAmount: { fontSize: 13, fontWeight: "900" },
  amountIn: { color: "#047857" },
  amountOut: { color: "#B91C1C" },
  ledgerMeta: { color: COLORS.textLight, fontSize: 11, marginTop: 5 },
  balanceAfterText: { color: COLORS.textLight, fontSize: 10, marginTop: 3 },
  syncRowButton: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 9, alignSelf: "flex-start" },
  syncRowText: { color: COLORS.primary, fontSize: 11, fontWeight: "700" },
  paginationRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14 },
  pageButton: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 9,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pageButtonText: { color: COLORS.primary, fontWeight: "700", fontSize: 12 },
  pageText: { color: COLORS.textLight, fontSize: 12 },
  paymentHistoryButton: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  paymentHistoryText: { flex: 1, color: COLORS.primary, fontWeight: "800", fontSize: 13 },
});
