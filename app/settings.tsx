import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Header from "../src/components/shared/Header";
import { COLORS } from "../src/constants/theme";
import { useNotifications } from "../src/contexts/NotificationContext";
import { useDiscoveryPreferences } from "../src/contexts/DiscoveryPreferencesContext";
import {
  AppearancePreference,
  getEffectiveAppearance,
  THEME_LOCKED_TO_LIGHT,
} from "../src/utils/appearance";

const APPEARANCE_OPTIONS: {
  value: AppearancePreference;
  label: string;
}[] = [
  { value: "light", label: "Sáng" },
  { value: "dark", label: "Tối" },
  { value: "system", label: "Hệ thống" },
];

export default function SettingsScreen() {
  const {
    systemNotificationsEnabled,
    isSystemNotificationPreferenceLoaded,
    setSystemNotificationsEnabled,
  } = useNotifications();
  const {
    showOwnPostsInDiscovery,
    isDiscoveryPreferenceLoaded,
    setShowOwnPostsInDiscovery,
  } = useDiscoveryPreferences();
  // Giao diện đang khóa ở chế độ Sáng: không lưu/không áp dụng lựa chọn khác.
  const appearancePreference: AppearancePreference = getEffectiveAppearance("light");

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Thiết lập ứng dụng" showBack={true} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Khám phá</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconTextWrap}>
              <View style={styles.iconBox}>
                <Ionicons name="compass-outline" size={20} color="#2B5659" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.settingText}>
                  Hiển thị tin đăng của tôi khi khám phá
                </Text>
                <Text style={styles.settingDescription}>
                  Cho phép tin của bạn xuất hiện tại Trang chủ và Tìm kiếm.
                </Text>
              </View>
            </View>
            <Switch
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor="#ffffff"
              ios_backgroundColor={COLORS.border}
              onValueChange={(value) => {
                void setShowOwnPostsInDiscovery(value);
              }}
              value={showOwnPostsInDiscovery}
              disabled={!isDiscoveryPreferenceLoaded}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Thông báo</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconTextWrap}>
              <View style={styles.iconBox}>
                <Ionicons name="notifications" size={20} color="#2B5659" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.settingText}>Thông báo trên thiết bị</Text>
                <Text style={styles.settingDescription}>
                  Hiển thị thông báo trên thiết bị khi HomeCycle đang hoạt động.
                </Text>
              </View>
            </View>
            <Switch
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor={"#ffffff"}
              ios_backgroundColor={COLORS.border}
              onValueChange={setSystemNotificationsEnabled}
              value={systemNotificationsEnabled}
              disabled={!isSystemNotificationPreferenceLoaded}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Giao diện</Text>
        <View style={styles.card}>
          <View style={styles.appearanceHeader}>
            <View style={styles.iconBox}>
              <Ionicons name="color-palette-outline" size={20} color="#2B5659" />
            </View>
            <View style={styles.flex}>
              <Text style={styles.settingText}>Chế độ hiển thị</Text>
              <Text style={styles.settingDescription}>
                {THEME_LOCKED_TO_LIGHT
                  ? "Tính năng đang được phát triển."
                  : "Áp dụng theo khả năng hiển thị hiện có của thiết bị."}
              </Text>
            </View>
          </View>
          <View style={styles.appearanceOptions}>
            {APPEARANCE_OPTIONS.map((option) => {
              const isSelected = appearancePreference === option.value;
              const isLocked = THEME_LOCKED_TO_LIGHT && option.value !== "light";
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.appearanceOption,
                    isSelected ? styles.appearanceOptionSelected : undefined,
                    isLocked ? styles.appearanceOptionLocked : undefined,
                  ]}
                  disabled
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected, disabled: true }}
                >
                  <Text
                    style={[
                      styles.appearanceOptionText,
                      isSelected
                        ? styles.appearanceOptionTextSelected
                        : undefined,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.footerInfo}>
          <Text style={styles.companyText}>© 2026 HomeCycle VN</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  container: { flex: 1 },
  content: { padding: 16 },
  flex: { flex: 1 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.textLight,
    textTransform: "uppercase",
    marginBottom: 12,
    marginTop: 16,
    marginLeft: 4,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  iconTextWrap: { flexDirection: "row", alignItems: "center", flex: 1 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    backgroundColor: "rgba(84, 123, 125, 0.10)",
  },
  settingText: { fontSize: 16, color: COLORS.text, fontWeight: "500" },
  settingDescription: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.textLight,
  },
  appearanceHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  appearanceOptions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  appearanceOption: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
  },
  appearanceOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "rgba(84, 123, 125, 0.10)",
  },
  appearanceOptionText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textLight,
  },
  appearanceOptionTextSelected: { color: COLORS.primary },
  appearanceOptionLocked: { opacity: 0.45 },
  footerInfo: { marginTop: 40, alignItems: "center" },
  companyText: { fontSize: 12, color: "#547B7D" },
});
