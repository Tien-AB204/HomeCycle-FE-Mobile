import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
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

import GoogleLoginButton from "../../src/components/shared/GoogleLoginButton";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";
import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  validateEmail,
  validatePassword,
} from "../../src/utils/formValidation";

export default function LoginScreen() {
  const router = useRouter();
  const { returnUrl } = useLocalSearchParams();
  const { login } = useAuth();

  const passwordInputRef = useRef<TextInput | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loginError, setLoginError] = useState("");

  const handleLogin = async () => {
    const cleanEmail = email.trim();

    // Không trim password.
    // Password phải được gửi đúng chính xác những gì user đã nhập.
    const cleanPassword = password;

    setEmailError("");
    setPasswordError("");
    setLoginError("");

    const nextEmailError = validateEmail(cleanEmail);
    const nextPasswordError = validatePassword(cleanPassword);

    if (nextEmailError) {
      setEmailError(nextEmailError);
    }

    if (nextPasswordError) {
      setPasswordError(nextPasswordError);
    }

    if (nextEmailError || nextPasswordError) {
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
      setLoginError(
        getApiErrorMessage(
          error,
          "Đăng nhập thất bại. Vui lòng kiểm tra lại.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
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
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={COLORS.text}
            />
          </TouchableOpacity>

          <View style={styles.logoContainer}>
            <Image
              source={require("../../src/assets/images/logo-dark-transparent.png")}
              style={styles.brandLogo}
              resizeMode="contain"
            />
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

            <View
              style={[
                styles.inputContainer,
                emailError
                  ? styles.inputContainerError
                  : undefined,
              ]}
            >
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
                    ? ({ outlineStyle: "none" } as any)
                    : undefined,
                ]}
                placeholder="Nhập email..."
                placeholderTextColor={COLORS.textLight}
                maxLength={EMAIL_MAX_LENGTH}
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setEmailError("");
                  setLoginError("");
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => {
                  passwordInputRef.current?.focus();
                }}
              />
            </View>

            {emailError ? (
              <Text
                accessibilityRole="alert"
                style={styles.fieldErrorText}
              >
                {emailError}
              </Text>
            ) : null}

            <Text
              style={[
                styles.label,
                styles.passwordLabel,
              ]}
            >
              MẬT KHẨU
            </Text>

            <View
              style={[
                styles.inputContainer,
                passwordError
                  ? styles.inputContainerError
                  : undefined,
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={COLORS.textLight}
                style={styles.inputIcon}
              />

              <TextInput
                ref={passwordInputRef}
                style={[
                  styles.input,
                  Platform.OS === "web"
                    ? ({ outlineStyle: "none" } as any)
                    : undefined,
                ]}
                placeholder="Nhập mật khẩu..."
                placeholderTextColor={COLORS.textLight}
                maxLength={PASSWORD_MAX_LENGTH}
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setPasswordError("");
                  setLoginError("");
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={() => {
                  void handleLogin();
                }}
              />

              <TouchableOpacity
                onPress={() =>
                  setShowPassword(
                    (current) => !current,
                  )
                }
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword
                    ? "Ẩn mật khẩu"
                    : "Hiện mật khẩu"
                }
                hitSlop={8}
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

            {passwordError ? (
              <Text
                accessibilityRole="alert"
                style={styles.fieldErrorText}
              >
                {passwordError}
              </Text>
            ) : null}

            <TouchableOpacity
              style={styles.forgotPasswordButton}
              onPress={() =>
                router.push(
                  "/(auth)/forgot-password" as any,
                )
              }
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Quên mật khẩu"
            >
              <Text style={styles.forgotPasswordText}>
                Quên mật khẩu?
              </Text>
            </TouchableOpacity>

            {loginError ? (
              <Text
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
                style={styles.loginErrorText}
              >
                {loginError}
              </Text>
            ) : null}

            <TouchableOpacity
              style={[
                styles.primaryButton,
                isLoading
                  ? styles.disabledButton
                  : undefined,
              ]}
              onPress={() => {
                void handleLogin();
              }}
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
    backgroundColor: COLORS.background,
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
    alignItems: "center",
    justifyContent: "center",
  },

  brandLogo: {
    width: 170,
    height: 36,
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
          "0px 4px 10px rgba(0, 0, 0, 0.05)",
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
    color: COLORS.textLight,
    marginBottom: 8,
    textTransform: "uppercase",
  },

  passwordLabel: {
    marginTop: 16,
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 54,
  },

  inputContainerError: {
    borderColor: COLORS.error,
  },

  fieldErrorText: {
    color: COLORS.error,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
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

  forgotPasswordButton: {
    alignSelf: "flex-end",
    paddingVertical: 8,
    paddingLeft: 12,
    marginTop: 2,
  },

  forgotPasswordText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "700",
  },

  loginErrorText: {
    color: COLORS.error,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 10,
    textAlign: "right",
  },

  primaryButton: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 54,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
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
    color: COLORS.text,
  },
});
