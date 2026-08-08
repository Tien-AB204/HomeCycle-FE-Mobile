import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Header from "../../src/components/shared/Header";
import { COLORS } from "../../src/constants/theme";

export default function AgreementPreviewScreen() {
  const router = useRouter();
  const { negotiationId } = useLocalSearchParams();

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Chi tiết đơn xác nhận" showBack={true} />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.mockBanner}>
          <Ionicons name="warning-outline" size={20} color="#B45309" />
          <Text style={styles.mockText}>(đây là thông tin đang mock, sau này sẽ xóa)</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text" size={24} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Hợp đồng giao dịch</Text>
          </View>
          
          <View style={styles.row}><Text style={styles.label}>Sản phẩm:</Text><Text style={styles.value}>Smart Tivi Samsung 55 inch</Text></View>
          <View style={styles.row}><Text style={styles.label}>Giá chốt:</Text><Text style={styles.valueHighlight}>9.000.000 đ</Text></View>
          <View style={styles.row}><Text style={styles.label}>Loại giao dịch:</Text><Text style={styles.value}>Có kiểm định</Text></View>
          <View style={styles.row}><Text style={styles.label}>Hình thức TT:</Text><Text style={styles.value}>Đặt cọc</Text></View>
          
          <View style={styles.divider} />
          
          <Text style={styles.sectionTitle}>Lịch trình</Text>
          <View style={styles.row}><Text style={styles.label}>Thời gian:</Text><Text style={styles.value}>14:00 - 08/08/2026</Text></View>
          <View style={styles.row}><Text style={styles.label}>Địa điểm:</Text><Text style={styles.value}>123 Nguyễn Văn Cừ, Quận 5, TP.HCM</Text></View>
        </View>

      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
          <Text style={styles.secondaryBtnText}>Yêu cầu sửa đổi</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push(`/payments/checkout?agreementId=mock-id`)}>
          <Text style={styles.primaryBtnText}>Đồng ý & Thanh toán</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: 16 },
  mockBanner: { flexDirection: "row", backgroundColor: "#FEF3C7", padding: 12, borderRadius: 8, alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: "#F59E0B" },
  mockText: { color: "#B45309", fontSize: 13, fontStyle: "italic", marginLeft: 8, flex: 1 },
  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  cardTitle: { fontSize: 18, fontWeight: "bold", marginLeft: 10, color: COLORS.text },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  label: { fontSize: 14, color: COLORS.textLight, flex: 1 },
  value: { fontSize: 14, color: COLORS.text, fontWeight: "500", flex: 2, textAlign: "right" },
  valueHighlight: { fontSize: 15, color: COLORS.primary, fontWeight: "bold", flex: 2, textAlign: "right" },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "bold", color: COLORS.text, marginBottom: 12 },
  bottomBar: { flexDirection: "row", padding: 16, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 12 },
  secondaryBtn: { flex: 1, paddingVertical: 14, borderRadius: 8, borderWidth: 1, borderColor: COLORS.primary, alignItems: "center" },
  secondaryBtnText: { color: COLORS.primary, fontWeight: "bold", fontSize: 14 },
  primaryBtn: { flex: 1.5, paddingVertical: 14, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: "center" },
  primaryBtnText: { color: COLORS.white, fontWeight: "bold", fontSize: 14 },
});