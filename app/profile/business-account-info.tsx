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

export default function BusinessAccountInfoScreen() {
  const router = useRouter();

  // ================= STATE: THÔNG TIN CƠ BẢN =================
  const [businessName, setBusinessName] = useState(
    "Công Ty TNHH Thu Mua Ánh Sáng",
  );
  const [businessDescription, setBusinessDescription] = useState(
    "Chuyên thu mua đồ điện máy, nội thất văn phòng thanh lý giá cao tại khu vực miền Nam.",
  );
  const [phoneNumber, setPhoneNumber] = useState("0901234567");
  const [email, setEmail] = useState("contact@anhsang.vn");

  // ================= STATE: THÔNG TIN PHÁP LÝ & ĐỊNH DANH =================
  const [taxCode, setTaxCode] = useState("0312345678");
  const [operatingScope, setOperatingScope] = useState(
    "Nội thành TP.HCM, Bình Dương, Đồng Nai",
  );
  const [businessAddress, setBusinessAddress] = useState(
    "123 Đường D1, Phường 25, Quận Bình Thạnh, TP.HCM",
  );
  const [representativeName, setRepresentativeName] = useState("NGUYEN VAN A");
  const [representativeCode, setRepresentativeCode] = useState("079099123456");

  // ================= STATE: THÔNG TIN THANH TOÁN =================
  const [bankName, setBankName] = useState("Techcombank");
  const [accountNumber, setAccountNumber] = useState("19031234567890");
  const [accountName, setAccountName] = useState(
    "CONG TY TNHH THU MUA ANH SANG",
  );

  const handleSaveChanges = () => {
    console.log("Saving Business Profile...");
    alert(
      "Cập nhật thành công! Các thay đổi về giấy tờ pháp lý đang chờ Moderator phê duyệt.",
    );
    router.back();
  };

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
          <Text style={styles.headerTitle}>Hồ sơ Doanh nghiệp</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Cảnh báo quy tắc nghiệp vụ */}
          <View style={styles.warningBanner}>
            <Ionicons name="warning-outline" size={20} color="#B45309" />
            <Text style={styles.warningText}>
              Lưu ý: Việc thay đổi các thông tin pháp lý (Mã số thuế, CCCD, Giấy
              phép) sẽ yêu cầu Moderator phê duyệt lại để tài khoản tiếp tục
              hoạt động.
            </Text>
          </View>

          {/* Logo Upload */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatarPlaceholder}>
              <Ionicons
                name="business-outline"
                size={40}
                color={COLORS.textLight}
              />
              <TouchableOpacity style={styles.cameraIcon}>
                <Ionicons name="camera" size={16} color={COLORS.white} />
              </TouchableOpacity>
            </View>
            <Text style={styles.avatarLabel}>Cập nhật Logo</Text>
          </View>

          {/* ================= PHẦN 1: THÔNG TIN CƠ BẢN ================= */}
          <SectionTitle title="THÔNG TIN CƠ BẢN" />

          <Text style={styles.label}>Tên doanh nghiệp / Hộ kinh doanh</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web" && ({ outlineStyle: "none" } as any),
              ]}
              value={businessName}
              onChangeText={setBusinessName}
            />
          </View>

          <Text style={styles.label}>Email liên hệ (Cố định)</Text>
          <View style={[styles.inputContainer, styles.inputDisabled]}>
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web" && ({ outlineStyle: "none" } as any),
                { color: COLORS.textLight },
              ]}
              value={email}
              editable={false}
            />
            <Ionicons name="lock-closed" size={16} color={COLORS.border} />
          </View>

          <Text style={styles.label}>Số điện thoại</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web" && ({ outlineStyle: "none" } as any),
              ]}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
            />
          </View>

          <Text style={styles.label}>Mô tả doanh nghiệp</Text>
          <View
            style={[
              styles.inputContainer,
              { height: 100, alignItems: "flex-start", paddingTop: 12 },
            ]}
          >
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web" && ({ outlineStyle: "none" } as any),
              ]}
              value={businessDescription}
              onChangeText={setBusinessDescription}
              multiline
              placeholder="Mô tả lĩnh vực hoạt động..."
            />
          </View>

          {/* ================= PHẦN 2: THÔNG TIN PHÁP LÝ ================= */}
          <SectionTitle title="THÔNG TIN PHÁP LÝ (CẦN DUYỆT)" />

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

          <Text style={styles.label}>Địa chỉ Trụ sở / Kho bãi</Text>
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
            />
          </View>

          <Text style={styles.label}>Giấy phép ĐKKD (Đã duyệt)</Text>
          <TouchableOpacity style={styles.uploadBox}>
            <Ionicons name="document-text" size={28} color={COLORS.primary} />
            <Text style={[styles.uploadText, { color: COLORS.primary }]}>
              GP_DKKD_CongTyAnhSang.pdf
            </Text>
            <Text
              style={{ fontSize: 11, color: COLORS.textLight, marginTop: 4 }}
            >
              (Nhấn để tải lên bản mới)
            </Text>
          </TouchableOpacity>

          <Text style={styles.label}>Người đại diện pháp luật</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web" && ({ outlineStyle: "none" } as any),
              ]}
              value={representativeName}
              onChangeText={setRepresentativeName}
              autoCapitalize="characters"
            />
          </View>

          <Text style={styles.label}>Số CCCD người đại diện</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web" && ({ outlineStyle: "none" } as any),
              ]}
              value={representativeCode}
              onChangeText={setRepresentativeCode}
              keyboardType="number-pad"
            />
          </View>

          {/* ================= PHẦN 3: THÔNG TIN THANH TOÁN ================= */}
          <SectionTitle title="THÔNG TIN THANH TOÁN" />

          <Text style={styles.label}>Ngân hàng thụ hưởng</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web" && ({ outlineStyle: "none" } as any),
              ]}
              value={bankName}
              onChangeText={setBankName}
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
            />
          </View>

          <Text style={styles.label}>Tên chủ tài khoản (Trùng với GPKD)</Text>
          <View style={[styles.inputContainer, { marginBottom: 32 }]}>
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web" && ({ outlineStyle: "none" } as any),
              ]}
              value={accountName}
              onChangeText={setAccountName}
              autoCapitalize="characters"
            />
          </View>

          {/* Nút LƯU THAY ĐỔI */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSaveChanges}
          >
            <Text style={styles.primaryButtonText}>LƯU THAY ĐỔI</Text>
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

  warningBanner: {
    flexDirection: "row",
    backgroundColor: "#FEF3C7",
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 16,
    alignItems: "flex-start",
    gap: 10,
  },
  warningText: { flex: 1, fontSize: 12, color: "#92400E", lineHeight: 18 },

  avatarContainer: { alignItems: "center", marginTop: 8, marginBottom: 16 },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  cameraIcon: {
    position: "absolute",
    bottom: -8,
    right: -8,
    backgroundColor: COLORS.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  avatarLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 12,
    fontWeight: "600",
  },

  sectionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
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
  inputDisabled: { backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" },
  input: { flex: 1, fontSize: 15, color: COLORS.text, height: "100%" },

  uploadBox: {
    height: 90,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    borderStyle: "dashed",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  uploadText: { fontSize: 13, fontWeight: "600", marginTop: 8 },

  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 54,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButtonText: { color: COLORS.white, fontSize: 16, fontWeight: "bold" },
});
