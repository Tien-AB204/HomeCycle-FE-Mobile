import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Header from "../../src/components/shared/Header";
import { COLORS } from "../../src/constants/theme";
import apiClient from "../../src/services/apis/axiosClient";

const paymentApi = {
  getStatus: (agreementId: string) =>
    apiClient
      .get(`/payments/${agreementId}/status`)
      .then((response) => response.data),
};

const orderApi = {
  getByAgreement: (agreementId: string) =>
    apiClient
      .get(`/orders/agreement/${agreementId}`)
      .then((response) => response.data),
};

const normalizeStatus = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const unwrap = (value: any) => value?.data ?? value;

export default function PaymentSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const agreementId = Array.isArray(params.agreementId)
    ? params.agreementId[0]
    : params.agreementId;
  const payosStatus = Array.isArray(params.status)
    ? params.status[0]
    : params.status;
  const cancel = Array.isArray(params.cancel) ? params.cancel[0] : params.cancel;

  const [loading, setLoading] = useState(true);
  const [isPaid, setIsPaid] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isPaidUrl = payosStatus === "PAID" && cancel !== "true";

  const resolveOrder = useCallback(async (targetAgreementId: string) => {
    const orderResponse = await orderApi.getByAgreement(targetAgreementId);
    const orderData = unwrap(orderResponse);
    const resolvedOrderId =
      orderData?.order?.orderId ||
      orderData?.orderId ||
      orderData?.id ||
      null;

    if (resolvedOrderId) {
      setOrderId(String(resolvedOrderId));
      return String(resolvedOrderId);
    }

    setOrderId(null);
    return null;
  }, []);

  const verifyPayment = useCallback(async () => {
    if (!agreementId) {
      setLoading(false);
      setIsPaid(false);
      setStatusMessage(
        "Không tìm thấy mã hợp đồng để xác thực giao dịch. Vui lòng mở đơn hàng từ danh sách của bạn.",
      );
      return;
    }

    try {
      setLoading(true);
      setStatusMessage(null);

      const statusResponse = await paymentApi.getStatus(agreementId);
      const rawStatus = unwrap(statusResponse);
      const normalized = normalizeStatus(rawStatus);

      setPaymentStatus(String(rawStatus ?? ""));

      const completed = normalized === "completed";
      setIsPaid(completed);

      if (completed) {
        const resolvedOrderId = await resolveOrder(agreementId);
        if (!resolvedOrderId) {
          setStatusMessage(
            "Thanh toán đã hoàn tất nhưng đơn hàng chưa sẵn sàng. Hãy thử tải lại sau ít giây.",
          );
        }
        return;
      }

      if (normalized === "pending") {
        setStatusMessage(
          isPaidUrl
            ? "PayOS đã chuyển bạn về sau thanh toán nhưng hệ thống vẫn đang đồng bộ trạng thái. Hãy thử kiểm tra lại."
            : "Giao dịch hiện vẫn đang chờ thanh toán.",
        );
        return;
      }

      if (normalized === "cancelled") {
        setStatusMessage("Giao dịch đã bị hủy.");
        return;
      }

      if (normalized === "expired") {
        setStatusMessage("Phiên thanh toán đã hết hạn.");
        return;
      }

      setStatusMessage("Chưa xác định được trạng thái thanh toán hiện tại.");
    } catch {
      setIsPaid(false);
      setStatusMessage(
        "Không thể xác thực trạng thái thanh toán lúc này. Không dựa vào URL PayOS để kết luận giao dịch thành công; hãy thử kiểm tra lại.",
      );
    } finally {
      setLoading(false);
    }
  }, [agreementId, isPaidUrl, resolveOrder]);

  useEffect(() => {
    void verifyPayment();
  }, [verifyPayment]);

  const handleGoToOrder = async () => {
    if (!agreementId) return;

    let targetOrderId = orderId;

    if (!targetOrderId) {
      try {
        setLoading(true);
        setStatusMessage(null);
        targetOrderId = await resolveOrder(agreementId);
      } catch {
        setStatusMessage(
          "Chưa thể lấy thông tin đơn hàng. Vui lòng thử lại sau.",
        );
      } finally {
        setLoading(false);
      }
    }

    if (targetOrderId) {
      router.replace(`/orders/${targetOrderId}` as any);
    }
  };

  const handleGoHome = () => {
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Kết quả thanh toán" showBack={false} />
      <View style={styles.container}>
        <View style={styles.card}>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Đang xác thực giao dịch...</Text>
            </View>
          ) : (
            <>
              <View
                style={[
                  styles.iconCircle,
                  {
                    backgroundColor: isPaid ? "#D1FAE5" : "#FEF3C7",
                  },
                ]}
              >
                <Ionicons
                  name={isPaid ? "checkmark-circle" : "time-outline"}
                  size={64}
                  color={isPaid ? "#10B981" : "#D97706"}
                />
              </View>

              <Text style={styles.title}>
                {isPaid
                  ? "Thanh toán thành công!"
                  : paymentStatus
                    ? "Trạng thái thanh toán"
                    : "Chưa xác thực được giao dịch"}
              </Text>

              <Text style={styles.subtitle}>
                {isPaid
                  ? "Giao dịch đã được Backend xác nhận và đơn hàng đã được tạo."
                  : statusMessage || "Vui lòng kiểm tra lại giao dịch."}
              </Text>

              {isPaid && statusMessage ? (
                <Text style={styles.inlineWarning}>{statusMessage}</Text>
              ) : null}

              {!isPaid ? (
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => void verifyPayment()}
                >
                  <Ionicons
                    name="refresh-outline"
                    size={18}
                    color={COLORS.primary}
                  />
                  <Text style={styles.retryBtnText}>Kiểm tra lại</Text>
                </TouchableOpacity>
              ) : null}

              <View style={styles.btnContainer}>
                {isPaid ? (
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={() => void handleGoToOrder()}
                  >
                    <Ionicons
                      name="receipt-outline"
                      size={18}
                      color={COLORS.white}
                      style={styles.buttonIcon}
                    />
                    <Text style={styles.primaryBtnText}>Xem đơn hàng</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={isPaid ? styles.secondaryBtn : styles.primaryBtn}
                  onPress={handleGoHome}
                >
                  <Ionicons
                    name="home-outline"
                    size={18}
                    color={isPaid ? COLORS.primary : COLORS.white}
                    style={styles.buttonIcon}
                  />
                  <Text
                    style={
                      isPaid ? styles.secondaryBtnText : styles.primaryBtnText
                    }
                  >
                    Về trang chủ
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: COLORS.white,
    width: "100%",
    padding: 24,
    borderRadius: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadingBox: { alignItems: "center", marginVertical: 30 },
  loadingText: { marginTop: 12, color: COLORS.textLight },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  inlineWarning: {
    width: "100%",
    color: "#B45309",
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 42,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 10,
    marginBottom: 16,
  },
  retryBtnText: { color: COLORS.primary, fontWeight: "700" },
  btnContainer: { width: "100%", gap: 12 },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    height: 50,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  primaryBtnText: { color: COLORS.white, fontSize: 15, fontWeight: "bold" },
  secondaryBtn: {
    backgroundColor: COLORS.white,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryBtnText: { color: COLORS.primary, fontSize: 15, fontWeight: "bold" },
  buttonIcon: { marginRight: 8 },
});
