import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import React, { useState, useCallback } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, Alert, Platform } from "react-native";
import Header from "../../src/components/shared/Header";
import { COLORS } from "../../src/constants/theme";
import { agreementApi } from "../../src/services/apis/agreementApi";

export default function AgreementPreviewScreen() {
  const router = useRouter();
  const { agreementId, negotiationId } = useLocalSearchParams();
  
  const [agreementData, setAgreementData] = useState<any>(null);
  const [previewInfo, setPreviewInfo] = useState<any>(null); 
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchAgreementDetails = useCallback(async () => {
    if (!agreementId || !negotiationId) return;
    try {
      setIsLoading(true);
      const [detailRes, previewRes] = await Promise.all([
        agreementApi.getAgreementById(agreementId as string),
        agreementApi.getPreview(negotiationId as string)
      ]);
      setAgreementData(detailRes?.data || detailRes);
      setPreviewInfo(previewRes?.data || previewRes);
    } catch (error) {
      console.error("Lỗi tải chi tiết đơn:", error);
      if (Platform.OS === "web") {
        window.alert("Không thể tải chi tiết đơn xác nhận.");
      } else {
        Alert.alert("Lỗi", "Không thể tải chi tiết đơn xác nhận.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [agreementId, negotiationId]);

  useFocusEffect(useCallback(() => { fetchAgreementDetails(); }, [fetchAgreementDetails]));

  const handleAccept = async () => {
    try {
      setIsProcessing(true);
      await agreementApi.acceptAgreement(agreementId as string);
      
      // FIX LỖI REDIRECT TRÊN WEB BỊ KẸT ALERT
      if (Platform.OS === "web") {
        window.alert("Đã đồng ý thỏa thuận. Tiến hành thanh toán!");
        router.push(`/payments/checkout?agreementId=${agreementId}`);
      } else {
        Alert.alert("Thành công", "Đã đồng ý thỏa thuận. Tiến hành thanh toán!", [
          { text: "OK", onPress: () => router.push(`/payments/checkout?agreementId=${agreementId}`) }
        ]);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || "Không thể đồng ý thỏa thuận.";
      if (Platform.OS === "web") {
        window.alert(errorMsg);
      } else {
        Alert.alert("Lỗi", errorMsg);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRequestEdit = () => {
    if (Platform.OS === "web") {
      window.alert("Tính năng yêu cầu đối tác sửa form chưa có API.");
    } else {
      Alert.alert("Tính năng đang phát triển", "Tính năng yêu cầu đối tác sửa form chưa có API.");
    }
  };

  const formatPrice = (price: number) => {
    return price ? price.toLocaleString("vi-VN") + " đ" : "0 đ";
  };

  const translateDeliveryMethod = (method: string) => {
    switch (method) {
      case "BuyerPickUp": return "Bên mua đến lấy";
      case "SellerDelivers": return "Bên bán tự giao";
      case "GhnDelivery": return "Giao hàng nhanh (GHN)";
      default: return method || "Không rõ";
    }
  };

  const translateAgreementStatus = (status: string) => {
    switch (status) {
      case "Pending": return "Đang chờ duyệt";
      case "Accepted": return "Đã chấp nhận";
      case "Rejected": return "Đã từ chối";
      case "Cancelled": return "Đã hủy";
      default: return status || "N/A";
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Chi tiết đơn xác nhận" showBack={true} />
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  const isInspection = agreementData?.agreementType === "Inspection";
  const details = agreementData?.agreementDetails || {};

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Chi tiết đơn xác nhận" showBack={true} />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text" size={24} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Hợp đồng giao dịch</Text>
          </View>
          
          <View style={styles.row}><Text style={styles.label}>Mã đơn xác nhận:</Text><Text style={[styles.value, { fontSize: 11, color: COLORS.textLight }]}>{agreementData?.agreementId}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Trạng thái đơn:</Text><Text style={[styles.value, { fontWeight: "bold", color: COLORS.primary }]}>{translateAgreementStatus(agreementData?.agreementStatus)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Loại giao dịch:</Text><Text style={styles.value}>{isInspection ? "Có kiểm định trước" : "Thu gom ngay"}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Hình thức TT:</Text><Text style={styles.value}>{agreementData?.paymentType === "Deposit" ? "Đặt cọc" : "Toàn phần"}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Số lượng:</Text><Text style={styles.value}>{agreementData?.quantity || 1}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Giá ban đầu:</Text><Text style={styles.value}>{formatPrice(agreementData?.initialPrice)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Giá chốt giao dịch:</Text><Text style={[styles.value, { color: COLORS.error, fontWeight: "bold" }]}>{formatPrice(agreementData?.finalPrice)}</Text></View>
          
          <View style={styles.divider} />
          
          <Text style={styles.sectionTitle}>Lịch trình & Giao nhận</Text>
          
          <View style={styles.row}><Text style={styles.label}>Vận chuyển:</Text><Text style={styles.value}>{translateDeliveryMethod(details.deliveryMethod)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Thời gian thu gom:</Text><Text style={styles.value}>{details.collectionDate ? new Date(details.collectionDate).toLocaleString() : "N/A"}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Địa chỉ lấy:</Text><Text style={styles.value}>{details.pickupAddress || "N/A"}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Địa chỉ giao:</Text><Text style={styles.value}>{details.deliveryAddress || "N/A"}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Thời gian kiểm định:</Text><Text style={styles.value}>{details.inspectionDate ? new Date(details.inspectionDate).toLocaleString() : "N/A"}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Địa điểm kiểm định:</Text><Text style={styles.value}>{details.inspectionAddress || "N/A"}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Phí ship dự kiến:</Text><Text style={[styles.value, {color: COLORS.error}]}>{formatPrice(details.estimatedShippingFee || 0)}</Text></View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Xác nhận & Thời gian</Text>
          <View style={styles.row}><Text style={styles.label}>Ngày tạo đơn:</Text><Text style={styles.value}>{agreementData?.createdAt ? new Date(agreementData.createdAt).toLocaleString() : "N/A"}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Người bán xác nhận:</Text><Text style={styles.value}>{agreementData?.sellerConfirmedAt ? new Date(agreementData.sellerConfirmedAt).toLocaleString() : "Chưa xác nhận"}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Người mua xác nhận:</Text><Text style={styles.value}>{agreementData?.buyerConfirmedAt ? new Date(agreementData.buyerConfirmedAt).toLocaleString() : "Chưa xác nhận"}</Text></View>

          {details.notes && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Ghi chú</Text>
              <Text style={styles.notesText}>{details.notes}</Text>
            </>
          )}
        </View>

      </ScrollView>

      {/* RẼ NHÁNH NÚT BẤM THEO PHÂN QUYỀN */}
      <View style={styles.bottomBar}>
        {agreementData?.agreementStatus === "Accepted" ? (
          // ĐÃ DUYỆT RỒI THÌ CHỈ HIỆN NÚT ĐI THANH TOÁN (Không call API PATCH nữa)
          <TouchableOpacity 
            style={styles.primaryBtn} 
            onPress={() => router.push(`/payments/checkout?agreementId=${agreementId}`)}
          >
            <Text style={styles.primaryBtnText}>Đi đến Thanh toán</Text>
          </TouchableOpacity>
        ) : previewInfo?.canEdit ? (
          <TouchableOpacity 
            style={styles.primaryBtn} 
            onPress={() => router.push(`/agreements/form?negotiationId=${negotiationId}&editAgreementId=${agreementId}`)}
          >
            <Text style={styles.primaryBtnText}>Chỉnh sửa đơn</Text>
          </TouchableOpacity>
        ) : previewInfo?.canConfirm ? (
          <>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleRequestEdit}>
              <Text style={styles.secondaryBtnText}>Yêu cầu sửa đổi</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleAccept} disabled={isProcessing}>
              {isProcessing ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryBtnText}>Đồng ý & Thanh toán</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <Text style={{ textAlign: 'center', flex: 1, color: COLORS.textLight }}>Đang chờ đối tác xử lý...</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { padding: 16 },
  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  cardTitle: { fontSize: 18, fontWeight: "bold", marginLeft: 10, color: COLORS.text },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  label: { fontSize: 14, color: COLORS.textLight, flex: 1 },
  value: { fontSize: 14, color: COLORS.text, fontWeight: "500", flex: 2, textAlign: "right" },
  notesText: { fontSize: 14, color: COLORS.text, fontStyle: "italic", backgroundColor: "#F8FAFC", padding: 12, borderRadius: 8 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "bold", color: COLORS.text, marginBottom: 12 },
  bottomBar: { flexDirection: "row", padding: 16, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 12 },
  secondaryBtn: { flex: 1, paddingVertical: 14, borderRadius: 8, borderWidth: 1, borderColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { color: COLORS.primary, fontWeight: "bold", fontSize: 14 },
  primaryBtn: { flex: 1.5, paddingVertical: 14, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { color: COLORS.white, fontWeight: "bold", fontSize: 14 },
});