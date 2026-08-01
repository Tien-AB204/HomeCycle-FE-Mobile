import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator
} from "react-native";
import { COLORS } from "../../src/constants/theme";
import { authApi } from "../../src/services/apis/authApi"; // IMPORT API CLIENT

export default function OTPScreen() {
  const router = useRouter();
  const { email, flow, role } = useLocalSearchParams();

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const [timeLeft, setTimeLeft] = useState(118);
  const [isLoading, setIsLoading] = useState(false); // THÊM STATE LOADING

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleOtpChange = (text: string, index: number) => {
    const value = text.length > 0 ? text[text.length - 1] : "";
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newOtp.every((val) => val !== "")) {
      handleVerify(newOtp.join(""));
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (fullOtp: string) => {
    if (!flow) {
      alert("Lỗi: Không nhận được dữ liệu luồng!");
      return;
    }

    try {
      setIsLoading(true);
      
      // 1. GỌI API XÁC THỰC OTP
      const response = await authApi.verifyOtp(email as string, fullOtp);
      
      // Bắt lấy Registration Token từ Backend trả về
      // (Tùy thuộc vào cấu trúc json backend trả về, thường nằm trong data)
      const token = response.data?.registrationToken || response.data?.data?.registrationToken;

      if (flow === "login") {
        router.replace("/(tabs)");
      } else if (flow === "register") {
        // LUỒNG ĐĂNG KÝ: Chuyển qua trang tiếp theo và NHÉT THÊM TOKEN vào Params
        router.push({
          pathname: "/(auth)/register-password",
          params: { email, role, registrationToken: token },
        });
      } else if (flow === "forgot_password") {
        router.push("/(auth)/reset-password");
      }
    } catch (error: any) {
      console.error("Lỗi xác thực OTP:", error);
      alert(error.response?.data?.message || "Mã OTP không chính xác hoặc đã hết hạn!");
    } finally {
      setIsLoading(false);
    }
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
        </View>

        <View style={styles.contentCard}>
          <View style={styles.iconCenterContainer}>
            <View style={styles.lockIconBox}>
              <Ionicons name="lock-closed" size={32} color={COLORS.white} />
            </View>
            <Text style={styles.title}>Xác thực Email</Text>
            <Text style={styles.subtitle}>
              Hệ thống đã gửi mã OTP gồm 6 chữ số đến email của bạn. Vui lòng
              kiểm tra và gõ vào ô bên dưới.
            </Text>
          </View>

          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                style={[
                  styles.otpInput,
                  Platform.OS === "web" && ({ outlineStyle: "none" } as any),
                  digit ? styles.otpInputActive : null,
                ]}
                keyboardType="number-pad"
                maxLength={1}
                value={digit}
                onChangeText={(text) => handleOtpChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                editable={!isLoading} // Không cho gõ thêm nếu đang gọi API
              />
            ))}
          </View>

          {/* HIỂN THỊ LOADING NHỎ KHI ĐANG KIỂM TRA OTP */}
          {isLoading && (
             <ActivityIndicator size="small" color={COLORS.primary} style={{ marginBottom: 16 }} />
          )}

          <View style={styles.timerContainer}>
            <Ionicons name="time" size={16} color={COLORS.error} />
            <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
          </View>

          <View style={styles.resendContainer}>
            <Text style={styles.resendTextBase}>Chưa nhận được mã? </Text>
            <TouchableOpacity>
              <Text style={styles.resendTextHighlight}>Gửi lại mã</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity
            onPress={() => router.push("/(auth)/login")}
            style={styles.backToLoginButton}
          >
            <Ionicons name="arrow-back" size={16} color={COLORS.primary} />
            <Text style={styles.backToLoginText}>Quay lại đăng nhập</Text>
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
  iconCenterContainer: { alignItems: "center", marginBottom: 32 },
  lockIconBox: {
    backgroundColor: COLORS.primary,
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  otpInput: {
    width: 45,
    height: 55,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  otpInputActive: { borderColor: "#2F80ED", borderWidth: 2 },
  timerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  timerText: { color: COLORS.error, fontWeight: "bold", fontSize: 14 },
  resendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 32,
  },
  resendTextBase: { color: COLORS.textLight, fontSize: 14 },
  resendTextHighlight: { color: "#4F7C7B", fontSize: 14, fontWeight: "600" },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 24,
    marginHorizontal: 10,
  },
  backToLoginButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  backToLoginText: { color: COLORS.primary, fontSize: 14, fontWeight: "bold" },
});