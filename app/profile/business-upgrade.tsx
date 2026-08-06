import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
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
import { COLORS } from "../../src/constants/theme";

export default function BusinessUpgradeScreen() {
  const router = useRouter();

  // State: Phân loại mô hình (Hộ kinh doanh / Công ty)
  const [businessModel, setBusinessModel] = useState<"household" | "company">(
    "household",
  );

  // State: Thông tin định danh cơ sở/tổ chức (Bảng Business_Profile)
  const [businessName, setBusinessName] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [operatingScope, setOperatingScope] = useState(""); // VD: Nội thành, Toàn quốc

  // State: Thông tin người đại diện (Bảng Business_Profile nối với eKYC)
  const [representativeName, setRepresentativeName] = useState("");
  const [representativeRole, setRepresentativeRole] = useState(""); // Chỉ dùng cho Company
  const [representativeCode, setRepresentativeCode] = useState(""); // CCCD

  // State: Thông tin thanh toán
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  // Hàm xử lý gửi yêu cầu nâng cấp
  const handleUpgrade = () => {
    // [NOTE API]: Tạo Payload gửi sang Backend (Bảng Business_Profile & Business_Documents)
    const payload = {
      businessModel,
      businessInfo: { businessName, taxCode, businessAddress, operatingScope },
      representativeInfo: {
        representativeName,
        representativeRole,
        representativeCode,
      },
      bankInfo: { bankName, accountNumber, accountName },
      // Sau này bổ sung thêm các URL ảnh lấy từ Firebase/Cloudinary
    };

    console.log("Gửi Yêu cầu Nâng cấp Doanh nghiệp: ", payload);
    alert(
      "Yêu cầu nâng cấp của bạn đã được gửi. Vui lòng chờ Moderator phê duyệt!",
    );
    router.back();
  };

  // Component tiêu đề mục
  const SectionTitle = ({ title }: { title: string }) => (
    <View style={styles.sectionTitleContainer}>
      <View style={styles.sectionTitleBar} />
      <Text style={styles.sectionTitleText}>{title}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nâng cấp Doanh nghiệp</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle" size={20} color="#0284C7" />
            <Text style={styles.infoText}>
              Hồ sơ của bạn sẽ được Moderator phê duyệt. Vui lòng cung cấp chính
              xác thông tin pháp lý.
            </Text>
          </View>

          {/* CHỌN MÔ HÌNH */}
          <View style={styles.modelToggleContainer}>
            <TouchableOpacity
              style={[
                styles.modelTab,
                businessModel === "household" && styles.modelTabActive,
              ]}
              onPress={() => setBusinessModel("household")}
            >
              <Text
                style={[
                  styles.modelTabText,
                  businessModel === "household" && styles.modelTabTextActive,
                ]}
              >
                Hộ kinh doanh
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modelTab,
                businessModel === "company" && styles.modelTabActive,
              ]}
              onPress={() => setBusinessModel("company")}
            >
              <Text
                style={[
                  styles.modelTabText,
                  businessModel === "company" && styles.modelTabTextActive,
                ]}
              >
                Công ty / DN
              </Text>
            </TouchableOpacity>
          </View>

          {/* 1. THÔNG TIN ĐỊNH DANH */}
          <SectionTitle title="THÔNG TIN ĐỊNH DANH TỔ CHỨC" />

          <Text style={styles.label}>
            {businessModel === "household"
              ? "Tên Hộ kinh doanh"
              : "Tên doanh nghiệp đầy đủ"}
          </Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web" && ({ outlineStyle: "none" } as any),
              ]}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="VD: Công Ty TNHH ABC..."
            />
          </View>

          <Text style={styles.label}>Mã số thuế</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web" && ({ outlineStyle: "none" } as any),
              ]}
              value={taxCode}
              onChangeText={setTaxCode}
              keyboardType="number-pad"
              placeholder="Nhập mã số thuế..."
            />
          </View>

          <Text style={styles.label}>Khu vực hoạt động</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web" && ({ outlineStyle: "none" } as any),
              ]}
              value={operatingScope}
              onChangeText={setOperatingScope}
              placeholder="VD: Nội thành TP.HCM, Toàn quốc..."
            />
          </View>

          <Text style={styles.label}>Địa chỉ kinh doanh / Trụ sở chính</Text>
          <View
            style={[
              styles.inputContainer,
              { height: 80, alignItems: "flex-start", paddingTop: 12 },
            ]}
          >
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web" && ({ outlineStyle: "none" } as any),
              ]}
              value={businessAddress}
              onChangeText={setBusinessAddress}
              multiline
              placeholder="Nhập địa chỉ chi tiết..."
            />
          </View>

          {/* 2. THÔNG TIN NGƯỜI ĐẠI DIỆN */}
          <SectionTitle title="THÔNG TIN NGƯỜI ĐẠI DIỆN PHÁP LUẬT" />

          <Text style={styles.label}>Họ và tên (Trùng CCCD)</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web" && ({ outlineStyle: "none" } as any),
              ]}
              value={representativeName}
              onChangeText={setRepresentativeName}
              autoCapitalize="characters"
              placeholder="NGUYEN VAN A"
            />
          </View>

          {businessModel === "company" && (
            <>
              <Text style={styles.label}>Chức vụ</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[
                    styles.input,
                    Platform.OS === "web" && ({ outlineStyle: "none" } as any),
                  ]}
                  value={representativeRole}
                  onChangeText={setRepresentativeRole}
                  placeholder="VD: Giám đốc, Tổng giám đốc..."
                />
              </View>
            </>
          )}

          <Text style={styles.label}>Số CCCD</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web" && ({ outlineStyle: "none" } as any),
              ]}
              value={representativeCode}
              onChangeText={setRepresentativeCode}
              keyboardType="number-pad"
              placeholder="Nhập số CCCD..."
            />
          </View>

          {/* 3. HỒ SƠ PHÁP LÝ (Upload Hình ảnh) */}
          <SectionTitle title="HỒ SƠ PHÁP LÝ (TẢI LÊN)" />
          <Text style={styles.label}>Giấy phép ĐKKD (PDF / Ảnh)</Text>
          <TouchableOpacity style={styles.uploadBox}>
            <Ionicons
              name="cloud-upload-outline"
              size={28}
              color={COLORS.textLight}
            />
            <Text style={styles.uploadText}>Nhấn để tải lên giấy phép</Text>
          </TouchableOpacity>

          <Text style={styles.label}>CCCD Người đại diện (2 mặt)</Text>
          <View style={styles.cccdRow}>
            <TouchableOpacity style={styles.cccdBox}>
              <Text style={styles.uploadText}>Mặt trước</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cccdBox}>
              <Text style={styles.uploadText}>Mặt sau</Text>
            </TouchableOpacity>
          </View>

          {/* 4. THÔNG TIN THANH TOÁN */}
          <SectionTitle title="THÔNG TIN THANH TOÁN (RÚT TIỀN)" />
          <Text style={styles.label}>Ngân hàng thụ hưởng</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web" && ({ outlineStyle: "none" } as any),
              ]}
              value={bankName}
              onChangeText={setBankName}
              placeholder="VD: Vietcombank, Techcombank..."
            />
          </View>

          <Text style={styles.label}>Số tài khoản</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web" && ({ outlineStyle: "none" } as any),
              ]}
              value={accountNumber}
              onChangeText={setAccountNumber}
              keyboardType="number-pad"
              placeholder="Nhập số tài khoản..."
            />
          </View>

          <Text style={styles.label}>
            Tên chủ tài khoản (Trùng với Tổ chức/Đại diện)
          </Text>
          <View style={[styles.inputContainer, { marginBottom: 32 }]}>
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web" && ({ outlineStyle: "none" } as any),
              ]}
              value={accountName}
              onChangeText={setAccountName}
              autoCapitalize="characters"
              placeholder="CONG TY TNHH ABC"
            />
          </View>

          {/* SUBMIT */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleUpgrade}
          >
            <Text style={styles.primaryButtonText}>GỬI YÊU CẦU DUYỆT</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: { padding: 4, marginLeft: -4 },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: COLORS.text },
  scrollContainer: { paddingHorizontal: 20, paddingBottom: 40 },

  infoBanner: {
    flexDirection: "row",
    backgroundColor: "#E0F2FE",
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 20,
    alignItems: "center",
    gap: 10,
  },
  infoText: { flex: 1, fontSize: 13, color: "#0369A1", lineHeight: 20 },

  modelToggleContainer: {
    flexDirection: "row",
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  modelTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 8,
  },
  modelTabActive: {
    backgroundColor: COLORS.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  modelTabText: { fontSize: 14, fontWeight: "600", color: COLORS.textLight },
  modelTabTextActive: { color: COLORS.primary, fontWeight: "bold" },

  sectionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 16,
  },
  sectionTitleBar: {
    width: 4,
    height: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
    marginRight: 8,
  },
  sectionTitleText: { fontSize: 15, fontWeight: "bold", color: "#334155" },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 52,
    backgroundColor: COLORS.white,
    marginBottom: 20,
  },
  input: { flex: 1, fontSize: 15, color: COLORS.text, height: "100%" },

  uploadBox: {
    height: 100,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    gap: 8,
  },
  cccdRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  cccdBox: {
    flex: 1,
    height: 90,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  uploadText: { fontSize: 13, color: COLORS.textLight, fontWeight: "500" },

  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 54,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButtonText: { color: COLORS.white, fontSize: 16, fontWeight: "bold" },
});
