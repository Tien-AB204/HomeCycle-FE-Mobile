import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
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
import { notifyUser } from "../../src/components/shared/ActionFeedback";
import GoogleLoginButton from "../../src/components/shared/GoogleLoginButton";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";

export default function LoginScreen() {
  const router = useRouter();
  const { returnUrl } = useLocalSearchParams();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] =
    useState(false);
  const [isLoading, setIsLoading] =
    useState(false);

  const handleLogin = async () => {
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      notifyUser(
        "Vui lòng nhập đầy đủ email và mật khẩu.",
        "error",
      );
      return;
    }

    try {
      setIsLoading(true);

      await login(cleanEmail, cleanPassword);

      if (returnUrl) {
        router.replace(returnUrl as any);
      } else {
        router.replace("/(tabs)");
      }
    } catch (error: unknown) {
      notifyUser(
        getApiErrorMessage(
          error,
          "Đăng nhập thất bại. Vui lòng kiểm tra lại.",
        ),
        "error",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : "height"
        }
        style={styles.keyboardContainer}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(tabs)");
              }
            }}
            style={styles.backButton}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={COLORS.text}
            />
          </TouchableOpacity>

          <View style={styles.logoContainer}>
            <Image
              source={require("../../assets/images/logo-favicon.png")}
              style={styles.logoImage}
            />
            <Text style={styles.logoText}>
              HomeCycle
            </Text>
          </View>

          <View style={styles.headerPlaceholder} />
        </View>

        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.title}>
              Đăng nhập vào tài khoản của bạn
            </Text>

            <Text style={styles.label}>
              ĐỊA CHỈ EMAIL
            </Text>

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
                  Platform.OS === "web"
                    ? ({
                        outlineStyle: "none",
                      } as any)
                    : undefined,
                ]}
                placeholder="Nhập email..."
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <Text
              style={[
                styles.label,
                styles.passwordLabel,
              ]}
            >
              MẬT KHẨU
            </Text>

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
                  Platform.OS === "web"
                    ? ({
                        outlineStyle: "none",
                      } as any)
                    : undefined,
                ]}
                placeholder="Nhập mật khẩu..."
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />

              <TouchableOpacity
                onPress={() =>
                  setShowPassword(
                    (current) => !current,
                  )
                }
              >
                <Ionicons
                  name={
                    showPassword
                      ? "eye-off-outline"
                      : "eye-outline"
                  }
                  size={20}
                  color={COLORS.textLight}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() =>
                router.push("/forgot-password")
              }
            >
              <Text
                style={styles.forgotPasswordText}
              >
                Quên mật khẩu?
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                isLoading
                  ? styles.disabledButton
                  : undefined,
              ]}
              onPress={() => void handleLogin()}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator
                  color={COLORS.white}
                />
              ) : (
                <>
                  <Text
                    style={
                      styles.primaryButtonText
                    }
                  >
                    ĐĂNG NHẬP
                  </Text>

                  <Ionicons
                    name="arrow-forward"
                    size={20}
                    color={COLORS.white}
                    style={styles.forwardIcon}
                  />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />

              <Text style={styles.dividerText}>
                HOẶC TIẾP TỤC VỚI
              </Text>

              <View style={styles.dividerLine} />
            </View>

            <GoogleLoginButton
              title="Google"
              disabled={isLoading}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Bạn chưa có tài khoản?{" "}
            </Text>

            <TouchableOpacity
              onPress={() =>
                router.push("/register")
              }
            >
              <Text style={styles.footerLink}>
                Đăng ký tài khoản
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  keyboardContainer: {
    flex: 1,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
  },

  backButton: {
    padding: 4,
  },

  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  logoImage: {
    width: 28,
    height: 28,
    resizeMode: "contain",
  },

  logoText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#172B30",
  },

  headerPlaceholder: {
    width: 28,
  },

  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "center",
  },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 24,
    ...Platform.select({
      web: {
        boxShadow:
          "0px 4px 10px rgba(0,0,0,0.05)",
      } as any,
      default: {
        shadowColor: "#000",
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 4,
      },
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
    fontWeight: "bold",
    color: "#64748B",
    marginBottom: 8,
    textTransform: "uppercase",
  },

  passwordLabel: {
    marginTop: 16,
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 54,
  },

  inputIcon: {
    marginRight: 10,
  },

  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    height: "100%",
  },

  forgotPassword: {
    alignSelf: "flex-end",
    marginTop: 12,
    marginBottom: 24,
  },

  forgotPasswordText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "600",
  },

  primaryButton: {
    flexDirection: "row",
    backgroundColor: "#2C5A56",
    borderRadius: 12,
    height: 54,
    justifyContent: "center",
    alignItems: "center",
  },

  disabledButton: {
    opacity: 0.7,
  },

  primaryButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "bold",
  },

  forwardIcon: {
    marginLeft: 8,
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
    fontSize: 11,
    color: COLORS.textLight,
    paddingHorizontal: 12,
    fontWeight: "600",
  },

  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 30,
  },

  footerText: {
    fontSize: 14,
    color: COLORS.textLight,
  },

  footerLink: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#172B30",
  },
});