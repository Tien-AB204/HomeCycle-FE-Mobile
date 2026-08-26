import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Header from "../../src/components/shared/Header";
import { COLORS } from "../../src/constants/theme";
import apiClient from "../../src/services/apis/axiosClient";
import {
  getApiErrorMessage,
  getApiSuccessMessage,
} from "../../src/utils/apiFeedback";

type FeedbackState = {
  type: "error" | "success" | "info";
  text: string;
} | null;

const agreementApi = {
  getAgreementById: (agreementId: string) =>
    apiClient
      .get(`/agreements/${agreementId}`)
      .then((response) => response.data),
};

const paymentApi = {
  checkoutWithPayOS: (
    agreementId: string,
    payload: { returnUrl: string; cancelUrl: string },
  ) =>
    apiClient
      .post(`/payments/payos/checkout/${agreementId}`, payload)
      .then((response) => response.data),

  checkoutWithWallet: (agreementId: string) =>
    apiClient
      .post(`/payments/wallet/checkout/${agreementId}`)
      .then((response) => response.data),
};

const walletApi = {
  getMyWallet: () =>
    apiClient.get("/wallet/me").then((response) => response.data),
};

const unwrap = (value: any) => value?.data ?? value;

function InlineFeedback({ feedback }: { feedback: FeedbackState }) {
  if (!feedback) return null;

  const palette =
    feedback.type === "error"
      ? {
          backgroundColor: "rgba(122, 16, 18, 0.08)",
          borderColor: "rgba(122, 16, 18, 0.22)",
          color: "#7A1012",
          icon: "alert-circle-outline" as const,
        }
      : feedback.type === "success"
        ? {
            backgroundColor: "rgba(47, 118, 93, 0.10)",
            borderColor: "rgba(47, 118, 93, 0.24)",
            color: "#2F765D",
            icon: "checkmark-circle-outline" as const,
          }
        : {
            backgroundColor: "rgba(84, 123, 125, 0.10)",
            borderColor: "rgba(84, 123, 125, 0.24)",
            color: "#2B5659",
            icon: "information-circle-outline" as const,
          };

  return (
    <View
      style={[
        styles.inlineFeedback,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
        },
      ]}
    >
      <Ionicons name={palette.icon} size={18} color={palette.color} />
      <Text style={[styles.inlineFeedbackText, { color: palette.color }]}>
        {feedback.text}
      </Text>
    </View>
  );
}

export default function CheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const agreementId = Array.isArray(params.agreementId)
    ? params.agreementId[0]
    : params.agreementId;

  const [agreement, setAgreement] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [walletLoadError, setWalletLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaymentCompleted, setIsPaymentCompleted] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "payos">(
    "wallet",
  );
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const clearFeedback = useCallback(() => setFeedback(null), []);
  const showError = useCallback(
    (text: string) => setFeedback({ type: "error", text }),
    [],
  );
  const showInfo = useCallback(
    (text: string) => setFeedback({ type: "info", text }),
    [],
  );
  const showSuccess = useCallback(
    (text: string) => setFeedback({ type: "success", text }),
    [],
  );

  const fetchCheckoutData = useCallback(async () => {
    if (!agreementId) {
      setAgreement(null);
      setWallet(null);
      setIsLoading(false);
      showError("Không tìm thấy mã hợp đồng cần thanh toán.");
      return;
    }

    try {
      setIsLoading(true);
      clearFeedback();
      setWalletLoadError("");

      const [agreementResult, walletResult] = await Promise.allSettled([
        agreementApi.getAgreementById(agreementId),
        walletApi.getMyWallet(),
      ]);

      if (agreementResult.status === "rejected") {
        throw agreementResult.reason;
      }

      setAgreement(unwrap(agreementResult.value));

      if (walletResult.status === "fulfilled") {
        setWallet(unwrap(walletResult.value));
      } else {
        setWallet(null);
        setWalletLoadError("Không tải được số dư ví lúc này.");
      }
    } catch (error: unknown) {
      console.error("Lỗi lấy thông tin thanh toán:", error);
      setAgreement(null);
      showError(
        getApiErrorMessage(error, "Không thể tải thông tin thanh toán."),
      );
    } finally {
      setIsLoading(false);
    }
  }, [agreementId, clearFeedback, showError]);

  useFocusEffect(
    useCallback(() => {
      void fetchCheckoutData();
    }, [fetchCheckoutData]),
  );

  const finalPrice = Number(agreement?.finalPrice || 0);
  const isDeposit = agreement?.paymentType === "Deposit";
  const amountToPay = isDeposit ? finalPrice * 0.2 : finalPrice;
  const platformFee = 0;
  const totalPayment = amountToPay + platformFee;

  const availableBalance = Number(
    wallet?.availableBalance ?? wallet?.AvailableBalance ?? 0,
  );
  const hasWalletData = wallet !== null;
  const walletHasEnoughBalance =
    hasWalletData && availableBalance >= totalPayment;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(value);

  const openPayOSCheckout = async (checkoutUrl: string) => {
    if (Platform.OS === "web") {
      const openedWindow = window.open(checkoutUrl, "_self");
      if (!openedWindow) {
        throw new Error(
          "Trình duyệt đã chặn trang thanh toán. Vui lòng cho phép mở cửa sổ mới và thử lại.",
        );
      }
      return;
    }

    const result = await WebBrowser.openBrowserAsync(checkoutUrl);

    if (result.type === "cancel") {
      setIsProcessing(false);
      showInfo("Bạn đã đóng trang thanh toán.");
    }
  };

  const handlePaymentSubmit = async () => {
    if (!agreementId) {
      showError("Không tìm thấy mã hợp đồng cần thanh toán.");
      return;
    }

    if (isPaymentCompleted) return;

    if (paymentMethod === "wallet") {
      if (!hasWalletData) {
        showError(
          walletLoadError ||
            "Chưa tải được số dư ví. Vui lòng thử lại hoặc chọn PayOS.",
        );
        return;
      }

      if (!walletHasEnoughBalance) {
        showError(
          `Số dư ví khả dụng chỉ còn ${formatCurrency(availableBalance)}, không đủ để thanh toán ${formatCurrency(totalPayment)}.`,
        );
        return;
      }
    }

    clearFeedback();

    try {
      setIsProcessing(true);

      const checkRes = await agreementApi.getAgreementById(agreementId);
      const latestData = unwrap(checkRes);
      const latestStatus = String(latestData?.agreementStatus ?? "")
        .replace(/[\s_-]/g, "")
        .toLowerCase();

      if (latestStatus !== "awaitingpayment" && latestStatus !== "accepted") {
        showError(
          "Giao dịch bị gián đoạn: đối tác vừa cập nhật hoặc hủy hợp đồng. Vui lòng quay lại kiểm tra.",
        );
        setIsProcessing(false);
        return;
      }

      if (paymentMethod === "wallet") {
        const response = await paymentApi.checkoutWithWallet(agreementId);
        setIsPaymentCompleted(true);
        showSuccess(
          getApiSuccessMessage(response, "Thanh toán qua ví thành công."),
        );
        await fetchCheckoutData();
        return;
      }

      const returnUrl =
        Platform.OS === "web"
          ? `${window.location.origin}/payments/success?agreementId=${agreementId}`
          : Linking.createURL("/payments/success", {
              queryParams: { agreementId },
            });

      const cancelUrl =
        Platform.OS === "web"
          ? `${window.location.origin}/payments/success?agreementId=${agreementId}&cancel=true`
          : Linking.createURL("/payments/success", {
              queryParams: { agreementId, cancel: "true" },
            });

      const response = await paymentApi.checkoutWithPayOS(agreementId, {
        returnUrl,
        cancelUrl,
      });

      const checkoutUrl = response?.data?.checkoutUrl || response?.checkoutUrl;

      if (!checkoutUrl) {
        throw new Error("Không nhận được link thanh toán từ hệ thống.");
      }

      showInfo("Đang mở trang thanh toán PayOS...");
      await openPayOSCheckout(checkoutUrl);
    } catch (error: unknown) {
      console.error("Lỗi thanh toán:", error);
      showError(getApiErrorMessage(error, "Giao dịch thất bại."));
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Thanh toán" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!agreement) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Thanh toán" showBack={true} />
        <View style={styles.emptyContainer}>
          <Ionicons name="card-outline" size={48} color={COLORS.textLight} />
          <Text style={styles.emptyTitle}>
            Chưa tải được thông tin thanh toán
          </Text>
          <InlineFeedback feedback={feedback} />
          {agreementId ? (
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => void fetchCheckoutData()}
            >
              <Text style={styles.retryBtnText}>Thử lại</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Thanh toán" showBack={true} />
      <View style={styles.container}>
        <View style={styles.invoiceCard}>
          <Text style={styles.sectionTitle}>Tổng hóa đơn</Text>
          <View style={styles.row}>
            <Text style={styles.label}>
              {isDeposit ? "Tiền cọc (20%):" : "Thanh toán toàn phần:"}
            </Text>
            <Text style={styles.value}>{formatCurrency(amountToPay)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Phí nền tảng:</Text>
            <Text style={styles.value}>{formatCurrency(platformFee)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.totalLabel}>Tổng thanh toán:</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(totalPayment)}
            </Text>
          </View>
        </View>

        <Text style={styles.paymentMethodsTitle}>Phương thức thanh toán</Text>

        <TouchableOpacity
          style={[
            styles.methodCard,
            paymentMethod === "wallet" && styles.methodCardActive,
          ]}
          onPress={() => {
            clearFeedback();
            setPaymentMethod("wallet");
          }}
          activeOpacity={0.8}
          disabled={isProcessing || isPaymentCompleted}
        >
          <View
            style={[
              styles.methodIconBox,
              paymentMethod === "wallet" && styles.methodIconBoxActive,
            ]}
          >
            <Ionicons
              name="wallet"
              size={24}
              color={
                paymentMethod === "wallet" ? COLORS.white : COLORS.textLight
              }
            />
          </View>
          <View style={styles.methodInfo}>
            <Text style={styles.methodTitle}>Ví HomeCycle</Text>
            <Text
              style={[
                styles.methodSubtitle,
                hasWalletData && !walletHasEnoughBalance
                  ? styles.insufficientBalanceText
                  : undefined,
              ]}
            >
              {hasWalletData
                ? `Số dư khả dụng: ${formatCurrency(availableBalance)}`
                : walletLoadError || "Đang cập nhật số dư..."}
            </Text>
          </View>
          <View
            style={[
              styles.radioCircle,
              paymentMethod === "wallet" && styles.radioCircleActive,
            ]}
          >
            {paymentMethod === "wallet" ? (
              <View style={styles.radioInner} />
            ) : null}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.methodCard,
            paymentMethod === "payos" && styles.methodCardActive,
          ]}
          onPress={() => {
            clearFeedback();
            setPaymentMethod("payos");
          }}
          activeOpacity={0.8}
          disabled={isProcessing || isPaymentCompleted}
        >
          <View
            style={[
              styles.methodIconBox,
              paymentMethod === "payos" && styles.methodIconBoxActive,
            ]}
          >
            <Ionicons
              name="qr-code-outline"
              size={24}
              color={
                paymentMethod === "payos" ? COLORS.white : COLORS.textLight
              }
            />
          </View>
          <View style={styles.methodInfo}>
            <Text style={styles.methodTitle}>PayOS</Text>
            <Text style={styles.methodSubtitle}>
              Chuyển khoản ngân hàng / Mã QR
            </Text>
          </View>
          <View
            style={[
              styles.radioCircle,
              paymentMethod === "payos" && styles.radioCircleActive,
            ]}
          >
            {paymentMethod === "payos" ? (
              <View style={styles.radioInner} />
            ) : null}
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomBar}>
        <InlineFeedback feedback={feedback} />
        <TouchableOpacity
          style={[
            styles.submitBtn,
            (isProcessing || isPaymentCompleted) && styles.disabledBtn,
          ]}
          onPress={() => void handlePaymentSubmit()}
          disabled={isProcessing || isPaymentCompleted}
        >
          {isProcessing ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.submitBtnText}>
              {isPaymentCompleted
                ? "Thanh toán thành công"
                : `Thanh toán ${formatCurrency(totalPayment)}`}
            </Text>
          )}
        </TouchableOpacity>
        {isPaymentCompleted ? (
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Quay lại</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { flex: 1, padding: 16 },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
    marginTop: 12,
    textAlign: "center",
  },
  retryBtn: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 22,
    paddingVertical: 12,
    marginTop: 12,
  },
  retryBtnText: { color: COLORS.white, fontWeight: "700" },
  invoiceCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 16,
  },
  paymentMethodsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.text,
    marginTop: 24,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  label: { fontSize: 14, color: COLORS.textLight },
  value: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  totalLabel: { fontSize: 16, fontWeight: "bold", color: COLORS.text },
  totalValue: { fontSize: 20, fontWeight: "bold", color: COLORS.primary },
  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  methodCardActive: { borderColor: COLORS.primary, backgroundColor: "rgba(84, 123, 125, 0.10)" },
  methodIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#F8F9FA",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  methodIconBoxActive: { backgroundColor: COLORS.primary },
  methodInfo: { flex: 1 },
  methodTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 4,
  },
  methodSubtitle: { fontSize: 13, color: COLORS.textLight },
  insufficientBalanceText: { color: "#9A6418" },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  radioCircleActive: { borderColor: COLORS.primary },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
  bottomBar: {
    padding: 16,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 10,
  },
  inlineFeedback: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  inlineFeedbackText: { flex: 1, fontSize: 13, lineHeight: 18 },
  submitBtn: {
    backgroundColor: COLORS.primary,
    height: 54,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  disabledBtn: { opacity: 0.7 },
  submitBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "bold" },
  backBtn: {
    alignItems: "center",
    borderColor: COLORS.primary,
    borderRadius: 12,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
  },
  backBtnText: { color: COLORS.primary, fontSize: 15, fontWeight: "700" },
});
