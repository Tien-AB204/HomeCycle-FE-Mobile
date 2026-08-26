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

export default function PaymentCancelScreen() {
  const router = useRouter();
  const { agreementId } = useLocalSearchParams();
  const [negotiationId, setNegotiationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchNegotiation = async () => {
      if (!agreementId) return;
      try {
        setLoading(true);
        const res = await agreementApi.getAgreementById(agreementId as string);
        const data = res?.data || res;
        if (data?.negotiationId) {
          setNegotiationId(data.negotiationId);
        }
      } catch (e) {
        console.log("Lỗi lấy thông tin agreement:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchNegotiation();
  }, [agreementId]);

  const handleRetry = () => {
    if (agreementId) {
      router.replace(`/payments/checkout?agreementId=${agreementId}`);
    } else {
      router.replace("/(tabs)");
    }
  };

  const handleGoToChat = () => {
    if (negotiationId) {
      router.replace(`/chat/${negotiationId}`);
    } else {
      router.replace("/(tabs)/chat");
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
          <View style={[styles.iconCircle, { backgroundColor: "rgba(122, 16, 18, 0.08)" }]}>
            <Ionicons name="close-circle" size={64} color="#7A1012" />
          </View>
          <Text style={styles.title}>Thanh toán đã bị hủy</Text>
          <Text style={styles.subtitle}>
            Giao dịch chưa được hoàn tất. Bạn có thể thử lại hoặc quay lại phòng
            chat để thảo luận thêm.
          </Text>

          {loading ? (
            <ActivityIndicator
              color={COLORS.primary}
              style={{ marginVertical: 20 }}
            />
          ) : (
            <View style={styles.btnContainer}>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleRetry}>
                <Ionicons
                  name="refresh-outline"
                  size={18}
                  color={COLORS.white}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.primaryBtnText}>Thử lại thanh toán</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleGoToChat}
              >
                <Ionicons
                  name="chatbubbles-outline"
                  size={18}
                  color={COLORS.primary}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.secondaryBtnText}>Quay lại trang chat</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.outlineBtn}
                onPress={handleGoHome}
              >
                <Ionicons
                  name="home-outline"
                  size={18}
                  color={COLORS.textLight}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.outlineBtnText}>Về trang chủ</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, padding: 20, justifyContent: "center", alignItems: "center" },
  card: { backgroundColor: COLORS.white, width: "100%", padding: 24, borderRadius: 20, alignItems: "center", borderWidth: 1, borderColor: COLORS.border },
  iconCircle: { width: 100, height: 100, borderRadius: 50, justifyContent: "center", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 22, fontWeight: "bold", color: COLORS.text, marginBottom: 10, textAlign: "center" },
  subtitle: { fontSize: 14, color: COLORS.textLight, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  btnContainer: { width: "100%", gap: 12 },
  primaryBtn: { backgroundColor: COLORS.primary, height: 50, borderRadius: 12, flexDirection: "row", justifyContent: "center", alignItems: "center" },
  primaryBtnText: { color: COLORS.white, fontSize: 15, fontWeight: "bold" },
  secondaryBtn: { backgroundColor: COLORS.white, height: 50, borderRadius: 12, borderWidth: 1, borderColor: COLORS.primary, flexDirection: "row", justifyContent: "center", alignItems: "center" },
  secondaryBtnText: { color: COLORS.primary, fontSize: 15, fontWeight: "bold" },
  outlineBtn: { backgroundColor: "transparent", height: 44, borderRadius: 12, flexDirection: "row", justifyContent: "center", alignItems: "center" },
  outlineBtnText: { color: COLORS.textLight, fontSize: 14, fontWeight: "600" },
});