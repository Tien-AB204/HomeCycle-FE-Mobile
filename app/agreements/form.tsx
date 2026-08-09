import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Header from "../../src/components/shared/Header";
import { COLORS } from "../../src/constants/theme";
import { agreementApi } from "../../src/services/apis/agreementApi";
import { negotiationApi } from "../../src/services/apis/negotiationApi";
import { offerApi } from "../../src/services/apis/offerApi";
import { postApi } from "../../src/services/apis/postApi";

export default function AgreementFormScreen() {
  const router = useRouter();
  const { negotiationId, editAgreementId } = useLocalSearchParams();
  const isEditing = !!editAgreementId;

  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isInspection, setIsInspection] = useState(true);
  const [paymentType, setPaymentType] = useState<"DEPOSIT" | "FULL">("DEPOSIT");

  // State cho Tóm tắt giao dịch
  const [summary, setSummary] = useState({ productName: "Đang tải thông tin...", price: 0, quantity: 1 });
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);

  // State Dùng chung
  const [notes, setNotes] = useState("");

  // State cho Kiểm định
  const [inspectionDate, setInspectionDate] = useState("");
  const [inspectionAddress, setInspectionAddress] = useState("");

  // State cho Thu gom/Giao nhận
  const [deliveryMethod, setDeliveryMethod] = useState<"SELLER_DELIVERY" | "BUYER_PICKUP" | "GHN">("SELLER_DELIVERY");
  const [collectionDate, setCollectionDate] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");

  const fetchSummary = useCallback(async () => {
    if (!negotiationId) return;
    try {
      setIsLoadingSummary(true);
      const negRes = await negotiationApi.getNegotiationById(negotiationId as string);
      const neg = negRes?.data || negRes;
      
      if (neg?.offerId) {
        const offerRes = await offerApi.getOfferById(neg.offerId);
        const offer = offerRes?.data || offerRes;

        let pName = "Sản phẩm thương lượng";
        if (offer?.postId) {
           const postRes = await postApi.getPostById(offer.postId);
           const postData = postRes?.data || postRes;
           pName = postData?.product?.productName || postData?.productName || pName;
        }

        setSummary({
          productName: pName,
          price: offer.offerPrice || 0,
          quantity: offer.offerQuantity || 1
        });
      }
    } catch (e) {
      console.log("Lỗi fetch summary:", e);
    } finally {
      setIsLoadingSummary(false);
    }
  }, [negotiationId]);

  const fetchExistingAgreement = useCallback(async () => {
    if (!isEditing || !editAgreementId) return;
    try {
      setIsLoadingData(true);
      const res = await agreementApi.getAgreementById(editAgreementId as string);
      const data = res?.data || res;

      if (data) {
        const isInsp = data.agreementType === "Inspection" || data.agreementType === 0;
        setIsInspection(isInsp);
        setPaymentType(data.paymentType === "Deposit" || data.paymentType === 1 ? "DEPOSIT" : "FULL");

        const details = data.agreementDetails || {};
        
        setNotes(details.notes || "");
        setInspectionDate(details.inspectionDate ? details.inspectionDate.split("T")[0] : "");
        setInspectionAddress(details.inspectionAddress || "");
        setCollectionDate(details.collectionDate ? details.collectionDate.split("T")[0] : "");
        setPickupAddress(details.pickupAddress || "");
        setDeliveryAddress(details.deliveryAddress || "");

        if (details.deliveryMethod === "SellerDelivers" || details.deliveryMethod === 2) setDeliveryMethod("SELLER_DELIVERY");
        else if (details.deliveryMethod === "BuyerPickUp" || details.deliveryMethod === 3) setDeliveryMethod("BUYER_PICKUP");
        else if (details.deliveryMethod === "GhnDelivery" || details.deliveryMethod === 1) setDeliveryMethod("GHN");
      }
    } catch (e) {
      console.log("Lỗi tải thông tin đơn cũ để sửa:", e);
      Alert.alert("Lỗi", "Không thể tải dữ liệu đơn xác nhận cũ.");
    } finally {
      setIsLoadingData(false);
    }
  }, [isEditing, editAgreementId]);

  useFocusEffect(useCallback(() => { 
    fetchSummary(); 
    if (isEditing) {
      fetchExistingAgreement();
    }
  }, [fetchSummary, fetchExistingAgreement, isEditing]));

  const handleDeliveryMethodChange = (method: any) => {
    setDeliveryMethod(method);
    if (method === "GHN") {
      setPaymentType("FULL");
    }
  };

  const handleSubmit = async () => {
    const methodEnumMap: Record<string, string> = {
      "SELLER_DELIVERY": "SellerDelivers",
      "BUYER_PICKUP": "BuyerPickUp",
      "GHN": "GhnDelivery"
    };

    let agreementDetailsObj: any = {
      notes: notes ? notes.trim() : null,
    };

    if (isInspection) {
      if (inspectionDate) agreementDetailsObj.inspectionDate = new Date(inspectionDate).toISOString();
      if (inspectionAddress) agreementDetailsObj.inspectionAddress = inspectionAddress.trim();
    } else {
      if (collectionDate) agreementDetailsObj.collectionDate = new Date(collectionDate).toISOString();
      if (pickupAddress) agreementDetailsObj.pickupAddress = pickupAddress.trim();
      if (deliveryAddress) agreementDetailsObj.deliveryAddress = deliveryAddress.trim();
      agreementDetailsObj.deliveryMethod = methodEnumMap[deliveryMethod] || "Unknown";
      if (deliveryMethod === "GHN") {
        agreementDetailsObj.estimatedShippingFee = 35000;
      }
    }

    try {
      setIsProcessing(true);
      if (isEditing) {
        const updatePayload = {
          agreementType: isInspection ? "Inspection" : "No_Inspection",
          paymentType: isInspection ? "Deposit" : paymentType === "DEPOSIT" ? "Deposit" : "Full_Payment",
          agreementDetails: agreementDetailsObj
        };
        await agreementApi.updateAgreement(editAgreementId as string, updatePayload);
        
        // FIX LỖI REDIRECT TRÊN WEB
        if (Platform.OS === "web") {
          window.alert("Đã cập nhật đơn xác nhận!");
          if (negotiationId) router.replace(`/chat/${negotiationId}`);
          else router.back();
        } else {
          Alert.alert("Thành công", "Đã cập nhật đơn xác nhận!", [
            { 
              text: "OK", 
              onPress: () => {
                if (negotiationId) router.replace(`/chat/${negotiationId}`);
                else router.back();
              } 
            }
          ]);
        }
      } else {
        if (!negotiationId) return;
        const createPayload = {
          negotiationId: negotiationId,
          agreementType: isInspection ? "Inspection" : "No_Inspection",
          paymentType: isInspection ? "Deposit" : paymentType === "DEPOSIT" ? "Deposit" : "Full_Payment",
          agreementDetails: agreementDetailsObj
        };
        await agreementApi.createAgreement(createPayload);
        
        // FIX LỖI REDIRECT TRÊN WEB
        if (Platform.OS === "web") {
          window.alert("Đã tạo đơn xác nhận!");
          router.replace(`/chat/${negotiationId}`);
        } else {
          Alert.alert("Thành công", "Đã tạo đơn xác nhận!", [
            { 
              text: "OK", 
              onPress: () => {
                router.replace(`/chat/${negotiationId}`);
              } 
            }
          ]);
        }
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.response?.data?.message || "Không thể thực hiện lúc này.";
      Alert.alert("Lỗi", errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);
  };

  if (isLoadingData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title={isEditing ? "Chỉnh sửa đơn xác nhận" : "Thiết lập đơn xác nhận"} showBack={true} />
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title={isEditing ? "Chỉnh sửa đơn xác nhận" : "Thiết lập đơn xác nhận"} showBack={true} />
      
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* TÓM TẮT GIAO DỊCH */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tóm tắt giao dịch</Text>
            <View style={styles.summaryCard}>
              {isLoadingSummary ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : (
                <>
                  <Text style={styles.summaryProductName} numberOfLines={2}>{summary.productName}</Text>
                  <Text style={styles.summaryPrice}>Giá chốt: {formatPrice(summary.price)}</Text>
                  <Text style={styles.summaryQty}>Số lượng: {summary.quantity}</Text>
                </>
              )}
            </View>
          </View>
          
          {/* LOẠI GIAO DỊCH */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Loại giao dịch</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity style={styles.radioBtn} onPress={() => { setIsInspection(true); setPaymentType("DEPOSIT"); }}>
                <Ionicons name={isInspection ? "radio-button-on" : "radio-button-off"} size={24} color={isInspection ? COLORS.primary : COLORS.textLight} />
                <Text style={styles.radioText}>Có kiểm định trước</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.radioBtn} onPress={() => setIsInspection(false)}>
                <Ionicons name={!isInspection ? "radio-button-on" : "radio-button-off"} size={24} color={!isInspection ? COLORS.primary : COLORS.textLight} />
                <Text style={styles.radioText}>Không kiểm định (Giao hàng ngay)</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* CHI TIẾT TỪNG LOẠI */}
          {isInspection ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Thông tin kiểm định</Text>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Thời gian hẹn</Text>
                <TextInput placeholder="VD: 2026-08-08" placeholderTextColor="#94A3B8" value={inspectionDate} onChangeText={setInspectionDate} style={styles.input} />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Địa điểm kiểm định</Text>
                <TextInput placeholder="Nhập địa điểm..." placeholderTextColor="#94A3B8" value={inspectionAddress} onChangeText={setInspectionAddress} style={styles.input} />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Ghi chú thêm</Text>
                <TextInput placeholder="Các yêu cầu khác..." placeholderTextColor="#94A3B8" value={notes} onChangeText={setNotes} style={styles.input} multiline />
              </View>
              
              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
                <Text style={styles.infoText}>Hình thức thanh toán: Đặt cọc (Mặc định khi có kiểm định)</Text>
              </View>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Thông tin giao nhận</Text>
              
              <Text style={styles.subLabel}>Phương thức vận chuyển</Text>
              <View style={[styles.radioGroup, { marginBottom: 16 }]}>
                <TouchableOpacity style={styles.radioBtn} onPress={() => handleDeliveryMethodChange("SELLER_DELIVERY")}>
                  <Ionicons name={deliveryMethod === "SELLER_DELIVERY" ? "radio-button-on" : "radio-button-off"} size={24} color={deliveryMethod === "SELLER_DELIVERY" ? COLORS.primary : COLORS.textLight} />
                  <Text style={styles.radioText}>Bên bán tự giao</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.radioBtn} onPress={() => handleDeliveryMethodChange("BUYER_PICKUP")}>
                  <Ionicons name={deliveryMethod === "BUYER_PICKUP" ? "radio-button-on" : "radio-button-off"} size={24} color={deliveryMethod === "BUYER_PICKUP" ? COLORS.primary : COLORS.textLight} />
                  <Text style={styles.radioText}>Bên mua đến lấy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.radioBtn} onPress={() => handleDeliveryMethodChange("GHN")}>
                  <Ionicons name={deliveryMethod === "GHN" ? "radio-button-on" : "radio-button-off"} size={24} color={deliveryMethod === "GHN" ? COLORS.primary : COLORS.textLight} />
                  <Text style={styles.radioText}>Dịch vụ giao hàng (GHN)</Text>
                </TouchableOpacity>
              </View>

              {deliveryMethod === "GHN" && (
                <View style={styles.mockFeeBox}>
                  <Text style={styles.mockFeeText}>[MOCK] Phí ship GHN dự kiến: 35.000 đ</Text>
                  <Text style={styles.mockSubText}>(Chưa tích hợp API GHN, đây là số giả định)</Text>
                </View>
              )}

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Thời gian thu gom dự kiến</Text>
                <TextInput placeholder="VD: 2026-08-08" placeholderTextColor="#94A3B8" value={collectionDate} onChangeText={setCollectionDate} style={styles.input} />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Địa chỉ lấy hàng (Seller Address)</Text>
                <TextInput placeholder="Nhập địa chỉ lấy hàng..." placeholderTextColor="#94A3B8" value={pickupAddress} onChangeText={setPickupAddress} style={styles.input} />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Địa chỉ nhận hàng (Buyer Address)</Text>
                <TextInput placeholder="Nhập địa chỉ nhận hàng..." placeholderTextColor="#94A3B8" value={deliveryAddress} onChangeText={setDeliveryAddress} style={styles.input} />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Ghi chú thêm</Text>
                <TextInput placeholder="Ghi chú cho shipper hoặc đối tác..." placeholderTextColor="#94A3B8" value={notes} onChangeText={setNotes} style={styles.input} multiline />
              </View>
              
              <Text style={styles.subLabel}>Hình thức thanh toán</Text>
              <View style={styles.radioGroupRow}>
                <TouchableOpacity style={styles.radioBtnRow} onPress={() => deliveryMethod !== "GHN" && setPaymentType("DEPOSIT")} disabled={deliveryMethod === "GHN"}>
                  <Ionicons name={paymentType === "DEPOSIT" ? "radio-button-on" : "radio-button-off"} size={24} color={paymentType === "DEPOSIT" ? COLORS.primary : COLORS.border} />
                  <Text style={[styles.radioText, deliveryMethod === "GHN" && { color: COLORS.textLight }]}>Đặt cọc</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.radioBtnRow} onPress={() => setPaymentType("FULL")}>
                  <Ionicons name={paymentType === "FULL" ? "radio-button-on" : "radio-button-off"} size={24} color={paymentType === "FULL" ? COLORS.primary : COLORS.textLight} />
                  <Text style={styles.radioText}>Toàn phần</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={isProcessing}>
            {isProcessing ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.submitBtnText}>{isEditing ? "Cập Nhật Đơn" : "Gửi Đơn Xác Nhận"}</Text>
            )}
          </TouchableOpacity>
          
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { padding: 16, paddingBottom: 40 },
  
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: "bold", color: COLORS.text, marginBottom: 12 },
  
  summaryCard: { backgroundColor: COLORS.white, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  summaryProductName: { fontSize: 15, fontWeight: "600", color: COLORS.text, marginBottom: 8 },
  summaryPrice: { fontSize: 15, fontWeight: "bold", color: COLORS.primary, marginBottom: 4 },
  summaryQty: { fontSize: 14, color: COLORS.textLight },

  radioGroup: { backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  radioBtn: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  radioGroupRow: { flexDirection: "row", gap: 12 },
  radioBtnRow: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  radioText: { marginLeft: 12, fontSize: 15, color: COLORS.text },
  
  inputContainer: { marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: "600", color: COLORS.text, marginBottom: 8 },
  input: { backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 16, fontSize: 15, color: COLORS.text, ...(Platform.OS === "web" ? { outlineStyle: "none" } as any : {}) },
  
  infoBox: { flexDirection: "row", backgroundColor: "#E0F2FE", padding: 12, borderRadius: 8, alignItems: "center", marginTop: 8 },
  infoText: { color: "#0369A1", fontSize: 13, marginLeft: 8, flex: 1 },
  subLabel: { fontSize: 14, fontWeight: "600", color: COLORS.text, marginTop: 8, marginBottom: 12 },
  
  mockFeeBox: { backgroundColor: "#FEF2F2", padding: 12, borderRadius: 8, marginBottom: 16, alignItems: "center", borderWidth: 1, borderColor: "#FECACA" },
  mockFeeText: { color: "#DC2626", fontWeight: "bold" },
  mockSubText: { color: "#EF4444", fontSize: 11, fontStyle: "italic", marginTop: 4 },
  
  submitBtn: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 12, alignItems: "center", marginTop: 8 },
  submitBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "bold" }
});