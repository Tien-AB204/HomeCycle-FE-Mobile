import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import {
  useRef,
  useState,
} from "react";
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

import { COLORS } from "../../src/constants/theme";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";
import {
  FULL_NAME_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  normalizeVietnamPhone,
  validateFullName,
  validateUsername,
  validateVietnamPhone,
} from "../../src/utils/formValidation";
import { capitalizeWordInitials } from "../../src/utils/textFormat";

const getStringParam = (
  value: string | string[] | undefined,
) => {
  return Array.isArray(value)
    ? value[0] ?? ""
    : value ?? "";
};

export default function ProfileSetupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const email = getStringParam(params.email);
  const password = getStringParam(params.password);
  const registrationToken = getStringParam(params.registrationToken);

  const usernameInputRef = useRef<TextInput | null>(null);
  const phoneInputRef = useRef<TextInput | null>(null);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [fullNameError, setFullNameError] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(auth)/register");
  };

  const pickAvatar = async () => {
    if (isPickingImage) return;

    try {
      setIsPickingImage(true);
      setAvatarError("");

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setAvatarUri(result.assets[0].uri);
        setAvatarError("");
      }
    } catch (error: unknown) {
      console.error("Lỗi chọn ảnh đại diện:", error);
      setAvatarError(
        getApiErrorMessage(error, "Không thể mở thư viện ảnh."),
      );
    } finally {
      setIsPickingImage(false);
    }
  };

  const validateForm = () => {
    const normalizedFullName =
      capitalizeWordInitials(
        fullName.trim().replace(/\s+/gu, " "),
      );

    const normalizedUsername =
      username.trim();

    const normalizedPhone =
      normalizeVietnamPhone(phone);

    setFullNameError("");
    setUsernameError("");
    setPhoneError("");

    const nextFullNameError =
      validateFullName(fullName);

    const nextUsernameError =
      validateUsername(username);

    const nextPhoneError =
      validateVietnamPhone(phone);

    if (nextFullNameError) {
      setFullNameError(nextFullNameError);
    }

    if (nextUsernameError) {
      setUsernameError(nextUsernameError);
    }

    if (nextPhoneError) {
      setPhoneError(nextPhoneError);
    }

    return {
      isValid:
        !nextFullNameError &&
        !nextUsernameError &&
        !nextPhoneError,
      normalizedFullName,
      normalizedUsername,
      normalizedPhone,
    };
  };
  const handleNext = () => {
    const {
      isValid,
      normalizedFullName,
      normalizedUsername,
      normalizedPhone,
    } = validateForm();

    if (!isValid) return;

    router.push({
      pathname: "/(auth)/verification-setup",
      params: {
        email,
        registrationToken,
        password,
        fullName: normalizedFullName,
        username: normalizedUsername,
        phoneNumber: normalizedPhone,
        avatarUri: avatarUri ?? "",
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topHeader}>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Quay lại"
            >
              <Ionicons name="arrow-back" size={26} color={COLORS.text} />
            </TouchableOpacity>

            <Image
              source={require("../../src/assets/images/logo-dark-transparent.png")}
              style={styles.brandLogo}
              resizeMode="contain"
              accessibilityLabel="HomeCycle"
            />

            <View style={styles.headerPlaceholder} />
          </View>

          <View style={styles.contentCard}>
            <View style={styles.headerCenter}>
              <View style={styles.headerIconBox}>
                <Ionicons name="person-outline" size={30} color={COLORS.white} />
              </View>
              <Text style={styles.title}>Thiết lập hồ sơ cá nhân</Text>
              <Text style={styles.subtitle}>
                Bước 1/2: Điền thông tin cơ bản để hoàn thiện tài khoản.
              </Text>
            </View>

            <View style={styles.avatarContainer}>
              <TouchableOpacity
                style={[
                  styles.avatarBox,
                  avatarError ? styles.avatarBoxError : undefined,
                ]}
                onPress={() => void pickAvatar()}
                disabled={isPickingImage}
                accessibilityRole="button"
                accessibilityLabel={
                  avatarUri ? "Thay ảnh đại diện" : "Chọn ảnh đại diện"
                }
                accessibilityState={{
                  disabled: isPickingImage,
                  busy: isPickingImage,
                }}
              >
                {isPickingImage ? (
                  <ActivityIndicator color={COLORS.primary} />
                ) : avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons name="person-outline" size={40} color="#547B7D" />
                )}

                <View style={styles.cameraBadge}>
                  <Ionicons name="camera" size={14} color={COLORS.white} />
                </View>
              </TouchableOpacity>

              <Text style={styles.avatarHint}>Ảnh đại diện không bắt buộc</Text>
              {avatarError ? (
                <Text style={styles.avatarErrorText} accessibilityRole="alert">
                  {avatarError}
                </Text>
              ) : null}
            </View>

            <View style={styles.sectionHeader}>
              <View style={styles.verticalBar} />
              <Text style={styles.sectionTitle}>THÔNG TIN CÁ NHÂN</Text>
            </View>

            <Text style={styles.fieldLabel}>Họ và tên *</Text>
            <View
              style={[
                styles.inputContainer,
                fullNameError ? styles.inputContainerError : undefined,
              ]}
            >
              <TextInput
                style={[
                  styles.input,
                  Platform.OS === "web"
                    ? ({ outlineStyle: "none" } as any)
                    : undefined,
                ]}
                placeholder="Nhập họ và tên..."
                placeholderTextColor={COLORS.textLight}
                maxLength={FULL_NAME_MAX_LENGTH}
                value={fullName}
                onChangeText={(value) => {
                  setFullName(capitalizeWordInitials(value));
                  setFullNameError("");
                }}
                autoCapitalize="words"
                autoCorrect={false}
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => usernameInputRef.current?.focus()}
              />
            </View>

            {fullNameError ? (
              <Text style={styles.fieldErrorText} accessibilityRole="alert">
                {fullNameError}
              </Text>
            ) : null}

            <Text style={styles.fieldLabel}>Username *</Text>
            <View
              style={[
                styles.inputContainer,
                usernameError ? styles.inputContainerError : undefined,
              ]}
            >
              <TextInput
                ref={usernameInputRef}
                style={[
                  styles.input,
                  Platform.OS === "web"
                    ? ({ outlineStyle: "none" } as any)
                    : undefined,
                ]}
                placeholder="username_cua_ban"
                placeholderTextColor={COLORS.textLight}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={USERNAME_MAX_LENGTH}
                value={username}
                onChangeText={(value) => {
                  setUsername(value);
                  setUsernameError("");
                }}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => phoneInputRef.current?.focus()}
              />
            </View>

            {usernameError ? (
              <Text style={styles.fieldErrorText} accessibilityRole="alert">
                {usernameError}
              </Text>
            ) : null}

            <Text style={styles.fieldLabel}>Số điện thoại *</Text>
            <View
              style={[
                styles.inputContainer,
                phoneError ? styles.inputContainerError : undefined,
              ]}
            >
              <TextInput
                ref={phoneInputRef}
                style={[
                  styles.input,
                  Platform.OS === "web"
                    ? ({ outlineStyle: "none" } as any)
                    : undefined,
                ]}
                placeholder="Nhập số điện thoại..."
                placeholderTextColor={COLORS.textLight}
                keyboardType="phone-pad"
                inputMode="tel"
                autoComplete="tel"
                textContentType="telephoneNumber"
                maxLength={20}
                value={phone}
                onChangeText={(value) => {
                  setPhone(value);
                  setPhoneError("");
                }}
                returnKeyType="done"
                onSubmitEditing={handleNext}
              />
            </View>

            {phoneError ? (
              <Text style={styles.fieldErrorText} accessibilityRole="alert">
                {phoneError}
              </Text>
            ) : null}

            <View style={styles.privacyNoteContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={14}
                color={COLORS.textLight}
              />
              <Text style={styles.privacyNoteText}>
                Số điện thoại của bạn sẽ được bảo mật.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleNext}
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonText}>TIẾP TỤC</Text>
              <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
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
    paddingBottom: 40,
  },
  topHeader: {
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
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.05)",
      } as any,
    }),
  },
  headerCenter: {
    alignItems: "center",
    marginBottom: 28,
  },
  headerIconBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    marginBottom: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.text,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  avatarContainer: {
    alignItems: "center",
    marginBottom: 28,
  },
  avatarBox: {
    width: 88,
    height: 88,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "#BAC2C1",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    backgroundColor: "#F8F9FA",
  },
  avatarBoxError: {
    borderColor: COLORS.error,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
  },
  cameraBadge: {
    position: "absolute",
    bottom: -8,
    right: -8,
    backgroundColor: COLORS.primary,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  avatarHint: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 14,
  },
  avatarErrorText: {
    color: COLORS.error,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 6,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  verticalBar: {
    width: 4,
    height: 18,
    backgroundColor: COLORS.primary,
    marginRight: 8,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 8,
  },
  inputContainer: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    backgroundColor: COLORS.white,
  },
  inputContainerError: {
    borderColor: COLORS.error,
    borderWidth: 1.5,
  },
  input: {
    flex: 1,
    minHeight: 50,
    fontSize: 14,
    color: COLORS.text,
  },
  fieldErrorText: {
    color: COLORS.error,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
    marginBottom: 14,
  },
  privacyNoteContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 8,
    marginBottom: 28,
  },
  privacyNoteText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textLight,
    lineHeight: 18,
  },
  primaryButton: {
    minHeight: 54,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "800",
  },
});