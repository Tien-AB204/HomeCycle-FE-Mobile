import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
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
import {
  InlineFeedback,
  useActionFeedback,
} from "../../src/components/shared/ActionFeedback";
import Header from "../../src/components/shared/Header";
import { COLORS } from "../../src/constants/theme";
import apiClient from "../../src/services/apis/axiosClient";
import {
  getApiErrorMessage,
  getApiSuccessMessage,
} from "../../src/utils/apiFeedback";

const agreementApi = {
  getAgreementById: (agreementId: string) =>
    apiClient
      .get(`/agreements/${agreementId}`)
      .then((response) => response.data),
};

const paymentApi = {
  // Đã sửa API: Nhận thêm payload chứa returnUrl và cancelUrl
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

export default function CheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const agreementId = Array.isArray(params.agreementId)
    ? params.agreementId[0]
    : params.agreementId;

  const [agreement, setAgreement] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaymentCompleted, setIsPaymentCompleted] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "payos">(
    "wallet",
  );

  const { feedback, clearFeedback, showError, showInfo, showSuccess } =
    useActionFeedback();

  const fetchAgreementData = useCallback(async () => {
    if (!agreementId) {
      setAgreement(null);
      setIsLoading(false);
      showError("Không tìm thấy mã hợp đồng cần thanh toán.");
      return;
    }

    try {
      setIsLoading(true);
      clearFeedback();

      const response = await agreementApi.getAgreementById(agreementId);
      setAgreement(response?.data || response);
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
      void fetchAgreementData();
    }, [fetchAgreementData]),
  );

  const finalPrice = agreement?.finalPrice || 0;
  const isDeposit = agreement?.paymentType === "Deposit";

  const amountToPay = isDeposit ? finalPrice * 0.2 : finalPrice;
  const platformFee = 0;
  const totalPayment = amountToPay + platformFee;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value);

  const openPayOSCheckout = async (checkoutUrl: string) => {
    if (Platform.OS === "web") {
      const openedWindow = window.open(checkoutUrl, "_self"); // Dùng _self để chuyển hướng luôn, dễ quay lại
      if (!openedWindow) {
        throw new Error(
          "Trình duyệt đã chặn trang thanh toán. Vui lòng cho phép mở cửa sổ mới và thử lại.",
        );
      }
      return;
    }

    const canOpen = await Linking.canOpenURL(checkoutUrl);
    if (!canOpen) {
      throw new Error("Thiết bị không thể mở đường dẫn thanh toán PayOS.");
    }
    await Linking.openURL(checkoutUrl);
  };

  const handlePaymentSubmit = async () => {
    if (!agreementId) {
      showError("Không tìm thấy mã hợp đồng cần thanh toán.");
      return;
    }

    if (isPaymentCompleted) {
      return;
    }

    clearFeedback();

    try {
      setIsProcessing(true);

      if (paymentMethod === "wallet") {
        const response = await paymentApi.checkoutWithWallet(agreementId);
        setIsPaymentCompleted(true);
        showSuccess(
          getApiSuccessMessage(response, "Thanh toán qua ví thành công."),
        );
        return;
      }

      // TỰ ĐỘNG TẠO ĐƯỜNG DẪN TRẢ VỀ DỰA TRÊN MÔI TRƯỜNG (WEB HAY MOBILE)
      const returnUrl =
        Platform.OS === "web"
          ? `${window.location.origin}/payments/success?agreementId=${agreementId}`
          : Linking.createURL("/payments/success", {
              queryParams: { agreementId },
            });

      const cancelUrl =
        Platform.OS === "web"
          ? `${window.location.origin}/payments/cancel?agreementId=${agreementId}`
          : Linking.createURL("/payments/cancel", {
              queryParams: { agreementId },
            });

      const response = await paymentApi.checkoutWithPayOS(agreementId, {
        returnUrl,
        cancelUrl,
      });

      const checkoutUrl = response?.data?.checkoutUrl || response?.checkoutUrl;

      if (!checkoutUrl) {
        throw new Error("Không nhận được link thanh toán từ hệ thống.");
      }

      await openPayOSCheckout(checkoutUrl);

      showInfo(
        getApiSuccessMessage(
          response,
          "Đã chuyển sang trang thanh toán PayOS.",
        ),
      );
    } catch (error: unknown) {
      console.error("Lỗi thanh toán:", error);
      showError(getApiErrorMessage(error, "Giao dịch thất bại."));
    } finally {
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
          <InlineFeedback
            feedback={feedback}
            onDismiss={clearFeedback}
            style={styles.emptyFeedback}
          />
          {agreementId ? (
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => void fetchAgreementData()}
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

        <Text
          style={[styles.sectionTitle, { marginTop: 24, marginBottom: 12 }]}
        >
          Phương thức thanh toán
        </Text>

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
            <Text style={styles.methodSubtitle}>Số dư: Chưa có dữ liệu</Text>
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
        <InlineFeedback
          feedback={feedback}
          onDismiss={clearFeedback}
          style={styles.actionFeedback}
        />
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
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <Text style={styles.backBtnText}>Quay lại</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
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
  emptyFeedback: { marginBottom: 12, maxWidth: 420, width: "100%" },
  retryBtn: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 22,
    paddingVertical: 12,
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
  methodCardActive: { borderColor: COLORS.primary, backgroundColor: "#F0F9FF" },
  methodIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#CBD5E1",
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
  actionFeedback: { marginBottom: 2 },
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
