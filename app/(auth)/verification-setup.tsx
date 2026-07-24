// app/(auth)/verification-setup.tsx
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker"; // Import thư viện chọn ảnh
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Image,
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

export default function VerificationSetupScreen() {
  const router = useRouter();

  // State lưu thông tin xác minh
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");

  // State lưu đường dẫn ảnh CCCD
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);

  // Hàm mở thư viện ảnh
  const pickImage = async (side: "front" | "back") => {
    // Gọi cửa sổ chọn ảnh
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, // Cho phép crop ảnh
      aspect: [4, 3], // Tỷ lệ khung hình của ảnh CCCD
      quality: 0.8, // Giảm chất lượng 1 chút để app nhẹ hơn
    });

    // Nếu người dùng chọn ảnh (không bấm hủy)
    if (!result.canceled) {
      if (side === "front") {
        setFrontImage(result.assets[0].uri);
      } else {
        setBackImage(result.assets[0].uri);
      }
    }
  };

  const handleComplete = () => {
    console.log("Dữ liệu gửi lên:", {
      bankName,
      bankAccount,
      bankAccountName,
      frontImage,
      backImage,
    });
    // Hoàn thành toàn bộ luồng, bay vào App chính
    router.replace("/(tabs)");
  };

  const handleSkip = () => {
    // Bỏ qua bước này, bay vào App chính
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Nút Back quay lại trang 1 */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerCenter}>
            <Ionicons
              name="shield-checkmark"
              size={48}
              color="#27AE60"
              style={{ marginBottom: 8 }}
            />
            <Text style={styles.title}>Xác minh & Thanh toán</Text>
            <Text style={styles.subtitle}>
              Bước 2/2: Bổ sung để tăng uy tín và nhận tiền bán hàng. Có thể
              thiết lập sau.
            </Text>
          </View>

          {/* ================= SECTION: HỒ SƠ PHÁP LÝ ================= */}
          <View style={styles.sectionHeader}>
            <View style={styles.verticalBar} />
            <Text style={styles.sectionTitle}>HỒ SƠ PHÁP LÝ</Text>
          </View>

          <Text style={styles.fieldLabel}>CCCD của bạn</Text>
          <View style={styles.cccdContainer}>
            {/* Box chọn ảnh mặt trước */}
            <TouchableOpacity
              style={styles.cccdUploadBox}
              onPress={() => pickImage("front")}
            >
              {frontImage ? (
                <Image
                  source={{ uri: frontImage }}
                  style={styles.cccdImage}
                  resizeMode="cover"
                />
              ) : (
                <>
                  <Ionicons
                    name="camera-outline"
                    size={24}
                    color={COLORS.textLight}
                  />
                  <Text style={styles.cccdUploadText}>Mặt trước</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Box chọn ảnh mặt sau */}
            <TouchableOpacity
              style={styles.cccdUploadBox}
              onPress={() => pickImage("back")}
            >
              {backImage ? (
                <Image
                  source={{ uri: backImage }}
                  style={styles.cccdImage}
                  resizeMode="cover"
                />
              ) : (
                <>
                  <Ionicons
                    name="camera-outline"
                    size={24}
                    color={COLORS.textLight}
                  />
                  <Text style={styles.cccdUploadText}>Mặt sau</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* ================= SECTION: THÔNG TIN THANH TOÁN ================= */}
          <View style={styles.sectionHeader}>
            <View style={styles.verticalBar} />
            <Text style={styles.sectionTitle}>THÔNG TIN THANH TOÁN</Text>
          </View>

          <View style={styles.paymentWrapper}>
            <Text style={styles.fieldLabel}>Ngân hàng thụ hưởng</Text>
            <View style={styles.inputContainerWhite}>
              <TextInput
                style={[
                  styles.input,
                  Platform.OS === "web" && ({ outlineStyle: "none" } as any),
                ]}
                placeholder="VD: Vietcombank, Techcombank..."
                placeholderTextColor={COLORS.textLight}
                value={bankName}
                onChangeText={setBankName}
              />
            </View>

            <Text style={styles.fieldLabel}>Số tài khoản</Text>
            <View style={styles.inputContainerWhite}>
              <TextInput
                style={[
                  styles.input,
                  Platform.OS === "web" && ({ outlineStyle: "none" } as any),
                ]}
                placeholder="Nhập số tài khoản ngân hàng"
                placeholderTextColor={COLORS.textLight}
                keyboardType="numeric"
                value={bankAccount}
                onChangeText={setBankAccount}
              />
            </View>

            <Text style={styles.fieldLabel}>
              Tên chủ tài khoản (Phải khớp với CCCD)
            </Text>
            <View style={styles.inputContainerWhite}>
              <TextInput
                style={[
                  styles.input,
                  Platform.OS === "web" && ({ outlineStyle: "none" } as any),
                ]}
                placeholder="VD: NGUYEN VAN A"
                placeholderTextColor={COLORS.textLight}
                autoCapitalize="characters"
                value={bankAccountName}
                onChangeText={setBankAccountName}
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleComplete}
          >
            <Text style={styles.primaryButtonText}>HOÀN THÀNH</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipButtonText}>Bỏ qua & Thiết lập sau</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  backButton: { padding: 4, marginLeft: -4, alignSelf: "flex-start" },
  scrollContainer: { paddingHorizontal: 20, paddingBottom: 40 },
  headerCenter: { alignItems: "center", marginBottom: 32 },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 8,
  },
  verticalBar: {
    width: 4,
    height: 16,
    backgroundColor: "#34495E",
    marginRight: 8,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#34495E",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 8,
  },
  inputContainerWhite: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 48,
    backgroundColor: COLORS.white,
    marginBottom: 16,
  },
  input: { flex: 1, fontSize: 14, color: COLORS.text },

  // Style CCCD
  cccdContainer: { flexDirection: "row", gap: 12, marginBottom: 32 },
  cccdUploadBox: {
    flex: 1,
    height: 100,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    overflow: "hidden", // overflow hidden để ảnh không tràn ra ngoài góc bo
  },
  cccdUploadText: { fontSize: 12, color: COLORS.textLight, marginTop: 8 },
  cccdImage: { width: "100%", height: "100%" },

  paymentWrapper: {
    backgroundColor: "#F4F7F8",
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  primaryButtonText: { color: COLORS.white, fontSize: 15, fontWeight: "bold" },
  skipButton: { height: 48, justifyContent: "center", alignItems: "center" },
  skipButtonText: { color: "#607D8B", fontSize: 15, fontWeight: "600" },
});
