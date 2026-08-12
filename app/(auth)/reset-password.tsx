import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { notifyUser } from "../../src/components/shared/ActionFeedback";
import { COLORS } from "../../src/constants/theme";

export default function ResetPasswordScreen() {
  const router = useRouter();

  const [newPassword, setNewPassword] =
    useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [showNewPassword, setShowNewPassword] =
    useState(false);
  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const handleReset = () => {
    if (!newPassword || !confirmPassword) {
      notifyUser(
        "Vui lòng điền đầy đủ mật khẩu.",
        "error",
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      notifyUser(
        "Mật khẩu xác nhận không khớp.",
        "error",
      );
      return;
    }

    notifyUser(
      "Đổi mật khẩu thành công. Vui lòng đăng nhập lại.",
      "success",
    );

    router.replace("/(auth)/login");
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
              size={24}
              color={COLORS.text}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.contentCard}>
          <View
            style={styles.logoCenterContainer}
          >
            <View style={styles.logoBox}>
              <Ionicons
                name="sync-circle"
                size={32}
                color={COLORS.white}
              />
            </View>

            <Text style={styles.logoText}>
              HomeCycle
            </Text>

            <Text style={styles.title}>
              Đặt lại mật khẩu mới
            </Text>

            <Text style={styles.subtitle}>
              Vui lòng tạo mật khẩu mới có độ
              bảo mật cao để bảo vệ tài khoản
              của bạn.
            </Text>
          </View>

          <Text style={styles.label}>
            MẬT KHẨU MỚI
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
              placeholder="Nhập mật khẩu mới..."
              placeholderTextColor={
                COLORS.textLight
              }
              secureTextEntry={!showNewPassword}
              value={newPassword}
              onChangeText={setNewPassword}
            />

            <TouchableOpacity
              onPress={() =>
                setShowNewPassword(
                  (current) => !current,
                )
              }
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

          <Text style={styles.label}>
            XÁC NHẬN MẬT KHẨU MỚI
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
              placeholder="Xác nhận lại mật khẩu mới..."
              placeholderTextColor={
                COLORS.textLight
              }
              secureTextEntry={
                !showConfirmPassword
              }
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            <TouchableOpacity
              onPress={() =>
                setShowConfirmPassword(
                  (current) => !current,
                )
              }
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

          <View
            style={styles.requirementsContainer}
          >
            <View style={styles.requirementRow}>
              <View style={styles.dot} />
              <Text
                style={styles.requirementText}
              >
                Tối thiểu 8 ký tự
              </Text>
            </View>

            <View style={styles.requirementRow}>
              <View style={styles.dot} />
              <Text
                style={styles.requirementText}
              >
                Bao gồm chữ hoa, chữ thường và số
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleReset}
          >
            <Text
              style={styles.primaryButtonText}
            >
              XÁC NHẬN ĐỔI MẬT KHẨU
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

  logoCenterContainer: {
    alignItems: "center",
    marginBottom: 32,
  },

  logoBox: {
    backgroundColor: COLORS.primary,
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },

  logoText: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.primary,
    marginBottom: 16,
  },

  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 13,
    color: COLORS.textLight,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 10,
  },

  label: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textLight,
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
    marginBottom: 16,
  },

  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },

  requirementsContainer: {
    marginBottom: 24,
    paddingHorizontal: 4,
  },

  requirementRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },

  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.textLight,
    marginRight: 8,
  },

  requirementText: {
    fontSize: 13,
    color: COLORS.textLight,
    fontWeight: "500",
  },

  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },

  primaryButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "bold",
  },
});