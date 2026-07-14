import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useAuth } from '../../src/contexts/AuthContext';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS } from "../../src/constants/theme";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const { login } = useAuth();
  const { returnUrl } = useLocalSearchParams();

  const handleNext = () => {
    if (!email) {
      alert("Vui lòng nhập email");
      return;
    }
    // ĐI THẲNG TỚI TRANG NHẬP MẬT KHẨU
    router.push({
      pathname: "/(auth)/password",
      params: { email: email, returnUrl: returnUrl }, 
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.logoContainer}>
            <Ionicons name="sync-circle" size={28} color={COLORS.primary} />
            <Text style={styles.logoText}>HomeCycle</Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.contentCard}>
          <Text style={styles.title}>Đăng nhập vào tài khoản của bạn</Text>

          <Text style={styles.label}>ĐỊA CHỈ EMAIL</Text>
          <View style={styles.inputContainer}>
            <Ionicons
              name="mail-outline"
              size={20}
              color={COLORS.textLight}
              style={styles.inputIcon}
            />
            <TextInput
              // Chèn outlineStyle ở đây để TypeScript không báo lỗi trong StyleSheet
              style={[
                styles.input,
                Platform.OS === "web" && ({ outlineStyle: "none" } as any),
              ]}
              placeholder="Nhập địa chỉ email của bạn..."
              placeholderTextColor={COLORS.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
            <Text style={styles.primaryButtonText}>TIẾP THEO</Text>
            <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>HOẶC TIẾP TỤC VỚI</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Nút Google */}
          <TouchableOpacity style={styles.googleButton}>
            <Image
              // Trỏ đường dẫn tương đối từ thư mục (auth) ra ngoài thư mục gốc rồi vào assets
              source={require("../../assets/images/google-icon.png")}
              style={{ width: 22, height: 22 }}
              resizeMode="contain"
            />
            <Text style={styles.googleButtonText}>Google</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Bạn chưa có tài khoản? </Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
            <Text style={styles.registerText}>Đăng ký tài khoản</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 40,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoText: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.primary,
  },
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
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.05)",
      } as any, // Ép kiểu as any để TS bỏ qua lỗi này
    }),
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 30,
    lineHeight: 32,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textLight,
    marginBottom: 8,
    letterSpacing: 0.5,
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
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "bold",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    marginHorizontal: 16,
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
  googleButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 32,
  },
  footerText: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  registerText: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.primary,
  },
});
