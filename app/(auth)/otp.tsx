import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { COLORS } from "../../src/constants/theme";
import { authApi } from "../../src/services/apis/authApi";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";
import { devLog } from "../../src/utils/devLog";
import { useGuardedRouter } from "../../src/utils/tapGuard";

const OTP_LENGTH = 6;
const INITIAL_TIME = 118;

const createEmptyOtp = () =>
  Array.from(
    { length: OTP_LENGTH },
    () => "",
  );

const getStringParam = (
  value: string | string[] | undefined,
) => {
  return Array.isArray(value)
    ? value[0] ?? ""
    : value ?? "";
};

export default function OTPScreen() {
  const router = useGuardedRouter();
  const params = useLocalSearchParams();

  const email = getStringParam(params.email);
  const flow = getStringParam(params.flow);
  const role = getStringParam(params.role);

  const [otp, setOtp] = useState<string[]>(
    createEmptyOtp,
  );

  const [timeLeft, setTimeLeft] =
    useState(INITIAL_TIME);

  const [isLoading, setIsLoading] =
    useState(false);

  // Hiển thị trực tiếp ngay dưới dãy OTP.
  const [otpError, setOtpError] =
    useState("");

  const [otpMessage, setOtpMessage] =
    useState("");

  // Một ô nhập ẩn nhận cả 6 số; 6 ô bên trên chỉ để hiển thị. Nhiều TextInput
  // riêng làm iOS tưởng là form AutoFill (tô vàng ô đang nhập, hiện thanh "Next").
  const otpInputRef = useRef<TextInput | null>(null);
  const [isOtpFocused, setIsOtpFocused] = useState(false);

  // Ngăn trường hợp auto-submit và Enter
  // cùng gọi API xác thực hai lần.
  const isSubmittingRef = useRef(false);

  // Không tự gửi lại cùng một OTP khi
  // onChangeText bị gọi nhiều lần.
  const lastSubmittedOtpRef =
    useRef("");

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((current) =>
        current > 0 ? current - 1 : 0,
      );
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const formatTime = (
    seconds: number,
  ) => {
    const minutes = Math.floor(
      seconds / 60,
    )
      .toString()
      .padStart(2, "0");

    const remainingSeconds = (
      seconds % 60
    )
      .toString()
      .padStart(2, "0");

    return `${minutes}:${remainingSeconds}`;
  };

  const handleVerify = async (
    fullOtp: string,
  ) => {
    const normalizedOtp = fullOtp
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);

    if (normalizedOtp.length !== OTP_LENGTH) {
      setOtpError(
        "Vui lòng nhập đủ 6 chữ số OTP.",
      );
      return;
    }

    if (
      isSubmittingRef.current ||
      isLoading
    ) {
      return;
    }

    if (!email || !flow) {
      setOtpError(
        "Không nhận được dữ liệu xác thực. Vui lòng quay lại và thử lại.",
      );
      return;
    }

    if (
      lastSubmittedOtpRef.current ===
      normalizedOtp
    ) {
      return;
    }

    try {
      isSubmittingRef.current = true;
      lastSubmittedOtpRef.current =
        normalizedOtp;

      setIsLoading(true);
      setOtpError("");
      setOtpMessage("");

      // Giữ nguyên API hiện có của project.
      const response =
        await authApi.verifyOtp(
          email,
          normalizedOtp,
        );

      const registrationToken =
        response.data
          ?.registrationToken ||
        response.data?.data
          ?.registrationToken;

      if (flow === "login") {
        router.dismissTo("/(tabs)");
        return;
      }

      if (flow === "register") {
        if (!registrationToken) {
          throw new Error(
            "Máy chủ không trả về mã đăng ký.",
          );
        }

        router.push({
          pathname:
            "/(auth)/register-password",
          params: {
            email,
            role,
            registrationToken,
          },
        });

        return;
      }

      // TODO: Future password reset flow.
      // Hiện tại project chưa có route /(auth)/reset-password
      // và chưa có API reset password tương ứng.
      // Giữ lại block này để dùng khi tính năng quên mật khẩu được triển khai.
      //
      // if (flow === "forgot_password") {
      //   router.push({
      //     pathname:
      //       "/(auth)/reset-password",
      //     params: {
      //       email,
      //       otp: normalizedOtp,
      //     },
      //   });
      //
      //   return;
      // }

      setOtpError(
        "Luồng xác thực không hợp lệ. Vui lòng quay lại và thử lại.",
      );
    } catch (error: unknown) {
      devLog(
        "Lỗi xác thực OTP:",
        error,
      );

      // Cho phép người dùng thử lại cùng OTP
      // nếu request trước bị lỗi mạng/server.
      lastSubmittedOtpRef.current = "";

      setOtpError(
        getApiErrorMessage(
          error,
          "Mã OTP không chính xác hoặc đã hết hạn.",
        ),
      );
    } finally {
      isSubmittingRef.current = false;
      setIsLoading(false);
    }
  };

  const handleOtpChange = (text: string) => {
    if (isLoading) {
      return;
    }

    // Chỉ giữ chữ số; dán/tự điền "123456" vào là đủ 6 ô.
    const digits = text.replace(/\D/g, "").slice(0, OTP_LENGTH);

    setOtpError("");
    setOtpMessage("");
    lastSubmittedOtpRef.current = "";

    setOtp(
      Array.from({ length: OTP_LENGTH }, (_, index) => digits[index] ?? ""),
    );

    if (digits.length < OTP_LENGTH) {
      return;
    }

    // Đủ 6 số: đóng bàn phím và tự xác thực.
    otpInputRef.current?.blur();
    void handleVerify(digits);
  };

  const handleSubmitEditing = () => {
    const fullOtp = otp.join("");

    if (fullOtp.length === OTP_LENGTH) {
      void handleVerify(fullOtp);
      return;
    }

    setOtpError(
      "Vui lòng nhập đủ 6 chữ số OTP.",
    );
  };

  const handleResend = async () => {
    if (
      isSubmittingRef.current ||
      isLoading ||
      timeLeft > 0
    ) {
      return;
    }

    if (!email) {
      setOtpError(
        "Không tìm thấy email nhận mã OTP. Vui lòng quay lại.",
      );
      return;
    }

    isSubmittingRef.current = true;

    try {
      setIsLoading(true);
      setOtpError("");
      setOtpMessage("");

      // Giữ nguyên API gửi OTP hiện có.
      await authApi.sendOtp(email);

      setOtp(createEmptyOtp());
      setTimeLeft(INITIAL_TIME);

      lastSubmittedOtpRef.current = "";

      setOtpMessage(
        "Mã OTP mới đã được gửi đến email của bạn.",
      );

      requestAnimationFrame(() => {
        otpInputRef.current?.focus();
      });
    } catch (error: unknown) {
      setOtpError(
        getApiErrorMessage(
          error,
          "Không thể gửi lại mã OTP.",
        ),
      );
    } finally {
      isSubmittingRef.current = false;
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
        style={styles.container}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            disabled={isLoading}
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
            style={
              styles.iconCenterContainer
            }
          >
            <View style={styles.lockIconBox}>
              <Ionicons
                name="lock-closed"
                size={32}
                color={COLORS.white}
              />
            </View>

            <Text style={styles.title}>
              Xác thực email
            </Text>

            <Text style={styles.subtitle}>
              Hệ thống đã gửi mã OTP gồm 6
              chữ số đến email của bạn. Vui
              lòng kiểm tra và nhập vào các
              ô bên dưới.
            </Text>

            {email ? (
              <Text
                style={styles.emailText}
              >
                {email}
              </Text>
            ) : null}
          </View>

          <Pressable
            style={styles.otpContainer}
            onPress={() => otpInputRef.current?.focus()}
            disabled={isLoading}
            accessibilityLabel="Nhập mã OTP 6 chữ số"
          >
            {otp.map((digit, index) => {
              const filledCount = otp.join("").length;
              const isCurrent =
                isOtpFocused &&
                (index === filledCount ||
                  (filledCount === OTP_LENGTH && index === OTP_LENGTH - 1));
              return (
                <View
                  key={index}
                  style={[
                    styles.otpInput,
                    digit ? styles.otpInputActive : undefined,
                    isCurrent ? styles.otpInputActive : undefined,
                    otpError ? styles.otpInputError : undefined,
                  ]}
                >
                  <Text style={styles.otpDigit}>{digit}</Text>
                </View>
              );
            })}

            <TextInput
              ref={otpInputRef}
              style={styles.otpHiddenInput}
              value={otp.join("")}
              onChangeText={handleOtpChange}
              onFocus={() => setIsOtpFocused(true)}
              onBlur={() => setIsOtpFocused(false)}
              onSubmitEditing={handleSubmitEditing}
              maxLength={OTP_LENGTH}
              keyboardType="number-pad"
              inputMode="numeric"
              // Hỗ trợ Android/iOS tự nhận OTP từ email/SMS.
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              importantForAutofill="yes"
              returnKeyType="done"
              caretHidden
              contextMenuHidden={false}
              editable={!isLoading}
              accessibilityLabel="Mã OTP"
            />
          </Pressable>

          {/* Lỗi nằm ngay dưới dãy OTP. */}
          {otpError ? (
            <View
              style={
                styles.inlineMessageRow
              }
            >
              <Ionicons
                name="alert-circle-outline"
                size={17}
                color={COLORS.error}
              />

              <Text style={styles.errorText}>
                {otpError}
              </Text>
            </View>
          ) : null}

          {/* Thông báo gửi lại mã cũng nằm
              ngay dưới dãy OTP. */}
          {otpMessage ? (
            <View
              style={
                styles.inlineMessageRow
              }
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={17}
                color="#2F765D"
              />

              <Text
                style={styles.successText}
              >
                {otpMessage}
              </Text>
            </View>
          ) : null}

          {isLoading ? (
            <View
              style={styles.verifyingRow}
            >
              <ActivityIndicator
                size="small"
                color={COLORS.primary}
              />

              <Text
                style={
                  styles.verifyingText
                }
              >
                Đang xác thực...
              </Text>
            </View>
          ) : null}

          <View style={styles.timerContainer}>
            <Ionicons
              name="time"
              size={16}
              color={
                timeLeft > 0
                  ? COLORS.error
                  : COLORS.textLight
              }
            />

            <Text
              style={[
                styles.timerText,
                timeLeft === 0
                  ? styles.timerExpired
                  : undefined,
              ]}
            >
              {formatTime(timeLeft)}
            </Text>
          </View>

          <View style={styles.resendContainer}>
            <Text
              style={styles.resendTextBase}
            >
              Chưa nhận được mã?{" "}
            </Text>

            <TouchableOpacity
              onPress={() =>
                void handleResend()
              }
              disabled={
                timeLeft > 0 || isLoading
              }
            >
              <Text
                style={[
                  styles.resendTextHighlight,
                  timeLeft > 0 || isLoading
                    ? styles.resendDisabled
                    : undefined,
                ]}
              >
                Gửi lại mã
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity
            onPress={() =>
              router.replace(
                "/(auth)/login",
              )
            }
            style={styles.backToLoginButton}
            disabled={isLoading}
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

  iconCenterContainer: {
    alignItems: "center",
    marginBottom: 30,
  },

  lockIconBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    backgroundColor: COLORS.primary,
  },

  title: {
    marginBottom: 12,
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "bold",
  },

  subtitle: {
    paddingHorizontal: 10,
    color: COLORS.textLight,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },

  emailText: {
    marginTop: 8,
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },

  otpContainer: {
    position: "relative",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },

  otpInput: {
    flex: 1,
    minWidth: 0,
    maxWidth: 52,
    height: 56,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
  },

  otpInputActive: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },

  otpInputError: {
    borderColor: COLORS.error,
  },

  otpDigit: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "bold",
  },

  // Phủ lên dãy ô để chạm/dán vào đâu cũng vào ô nhập; gần như trong suốt
  // (không để 0 vì một số bản iOS bỏ qua view hoàn toàn trong suốt).
  otpHiddenInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.02,
    color: "transparent",
    fontSize: 1,
  },

  inlineMessageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 10,
  },

  errorText: {
    flex: 1,
    color: COLORS.error,
    fontSize: 13,
    lineHeight: 18,
  },

  successText: {
    flex: 1,
    color: "#2F765D",
    fontSize: 13,
    lineHeight: 18,
  },

  verifyingRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
  },

  verifyingText: {
    color: COLORS.textLight,
    fontSize: 13,
  },

  timerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 22,
    marginBottom: 16,
  },

  timerText: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: "bold",
  },

  timerExpired: {
    color: COLORS.textLight,
  },

  resendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 32,
  },

  resendTextBase: {
    color: COLORS.textLight,
    fontSize: 14,
  },

  resendTextHighlight: {
    color: "#547B7D",
    fontSize: 14,
    fontWeight: "600",
  },

  resendDisabled: {
    opacity: 0.45,
  },

  divider: {
    height: 1,
    marginBottom: 24,
    marginHorizontal: 10,
    backgroundColor: COLORS.border,
  },

  backToLoginButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },

  backToLoginText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "bold",
  },
});