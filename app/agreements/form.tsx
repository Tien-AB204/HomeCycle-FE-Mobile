import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
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

export default function AgreementFormScreen() {
  const router = useRouter();
  const { negotiationId } = useLocalSearchParams();

  // State rẽ nhánh loại giao dịch
  const [isInspection, setIsInspection] = useState(true);

  // State form chung
  const [paymentType, setPaymentType] = useState<"DEPOSIT" | "FULL">("DEPOSIT");

  // State cho Kiểm định (Inspection)
  const [inspectionDate, setInspectionDate] = useState("");
  const [inspectionAddress, setInspectionAddress] = useState("");
  const [notes, setNotes] = useState("");

  // State cho Thu gom (Collection)
  const [deliveryMethod, setDeliveryMethod] = useState<"SELLER_DELIVERY" | "BUYER_PICKUP" | "GHN">("SELLER_DELIVERY");
  const [collectionDate, setCollectionDate] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");

  const handleDeliveryMethodChange = (method: any) => {
    setDeliveryMethod(method);
    if (method === "GHN") {
      setPaymentType("FULL"); // Quy tắc: Chọn GHN bắt buộc thanh toán toàn phần
    }
  };

  const handleSubmit = () => {
    // Mock chuyển sang trang Preview
    router.push(`/agreements/preview?negotiationId=${negotiationId}`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Thiết lập đơn xác nhận" showBack={true} />
      
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* BANNER MOCK */}
          <View style={styles.mockBanner}>
            <Ionicons name="warning-outline" size={20} color="#B45309" />
            <Text style={styles.mockText}>(đây là thông tin đang mock, sau này sẽ xóa)</Text>
          </View>

          {/* KHỐI 1: TÓM TẮT HÀNG HÓA */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tóm tắt giao dịch</Text>
            <View style={styles.card}>
              <Text style={styles.productName}>Smart Tivi Samsung UHD 4K 55 inch</Text>
              <Text style={styles.priceText}>Giá chốt: 9.000.000 đ</Text>
              <Text style={styles.qtyText}>Số lượng: 1</Text>
            </View>
          </View>

          {/* KHỐI 2: CHỌN LOẠI GIAO DỊCH */}
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

          {/* KHỐI 3: FORM ĐỘNG */}
          {isInspection ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Thông tin kiểm định</Text>
              <View style={styles.inputBox}><TextInput placeholder="Thời gian hẹn (VD: 14:00 - 08/08/2026)" value={inspectionDate} onChangeText={setInspectionDate} style={styles.input} /></View>
              <View style={styles.inputBox}><TextInput placeholder="Địa điểm kiểm định" value={inspectionAddress} onChangeText={setInspectionAddress} style={styles.input} /></View>
              <View style={styles.inputBox}><TextInput placeholder="Ghi chú thêm..." value={notes} onChangeText={setNotes} style={styles.input} multiline /></View>
              
              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
                <Text style={styles.infoText}>Hình thức thanh toán: Đặt cọc (Mặc định khi có kiểm định)</Text>
              </View>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Thông tin giao nhận</Text>
              
              <Text style={styles.subLabel}>Phương thức vận chuyển</Text>
              <View style={styles.radioGroup}>
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
                  <Text style={styles.mockFeeText}>Phí ship GHN dự kiến: 35.000 đ</Text>
                  <Text style={styles.mockSubText}>(đây là thông tin đang mock, sau này sẽ xóa)</Text>
                </View>
              )}

              <View style={styles.inputBox}><TextInput placeholder="Thời gian thu gom dự kiến" value={collectionDate} onChangeText={setCollectionDate} style={styles.input} /></View>
              <View style={styles.inputBox}><TextInput placeholder="Địa chỉ lấy hàng (Seller Address)" value={pickupAddress} onChangeText={setPickupAddress} style={styles.input} /></View>
              <View style={styles.inputBox}><TextInput placeholder="Địa chỉ nhận hàng (Buyer Address)" value={deliveryAddress} onChangeText={setDeliveryAddress} style={styles.input} /></View>
              
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

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
            <Text style={styles.submitBtnText}>Gửi Đơn Xác Nhận</Text>
          </TouchableOpacity>
          
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: 16, paddingBottom: 40 },
  mockBanner: { flexDirection: "row", backgroundColor: "#FEF3C7", padding: 12, borderRadius: 8, alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: "#F59E0B" },
  mockText: { color: "#B45309", fontSize: 13, fontStyle: "italic", marginLeft: 8, flex: 1 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: "bold", color: COLORS.text, marginBottom: 12 },
  card: { backgroundColor: COLORS.white, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  productName: { fontSize: 15, fontWeight: "600", marginBottom: 8 },
  priceText: { fontSize: 14, color: COLORS.primary, fontWeight: "bold", marginBottom: 4 },
  qtyText: { fontSize: 13, color: COLORS.textLight },
  radioGroup: { backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  radioBtn: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  radioGroupRow: { flexDirection: "row", gap: 12 },
  radioBtnRow: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  radioText: { marginLeft: 12, fontSize: 15, color: COLORS.text },
  inputBox: { backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 },
  input: { padding: 16, fontSize: 15, color: COLORS.text, ...(Platform.OS === "web" ? { outlineStyle: "none" } as any : {}) },
  infoBox: { flexDirection: "row", backgroundColor: "#E0F2FE", padding: 12, borderRadius: 8, alignItems: "center" },
  infoText: { color: "#0369A1", fontSize: 13, marginLeft: 8, flex: 1 },
  subLabel: { fontSize: 14, fontWeight: "600", color: COLORS.text, marginTop: 8, marginBottom: 8 },
  mockFeeBox: { backgroundColor: "#F3F4F6", padding: 12, borderRadius: 8, marginBottom: 12, alignItems: "center" },
  mockFeeText: { color: COLORS.text, fontWeight: "bold" },
  mockSubText: { color: COLORS.error, fontSize: 11, fontStyle: "italic", marginTop: 4 },
  submitBtn: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 12, alignItems: "center", marginTop: 8 },
  submitBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "bold" }
});