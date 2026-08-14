import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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

const agreementApi = {
  getAgreementById: (agreementId: string) =>
    apiClient
      .get(`/agreements/${agreementId}`)
      .then((response) => response.data),
};

export default function PaymentSuccessScreen() {
  const router = useRouter();

  // PayOS trả về status=PAID và cancel=false
  const { agreementId, status, cancel } = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [isPaid, setIsPaid] = useState(false);

  // LOGIC HYBRID:
  // 1. Kiểm tra URL PayOS: status=PAID và không bị hủy
  const isPaidUrl = status === "PAID" && cancel !== "true";

  useEffect(() => {
    let isMounted = true;

    const verifyPayment = async () => {
      if (!agreementId) {
        setLoading(false);
        // Nếu không có ID, tin vào URL (thường là trường hợp load lại trang)
        setIsPaid(isPaidUrl);
        return;
      }

      try {
        setLoading(true);
        const res = await agreementApi.getAgreementById(agreementId as string);
        const data = res?.data || res;

        if (!isMounted) return;

        // KIỂM TRA ĐÚNG ENUM: Confirmed = 2
        const isConfirmed =
          data?.agreementStatus === "Confirmed" || data?.agreementStatus === 2;

        // QUYẾT ĐỊNH: Nếu BE đã Confirmed HOẶC PayOS báo PAID -> Thì coi như thanh toán thành công
        setIsPaid(isConfirmed || isPaidUrl);
      } catch (e) {
        console.log("Lỗi lấy thông tin:", e);
        // Fallback: Nếu API lỗi, vẫn tin vào URL PayOS
        if (isMounted) setIsPaid(isPaidUrl);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    verifyPayment();

    return () => {
      isMounted = false;
    };
  }, [agreementId, isPaidUrl]);

  const handleGoToOrder = () => {
    if (agreementId) {
      router.replace(`/orders/${agreementId}` as any);
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
            <View style={{ alignItems: "center", marginVertical: 30 }}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={{ marginTop: 12, color: COLORS.textLight }}>
                Đang xác thực giao dịch...
              </Text>
            </View>
          ) : (
            <>
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: isPaid ? "#D1FAE5" : "#FEE2E2" },
                ]}
              >
                <Ionicons
                  name={isPaid ? "checkmark-circle" : "close-circle"}
                  size={64}
                  color={isPaid ? "#10B981" : COLORS.error}
                />
              </View>

              <Text style={styles.title}>
                {isPaid ? "Thanh toán thành công!" : "Thanh toán thất bại!"}
              </Text>

              <Text style={styles.subtitle}>
                {isPaid
                  ? "Giao dịch đã được ghi nhận."
                  : "Giao dịch đã bị hủy hoặc xảy ra lỗi."}
                {!isPaid && isPaidUrl && "\n(Hệ thống đang đồng bộ dữ liệu...)"}
              </Text>

              <View style={styles.btnContainer}>
                {isPaid && (
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={handleGoToOrder}
                  >
                    <Ionicons
                      name="receipt-outline"
                      size={18}
                      color={COLORS.white}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.primaryBtnText}>Xem đơn hàng</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={isPaid ? styles.secondaryBtn : styles.primaryBtn}
                  onPress={handleGoHome}
                >
                  <Ionicons
                    name="home-outline"
                    size={18}
                    color={isPaid ? COLORS.primary : COLORS.white}
                    style={{ marginRight: 8 }}
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
    marginBottom: 24,
  },
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
});
