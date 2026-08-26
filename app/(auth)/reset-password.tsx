import { Ionicons } from "@expo/vector-icons";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
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
import {
  useRef,
  useState,
} from "react";

import { COLORS } from "../../src/constants/theme";
import {
  PASSWORD_MAX_LENGTH,
  validatePassword,
} from "../../src/utils/formValidation";

const getStringParam = (
  value: string | string[] | undefined,
) => {
  return Array.isArray(value)
    ? value[0] ?? ""
    : value ?? "";
};

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const email = getStringParam(params.email);

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

    setNewPasswordError("");
    setConfirmPasswordError("");
    setSubmitError("");

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
    if (!validateForm()) {
      return;
    }

    /*
     * TODO(BE):
     *
     * Swagger hiß╗çn tß║íi ng├áy 13/08/2026 ch╞░a c├│
     * endpoint ─æß║╖t lß║íi mß║¡t khß║⌐u.
     *
     * C├íc endpoint Auth hiß╗çn c├│ chß╗ë gß╗ôm:
     * - POST /api/auth/send-otp
     * - POST /api/auth/verify-otp
     * - POST /api/auth/login
     * - POST /api/auth/personal/register
     * - POST /api/auth/business/register
     * - POST /api/auth/google-login
     * - POST /api/auth/refresh-token
     *
     * Tuyß╗çt ─æß╗æi kh├┤ng giß║ú b├ío th├ánh c├┤ng hoß║╖c tß╗▒
     * chuyß╗ân vß╗ü m├án ─æ─âng nhß║¡p khi ch╞░a gß╗ìi BE.
     */
    setSubmitError(
      "Chß╗⌐c n─âng ─æß║╖t lß║íi mß║¡t khß║⌐u hiß╗çn ch╞░a ─æ╞░ß╗úc m├íy chß╗º hß╗ù trß╗ú. Vui l├▓ng thß╗¡ lß║íi sau.",
    );
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
            {/* Logo thß║¡t cß╗ºa HomeCycle. */}
            <Image
              source={require("../../src/assets/images/logo-dark-transparent.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />

            <Text style={styles.title}>
              ─Éß║╖t lß║íi mß║¡t khß║⌐u mß╗¢i
            </Text>

            <Text style={styles.subtitle}>
              Vui l├▓ng tß║ío mß║¡t khß║⌐u mß╗¢i ─æß╗â
              bß║úo vß╗ç t├ái khoß║ún cß╗ºa bß║ín.
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
            Mß║¼T KHß║¿U Mß╗ÜI
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
              placeholder="Nhß║¡p mß║¡t khß║⌐u mß╗¢i..."
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

              // Enter ß╗ƒ ├┤ ─æß║ºu chuyß╗ân sang ├┤ x├íc nhß║¡n.
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
            X├üC NHß║¼N Mß║¼T KHß║¿U Mß╗ÜI
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
              placeholder="Nhß║¡p lß║íi mß║¡t khß║⌐u mß╗¢i..."
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

              /*
               * Enter ß╗ƒ ├┤ cuß╗æi gß╗ìi thß║│ng
               * handleReset giß╗æng n├║t x├íc nhß║¡n.
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
                Tß╗æi thiß╗âu 6 k├╜ tß╗▒
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
            style={styles.primaryButton}
            onPress={() => {
              void handleReset();
            }}
          >
            <Text
              style={
                styles.primaryButtonText
              }
            >
              X├üC NHß║¼N ─Éß╗öI Mß║¼T KHß║¿U
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
