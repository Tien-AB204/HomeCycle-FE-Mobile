import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
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
import { notifyUser } from "../../src/components/shared/ActionFeedback";
import GoogleLoginButton from "../../src/components/shared/GoogleLoginButton";
import { COLORS } from "../../src/constants/theme";
import { authApi } from "../../src/services/apis/authApi";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";

type RegistrationRole =
  | "personal"
  | "business";

export default function RegisterScreen() {
  const router = useRouter();

  const [role, setRole] =
    useState<RegistrationRole>("personal");
  const [email, setEmail] = useState("");
  const [agreeTerms, setAgreeTerms] =
    useState(false);
  const [isLoading, setIsLoading] =
    useState(false);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(auth)/login");
    }
  };

  const handleRegister = async () => {
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      notifyUser(
        "Vui lòng điền email.",
        "error",
      );
      return;
    }

    if (!agreeTerms) {
      notifyUser(
        "Vui lòng đồng ý với điều khoản dịch vụ.",
        "error",
      );
      return;
    }

    try {
      setIsLoading(true);

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

      notifyUser(
        getApiErrorMessage(
          error,
          "Không thể gửi OTP. Vui lòng kiểm tra lại email.",
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
            >
              <Ionicons
                name="arrow-back"
                size={24}
                color={COLORS.text}
              />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>
              HomeCycle
            </Text>

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

            <View style={styles.roleContainer}>
              <TouchableOpacity
                style={[
                  styles.roleTab,
                  role === "personal"
                    ? styles.roleTabActive
                    : undefined,
                ]}
                onPress={() =>
                  setRole("personal")
                }
                disabled={isLoading}
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
                  setRole("business")
                }
                disabled={isLoading}
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
              Email
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
                placeholder="example@gmail.com"
                placeholderTextColor={
                  COLORS.textLight
                }
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                editable={!isLoading}
              />
            </View>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() =>
                setAgreeTerms(
                  (current) => !current,
                )
              }
              disabled={isLoading}
            >
              <Ionicons
                name={
                  agreeTerms
                    ? "checkbox"
                    : "square-outline"
                }
                size={22}
                color={
                  agreeTerms
                    ? COLORS.primary
                    : COLORS.textLight
                }
              />

              <Text
                style={styles.checkboxLabel}
              >
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
            >
              {isLoading ? (
                <ActivityIndicator
                  color={COLORS.white}
                />
              ) : (
                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Đăng ký
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />

              <Text style={styles.dividerText}>
                HOẶC ĐĂNG KÝ BẰNG
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
              Đã có tài khoản?{" "}
            </Text>

            <TouchableOpacity
              onPress={() =>
                router.replace(
                  "/(auth)/login",
                )
              }
              disabled={isLoading}
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
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 24,
  },

  backButton: {
    padding: 8,
    marginLeft: -8,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.primary,
  },

  headerPlaceholder: {
    width: 24,
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

  roleContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },

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

  roleTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textLight,
  },

  roleTabTextActive: {
    color: COLORS.primary,
    fontWeight: "bold",
  },

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

  inputIcon: {
    marginRight: 12,
  },

  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },

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

  linkText: {
    color: COLORS.primary,
    fontWeight: "600",
  },

  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },

  disabledButton: {
    opacity: 0.7,
  },

  primaryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "bold",
  },

  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
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
    marginTop: 24,
  },

  footerText: {
    fontSize: 14,
    color: COLORS.textLight,
  },

  loginText: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.primary,
  },
});