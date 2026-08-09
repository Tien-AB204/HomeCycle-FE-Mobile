import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from "react-native";
import Header from "../../src/components/shared/Header";
import { COLORS } from "../../src/constants/theme";
import { agreementApi } from "../../src/services/apis/agreementApi";

export default function PaymentSuccessScreen() {
  const router = useRouter();
  const { agreementId } = useLocalSearchParams();
  const [negotiationId, setNegotiationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Lấy negotiationId từ agreementId để định hướng nút quay lại chat
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
          <View style={[styles.iconCircle, { backgroundColor: "#D1FAE5" }]}>
            <Ionicons name="checkmark-circle" size={64} color="#10B981" />
          </View>
          <Text style={styles.title}>Thanh toán thành công!</Text>
          <Text style={styles.subtitle}>
            Giao dịch của bạn đã được ghi nhận. Hệ thống đang cập nhật trạng thái đơn hàng.
          </Text>

          {loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
          ) : (
            <View style={styles.btnContainer}>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleGoToChat}>
                <Ionicons name="chatbubbles-outline" size={18} color={COLORS.white} style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>Quay lại trang chat</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryBtn} onPress={handleGoHome}>
                <Ionicons name="home-outline" size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
                <Text style={styles.secondaryBtnText}>Về trang chủ</Text>
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
});