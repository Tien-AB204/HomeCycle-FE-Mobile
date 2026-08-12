import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useState } from "react";
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
} from "react-native";
import { notifyUser } from "../../src/components/shared/ActionFeedback";
import { COLORS } from "../../src/constants/theme";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";

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
  const password = getStringParam(
    params.password,
  );
  const registrationToken = getStringParam(
    params.registrationToken,
  );

  const [fullName, setFullName] =
    useState("");
  const [username, setUsername] =
    useState("");
  const [phone, setPhone] = useState("");
  const [avatarUri, setAvatarUri] =
    useState<string | null>(null);
  const [isPickingImage, setIsPickingImage] =
    useState(false);

  const pickAvatar = async () => {
    if (isPickingImage) {
      return;
    }

    try {
      setIsPickingImage(true);

      const result =
        await ImagePicker.launchImageLibraryAsync(
          {
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
          },
        );

      if (
        !result.canceled &&
        result.assets[0]?.uri
      ) {
        setAvatarUri(
          result.assets[0].uri,
        );
      }
    } catch (error: unknown) {
      notifyUser(
        getApiErrorMessage(
          error,
          "Không thể mở thư viện ảnh.",
        ),
        "error",
      );
    } finally {
      setIsPickingImage(false);
    }
  };

  const handleNext = () => {
    const normalizedFullName =
      fullName.trim();
    const normalizedUsername =
      username.trim();
    const normalizedPhone = phone.trim();

    if (
      !normalizedFullName ||
      !normalizedUsername ||
      !normalizedPhone
    ) {
      notifyUser(
        "Họ tên, username và số điện thoại là bắt buộc.",
        "error",
      );
      return;
    }

    router.push({
      pathname:
        "/(auth)/verification-setup",
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
          <View style={styles.headerCenter}>
            <Ionicons
              name="person-circle"
              size={48}
              color={COLORS.primary}
              style={styles.headerIcon}
            />

            <Text style={styles.title}>
              Thiết lập hồ sơ cá nhân
            </Text>

            <Text style={styles.subtitle}>
              Bước 1/2: Thông tin cơ bản
              giúp bạn trải nghiệm mua bán
              tốt hơn.
            </Text>
          </View>

          <View
            style={styles.avatarContainer}
          >
            <TouchableOpacity
              style={styles.avatarBox}
              onPress={() =>
                void pickAvatar()
              }
              disabled={isPickingImage}
            >
              {avatarUri ? (
                <Image
                  source={{
                    uri: avatarUri,
                  }}
                  style={styles.avatarImage}
                />
              ) : (
                <Ionicons
                  name="person-outline"
                  size={40}
                  color="#B0B8C1"
                />
              )}

              <View style={styles.cameraBadge}>
                <Ionicons
                  name="camera"
                  size={14}
                  color={COLORS.white}
                />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionHeader}>
            <View style={styles.verticalBar} />

            <Text style={styles.sectionTitle}>
              THÔNG TIN CÁ NHÂN
            </Text>
          </View>

          <Text style={styles.fieldLabel}>
            Họ và tên *
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web"
                  ? ({
                      outlineStyle: "none",
                    } as any)
                  : undefined,
              ]}
              placeholder="Nhập họ và tên..."
              placeholderTextColor={
                COLORS.textLight
              }
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <Text style={styles.fieldLabel}>
            Username *
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web"
                  ? ({
                      outlineStyle: "none",
                    } as any)
                  : undefined,
              ]}
              placeholder="username_cua_ban"
              placeholderTextColor={
                COLORS.textLight
              }
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
            />
          </View>

          <Text style={styles.fieldLabel}>
            Số điện thoại *
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web"
                  ? ({
                      outlineStyle: "none",
                    } as any)
                  : undefined,
              ]}
              placeholder="Nhập số điện thoại..."
              placeholderTextColor={
                COLORS.textLight
              }
              keyboardType="phone-pad"
              inputMode="tel"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          <View
            style={
              styles.privacyNoteContainer
            }
          >
            <Ionicons
              name="lock-closed-outline"
              size={14}
              color={COLORS.textLight}
            />

            <Text
              style={styles.privacyNoteText}
            >
              Số điện thoại của bạn sẽ được
              bảo mật.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleNext}
          >
            <Text
              style={styles.primaryButtonText}
            >
              TIẾP TỤC
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  keyboardContainer: {
    flex: 1,
  },

  scrollContainer: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },

  headerCenter: {
    alignItems: "center",
    marginBottom: 32,
  },

  headerIcon: {
    marginBottom: 8,
  },

  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: COLORS.text,
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
    marginBottom: 32,
  },

  avatarBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#E0E4EC",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
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
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLORS.white,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },

  verticalBar: {
    width: 4,
    height: 16,
    backgroundColor: "#34495E",
    marginRight: 8,
    borderRadius: 2,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#34495E",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 8,
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 48,
    backgroundColor: COLORS.white,
    marginBottom: 16,
  },

  input: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },

  privacyNoteContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: -8,
    marginBottom: 32,
  },

  privacyNoteText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textLight,
    lineHeight: 18,
  },

  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },

  primaryButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "bold",
  },
});