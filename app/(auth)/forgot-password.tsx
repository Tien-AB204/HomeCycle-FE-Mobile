import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
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

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] =
    useState("");

  const handleEmailChange = (
    value: string,
  ) => {
    setEmail(value);
    setEmailError("");
  };

  const handleSendCode = () => {
    const normalizedEmail = email.trim();

    setEmailError("");

    if (!normalizedEmail) {
      setEmailError(
        "Vui lòng nhập email của bạn.",
      );
      return;
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        normalizedEmail,
      )
    ) {
      setEmailError(
        "Địa chỉ email không đúng định dạng.",
      );
      return;
    }

    router.push({
      pathname: "/(auth)/otp",
      params: {
        email: normalizedEmail,
        flow: "forgot_password",
      },
    });
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
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : "height"
        }
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
          <View
            style={styles.logoCenterContainer}
          >
            {/* Ảnh thật nằm trong src/assets/images */}
            <Image
              source={require("../../src/assets/images/logo-dark-transparent.png")}
              style={styles.brandLogo}
              resizeMode="contain"
            />

            <Text style={styles.title}>
              Khôi phục mật khẩu
            </Text>

            <Text style={styles.subtitle}>
              Nhập email của bạn để nhận mã
              OTP xác thực khôi phục tài khoản.
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
                  ? ({
                      outlineStyle:
                        "none",
                    } as any)
                  : undefined,
              ]}
              placeholder="user@example.com"
              placeholderTextColor={
                COLORS.textLight
              }
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              value={email}
              onChangeText={handleEmailChange}
              onSubmitEditing={
                handleSendCode
              }
              returnKeyType="send"
            />
          </View>

          {/* Lỗi nằm ngay dưới trường email */}
          {emailError ? (
            <Text
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              style={styles.fieldErrorText}
            >
              {emailError}
            </Text>
          ) : null}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSendCode}
            accessibilityRole="button"
          >
            <Text
              style={styles.primaryButtonText}
            >
              GỬI MÃ KHÔI PHỤC
            </Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <TouchableOpacity
              style={
                styles.backToLoginButton
              }
              onPress={() =>
                router.replace(
                  "/(auth)/login",
                )
              }
            >
              <Ionicons
                name="arrow-back"
                size={16}
                color={COLORS.primary}
              />

              <Text
                style={
                  styles.backToLoginText
                }
              >
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
    backgroundColor: "#FAFAFA",
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