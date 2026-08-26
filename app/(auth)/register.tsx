import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
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

import GoogleLoginButton from "../../src/components/shared/GoogleLoginButton";
import { COLORS } from "../../src/constants/theme";
import { authApi } from "../../src/services/apis/authApi";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";
import {
  EMAIL_MAX_LENGTH,
  validateEmail,
} from "../../src/utils/formValidation";

type RegistrationRole = "personal" | "business";

export default function RegisterScreen() {
  const router = useRouter();

  const [role, setRole] =
    useState<RegistrationRole>("personal");

  const [email, setEmail] = useState("");
  const [agreeTerms, setAgreeTerms] =
    useState(false);

  const [emailError, setEmailError] =
    useState("");

  const [termsError, setTermsError] =
    useState("");

  const [submitError, setSubmitError] =
    useState("");

  const [isLoading, setIsLoading] =
    useState(false);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(auth)/login");
  };

  const handleRoleChange = (
    nextRole: RegistrationRole,
  ) => {
    if (isLoading) {
      return;
    }

    setRole(nextRole);
    setSubmitError("");
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setEmailError("");
    setSubmitError("");
  };

  const handleToggleTerms = () => {
    if (isLoading) {
      return;
    }

    setAgreeTerms((currentValue) => {
      const nextValue = !currentValue;

      if (nextValue) {
        setTermsError("");
      }

      return nextValue;
    });

    setSubmitError("");
  };

  const validateForm = () => {
    const normalizedEmail = email.trim();
    let isValid = true;

    setEmailError("");
    setTermsError("");
    setSubmitError("");

    const nextEmailError =
      validateEmail(normalizedEmail);

    if (nextEmailError) {
      setEmailError(nextEmailError);
      isValid = false;
    }

    if (!agreeTerms) {
      setTermsError(
        "Bạn cần đồng ý với điều khoản dịch vụ và chính sách bảo mật.",
      );
      isValid = false;
    }

    return {
      isValid,
      normalizedEmail,
    };
  };
  const handleRegister = async () => {
    if (isLoading) {
      return;
    }

    const { isValid, normalizedEmail } =
      validateForm();

    if (!isValid) {
      return;
    }

    try {
      setIsLoading(true);
      setSubmitError("");

      // Giữ nguyên API hiện có.
      // Không tự thêm endpoint hoặc payload chưa được BE xác nhận.
      await authApi.sendOtp(normalizedEmail);

      router.push({
        pathname: "/(auth)/otp",
        params: {
          email: normalizedEmail,
          flow: "register",
          role,
        },
      });
    } catch (error: unknown) {
      console.error("Lỗi gửi OTP:", error);

      setSubmitError(
        getApiErrorMessage(
          error,
          "Không thể gửi mã OTP. Vui lòng kiểm tra lại email.",
        ),
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
        <ScrollView
          contentContainerStyle={
            styles.scrollContainer
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Quay lại"
            >
              <Ionicons
                name="arrow-back"
                size={26}
                color={COLORS.text}
              />
            </TouchableOpacity>

            <Image
              source={require("../../src/assets/images/logo-dark-transparent.png")}
              style={styles.brandLogo}
              resizeMode="contain"
              accessibilityLabel="HomeCycle"
            />

            <View
              style={styles.headerPlaceholder}
            />
          </View>

          <View style={styles.contentCard}>
            <Text style={styles.title}>
              Tạo tài khoản
            </Text>

            <Text style={styles.subtitle}>
              Bắt đầu hành trình mua bán đồ cũ
              an toàn và chuyên nghiệp.
            </Text>

            <Text style={styles.sectionLabel}>
              LOẠI TÀI KHOẢN
            </Text>

            <View style={styles.roleContainer}>
              <TouchableOpacity
                style={[
                  styles.roleTab,
                  role === "personal"
                    ? styles.roleTabActive
                    : undefined,
                ]}
                onPress={() =>
                  handleRoleChange("personal")
                }
                disabled={isLoading}
                accessibilityRole="radio"
                accessibilityState={{
                  checked: role === "personal",
                  disabled: isLoading,
                }}
              >
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={
                    role === "personal"
                      ? COLORS.primary
                      : COLORS.textLight
                  }
                />

                <Text
                  style={[
                    styles.roleTabText,
                    role === "personal"
                      ? styles.roleTabTextActive
                      : undefined,
                  ]}
                >
                  Cá nhân
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleTab,
                  role === "business"
                    ? styles.roleTabActive
                    : undefined,
                ]}
                onPress={() =>
                  handleRoleChange("business")
                }
                disabled={isLoading}
                accessibilityRole="radio"
                accessibilityState={{
                  checked: role === "business",
                  disabled: isLoading,
                }}
              >
                <Ionicons
                  name="business-outline"
                  size={20}
                  color={
                    role === "business"
                      ? COLORS.primary
                      : COLORS.textLight
                  }
                />

                <Text
                  style={[
                    styles.roleTabText,
                    role === "business"
                      ? styles.roleTabTextActive
                      : undefined,
                  ]}
                >
                  Doanh nghiệp
                </Text>
              </TouchableOpacity>
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
                color={
                  emailError
                    ? COLORS.error || "#7A1012"
                    : COLORS.textLight
                }
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
                placeholder="example@gmail.com"
                placeholderTextColor={
                  COLORS.textLight
                }
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                maxLength={EMAIL_MAX_LENGTH}
                value={email}
                onChangeText={handleEmailChange}
                editable={!isLoading}
                returnKeyType="send"
                onSubmitEditing={() =>
                  void handleRegister()
                }
              />
            </View>

            {emailError ? (
              <Text
                style={styles.fieldErrorText}
                accessibilityRole="alert"
              >
                {emailError}
              </Text>
            ) : null}

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={handleToggleTerms}
              disabled={isLoading}
              accessibilityRole="checkbox"
              accessibilityState={{
                checked: agreeTerms,
                disabled: isLoading,
              }}
            >
              <Ionicons
                name={
                  agreeTerms
                    ? "checkbox"
                    : "square-outline"
                }
                size={23}
                color={
                  termsError
                    ? COLORS.error || "#7A1012"
                    : agreeTerms
                      ? COLORS.primary
                      : COLORS.textLight
                }
              />

              <Text style={styles.checkboxLabel}>
                Tôi đồng ý với{" "}
                <Text style={styles.linkText}>
                  điều khoản dịch vụ
                </Text>{" "}
                và{" "}
                <Text style={styles.linkText}>
                  chính sách bảo mật
                </Text>{" "}
                của HomeCycle.
              </Text>
            </TouchableOpacity>

            {termsError ? (
              <Text
                style={styles.termsErrorText}
                accessibilityRole="alert"
              >
                {termsError}
              </Text>
            ) : null}

            <TouchableOpacity
              style={[
                styles.primaryButton,
                isLoading
                  ? styles.disabledButton
                  : undefined,
              ]}
              onPress={() =>
                void handleRegister()
              }
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityState={{
                disabled: isLoading,
                busy: isLoading,
              }}
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
                    ĐĂNG KÝ
                  </Text>

                  <Ionicons
                    name="arrow-forward"
                    size={20}
                    color={COLORS.white}
                  />
                </>
              )}
            </TouchableOpacity>

            {submitError ? (
              <Text
                style={styles.submitErrorText}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                {submitError}
              </Text>
            ) : null}

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />

              <Text style={styles.dividerText}>
                HOẶC ĐĂNG KÝ BẰNG
              </Text>

              <View style={styles.dividerLine} />
            </View>

            {/*
              GoogleLoginButton vẫn đang tự gọi notifyUser.
              Sẽ sửa riêng component này sau để trả lỗi về
              đúng màn Login/Register thay vì banner toàn cục.
            */}
            <GoogleLoginButton
              title="Google"
              disabled={isLoading}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Đã có tài khoản?{" "}
            </Text>

            <TouchableOpacity
              onPress={() =>
                router.replace(
                  "/(auth)/login",
                )
              }
              disabled={isLoading}
              accessibilityRole="link"
            >
              <Text style={styles.loginText}>
                Đăng nhập ngay
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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

  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },

  header: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  backButton: {
    width: 42,
    height: 42,
    alignItems: "flex-start",
    justifyContent: "center",
  },

  brandLogo: {
    width: 178,
    height: 46,
  },

  headerPlaceholder: {
    width: 42,
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

  title: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    lineHeight: 21,
    marginBottom: 24,
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textLight,
    marginBottom: 10,
  },

  roleContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },

  roleTab: {
    flex: 1,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    paddingHorizontal: 8,
  },

  roleTabActive: {
    borderColor: COLORS.primary,
    backgroundColor: "rgba(84, 123, 125, 0.08)",
    borderWidth: 1.5,
  },

  roleTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textLight,
  },

  roleTabTextActive: {
    color: COLORS.primary,
    fontWeight: "700",
  },

  label: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 8,
  },

  inputContainer: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: "#F8F9FA",
  },

  inputContainerError: {
    borderColor: COLORS.error || "#7A1012",
    borderWidth: 1.5,
  },

  inputIcon: {
    marginRight: 12,
  },

  input: {
    flex: 1,
    minHeight: 52,
    fontSize: 15,
    color: COLORS.text,
  },

  fieldErrorText: {
    color: COLORS.error || "#7A1012",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
    marginBottom: 16,
  },

  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 18,
  },

  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textLight,
    lineHeight: 19,
  },

  linkText: {
    color: COLORS.primary,
    fontWeight: "700",
  },

  termsErrorText: {
    color: COLORS.error || "#7A1012",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },

  primaryButton: {
    minHeight: 54,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    marginTop: 20,
    paddingHorizontal: 18,
  },

  disabledButton: {
    opacity: 0.7,
  },

  primaryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "800",
  },

  submitErrorText: {
    color: COLORS.error || "#7A1012",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 8,
  },

  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 22,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },

  dividerText: {
    marginHorizontal: 12,
    fontSize: 11,
    color: COLORS.textLight,
    fontWeight: "600",
  },

  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 24,
  },

  footerText: {
    fontSize: 14,
    color: COLORS.textLight,
  },

  loginText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },
});