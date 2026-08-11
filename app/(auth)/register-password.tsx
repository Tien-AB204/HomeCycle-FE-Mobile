// app/(auth)/register-password.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
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
import { authApi } from "../../src/services/apis/authApi";

export default function RegisterPasswordScreen() {
  const router = useRouter();

  // Hứng dữ liệu từ màn hình trước
  const { email, role, registrationToken, isGoogleAuth } =
    useLocalSearchParams();

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(auth)/register");
  };

  const handleNext = async () => {
    if (password.length < 6) {
      alert("Mật khẩu phải từ 6 ký tự trở lên");
      return;
    }

    if (role === "business") {
      try {
        setIsLoading(true);
        // 1. Gọi API tạo tài khoản doanh nghiệp
        const res = await authApi.registerBusiness(
          registrationToken as string,
          password,
        );

        // 2. Bóc tách token từ response (theo cấu trúc bọc "data" của BE)
        const responseData = res?.data?.data || res?.data;
        const { accessToken, refreshToken } = responseData;

        // 3. Nếu có accessToken, lưu thẳng vào Storage (Bỏ qua Login)
        if (accessToken) {
          await AsyncStorage.setItem("accessToken", accessToken);
          if (refreshToken)
            await AsyncStorage.setItem("refreshToken", refreshToken);

          // Đánh dấu role là business để AuthContext biết
          await AsyncStorage.setItem("userRole", "business");

          // Chuyển thẳng sang màn setup hồ sơ
          router.push({
            pathname: "/(auth)/business-setup",
            params: { email, isGoogleAuth },
          });
        } else {
          throw new Error("Không nhận được Token từ máy chủ.");
        }
      } catch (error: any) {
        console.error(
          "Lỗi tạo tài khoản business:",
          error.response?.data || error,
        );
        alert(
          error.response?.data?.message || "Có lỗi xảy ra khi tạo tài khoản!",
        );
      } finally {
        setIsLoading(false);
      }
    } else {
      // Đối với người dùng cá nhân (Personal): Chuyển tiếp dữ liệu sang Bước 2 để nhập nốt Profile
      router.push({
        pathname: "/(auth)/profile-setup",
        params: { email, password, registrationToken, isGoogleAuth },
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.contentCard}>
          <View style={styles.logoCenterContainer}>
            <View style={styles.logoBox}>
              <Ionicons name="sync-circle" size={32} color={COLORS.white} />
            </View>
            <Text style={styles.logoText}>HomeCycle</Text>
            <Text style={styles.title}>Tạo mật khẩu</Text>
          </View>

          <Text style={styles.label}>Tài khoản</Text>
          <View style={[styles.inputContainer, styles.inputDisabled]}>
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
                { color: COLORS.text },
              ]}
              value={email as string}
              editable={false}
            />
          </View>

          <Text style={styles.label}>Mật khẩu</Text>
          <View style={styles.inputContainer}>
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={COLORS.textLight}
              style={styles.inputIcon}
            />
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web" && ({ outlineStyle: "none" } as any),
              ]}
              placeholder="Tối thiểu 6 ký tự..."
              placeholderTextColor={COLORS.textLight}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              editable={!isLoading}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
              disabled={isLoading}
            >
              <Ionicons
                name={showPassword ? "eye-outline" : "eye-off-outline"}
                size={20}
                color={COLORS.textLight}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleNext}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.primaryButtonText}>TIẾP TỤC</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Đã có tài khoản? </Text>
          <TouchableOpacity
            onPress={() => router.replace("/(auth)/login" as any)}
            disabled={isLoading}
          >
            <Text style={styles.registerText}>Đăng nhập ngay</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 20,
  },
  backButton: { padding: 8, marginLeft: -8 },
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
  logoCenterContainer: { alignItems: "center", marginBottom: 32 },
  logoBox: {
    backgroundColor: COLORS.primary,
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  logoText: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.primary,
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: "bold", color: COLORS.text },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textLight,
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
    backgroundColor: COLORS.white,
    marginBottom: 24,
  },
  inputIcon: { marginRight: 12 },
  inputDisabled: { backgroundColor: "#F5F5F5", borderColor: "#E0E0E0" },
  input: { flex: 1, fontSize: 15, color: COLORS.text },
  eyeIcon: { padding: 4 },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButtonText: { color: COLORS.white, fontSize: 15, fontWeight: "bold" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 32 },
  footerText: { fontSize: 14, color: COLORS.textLight },
  registerText: { fontSize: 14, fontWeight: "bold", color: COLORS.primary },
});
