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
import { notifyUser } from "../../src/components/shared/ActionFeedback";
import { COLORS } from "../../src/constants/theme";
import { authApi } from "../../src/services/apis/authApi";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";

const OTP_LENGTH = 6;
const INITIAL_TIME = 118;

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

  const [otp, setOtp] = useState(
    Array.from(
      { length: OTP_LENGTH },
      () => "",
    ),
  );

  const inputRefs =
    useRef<Array<TextInput | null>>([]);

  const [timeLeft, setTimeLeft] =
    useState(INITIAL_TIME);
  const [isLoading, setIsLoading] =
    useState(false);

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

  const handleOtpChange = (
    text: string,
    index: number,
  ) => {
    if (isLoading) {
      return;
    }

    const numericText = text.replace(
      /\D/g,
      "",
    );

    const value =
      numericText.length > 0
        ? numericText[
            numericText.length - 1
          ]
        : "";

    const nextOtp = [...otp];
    nextOtp[index] = value;
    setOtp(nextOtp);

    if (
      value &&
      index < OTP_LENGTH - 1
    ) {
      inputRefs.current[
        index + 1
      ]?.focus();
    }

    if (
      nextOtp.every(
        (item) => item !== "",
      )
    ) {
      void handleVerify(
        nextOtp.join(""),
      );
    }
  };

  const handleKeyPress = (
    event: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number,
  ) => {
    if (
      event.nativeEvent.key ===
        "Backspace" &&
      !otp[index] &&
      index > 0
    ) {
      inputRefs.current[
        index - 1
      ]?.focus();
    }
  };

  const handleVerify = async (
    fullOtp: string,
  ) => {
    if (isLoading) {
      return;
    }

    if (!flow || !email) {
      notifyUser(
        "Không nhận được dữ liệu xác thực.",
        "error",
      );
      return;
    }

    try {
      setIsLoading(true);

      const response =
        await authApi.verifyOtp(
          email,
          fullOtp,
        );

      const registrationToken =
        response.data?.registrationToken ||
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

      if (flow === "forgot_password") {
        router.push(
          "/(auth)/reset-password",
        );
      }
    } catch (error: unknown) {
      console.error(
        "Lỗi xác thực OTP:",
        error,
      );

      notifyUser(
        getApiErrorMessage(
          error,
          "Mã OTP không chính xác hoặc đã hết hạn.",
        ),
        "error",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (
      isLoading ||
      timeLeft > 0 ||
      !email
    ) {
      return;
    }

    try {
      setIsLoading(true);

      await authApi.sendOtp(email);

      setOtp(
        Array.from(
          { length: OTP_LENGTH },
          () => "",
        ),
      );
      setTimeLeft(INITIAL_TIME);
      inputRefs.current[0]?.focus();

      notifyUser(
        "Mã OTP mới đã được gửi.",
        "success",
      );
    } catch (error: unknown) {
      notifyUser(
        getApiErrorMessage(
          error,
          "Không thể gửi lại mã OTP.",
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
                ]}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={1}
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
                editable={!isLoading}
              />
            ))}
          </View>

          {isLoading ? (
            <ActivityIndicator
              size="small"
              color={COLORS.primary}
              style={styles.loader}
            />
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
              router.push(
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
    marginBottom: 32,
  },

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

  otpInputActive: {
    borderColor: "#2F80ED",
    borderWidth: 2,
  },

  loader: {
    marginBottom: 16,
  },

  timerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },

  timerText: {
    color: COLORS.error,
    fontWeight: "bold",
    fontSize: 14,
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

  backToLoginText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "bold",
  },
});