import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useChatRealtime } from "../src/contexts/ChatRealtimeContext";
import apiClient from "../src/services/apis/axiosClient";
import { getMyWithdrawalQuota, WithdrawalQuota } from "../src/services/apis/withdrawalApi";
import { getApiErrorMessage } from "../src/utils/apiFeedback";
import { NETWORK_ERROR_MESSAGE, readSafeApiMessage } from "../src/utils/errorMessage";
import { useAutoDismissFeedback } from "../src/utils/useAutoDismissFeedback";
import { useGuardedRouter } from "../src/utils/tapGuard";

const PAGE_SIZE = 10;

const walletApi = {
  getMyWallet: () => apiClient.get("/wallet/me").then((response) => response.data),

  // Lịch sử ví là WalletTransaction (mỗi giao dịch một dòng); ledger chỉ là bút toán kế toán.
  getTransactions: (pageNumber: number) =>
    apiClient
      .get("/wallet/me/transactions", {
        params: {
          PageNumber: pageNumber,
          PageSize: PAGE_SIZE,
        },
      })
      .then((response) => response.data),

  getTransactionDetail: (walletTransactionId: string) =>
    apiClient
      .get(`/wallet/me/transactions/${walletTransactionId}`)
      .then((response) => response.data),

  // Tiền đơn hàng nền tảng đang giữ (Order_Escrow) cho người bán; không suy ra từ holdBalance.
  getPendingSettlements: () =>
    apiClient.get("/wallet/me/pending-settlements").then((response) => response.data),

  createWithdrawal: (amount: number) =>
    apiClient
      .post("/wallet/withdrawals", { amount })
      .then((response) => response.data),
};

type InlineMessage = {
  type: "error" | "success" | "warning" | "info";
  text: string;
} | null;

type WalletTransactionItem = {
  walletTransactionId?: string;
  paymentId?: string | null;
  paymentMethod?: number | string | null;
  transactionType?: number | string | null;
  referenceType?: number | string | null;
  referenceId?: string | null;
  referenceCode?: string | null;
  amount?: number;
  status?: number | string | null;
  createdAt?: string;
  description?: string;
};

type BalanceImpact = {
  ledgerId?: string;
  direction?: number | string;
  balanceType?: number | string;
  amount?: number;
  balanceBefore?: number;
  balanceAfter?: number;
  description?: string;
};

type PendingSettlementItem = {
  orderId?: string;
  orderCode?: string;
  productName?: string | null;
  amount?: number;
  orderStatus?: number | string | null;
  updatedAt?: string;
};

type PendingSettlements = {
  totalPendingAmount: number;
  items: PendingSettlementItem[];
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

// BE là source of truth cho các quy tắc hạn mức rút tiền động (min/max/hạn
// mức ngày); message BE trả đã có sẵn số tiền chính xác nên ưu tiên hiển
// thị nguyên văn thay vì tự soạn lại ở FE.
const getErrorMessageFromResponse = (error: any) =>
  readSafeApiMessage(error?.response?.data) || "";

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
  return normalized === "1" || normalized === "hold" ? "Đang chờ rút" : "Số dư khả dụng";
};

// TransactionType của BE (chuỗi hoặc số). Chiều tiền xét theo ví người dùng.
const TRANSACTION_TYPES: Record<string, { label: string; flow: "in" | "out" | "lock" | "none" }> = {
  escrow_deposit: { label: "Thanh toán đơn hàng (PayOS)", flow: "none" },
  wallet_payment: { label: "Thanh toán đơn hàng bằng ví", flow: "out" },
  payout_release: { label: "Nhận tiền bán hàng", flow: "in" },
  order_refund: { label: "Hoàn tiền đơn hàng", flow: "in" },
  withdrawal_lock: { label: "Khóa tiền chờ rút", flow: "lock" },
  withdrawal_success: { label: "Rút tiền thành công", flow: "out" },
  withdrawal_revert: { label: "Hoàn lại tiền rút", flow: "in" },
  commission_fee: { label: "Phí hoa hồng", flow: "out" },
  subscription_fee: { label: "Thanh toán gói dịch vụ", flow: "out" },
  shipping_fee_collected: { label: "Thu phí vận chuyển", flow: "none" },
};
const TRANSACTION_TYPE_BY_NUMBER: Record<string, string> = {
  "1": "escrow_deposit",
  "2": "wallet_payment",
  "3": "payout_release",
  "4": "order_refund",
  "5": "withdrawal_lock",
  "6": "withdrawal_success",
  "7": "withdrawal_revert",
  "8": "commission_fee",
  "9": "subscription_fee",
  "10": "shipping_fee_collected",
};

const getTransactionTypeInfo = (value: unknown) => {
  const normalized = normalizeEnum(value);
  const key = TRANSACTION_TYPE_BY_NUMBER[normalized] ?? normalized;
  return TRANSACTION_TYPES[key] ?? { label: "", flow: "none" as const };
};

const getTransactionStatusLabel = (value: unknown) => {
  switch (normalizeEnum(value)) {
    case "0":
    case "pending":
      return "Đang xử lý";
    case "2":
    case "failed":
      return "Thất bại";
    case "3":
    case "cancelled":
      return "Đã hủy";
    default:
      return "";
  }
};

const getOrderStatusLabel = (value: unknown) => {
  switch (normalizeEnum(value)) {
    case "0":
    case "pending":
      return "Chờ xử lý";
    case "4":
    case "disputing":
      return "Đang tranh chấp";
    case "5":
    case "returned":
      return "Đã trả hàng";
    case "1":
    case "processing":
      return "Đang xử lý";
    case "2":
    case "completed":
      return "Hoàn tất";
    case "3":
    case "cancelled":
      return "Đã hủy";
    default:
      return "";
  }
};

export default function WalletScreen() {
  const router = useGuardedRouter();
  const { user } = useAuth();

  const { connection, reconnectVersion } = useChatRealtime();
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<WalletTransactionItem[]>([]);
  const [expandedTransactionId, setExpandedTransactionId] = useState<string | null>(null);
  const [transactionImpacts, setTransactionImpacts] = useState<Record<string, BalanceImpact[]>>({});
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [pendingSettlements, setPendingSettlements] = useState<PendingSettlements | null>(null);
  const [isPendingExpanded, setIsPendingExpanded] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const pageNumberRef = useRef(1);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const withdrawalInFlightRef = useRef(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [message, setMessage] = useState<InlineMessage>(null);
  useAutoDismissFeedback(message, () => setMessage(null));
  const [quota, setQuota] = useState<WithdrawalQuota | null>(null);

  const isBusiness = String(user?.role || "").toLowerCase() === "business";
  const availableBalance = Number(wallet?.availableBalance ?? wallet?.AvailableBalance ?? 0);
  const holdBalance = Number(wallet?.holdBalance ?? wallet?.HoldBalance ?? 0);

  const loadWallet = useCallback(async () => {
    const response = await walletApi.getMyWallet();
    setWallet(unwrap(response));
  }, []);

  const loadQuota = useCallback(async () => {
    try {
      const response = await getMyWithdrawalQuota();
      setQuota(unwrap(response));
    } catch {
      // Hạn mức là thông tin tham khảo hiển thị thêm; nếu tải thất bại vẫn
      // để BE là nơi xác thực cuối cùng khi submit, không chặn màn hình ví.
      setQuota(null);
    }
  }, []);

  const loadTransactions = useCallback(async (page: number) => {
    const response = await walletApi.getTransactions(page);
    const data = unwrap(response);
    const items = data?.items || data?.data?.items || [];
    const nextPage = Number(data?.pageNumber || page);

    setTransactions(Array.isArray(items) ? items : []);
    setExpandedTransactionId(null);
    setPageNumber(nextPage);
    pageNumberRef.current = nextPage;
    setTotalPages(Math.max(1, Number(data?.totalPages || 1)));
    setTotalCount(Number(data?.totalCount || 0));
  }, []);

  const loadPendingSettlements = useCallback(async () => {
    try {
      const data = unwrap(await walletApi.getPendingSettlements());
      setPendingSettlements({
        totalPendingAmount: Number(data?.totalPendingAmount ?? 0),
        items: Array.isArray(data?.items) ? data.items : [],
      });
    } catch {
      // Phần tham khảo; lỗi không chặn màn hình ví.
      setPendingSettlements(null);
    }
  }, []);

  const toggleTransactionDetail = async (walletTransactionId: string) => {
    if (expandedTransactionId === walletTransactionId) {
      setExpandedTransactionId(null);
      return;
    }
    setExpandedTransactionId(walletTransactionId);
    if (transactionImpacts[walletTransactionId]) return;
    try {
      setLoadingDetailId(walletTransactionId);
      const data = unwrap(await walletApi.getTransactionDetail(walletTransactionId));
      setTransactionImpacts((current) => ({
        ...current,
        [walletTransactionId]: Array.isArray(data?.balanceImpacts) ? data.balanceImpacts : [],
      }));
    } catch (error) {
      setMessage({
        type: "error",
        text: getApiErrorMessage(error, "Không thể tải chi tiết giao dịch."),
      });
      setExpandedTransactionId(null);
    } finally {
      setLoadingDetailId(null);
    }
  };

  const loadPage = useCallback(
    async (page: number, refreshing = false) => {
      try {
        if (refreshing) setIsRefreshing(true);
        else setIsLoading(true);

        setMessage(null);
        await Promise.all([
          loadWallet(),
          loadTransactions(page),
          loadQuota(),
          loadPendingSettlements(),
        ]);
      } catch (error) {
        setMessage({
          type: "error",
          text: getApiErrorMessage(error, NETWORK_ERROR_MESSAGE),
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [loadPendingSettlements, loadQuota, loadTransactions, loadWallet],
  );

  useFocusEffect(
    useCallback(() => {
      void loadPage(1);
    }, [loadPage]),
  );

  // FinanceUpdated chỉ là tín hiệu làm mới: payload có thể rỗng (vd. người bán khi bên mua vừa
  // thanh toán) nên luôn tải lại thay vì đọc nội dung sự kiện.
  useEffect(() => {
    if (!connection) return;
    const handleFinanceUpdated = () => {
      void Promise.all([
        loadWallet(),
        loadTransactions(pageNumberRef.current),
        loadQuota(),
        loadPendingSettlements(),
      ]).catch(() => undefined);
    };
    connection.on("FinanceUpdated", handleFinanceUpdated);
    return () => {
      connection.off("FinanceUpdated", handleFinanceUpdated);
    };
  }, [connection, loadPendingSettlements, loadQuota, loadTransactions, loadWallet]);

  useEffect(() => {
    if (reconnectVersion > 0) void loadPage(pageNumberRef.current, true);
  }, [loadPage, reconnectVersion]);

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
        text: "Tài khoản doanh nghiệp hiện chưa hỗ trợ yêu cầu rút tiền. Vui lòng thử lại khi tính năng này được mở.",
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

    // Kiểm tra sơ bộ theo hạn mức động từ BE để UX phản hồi sớm; BE vẫn là
    // nơi xác thực cuối cùng khi submit thật (không thay thế validation BE).
    if (quota) {
      if (parsedWithdrawalAmount < quota.minimumWithdrawalAmount) {
        setAmountError(
          `Số tiền rút tối thiểu là ${formatCurrency(quota.minimumWithdrawalAmount)}.`,
        );
        return false;
      }

      if (parsedWithdrawalAmount > quota.maximumWithdrawalAmount) {
        setAmountError(
          `Số tiền rút tối đa mỗi lần là ${formatCurrency(quota.maximumWithdrawalAmount)}.`,
        );
        return false;
      }

      if (
        typeof quota.remainingDailyWithdrawalCount === "number" &&
        quota.remainingDailyWithdrawalCount <= 0
      ) {
        setAmountError(
          `Bạn đã sử dụng hết ${quota.dailyWithdrawalCountLimit ?? quota.usedDailyWithdrawalCount ?? 0} lượt rút tiền trong ngày.`,
        );
        return false;
      }

      // null = không giới hạn theo ngày (VIP); chỉ chặn khi Backend có hạn mức số.
      if (
        typeof quota.remainingDailyLimitAmount === "number" &&
        parsedWithdrawalAmount > quota.remainingDailyLimitAmount
      ) {
        setAmountError(
          `Hạn mức rút còn lại hôm nay là ${formatCurrency(quota.remainingDailyLimitAmount)}.`,
        );
        return false;
      }
    }

    return true;
  };

  const createWithdrawal = async () => {
    if (withdrawalInFlightRef.current || !validateWithdrawal()) return;

    withdrawalInFlightRef.current = true;

    try {
      setIsWithdrawing(true);
      setMessage(null);

      const response = await walletApi.createWithdrawal(parsedWithdrawalAmount);
      const data = unwrap(response);
      const withdrawalId = String(
        data?.withdrawalId || response?.withdrawalId || "",
      ).trim();

      setWithdrawalAmount("");
      setMessage({
        type: "success",
        text: withdrawalId
          ? `Đã tạo yêu cầu rút tiền. Mã yêu cầu: ${withdrawalId}`
          : "Đã tạo yêu cầu rút tiền.",
      });

      await Promise.all([loadWallet(), loadTransactions(1), loadQuota()]);
    } catch (error: any) {
      const code = getErrorCode(error);
      const messageByCode: Record<string, string> = {
        "Withdrawal.BankAccountNotVerified":
          "Tài khoản ngân hàng chưa được xác thực nên chưa thể rút tiền.",
        "Wallet.InsufficientBalance":
          "Số dư khả dụng không đủ để rút số tiền này.",
        "Withdrawal.InvalidRequest":
          "Số tiền rút chưa hợp lệ.",
        "Withdrawal.DailyCountLimitExceeded":
          "Bạn đã sử dụng hết số lượt rút tiền trong ngày.",
      };

      if (code === "Withdrawal.DailyCountLimitExceeded") {
        // Đồng bộ lại hạn mức để số lượt còn lại phản ánh đúng trạng thái máy chủ.
        void loadQuota();
      }

      setMessage({
        type: "error",
        // Ưu tiên thông điệp BE; bảng mã lỗi chỉ là dự phòng.
        text:
          getErrorMessageFromResponse(error) ||
          messageByCode[code] ||
          getApiErrorMessage(error, NETWORK_ERROR_MESSAGE),
      });
    } finally {
      withdrawalInFlightRef.current = false;
      setIsWithdrawing(false);
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
          {/* holdBalance chỉ là tiền khóa của yêu cầu rút; tiền đơn hàng nằm ở mục chờ nhận bên dưới. */}
          <View style={styles.holdRow}>
            <Text style={styles.holdLabel}>Đang chờ rút</Text>
            <Text style={styles.holdValue}>{formatCurrency(holdBalance)}</Text>
          </View>
        </View>

        {pendingSettlements &&
        (pendingSettlements.totalPendingAmount > 0 || pendingSettlements.items.length > 0) ? (
          <View style={styles.card}>
            {/* Mặc định thu gọn: chỉ hiện tổng và số đơn; chạm để xem danh sách. */}
            <TouchableOpacity
              style={styles.pendingHeader}
              activeOpacity={0.7}
              onPress={() => setIsPendingExpanded((value) => !value)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isPendingExpanded }}
            >
              <View style={styles.ledgerContent}>
                <Text style={styles.cardTitle}>Tiền chờ nhận từ đơn hàng</Text>
                <Text style={styles.pendingTotal}>
                  {formatCurrency(pendingSettlements.totalPendingAmount)}
                </Text>
                <Text style={styles.countText}>
                  {pendingSettlements.items.length} đơn ·{" "}
                  {isPendingExpanded ? "Thu gọn" : "Xem chi tiết"}
                </Text>
              </View>
              <Ionicons
                name={isPendingExpanded ? "chevron-up" : "chevron-down"}
                size={20}
                color={COLORS.primary}
              />
            </TouchableOpacity>
            {isPendingExpanded ? (
              <Text style={[styles.helperText, styles.pendingHelper]}>
                HomeCycle đang giữ khoản tiền này cho các đơn bạn bán. Tiền được chuyển vào số dư khả dụng sau khi đơn hoàn tất và hết thời hạn khiếu nại.
              </Text>
            ) : null}
            {isPendingExpanded && pendingSettlements.items.map((item, index) => (
              <TouchableOpacity
                key={item.orderId || `${item.orderCode}-${index}`}
                style={[
                  styles.pendingItem,
                  index === pendingSettlements.items.length - 1 ? styles.lastLedgerItem : undefined,
                ]}
                disabled={!item.orderId}
                onPress={() => router.push(`/orders/${item.orderId}` as any)}
              >
                <View style={styles.ledgerContent}>
                  <Text style={styles.ledgerDescription} numberOfLines={1}>
                    {item.productName || "Đơn hàng"}
                  </Text>
                  <Text style={styles.ledgerMeta}>
                    {[item.orderCode, getOrderStatusLabel(item.orderStatus)].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                <Text style={styles.pendingAmount}>{formatCurrency(item.amount)}</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

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
            Tiền rút sẽ được khóa khỏi số dư khả dụng và chuyển sang mục đang chờ rút trong lúc chờ xử lý.
          </Text>

          {quota ? (
            <View style={styles.quotaBox}>
              <View style={styles.quotaRow}>
                <Text style={styles.quotaLabel}>Tối thiểu</Text>
                <Text style={styles.quotaValue}>{formatCurrency(quota.minimumWithdrawalAmount)}</Text>
              </View>
              <View style={styles.quotaRow}>
                <Text style={styles.quotaLabel}>Tối đa mỗi lần</Text>
                <Text style={styles.quotaValue}>{formatCurrency(quota.maximumWithdrawalAmount)}</Text>
              </View>
              <View style={[styles.quotaRow, styles.quotaRowLast]}>
                <Text style={styles.quotaLabel}>Đã sử dụng hạn mức ngày</Text>
                <Text style={styles.quotaValue}>
                  {formatCurrency(quota.usedDailyLimitAmount)} /{" "}
                  {typeof quota.dailyWithdrawalLimit === "number"
                    ? formatCurrency(quota.dailyWithdrawalLimit)
                    : "Không giới hạn"}
                </Text>
              </View>
              <Text style={styles.quotaRemainingText}>
                {typeof quota.remainingDailyLimitAmount === "number"
                  ? `Còn lại hôm nay: ${formatCurrency(quota.remainingDailyLimitAmount)}`
                  : "Hạn mức tổng tiền trong ngày: Không giới hạn"}
              </Text>
              {typeof quota.dailyWithdrawalCountLimit === "number" ? (
                <View style={[styles.quotaRow, styles.quotaRowTop]}>
                  <Text style={styles.quotaLabel}>Lượt rút trong ngày</Text>
                  <Text
                    style={[
                      styles.quotaValue,
                      (quota.remainingDailyWithdrawalCount ?? 0) <= 0
                        ? styles.quotaValueExhausted
                        : undefined,
                    ]}
                  >
                    {quota.usedDailyWithdrawalCount ?? 0} / {quota.dailyWithdrawalCountLimit}
                    {" · "}còn {Math.max(quota.remainingDailyWithdrawalCount ?? 0, 0)} lượt
                  </Text>
                </View>
              ) : (
                <View style={[styles.quotaRow, styles.quotaRowTop]}>
                  <Text style={styles.quotaLabel}>Lượt rút trong ngày</Text>
                  <Text style={styles.quotaValue}>Không giới hạn</Text>
                </View>
              )}
            </View>
          ) : null}

          {isBusiness ? (
            <View style={styles.businessWarning}>
              <Ionicons name="warning-outline" size={18} color="#9A6418" />
              <Text style={styles.businessWarningText}>
                Tài khoản doanh nghiệp hiện chưa hỗ trợ gửi yêu cầu rút tiền. Bạn vẫn có thể xem số dư và lịch sử ví.
              </Text>
            </View>
          ) : null}

          <Text style={styles.inputLabel}>Số tiền muốn rút <Text style={{ color: COLORS.error }}>*</Text></Text>
          <TextInput
            style={[styles.amountInput, amountError ? styles.inputError : undefined]}
            value={withdrawalAmount}
            onChangeText={(value) => {
              setWithdrawalAmount(value.replace(/[^0-9]/g, ""));
              setAmountError(null);
              setMessage(null);
            }}
            keyboardType="number-pad"
            placeholder={
              quota ? `Tối thiểu ${formatCurrency(quota.minimumWithdrawalAmount)}` : "VD: 100000"
            }
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
        </View>

        <TouchableOpacity
          style={styles.withdrawalHistoryButton}
          onPress={() => router.push("/wallet/withdrawals" as any)}
        >
          <Ionicons name="cash-outline" size={20} color={COLORS.primary} />
          <View style={styles.historyButtonContent}>
            <Text style={styles.withdrawalHistoryTitle}>Lịch sử rút tiền</Text>
            <Text style={styles.withdrawalHistoryText}>
              Xem trạng thái và chi tiết các yêu cầu của bạn
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={19} color={COLORS.primary} />
        </TouchableOpacity>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            {/* Mặc định thu gọn: chỉ hiện số giao dịch; chạm tiêu đề để xem danh sách. */}
            <TouchableOpacity
              style={styles.historyHeaderToggle}
              activeOpacity={0.7}
              onPress={() => setIsHistoryExpanded((value) => !value)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isHistoryExpanded }}
            >
              <View style={styles.ledgerContent}>
                <Text style={styles.cardTitle}>Lịch sử giao dịch ví</Text>
                <Text style={styles.countText}>
                  {totalCount} giao dịch · {isHistoryExpanded ? "Thu gọn" : "Xem chi tiết"}
                </Text>
              </View>
              <Ionicons
                name={isHistoryExpanded ? "chevron-up" : "chevron-down"}
                size={20}
                color={COLORS.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.refreshButton} onPress={() => void loadPage(pageNumber, true)}>
              <Ionicons name="refresh" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {!isHistoryExpanded ? null : transactions.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="receipt-outline" size={32} color={COLORS.textLight} />
              <Text style={styles.emptyTitle}>Chưa có giao dịch</Text>
              <Text style={styles.emptyText}>Các khoản cộng, trừ hoặc khóa chờ rút sẽ xuất hiện tại đây.</Text>
            </View>
          ) : (
            transactions.map((item, index) => {
              const id = String(item.walletTransactionId || "");
              const typeInfo = getTransactionTypeInfo(item.transactionType);
              const amount = Math.abs(Number(item.amount || 0));
              const statusLabel = getTransactionStatusLabel(item.status);
              const isExpanded = Boolean(id) && expandedTransactionId === id;
              const impacts = id ? transactionImpacts[id] : undefined;
              // Loại không cộng/trừ vào ví của mình (vd. chuyển tiền đơn cũ sang Order_Escrow): dùng mô tả BE.
              const title =
                typeInfo.flow === "none"
                  ? item.description || typeInfo.label || "Giao dịch ví"
                  : typeInfo.label || item.description || "Giao dịch ví";
              const showDescriptionInDetail = Boolean(item.description) && title !== item.description;

              return (
                <View
                  key={id || `${item.createdAt}-${index}`}
                  style={[
                    styles.ledgerItemWrap,
                    index === transactions.length - 1 ? styles.lastLedgerItem : undefined,
                  ]}
                >
                  <TouchableOpacity
                    style={styles.ledgerItem}
                    disabled={!id}
                    onPress={() => void toggleTransactionDetail(id)}
                  >
                    <View style={styles.ledgerContent}>
                      <View style={styles.ledgerTopRow}>
                        <Text style={styles.ledgerDescription} numberOfLines={2}>
                          {title}
                        </Text>
                        <Text
                          style={[
                            styles.ledgerAmount,
                            typeInfo.flow === "in"
                              ? styles.amountIn
                              : typeInfo.flow === "out"
                                ? styles.amountOut
                                : styles.amountNeutral,
                          ]}
                        >
                          {typeInfo.flow === "in" ? "+" : typeInfo.flow === "out" ? "-" : ""}
                          {formatCurrency(amount)}
                        </Text>
                      </View>
                      <Text style={styles.ledgerMeta}>
                        {[item.referenceCode, statusLabel, formatDateTime(item.createdAt)].filter(Boolean).join(" · ")}
                      </Text>
                    </View>
                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={COLORS.textLight}
                    />
                  </TouchableOpacity>

                  {isExpanded ? (
                    <View style={styles.impactBox}>
                      {showDescriptionInDetail ? (
                        <Text style={styles.impactDescription}>{item.description}</Text>
                      ) : null}
                      {loadingDetailId === id ? (
                        <ActivityIndicator size="small" color={COLORS.primary} />
                      ) : impacts && impacts.length > 0 ? (
                        impacts.map((impact, impactIndex) => {
                          const incoming = isDirectionIn(impact.direction);
                          return (
                            <View key={impact.ledgerId || impactIndex} style={styles.impactRow}>
                              <Text style={styles.impactLabel}>{getBalanceTypeLabel(impact.balanceType)}</Text>
                              <View style={styles.impactValues}>
                                <Text style={[styles.impactAmount, incoming ? styles.amountIn : styles.amountOut]}>
                                  {incoming ? "+" : "-"}{formatCurrency(impact.amount)}
                                </Text>
                                <Text style={styles.balanceAfterText}>
                                  {formatCurrency(impact.balanceBefore)} → {formatCurrency(impact.balanceAfter)}
                                </Text>
                              </View>
                            </View>
                          );
                        })
                      ) : (
                        <Text style={styles.balanceAfterText}>Giao dịch này không làm thay đổi số dư ví của bạn.</Text>
                      )}
                    </View>
                  ) : null}
                </View>
              );
            })
          )}

          {isHistoryExpanded && totalPages > 1 ? (
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
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  loadingText: { marginTop: 10, color: COLORS.textLight },
  scrollContent: { padding: 16, paddingBottom: 40 },
  balanceCard: {
    backgroundColor: "rgba(47, 118, 93, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(47, 118, 93, 0.24)",
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  balanceHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  balanceLabel: { color: "#2F765D", fontSize: 13, fontWeight: "700" },
  balanceValue: { color: "#2F765D", fontSize: 28, fontWeight: "900", marginTop: 5 },
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
    borderTopColor: "rgba(47, 118, 93, 0.24)",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  holdLabel: { color: "#2F765D", fontSize: 12 },
  holdValue: { color: "#2F765D", fontSize: 13, fontWeight: "800" },
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
    borderColor: "rgba(154, 100, 24, 0.24)",
    backgroundColor: "rgba(154, 100, 24, 0.10)",
    borderRadius: 10,
    padding: 11,
    marginBottom: 14,
  },
  businessWarningText: { flex: 1, color: "#9A6418", fontSize: 12, lineHeight: 17 },
  quotaBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    backgroundColor: "#F8F9FA",
  },
  quotaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  quotaRowLast: { borderBottomWidth: 0 },
  quotaRowTop: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border, borderBottomWidth: 0 },
  quotaValueExhausted: { color: COLORS.error },
  quotaLabel: { color: COLORS.textLight, fontSize: 12 },
  quotaValue: { color: COLORS.text, fontSize: 12, fontWeight: "700" },
  quotaRemainingText: {
    marginTop: 6,
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "800",
  },
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
  withdrawalHistoryButton: {
    minHeight: 64,
    marginBottom: 14,
    paddingHorizontal: 15,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 12,
    backgroundColor: COLORS.white,
  },
  historyButtonContent: { flex: 1 },
  withdrawalHistoryTitle: { color: COLORS.primary, fontSize: 14, fontWeight: "800" },
  withdrawalHistoryText: { marginTop: 3, color: COLORS.textLight, fontSize: 11, lineHeight: 16 },
  messageBox: { borderWidth: 1, borderRadius: 10, padding: 11, marginBottom: 14 },
  messageText: { fontSize: 12, lineHeight: 18 },
  messageError: { backgroundColor: "rgba(122, 16, 18, 0.08)", borderColor: "rgba(122, 16, 18, 0.22)" },
  messageErrorText: { color: "#7A1012" },
  messageSuccess: { backgroundColor: "rgba(47, 118, 93, 0.10)", borderColor: "rgba(47, 118, 93, 0.24)" },
  messageSuccessText: { color: "#2F765D" },
  messageWarning: { backgroundColor: "rgba(154, 100, 24, 0.10)", borderColor: "rgba(154, 100, 24, 0.24)" },
  messageWarningText: { color: "#9A6418" },
  messageInfo: { backgroundColor: "rgba(84, 123, 125, 0.10)", borderColor: "rgba(84, 123, 125, 0.24)" },
  messageInfoText: { color: "#2B5659" },
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
  ledgerItemWrap: {
    borderBottomWidth: 1,
    borderBottomColor: "#BAC2C1",
  },
  ledgerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 13,
  },
  lastLedgerItem: { borderBottomWidth: 0 },
  amountNeutral: { color: COLORS.textLight },
  impactBox: {
    marginLeft: 0,
    marginBottom: 12,
    padding: 10,
    gap: 8,
    borderRadius: 10,
    backgroundColor: "#F8F9FA",
  },
  impactDescription: { color: COLORS.text, fontSize: 12, lineHeight: 17 },
  impactRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  impactLabel: { color: COLORS.textLight, fontSize: 12 },
  impactValues: { alignItems: "flex-end" },
  impactAmount: { fontSize: 12, fontWeight: "800" },
  pendingTotal: { color: COLORS.primary, fontSize: 22, fontWeight: "900", marginBottom: 4 },
  pendingHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  historyHeaderToggle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, marginRight: 10 },
  pendingHelper: { marginTop: 10, marginBottom: 4 },
  pendingItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#BAC2C1",
  },
  pendingAmount: { color: COLORS.text, fontSize: 13, fontWeight: "800" },
  ledgerContent: { flex: 1 },
  ledgerTopRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  ledgerDescription: { flex: 1, color: COLORS.text, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  ledgerAmount: { fontSize: 13, fontWeight: "900" },
  amountIn: { color: "#2F765D" },
  amountOut: { color: "#7A1012" },
  ledgerMeta: { color: COLORS.textLight, fontSize: 11, marginTop: 5 },
  balanceAfterText: { color: COLORS.textLight, fontSize: 10, marginTop: 3 },
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
