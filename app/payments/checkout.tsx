import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Linking from "expo-linking";
import Header from "../../src/components/shared/Header";
import { COLORS } from "../../src/constants/theme";
import { agreementApi } from "../../src/services/apis/agreementApi";
import { paymentApi } from "../../src/services/apis/paymentApi";

export default function CheckoutScreen() {
  const router = useRouter();
  const { agreementId } = useLocalSearchParams();

  const [agreement, setAgreement] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "payos">("wallet");

  // 1. LẤY THÔNG TIN ĐƠN ĐỂ TÍNH TIỀN THỰC TẾ
  const fetchAgreementData = useCallback(async () => {
    if (!agreementId) return;
    try {
      setIsLoading(true);
      const res = await agreementApi.getAgreementById(agreementId as string);
      setAgreement(res?.data || res);
    } catch (error) {
      console.error("Lỗi lấy thông tin thanh toán:", error);
      const msg = "Không thể tải thông tin thanh toán.";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Lỗi", msg);
    } finally {
      setIsLoading(false);
    }
  }, [agreementId]);

  useFocusEffect(
    useCallback(() => {
      fetchAgreementData();
    }, [fetchAgreementData])
  );

  // 2. TÍNH TOÁN SỐ TIỀN CẦN THANH TOÁN THEO CÔNG THỨC CHUẨN
  const finalPrice = agreement?.finalPrice || 0;
  const isDeposit = agreement?.paymentType === "Deposit";
  
  // Tiền cọc là 20% giá chốt giao dịch
  const amountToPay = isDeposit ? finalPrice * 0.2 : finalPrice; 
  
  // Phí nền tảng hiện tại đang là 0đ
  const platformFee = 0; 
  const totalPayment = amountToPay + platformFee;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
  };

  // 3. XỬ LÝ NÚT BẤM THANH TOÁN
  const handlePaymentSubmit = async () => {
    try {
      setIsProcessing(true);

      if (paymentMethod === "wallet") {
        // --- THANH TOÁN BẰNG VÍ ---
        await paymentApi.checkoutWithWallet(agreementId as string);
        
        if (Platform.OS === "web") {
          window.alert("Thanh toán qua Ví thành công!");
          router.back(); 
        } else {
          Alert.alert("Thành công", "Thanh toán qua Ví thành công!", [
            { text: "OK", onPress: () => router.back() }
          ]);
        }
      } else {
        // --- THANH TOÁN BẰNG PAYOS ---
        const res = await paymentApi.checkoutWithPayOS(agreementId as string);
        const checkoutUrl = res?.data?.checkoutUrl || res?.checkoutUrl;
        
        if (checkoutUrl) {
          // Mở link sang trang quét QR của PayOS
          if (Platform.OS === "web") {
            window.open(checkoutUrl, "_blank");
          } else {
            Linking.openURL(checkoutUrl);
          }
          // Quay lại màn hình trước để chờ BE tự động update status qua Webhook
          router.back(); 
        } else {
          throw new Error("Không nhận được link thanh toán từ hệ thống.");
        }
      }
    } catch (error: any) {
      console.error("Lỗi thanh toán:", error);
      const errorMsg = error.response?.data?.error?.message || error.response?.data?.message || error.message || "Giao dịch thất bại.";
      Platform.OS === "web" ? window.alert(`Lỗi: ${errorMsg}`) : Alert.alert("Lỗi", errorMsg);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Thanh toán" showBack={true} />
      
      <View style={styles.container}>
        {/* TỔNG HÓA ĐƠN */}
        <View style={styles.invoiceCard}>
          <Text style={styles.sectionTitle}>Tổng hóa đơn</Text>
          
          <View style={styles.row}>
            <Text style={styles.label}>{isDeposit ? "Tiền cọc (20%):" : "Thanh toán toàn phần:"}</Text>
            <Text style={styles.value}>{formatCurrency(amountToPay)}</Text>
          </View>
          
          <View style={styles.row}>
            <Text style={styles.label}>Phí nền tảng:</Text>
            <Text style={styles.value}>{formatCurrency(platformFee)}</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.row}>
            <Text style={styles.totalLabel}>Tổng thanh toán:</Text>
            <Text style={styles.totalValue}>{formatCurrency(totalPayment)}</Text>
          </View>
        </View>

        {/* PHƯƠNG THỨC THANH TOÁN */}
        <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>Phương thức thanh toán</Text>
        
        {/* Tuỳ chọn: VÍ HOMECYCLE */}
        <TouchableOpacity 
          style={[styles.methodCard, paymentMethod === "wallet" && styles.methodCardActive]} 
          onPress={() => setPaymentMethod("wallet")}
          activeOpacity={0.8}
        >
          <View style={styles.methodIconBox}>
            <Ionicons name="wallet" size={24} color={paymentMethod === "wallet" ? COLORS.white : COLORS.textLight} />
          </View>
          <View style={styles.methodInfo}>
            <Text style={styles.methodTitle}>Ví HomeCycle</Text>
            {/* Tạm thời để No data vì chưa có API lấy số dư ví */}
            <Text style={styles.methodSubtitle}>Số dư: Chưa có dữ liệu</Text> 
          </View>
          <View style={[styles.radioCircle, paymentMethod === "wallet" && styles.radioCircleActive]}>
            {paymentMethod === "wallet" && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>

        {/* Tuỳ chọn: PAYOS */}
        <TouchableOpacity 
          style={[styles.methodCard, paymentMethod === "payos" && styles.methodCardActive]} 
          onPress={() => setPaymentMethod("payos")}
          activeOpacity={0.8}
        >
          <View style={styles.methodIconBoxPayOS}>
            <Ionicons name="qr-code-outline" size={24} color={paymentMethod === "payos" ? COLORS.white : COLORS.textLight} />
          </View>
          <View style={styles.methodInfo}>
            <Text style={styles.methodTitle}>PayOS</Text>
            <Text style={styles.methodSubtitle}>Chuyển khoản Ngân hàng / Mã QR</Text>
          </View>
          <View style={[styles.radioCircle, paymentMethod === "payos" && styles.radioCircleActive]}>
            {paymentMethod === "payos" && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>
      </View>

      {/* NÚT THANH TOÁN CỐ ĐỊNH Ở ĐÁY */}
      <View style={styles.bottomBar}>
        <TouchableOpacity 
          style={[styles.submitBtn, isProcessing && { opacity: 0.7 }]} 
          onPress={handlePaymentSubmit}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.submitBtnText}>Thanh toán {formatCurrency(totalPayment)}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { flex: 1, padding: 16 },

  invoiceCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.border, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "bold", color: COLORS.text, marginBottom: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  label: { fontSize: 14, color: COLORS.textLight },
  value: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  totalLabel: { fontSize: 16, fontWeight: "bold", color: COLORS.text },
  totalValue: { fontSize: 20, fontWeight: "bold", color: COLORS.primary },

  methodCard: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  methodCardActive: { borderColor: COLORS.primary, backgroundColor: "#F0F9FF" },
  methodIconBox: { width: 44, height: 44, borderRadius: 10, backgroundColor: "#CBD5E1", justifyContent: "center", alignItems: "center", marginRight: 16 },
  methodIconBoxPayOS: { width: 44, height: 44, borderRadius: 10, backgroundColor: "#CBD5E1", justifyContent: "center", alignItems: "center", marginRight: 16 },
  methodInfo: { flex: 1 },
  methodTitle: { fontSize: 16, fontWeight: "bold", color: COLORS.text, marginBottom: 4 },
  methodSubtitle: { fontSize: 13, color: COLORS.textLight },
  
  radioCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: COLORS.border, justifyContent: "center", alignItems: "center" },
  radioCircleActive: { borderColor: COLORS.primary },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.primary },

  bottomBar: { padding: 16, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border },
  submitBtn: { backgroundColor: COLORS.primary, height: 54, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  submitBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "bold" },
});