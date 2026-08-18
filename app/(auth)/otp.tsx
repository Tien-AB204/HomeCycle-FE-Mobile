import { Ionicons } from "@expo/vector-icons";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  NativeSyntheticEvent,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  TouchableOpacity,
  View,
} from "react-native";

import { COLORS } from "../../src/constants/theme";
import { authApi } from "../../src/services/apis/authApi";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";

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
  const router = useRouter();
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

  const inputRefs =
    useRef<Array<TextInput | null>>([]);

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

  const focusFirstEmptyInput = (
    currentOtp: string[],
  ) => {
    const firstEmptyIndex =
      currentOtp.findIndex(
        (digit) => digit === "",
      );

    if (firstEmptyIndex >= 0) {
      requestAnimationFrame(() => {
        inputRefs.current[
          firstEmptyIndex
        ]?.focus();
      });

      return true;
    }

    return false;
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
        router.replace("/(tabs)");
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
      console.error(
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

  const handleOtpChange = (
    text: string,
    index: number,
  ) => {
    if (isLoading) {
      return;
    }

    // Chỉ giữ chữ số.
    // Khi paste "123456", mảng digits có đủ 6 số.
    const digits = text.replace(
      /\D/g,
      "",
    );

    setOtpError("");
    setOtpMessage("");
    lastSubmittedOtpRef.current = "";

    if (!digits) {
      setOtp((current) => {
        const nextOtp = [...current];
        nextOtp[index] = "";

        return nextOtp;
      });

      return;
    }

    const nextOtp = [...otp];
    let targetIndex = index;

    // Phân phối toàn bộ chuỗi được paste
    // lần lượt từ ô hiện tại.
    digits
      .slice(
        0,
        OTP_LENGTH - index,
      )
      .split("")
      .forEach((digit) => {
        nextOtp[targetIndex] = digit;
        targetIndex += 1;
      });

    setOtp(nextOtp);

    const hasEmptyInput =
      focusFirstEmptyInput(nextOtp);

    if (hasEmptyInput) {
      return;
    }

    // Đủ 6 số: đóng bàn phím và tự xác thực.
    inputRefs.current[
      OTP_LENGTH - 1
    ]?.blur();

    void handleVerify(
      nextOtp.join(""),
    );
  };

  const handleKeyPress = (
    event: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number,
  ) => {
    if (
      event.nativeEvent.key !==
      "Backspace"
    ) {
      return;
    }

    if (
      !otp[index] &&
      index > 0
    ) {
      setOtp((current) => {
        const nextOtp = [...current];

        nextOtp[index - 1] = "";

        return nextOtp;
      });

      requestAnimationFrame(() => {
        inputRefs.current[
          index - 1
        ]?.focus();
      });
    }
  };

  const handleSubmitEditing = (
    index: number,
  ) => {
    const fullOtp = otp.join("");

    if (
      fullOtp.length === OTP_LENGTH
    ) {
      void handleVerify(fullOtp);
      return;
    }

    const firstEmptyIndex =
      otp.findIndex(
        (digit) => digit === "",
      );

    if (firstEmptyIndex >= 0) {
      inputRefs.current[
        firstEmptyIndex
      ]?.focus();

      return;
    }

    if (
      index < OTP_LENGTH - 1
    ) {
      inputRefs.current[
        index + 1
      ]?.focus();

      return;
    }

    setOtpError(
      "Vui lòng nhập đủ 6 chữ số OTP.",
    );
  };

  const handleResend = async () => {
    if (
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
        inputRefs.current[0]?.focus();
      });
    } catch (error: unknown) {
      setOtpError(
        getApiErrorMessage(
          error,
          "Không thể gửi lại mã OTP.",
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

          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] =
                    ref;
                }}
                style={[
                  styles.otpInput,
                  Platform.OS === "web"
                    ? ({
                        outlineStyle: "none",
                      } as any)
                    : undefined,
                  digit
                    ? styles.otpInputActive
                    : undefined,
                  otpError
                    ? styles.otpInputError
                    : undefined,
                ]}
                keyboardType="number-pad"
                inputMode="numeric"

                // Cho phép dán toàn bộ sáu số
                // vào bất kỳ ô nào.
                maxLength={OTP_LENGTH}

                // Hỗ trợ Android/iOS tự nhận OTP.
                autoComplete={
                  index === 0
                    ? "one-time-code"
                    : "off"
                }
                textContentType={
                  index === 0
                    ? "oneTimeCode"
                    : "none"
                }
                importantForAutofill={
                  index === 0
                    ? "yes"
                    : "no"
                }
                value={digit}
                onChangeText={(text) =>
                  handleOtpChange(
                    text,
                    index,
                  )
                }
                onKeyPress={(event) =>
                  handleKeyPress(
                    event,
                    index,
                  )
                }
                onSubmitEditing={() =>
                  handleSubmitEditing(
                    index,
                  )
                }
                returnKeyType={
                  index === OTP_LENGTH - 1
                    ? "done"
                    : "next"
                }
                blurOnSubmit={
                  index === OTP_LENGTH - 1
                }
                selectTextOnFocus
                editable={!isLoading}
                accessibilityLabel={`Chữ số OTP ${
                  index + 1
                }`}
              />
            ))}
          </View>

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
                color="#16803C"
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
    color: COLORS.text,
    backgroundColor: COLORS.white,
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
  },

  otpInputActive: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },

  otpInputError: {
    borderColor: COLORS.error,
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
    color: "#16803C",
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
    color: "#4F7C7B",
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