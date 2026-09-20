import { Ionicons } from "@expo/vector-icons";

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

import { COLORS } from "../../src/constants/theme";
import { authApi, getPasswordResetErrorMessage } from "../../src/services/apis/authApi";
import {
  EMAIL_MAX_LENGTH,
  validateEmail,
} from "../../src/utils/formValidation";
import { useGuardedRouter } from "../../src/utils/tapGuard";

export default function ForgotPasswordScreen() {
  const router = useGuardedRouter();

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitInFlightRef = useRef(false);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setEmailError("");
    setSubmitError("");
  };

  const handleSendCode = async () => {
    if (submitInFlightRef.current) return;
    setEmailError("");
    setSubmitError("");

    const normalizedEmail = email.trim().toLowerCase();
    const validationError = validateEmail(normalizedEmail);

    if (validationError) {
      setEmailError(validationError);
      return;
    }

    submitInFlightRef.current = true;
    setIsSubmitting(true);
    try {
      // Chỉ chuyển sang màn nhập OTP khi máy chủ xác nhận đã gửi mã.
      await authApi.forgotPassword(normalizedEmail);
      router.push({
        pathname: "/(auth)/reset-password",
        params: { email: normalizedEmail },
      });
    } catch (error) {
      setSubmitError(
        getPasswordResetErrorMessage(
          error,
          "Không thể gửi mã khôi phục lúc này. Vui lòng thử lại.",
        ),
      );
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(auth)/login");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBack}
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
        </View>

        <View style={styles.contentCard}>
          <View style={styles.logoCenterContainer}>
            <Image
              source={require("../../src/assets/images/logo-dark-transparent.png")}
              style={styles.brandLogo}
              resizeMode="contain"
            />

            <Text style={styles.title}>
              Khôi phục mật khẩu
            </Text>

            <Text style={styles.subtitle}>
              Nhập email của bạn để khôi phục quyền truy cập tài khoản.
            </Text>
          </View>

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
              placeholder="user@example.com"
              placeholderTextColor={COLORS.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              maxLength={EMAIL_MAX_LENGTH}
              value={email}
              onChangeText={handleEmailChange}
              onSubmitEditing={() => void handleSendCode()}
              returnKeyType="send"
              editable={!isSubmitting}
            />
          </View>

          {emailError ? (
            <Text
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              style={styles.fieldErrorText}
            >
              {emailError}
            </Text>
          ) : null}

          {submitError ? (
            <View style={styles.submitErrorBox}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={COLORS.error}
              />

              <Text
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
                style={styles.submitErrorText}
              >
                {submitError}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryButton, isSubmitting ? styles.primaryButtonDisabled : undefined]}
            onPress={() => void handleSendCode()}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
          >
            {isSubmitting ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.primaryButtonText}>
                GỬI MÃ KHÔI PHỤC
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.backToLoginButton}
              onPress={() =>
                router.replace("/(auth)/login")
              }
            >
              <Ionicons
                name="arrow-back"
                size={16}
                color={COLORS.primary}
              />

              <Text style={styles.backToLoginText}>
                Quay lại đăng nhập
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

  container: {
    flex: 1,
    paddingHorizontal: 20,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 20,
  },

  backButton: {
    padding: 8,
    marginLeft: -8,
  },

  contentCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 24,

    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },

      android: {
        elevation: 2,
      },

      web: {
        boxShadow:
          "0px 2px 8px rgba(0, 0, 0, 0.05)",
      } as any,
    }),
  },

  logoCenterContainer: {
    alignItems: "center",
    marginBottom: 32,
  },

  brandLogo: {
    width: 210,
    height: 43,
    marginBottom: 16,
  },

  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 13,
    color: COLORS.textLight,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 10,
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
    backgroundColor: COLORS.background,
  },

  inputContainerError: {
    borderColor: COLORS.error,
  },

  inputIcon: {
    marginRight: 12,
  },

  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },

  fieldErrorText: {
    color: COLORS.error,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },

  submitErrorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(122, 16, 18, 0.24)",
    backgroundColor: "rgba(122, 16, 18, 0.06)",
  },
  submitErrorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.error,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },

  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 24,
  },

  primaryButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },

  footer: {
    alignItems: "center",
  },

  backToLoginButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  backToLoginText: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.primary,
  },
});
