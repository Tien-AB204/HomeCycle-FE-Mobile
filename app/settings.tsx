import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { SafeAreaView, StyleSheet, Switch, Text, View } from "react-native";
import Header from "../src/components/shared/Header";
import { COLORS } from "../src/constants/theme";
import { useNotifications } from "../src/contexts/NotificationContext";

export default function SettingsScreen() {
  const {
    systemNotificationsEnabled,
    isSystemNotificationPreferenceLoaded,
    setSystemNotificationsEnabled,
  } = useNotifications();

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Thiết lập ứng dụng" showBack={true} />

      <View style={styles.container}>
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

        <View style={styles.footerInfo}>
          <Text style={styles.companyText}>© 2026 HomeCycle VN</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  container: { flex: 1, padding: 16 },
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
  footerInfo: { marginTop: 40, alignItems: "center" },
  companyText: { fontSize: 12, color: "#547B7D" },
});
