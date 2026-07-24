import { Ionicons } from "@expo/vector-icons";
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

export default function RegisterScreen() {
  const router = useRouter();

  const [role, setRole] = useState<"personal" | "business">("personal");
  const [email, setEmail] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(auth)/login" as any);
    }
  };

  const handleRegister = () => {
    if (!email) {
      alert("Vui lòng điền Email");
      return;
    }
    if (!agreeTerms) {
      alert("Vui lòng đồng ý với điều khoản dịch vụ");
      return;
    }

    // ĐÃ SỬA: Cả luồng Cá nhân và Doanh nghiệp đều đi qua bước xác thực OTP
    router.push({
      pathname: "/(auth)/otp",
      params: { email: email, flow: "register", role: role },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>HomeCycle</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Khung nội dung chính */}
          <View style={styles.contentCard}>
            <Text style={styles.title}>Tạo tài khoản</Text>
            <Text style={styles.subtitle}>
              Bắt đầu hành trình mua bán đồ cũ an toàn và chuyên nghiệp.
            </Text>

            {/* Chuyển đổi Cá nhân / Doanh nghiệp */}
            <View style={styles.roleContainer}>
              <TouchableOpacity
                style={[
                  styles.roleTab,
                  role === "personal" ? styles.roleTabActive : null,
                ]}
                onPress={() => setRole("personal")}
              >
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={
                    role === "personal" ? COLORS.primary : COLORS.textLight
                  }
                />
                <Text
                  style={[
                    styles.roleTabText,
                    role === "personal" ? styles.roleTabTextActive : null,
                  ]}
                >
                  Cá nhân
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleTab,
                  role === "business" ? styles.roleTabActive : null,
                ]}
                onPress={() => setRole("business")}
              >
                <Ionicons
                  name="business-outline"
                  size={20}
                  color={
                    role === "business" ? COLORS.primary : COLORS.textLight
                  }
                />
                <Text
                  style={[
                    styles.roleTabText,
                    role === "business" ? styles.roleTabTextActive : null,
                  ]}
                >
                  Doanh nghiệp
                </Text>
              </TouchableOpacity>
            </View>

            {/* Ô nhập Email */}
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputContainer}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={COLORS.textLight}
                style={styles.inputIcon}
              />
              <TextInput
                style={[
                  styles.input,
                  Platform.OS === "web" && ({ outlineStyle: "none" } as any),
                ]}
                placeholder="example@gmail.com"
                placeholderTextColor={COLORS.textLight}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {/* Checkbox Điều khoản */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setAgreeTerms(!agreeTerms)}
            >
              <Ionicons
                name={agreeTerms ? "checkbox" : "square-outline"}
                size={22}
                color={agreeTerms ? COLORS.primary : COLORS.textLight}
              />
              <Text style={styles.checkboxLabel}>
                Tôi đồng ý với{" "}
                <Text style={styles.linkText}>điều khoản dịch vụ</Text> và{" "}
                <Text style={styles.linkText}>chính sách bảo mật</Text> của
                HomeCycle.
              </Text>
            </TouchableOpacity>

            {/* Nút Đăng Ký */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleRegister}
            >
              <Text style={styles.primaryButtonText}>Đăng ký</Text>
            </TouchableOpacity>

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>HOẶC ĐĂNG KÝ BẰNG</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Nút Google */}
            <TouchableOpacity style={styles.googleButton}>
              <Image
                source={require("../../assets/images/google-icon.png")}
                style={{ width: 22, height: 22 }}
                resizeMode="contain"
              />
              <Text style={styles.googleButtonText}>Google</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Đã có tài khoản? </Text>
            <TouchableOpacity
              onPress={() => router.replace("/(auth)/login" as any)}
            >
              <Text style={styles.loginText}>Đăng nhập ngay</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scrollContainer: { paddingHorizontal: 20, paddingBottom: 30 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 24,
  },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: COLORS.primary },
  contentCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      web: { boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.05)" } as any,
    }),
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    lineHeight: 20,
    marginBottom: 24,
  },
  roleContainer: { flexDirection: "row", gap: 12, marginBottom: 24 },
  roleTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 54,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.white,
  },
  roleTabActive: {
    borderColor: COLORS.primary,
    backgroundColor: "#E6F0F0",
    borderWidth: 1.5,
  },
  roleTabText: { fontSize: 14, fontWeight: "600", color: COLORS.textLight },
  roleTabTextActive: { color: COLORS.primary, fontWeight: "bold" },
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
    height: 52,
    backgroundColor: "#FAFAFA",
    marginBottom: 24,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 15, color: COLORS.text },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: -4,
    marginBottom: 20,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textLight,
    lineHeight: 18,
  },
  linkText: { color: COLORS.primary, fontWeight: "600" },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButtonText: { color: COLORS.white, fontSize: 16, fontWeight: "bold" },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 11,
    color: COLORS.textLight,
    fontWeight: "600",
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    height: 52,
    gap: 12,
  },
  googleButtonText: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  footerText: { fontSize: 14, color: COLORS.textLight },
  loginText: { fontSize: 14, fontWeight: "bold", color: COLORS.primary },
});
