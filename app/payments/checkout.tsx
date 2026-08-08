import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Header from "../../src/components/shared/Header";
import { COLORS } from "../../src/constants/theme";

export default function CheckoutScreen() {
  const router = useRouter();
  const [paymentMethod, setPaymentMethod] = useState<"WALLET" | "PAYOS">("WALLET");

  const handleCheckout = () => {
    Alert.alert("Thành công", "Thanh toán thành công! Lịch hẹn đã được tạo.", [
      { text: "OK", onPress: () => router.replace("/(tabs)/orders") }
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Thanh toán" showBack={true} />
      
      <View style={styles.content}>
        <View style={styles.mockBanner}>
          <Text style={styles.mockText}>(đây là thông tin đang mock, sau này sẽ xóa)</Text>
        </View>

        <View style={styles.billCard}>
          <Text style={styles.billTitle}>Tổng hóa đơn</Text>
          <View style={styles.row}><Text style={styles.label}>Tiền cọc (10%):</Text><Text style={styles.value}>900.000 đ</Text></View>
          <View style={styles.row}><Text style={styles.label}>Phí nền tảng:</Text><Text style={styles.value}>0 đ</Text></View>
          <View style={styles.divider} />
          <View style={styles.row}><Text style={styles.totalLabel}>Tổng thanh toán:</Text><Text style={styles.totalValue}>900.000 đ</Text></View>
        </View>

        <Text style={styles.sectionTitle}>Phương thức thanh toán</Text>
        
        <TouchableOpacity style={[styles.methodBtn, paymentMethod === "WALLET" && styles.methodActive]} onPress={() => setPaymentMethod("WALLET")}>
          <Ionicons name="wallet" size={28} color={paymentMethod === "WALLET" ? COLORS.primary : COLORS.textLight} />
          <View style={styles.methodInfo}>
            <Text style={styles.methodName}>Ví HomeCycle</Text>
            <Text style={styles.methodSub}>Số dư: 1.500.000 đ (Mock)</Text>
          </View>
          <Ionicons name={paymentMethod === "WALLET" ? "checkmark-circle" : "ellipse-outline"} size={24} color={paymentMethod === "WALLET" ? COLORS.primary : COLORS.border} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.methodBtn, paymentMethod === "PAYOS" && styles.methodActive]} onPress={() => setPaymentMethod("PAYOS")}>
          <Ionicons name="qr-code" size={28} color={paymentMethod === "PAYOS" ? COLORS.primary : COLORS.textLight} />
          <View style={styles.methodInfo}>
            <Text style={styles.methodName}>PayOS</Text>
            <Text style={styles.methodSub}>Chuyển khoản Ngân hàng / Mã QR</Text>
          </View>
          <Ionicons name={paymentMethod === "PAYOS" ? "checkmark-circle" : "ellipse-outline"} size={24} color={paymentMethod === "PAYOS" ? COLORS.primary : COLORS.border} />
        </TouchableOpacity>

      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckout}>
          <Text style={styles.checkoutBtnText}>Thanh toán 900.000 đ</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, padding: 16 },
  mockBanner: { backgroundColor: "#FEE2E2", padding: 8, borderRadius: 8, alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: "#EF4444" },
  mockText: { color: "#B91C1C", fontSize: 12, fontStyle: "italic" },
  billCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: COLORS.border },
  billTitle: { fontSize: 16, fontWeight: "bold", color: COLORS.text, marginBottom: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  label: { fontSize: 14, color: COLORS.textLight },
  value: { fontSize: 14, color: COLORS.text, fontWeight: "500" },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  totalLabel: { fontSize: 16, fontWeight: "bold", color: COLORS.text },
  totalValue: { fontSize: 20, fontWeight: "bold", color: COLORS.primary },
  sectionTitle: { fontSize: 15, fontWeight: "bold", color: COLORS.text, marginBottom: 12 },
  methodBtn: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 },
  methodActive: { borderColor: COLORS.primary, backgroundColor: "#F0FDF4" },
  methodInfo: { flex: 1, marginLeft: 12 },
  methodName: { fontSize: 15, fontWeight: "bold", color: COLORS.text },
  methodSub: { fontSize: 13, color: COLORS.textLight, marginTop: 4 },
  bottomBar: { padding: 16, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border },
  checkoutBtn: { backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 12, alignItems: "center" },
  checkoutBtnText: { color: COLORS.white, fontWeight: "bold", fontSize: 16 },
});