import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
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
import {
  useEffect,
  useRef,
  useState,
} from "react";

import { COLORS } from "../../src/constants/theme";
import { authApi, getPasswordResetErrorMessage } from "../../src/services/apis/authApi";
import {
  PASSWORD_MAX_LENGTH,
  validatePassword,
} from "../../src/utils/formValidation";
import { useGuardedRouter } from "../../src/utils/tapGuard";

// OTP đặt lại mật khẩu: đúng 6 chữ số, hiệu lực 5 phút, dùng một lần (Backend là nơi quyết định).
const OTP_LENGTH = 6;
const OTP_LIFETIME_SECONDS = 5 * 60;
const formatCountdown = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

const getStringParam = (
  value: string | string[] | undefined,
) => {
  return Array.isArray(value)
    ? value[0] ?? ""
    : value ?? "";
};

export default function ResetPasswordScreen() {
  const router = useGuardedRouter();
  const params = useLocalSearchParams();

  const email = getStringParam(params.email);

  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendNotice, setResendNotice] = useState("");
  // Đếm ngược hiệu lực OTP (hiển thị); Backend vẫn là nơi quyết định hết hạn/giới hạn gửi lại.
  const [otpExpiresAt, setOtpExpiresAt] = useState<number>(() => Date.now() + OTP_LIFETIME_SECONDS * 1000);
  const [secondsLeft, setSecondsLeft] = useState(OTP_LIFETIME_SECONDS);
  // Khóa đồng bộ DUY NHẤT cho cả hai hành động mạng của màn này (đặt lại mật khẩu
  // và gửi lại OTP): không bao giờ để hai yêu cầu chạy song song, kể cả chéo nhau.
  // isSubmitting / isResending chỉ phục vụ hiển thị (state cập nhật bất đồng bộ).
  const authActionInFlightRef = useRef(false);

  useEffect(() => {
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((otpExpiresAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [otpExpiresAt]);

  const [newPassword, setNewPassword] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    showNewPassword,
    setShowNewPassword,
  ] = useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const [
    newPasswordError,
    setNewPasswordError,
  ] = useState("");

  const [
    confirmPasswordError,
    setConfirmPasswordError,
  ] = useState("");

  const [submitError, setSubmitError] =
    useState("");

  const confirmPasswordRef =
    useRef<TextInput | null>(null);

  // Đang có hành động mạng (đặt lại hoặc gửi lại OTP): khóa toàn bộ điều khiển
  // có thể làm lệch trạng thái OTP/mật khẩu.
  const isBusy = isSubmitting || isResending;

  const handleNewPasswordChange = (
    value: string,
  ) => {
    setNewPassword(value);

    if (newPasswordError) {
      setNewPasswordError("");
    }

    if (submitError) {
      setSubmitError("");
    }
  };

  const handleConfirmPasswordChange = (
    value: string,
  ) => {
    setConfirmPassword(value);

    if (confirmPasswordError) {
      setConfirmPasswordError("");
    }

    if (submitError) {
      setSubmitError("");
    }
  };

  const validateForm = () => {
    let isValid = true;

    setOtpError("");
    setNewPasswordError("");
    setConfirmPasswordError("");
    setSubmitError("");

    if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(otp)) {
      setOtpError(`Mã OTP gồm đúng ${OTP_LENGTH} chữ số.`);
      isValid = false;
    }

    const passwordValidationError =
      validatePassword(newPassword);

    if (passwordValidationError) {
      setNewPasswordError(
        passwordValidationError,
      );
      isValid = false;
    }

    if (!confirmPassword || !/\S/.test(confirmPassword)) {
      setConfirmPasswordError(
        "Vui lòng nhập lại mật khẩu mới.",
      );
      isValid = false;
    } else if (newPassword !== confirmPassword) {
      setConfirmPasswordError(
        "Mật khẩu xác nhận không khớp.",
      );
      isValid = false;
    }

    return isValid;
  };
  const handleReset = async () => {
    if (authActionInFlightRef.current) return;
    if (!validateForm()) {
      return;
    }
    if (!email) {
      setSubmitError("Thiếu email để đặt lại mật khẩu. Vui lòng quay lại bước quên mật khẩu.");
      return;
    }

    authActionInFlightRef.current = true;
    setIsSubmitting(true);
    try {
      await authApi.resetPassword({
        email,
        otp,
        newPassword,
        confirmPassword,
      });
      // Không tự đăng nhập: về màn đăng nhập với thông báo thành công.
      router.replace({
        pathname: "/(auth)/login",
        params: { notice: "password-reset" },
      });
    } catch (error) {
      setSubmitError(
        getPasswordResetErrorMessage(
          error,
          "Không thể đặt lại mật khẩu lúc này. Vui lòng thử lại.",
        ),
      );
    } finally {
      authActionInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Gửi lại OTP đặt lại mật khẩu (KHÔNG dùng send-otp của đăng ký).
  const handleResendOtp = async () => {
    if (authActionInFlightRef.current || !email) return;
    authActionInFlightRef.current = true;
    setIsResending(true);
    setResendNotice("");
    setSubmitError("");
    try {
      await authApi.forgotPassword(email);
      setOtp("");
      setOtpError("");
      setOtpExpiresAt(Date.now() + OTP_LIFETIME_SECONDS * 1000);
      setResendNotice("Đã gửi lại mã OTP mới tới email của bạn.");
    } catch (error) {
      setSubmitError(
        getPasswordResetErrorMessage(
          error,
          "Không thể gửi lại mã OTP lúc này. Vui lòng thử lại sau.",
        ),
      );
    } finally {
      authActionInFlightRef.current = false;
      setIsResending(false);
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
        style={styles.container}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons
              name="arrow-back"
              size={26}
              color={COLORS.text}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.contentCard}>
          <View
            style={
              styles.logoCenterContainer
            }
          >
            {/* Logo thật của HomeCycle. */}
            <Image
              source={require("../../src/assets/images/logo-dark-transparent.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />

            <Text style={styles.title}>
              Đặt lại mật khẩu mới
            </Text>

            <Text style={styles.subtitle}>
              Vui lòng tạo mật khẩu mới để
              bảo vệ tài khoản của bạn.
            </Text>

            {email ? (
              <Text
                style={styles.emailText}
              >
                {email}
              </Text>
            ) : null}
          </View>

          <Text style={styles.label}>
            MÃ OTP
          </Text>

          <View
            style={[
              styles.inputContainer,
              otpError
                ? styles.inputContainerError
                : undefined,
            ]}
          >
            <Ionicons
              name="key-outline"
              size={20}
              color={
                otpError
                  ? COLORS.error
                  : COLORS.textLight
              }
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
              placeholder="Nhập mã 6 chữ số..."
              placeholderTextColor={
                COLORS.textLight
              }
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={OTP_LENGTH}
              value={otp}
              onChangeText={(text) => {
                setOtp(text.replace(/[^0-9]/g, "").slice(0, OTP_LENGTH));
                setOtpError("");
                setSubmitError("");
              }}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              editable={!isBusy}
            />
          </View>

          {otpError ? (
            <View
              style={
                styles.fieldErrorRow
              }
            >
              <Ionicons
                name="alert-circle-outline"
                size={16}
                color={COLORS.error}
              />

              <Text
                style={
                  styles.fieldErrorText
                }
              >
                {otpError}
              </Text>
            </View>
          ) : null}

          <View style={styles.otpMetaRow}>
            <Text style={styles.otpMetaText}>
              {secondsLeft > 0
                ? `Mã có hiệu lực trong ${formatCountdown(secondsLeft)}`
                : "Mã OTP đã hết hạn. Hãy gửi lại mã mới."}
            </Text>
            <TouchableOpacity
              onPress={() => {
                void handleResendOtp();
              }}
              disabled={isBusy}
              accessibilityRole="button"
              accessibilityState={{ disabled: isBusy, busy: isResending }}
              hitSlop={6}
            >
              <Text
                style={[
                  styles.resendText,
                  isBusy ? styles.resendTextDisabled : undefined,
                ]}
              >
                {isResending ? "Đang gửi..." : "Gửi lại mã"}
              </Text>
            </TouchableOpacity>
          </View>

          {resendNotice ? (
            <Text
              accessibilityLiveRegion="polite"
              style={styles.resendNoticeText}
            >
              {resendNotice}
            </Text>
          ) : null}

          <Text style={styles.label}>
            MẬT KHẨU MỚI
          </Text>

          <View
            style={[
              styles.inputContainer,
              newPasswordError
                ? styles.inputContainerError
                : undefined,
            ]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={
                newPasswordError
                  ? COLORS.error
                  : COLORS.textLight
              }
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
              placeholder="Nhập mật khẩu mới..."
              placeholderTextColor={
                COLORS.textLight
              }
              secureTextEntry={
                !showNewPassword
              }
              maxLength={PASSWORD_MAX_LENGTH}
              value={newPassword}
              onChangeText={
                handleNewPasswordChange
              }
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!isBusy}

              // Enter ở ô đầu chuyển sang ô xác nhận.
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => {
                confirmPasswordRef.current?.focus();
              }}
            />

            <TouchableOpacity
              onPress={() =>
                setShowNewPassword(
                  (current) => !current,
                )
              }
              style={styles.eyeIcon}
            >
              <Ionicons
                name={
                  showNewPassword
                    ? "eye-outline"
                    : "eye-off-outline"
                }
                size={20}
                color={COLORS.textLight}
              />
            </TouchableOpacity>
          </View>

          {newPasswordError ? (
            <View
              style={
                styles.fieldErrorRow
              }
            >
              <Ionicons
                name="alert-circle-outline"
                size={16}
                color={COLORS.error}
              />

              <Text
                style={
                  styles.fieldErrorText
                }
              >
                {newPasswordError}
              </Text>
            </View>
          ) : null}

          <Text style={styles.label}>
            XÁC NHẬN MẬT KHẨU MỚI
          </Text>

          <View
            style={[
              styles.inputContainer,
              confirmPasswordError
                ? styles.inputContainerError
                : undefined,
            ]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={
                confirmPasswordError
                  ? COLORS.error
                  : COLORS.textLight
              }
              style={styles.inputIcon}
            />

            <TextInput
              ref={confirmPasswordRef}
              style={[
                styles.input,
                Platform.OS === "web"
                  ? ({
                      outlineStyle:
                        "none",
                    } as any)
                  : undefined,
              ]}
              placeholder="Nhập lại mật khẩu mới..."
              placeholderTextColor={
                COLORS.textLight
              }
              secureTextEntry={
                !showConfirmPassword
              }
              maxLength={PASSWORD_MAX_LENGTH}
              value={confirmPassword}
              onChangeText={
                handleConfirmPasswordChange
              }
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!isBusy}

              /*
               * Enter ở ô cuối gọi thẳng
               * handleReset giống nút xác nhận.
               */
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={() => {
                void handleReset();
              }}
            />

            <TouchableOpacity
              onPress={() =>
                setShowConfirmPassword(
                  (current) => !current,
                )
              }
              style={styles.eyeIcon}
            >
              <Ionicons
                name={
                  showConfirmPassword
                    ? "eye-outline"
                    : "eye-off-outline"
                }
                size={20}
                color={COLORS.textLight}
              />
            </TouchableOpacity>
          </View>

          {confirmPasswordError ? (
            <View
              style={
                styles.fieldErrorRow
              }
            >
              <Ionicons
                name="alert-circle-outline"
                size={16}
                color={COLORS.error}
              />

              <Text
                style={
                  styles.fieldErrorText
                }
              >
                {confirmPasswordError}
              </Text>
            </View>
          ) : null}

          <View
            style={
              styles.requirementsContainer
            }
          >
            <View
              style={styles.requirementRow}
            >
              <View style={styles.dot} />

              <Text
                style={
                  styles.requirementText
                }
              >
                Tối thiểu 6 ký tự
              </Text>
            </View>
          </View>

          {submitError ? (
            <View
              style={
                styles.submitErrorRow
              }
            >
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={COLORS.error}
              />

              <Text
                style={
                  styles.submitErrorText
                }
              >
                {submitError}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              styles.primaryButton,
              isBusy ? styles.primaryButtonDisabled : undefined,
            ]}
            onPress={() => {
              void handleReset();
            }}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityState={{ disabled: isBusy, busy: isSubmitting }}
          >
            {isSubmitting ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
            <Text
              style={
                styles.primaryButtonText
              }
            >
              XÁC NHẬN ĐỔI MẬT KHẨU
            </Text>
            )}
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
    marginTop: 20,
    marginBottom: 20,
  },

  backButton: {
    padding: 8,
    marginLeft: -8,
  },

  contentCard: {
    padding: 24,
    borderRadius: 24,
    backgroundColor: COLORS.white,

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
    marginBottom: 30,
  },

  logoImage: {
    width: 230,
    height: 58,
    marginBottom: 18,
  },

  title: {
    marginBottom: 8,
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "bold",
    textAlign: "center",
  },

  subtitle: {
    paddingHorizontal: 10,
    color: COLORS.textLight,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },

  emailText: {
    marginTop: 8,
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "600",
  },

  label: {
    marginBottom: 8,
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: "600",
  },

  inputContainer: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.background,
  },

  inputContainerError: {
    marginBottom: 0,
    borderColor: COLORS.error,
  },

  inputIcon: {
    marginRight: 10,
  },

  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
  },

  eyeIcon: {
    padding: 6,
  },

  fieldErrorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
    marginTop: 7,
    marginBottom: 15,
  },

  fieldErrorText: {
    flex: 1,
    color: COLORS.error,
    fontSize: 13,
    lineHeight: 18,
  },

  requirementsContainer: {
    paddingHorizontal: 4,
    marginBottom: 20,
  },

  requirementRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  dot: {
    width: 5,
    height: 5,
    marginRight: 8,
    borderRadius: 3,
    backgroundColor: COLORS.textLight,
  },

  requirementText: {
    color: COLORS.textLight,
    fontSize: 13,
  },

  submitErrorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginBottom: 12,
  },

  submitErrorText: {
    flex: 1,
    color: COLORS.error,
    fontSize: 13,
    lineHeight: 18,
  },

  otpMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  otpMetaText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.textLight,
  },
  resendText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
  },
  resendTextDisabled: {
    opacity: 0.5,
  },
  resendNoticeText: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.success,
    marginBottom: 12,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButton: {
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },

  primaryButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "bold",
  },
});
