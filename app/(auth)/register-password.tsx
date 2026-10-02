import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams } from "expo-router";
import {
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
  ActivityIndicator,
} from "react-native";
import { useRef, useState } from "react";

import { COLORS } from "../../src/constants/theme";
import { authApi } from "../../src/services/apis/authApi";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";
import {
  PASSWORD_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  normalizeVietnamPhone,
  validatePassword as validatePasswordValue,
  validateUsername,
  validateVietnamPhone,
} from "../../src/utils/formValidation";
import { devLog } from "../../src/utils/devLog";
import { useGuardedRouter } from "../../src/utils/tapGuard";

const getStringParam = (
  value: string | string[] | undefined,
) => {
  return Array.isArray(value)
    ? value[0] ?? ""
    : value ?? "";
};

export default function RegisterPasswordScreen() {
  const router = useGuardedRouter();
  const params = useLocalSearchParams();

  const email = getStringParam(params.email);
  const role = getStringParam(params.role);

  const registrationToken = getStringParam(
    params.registrationToken,
  );

  const isGoogleAuth = getStringParam(
    params.isGoogleAuth,
  );

  const isBusiness = role === "business";

  // Doanh nghiệp đăng ký tài khoản ngay tại màn này nên cần thêm tên đăng nhập và số điện thoại.
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const [password, setPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(false);

  // Lỗi validation hiển thị ngay dưới ô mật khẩu.
  const [passwordError, setPasswordError] =
    useState("");

  // Lỗi API hoặc dữ liệu luồng hiển thị gần nút Tiếp tục.
  const [submitError, setSubmitError] =
    useState("");

  // Tránh Enter và nút bấm gọi cùng lúc.
  const isSubmittingRef = useRef(false);

  const handleBack = () => {
    if (isLoading) {
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(auth)/register");
  };

  const validatePassword = () => {
    setPasswordError("");
    setSubmitError("");

    const validationError =
      validatePasswordValue(password);

    if (validationError) {
      setPasswordError(validationError);
      return null;
    }

    // Giữ nguyên chính xác password user nhập.
    return password;
  };
  const handleNext = async () => {
    if (
      isLoading ||
      isSubmittingRef.current
    ) {
      return;
    }

    const nextUsernameError = isBusiness ? validateUsername(username) : "";
    const nextPhoneError = isBusiness ? validateVietnamPhone(phone) : "";
    setUsernameError(nextUsernameError);
    setPhoneError(nextPhoneError);

    const validPassword =
      validatePassword();

    if (!validPassword || nextUsernameError || nextPhoneError) {
      return;
    }

    if (!registrationToken) {
      setSubmitError(
        "Không tìm thấy mã đăng ký. Vui lòng thực hiện lại quá trình đăng ký.",
      );

      return;
    }

    /*
     * Tài khoản cá nhân chưa gọi API ở màn này.
     * Mật khẩu tiếp tục được chuyển sang profile-setup
     * theo đúng flow hiện tại của project.
     */
    if (role !== "business") {
      router.push({
        pathname:
          "/(auth)/profile-setup",
        params: {
          email,
          password: validPassword,
          registrationToken,
          isGoogleAuth,
        },
      });

      return;
    }

    try {
      isSubmittingRef.current = true;
      setIsLoading(true);
      setSubmitError("");

      /*
       * Swagger:
       * POST /api/auth/business/register
       * Header: X-Registration-Token
       * Body: { username, phoneNumber, password }
       */
      const response =
        await authApi.registerBusiness(
          registrationToken,
          {
            username: username.trim(),
            phoneNumber: normalizeVietnamPhone(phone),
            password: validPassword,
          },
        );

      /*
       * Hỗ trợ cả các cấu trúc:
       * { data: { accessToken } }
       * { data: { data: { accessToken } } }
       * { accessToken }
       */
      if (response?.isSuccess === false) {
        throw response;
      }

      const responseData =
        response?.data?.data ??
        response?.data ??
        response;

      const accessToken =
        responseData?.accessToken;

      const refreshToken =
        responseData?.refreshToken;

      if (!accessToken) {
        throw new Error(
          "Máy chủ không trả về mã đăng nhập.",
        );
      }

      await AsyncStorage.setItem(
        "accessToken",
        accessToken,
      );

      if (refreshToken) {
        await AsyncStorage.setItem(
          "refreshToken",
          refreshToken,
        );
      }

      await AsyncStorage.setItem(
        "userRole",
        "business",
      );

      router.push({
        pathname:
          "/(auth)/business-setup",
        params: {
          email,
          isGoogleAuth,
        },
      });
    } catch (error: unknown) {
      devLog(
        "Lỗi tạo tài khoản business:",
        error,
      );

      setSubmitError(
        getApiErrorMessage(
          error,
          "Không thể tạo tài khoản.",
        ),
      );
    } finally {
      isSubmittingRef.current = false;
      setIsLoading(false);
    }
  };

  const handlePasswordChange = (
    value: string,
  ) => {
    setPassword(value);

    if (passwordError) {
      setPasswordError("");
    }

    if (submitError) {
      setSubmitError("");
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
            onPress={handleBack}
            style={styles.backButton}
            disabled={isLoading}
          >
            <Ionicons
              name="arrow-back"
              size={26}
              color={COLORS.text}
            />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.contentCard}>
          <View
            style={
              styles.logoCenterContainer
            }
          >
            {/* Logo HomeCycle thật, không dùng icon mock. */}
            <Image
              source={require("../../src/assets/images/logo-dark-transparent.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />

            <Text style={styles.title}>
              {isBusiness ? "Tạo tài khoản" : "Tạo mật khẩu"}
            </Text>
          </View>

          <Text style={styles.label}>
            Tài khoản
          </Text>

          <View
            style={[
              styles.inputContainer,
              styles.inputDisabled,
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
                styles.disabledInputText,
                Platform.OS === "web"
                  ? ({
                      outlineStyle:
                        "none",
                    } as any)
                  : undefined,
              ]}
              value={email}
              editable={false}
              accessibilityLabel="Email tài khoản"
            />
          </View>

          {isBusiness ? (
            <>
              <Text style={styles.label}>Tên đăng nhập</Text>
              <View style={[styles.inputContainer, usernameError ? styles.inputContainerError : undefined]}>
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={usernameError ? COLORS.error : COLORS.textLight}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : undefined]}
                  placeholder="Chữ cái, chữ số hoặc dấu gạch dưới"
                  placeholderTextColor={COLORS.textLight}
                  maxLength={USERNAME_MAX_LENGTH}
                  value={username}
                  onChangeText={(value) => {
                    setUsername(value);
                    if (usernameError) setUsernameError("");
                    if (submitError) setSubmitError("");
                  }}
                  editable={!isLoading}
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Tên đăng nhập"
                />
              </View>
              {usernameError ? (
                <View style={styles.fieldErrorRow}>
                  <Ionicons name="alert-circle-outline" size={16} color={COLORS.error} />
                  <Text style={styles.fieldErrorText}>{usernameError}</Text>
                </View>
              ) : null}

              <Text style={styles.label}>Số điện thoại</Text>
              <View style={[styles.inputContainer, phoneError ? styles.inputContainerError : undefined]}>
                <Ionicons
                  name="call-outline"
                  size={20}
                  color={phoneError ? COLORS.error : COLORS.textLight}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : undefined]}
                  placeholder="VD: 0912345678"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="phone-pad"
                  maxLength={20}
                  value={phone}
                  onChangeText={(value) => {
                    setPhone(value);
                    if (phoneError) setPhoneError("");
                    if (submitError) setSubmitError("");
                  }}
                  editable={!isLoading}
                  accessibilityLabel="Số điện thoại"
                />
              </View>
              {phoneError ? (
                <View style={styles.fieldErrorRow}>
                  <Ionicons name="alert-circle-outline" size={16} color={COLORS.error} />
                  <Text style={styles.fieldErrorText}>{phoneError}</Text>
                </View>
              ) : null}
            </>
          ) : null}

          <Text style={styles.label}>
            Mật khẩu
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
              color={
                passwordError
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
              placeholder="Từ 6 đến 50 ký tự..."
              placeholderTextColor={
                COLORS.textLight
              }
              maxLength={PASSWORD_MAX_LENGTH}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={
                handlePasswordChange
              }
              editable={!isLoading}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"

              /*
               * Đây là phần sửa Enter:
               * nhập xong mật khẩu và nhấn Enter
               * sẽ gọi đúng handler Tiếp tục.
               */
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={() => {
                void handleNext();
              }}
            />

            <TouchableOpacity
              onPress={() =>
                setShowPassword(
                  (current) => !current,
                )
              }
              style={styles.eyeIcon}
              disabled={isLoading}
            >
              <Ionicons
                name={
                  showPassword
                    ? "eye-outline"
                    : "eye-off-outline"
                }
                size={20}
                color={COLORS.textLight}
              />
            </TouchableOpacity>
          </View>

          {passwordError ? (
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
                {passwordError}
              </Text>
            </View>
          ) : null}

          {submitError ? (
            <View
              style={
                styles.submitErrorRow
              }
            >
              <Ionicons
                name="alert-circle-outline"
                size={17}
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
              isLoading
                ? styles.disabledButton
                : undefined,
            ]}
            onPress={() => {
              void handleNext();
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <View
                style={styles.loadingRow}
              >
                <ActivityIndicator
                  color={COLORS.white}
                  size="small"
                />

                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  ĐANG XỬ LÝ
                </Text>
              </View>
            ) : (
              <Text
                style={
                  styles.primaryButtonText
                }
              >
                TIẾP TỤC
              </Text>
            )}
          </TouchableOpacity>
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
            <Text style={styles.registerText}>
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

  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
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
    marginBottom: 32,
  },

  logoImage: {
    width: 230,
    height: 58,
    marginBottom: 16,
  },

  title: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "bold",
  },

  label: {
    marginBottom: 8,
    color: COLORS.textLight,
    fontSize: 13,
    fontWeight: "600",
  },

  inputContainer: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.white,
  },

  inputContainerError: {
    marginBottom: 0,
    borderColor: COLORS.error,
  },

  inputIcon: {
    marginRight: 12,
  },

  inputDisabled: {
    backgroundColor: "#F8F9FA",
    borderColor: "#BAC2C1",
  },

  disabledInputText: {
    color: COLORS.text,
  },

  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
  },

  eyeIcon: {
    padding: 6,
  },

  fieldErrorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
    marginTop: 7,
    marginBottom: 18,
  },

  fieldErrorText: {
    flex: 1,
    color: COLORS.error,
    fontSize: 13,
    lineHeight: 18,
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

  primaryButton: {
    height: 64,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },

  disabledButton: {
    backgroundColor: COLORS.textLight,
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  primaryButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "bold",
  },

  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 32,
  },

  footerText: {
    color: COLORS.textLight,
    fontSize: 14,
  },

  registerText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "bold",
  },
});