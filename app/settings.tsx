import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import { SafeAreaView, StyleSheet, Switch, Text, View } from "react-native";
import Header from "../src/components/shared/Header";
import { COLORS } from "../src/constants/theme";

export default function SettingsScreen() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(true);

  // Load trạng thái theme từ LocalStorage khi mở màn hình
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem("theme");
        if (savedTheme === "dark") {
          setIsDarkMode(true);
        }
      } catch (error) {
        console.log("Lỗi tải cài đặt:", error);
      }
    };
    loadSettings();
  }, []);

  // Hàm xử lý khi gạt nút Sáng/Tối
  const toggleTheme = async (value: boolean) => {
    setIsDarkMode(value);
    try {
      await AsyncStorage.setItem("theme", value ? "dark" : "light");
      // Ghi chú cho Dev:
      // Để toàn bộ App đổi màu ngay lập tức khi gạt nút này,
      // sau này ông cần bọc App bằng một cái <ThemeProvider> (Context) nhé.
      // Hiện tại nó đã lưu trạng thái vào máy thành công!
    } catch (error) {
      console.log("Lỗi lưu cài đặt theme:", error);
    }
  };

  const toggleNotifications = (value: boolean) => {
    setIsNotificationsEnabled(value);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Thiết lập ứng dụng" showBack={true} />

      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Giao diện & Hiển thị</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconTextWrap}>
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: isDarkMode ? "#334155" : "#F1F5F9" },
                ]}
              >
                <Ionicons
                  name={isDarkMode ? "moon" : "sunny"}
                  size={20}
                  color={isDarkMode ? "#FBBF24" : "#F59E0B"}
                />
              </View>
              <Text style={styles.settingText}>Giao diện tối (Dark Mode)</Text>
            </View>
            <Switch
              trackColor={{ false: "#CBD5E1", true: COLORS.primary }}
              thumbColor={"#ffffff"}
              ios_backgroundColor="#CBD5E1"
              onValueChange={toggleTheme}
              value={isDarkMode}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Thông báo</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconTextWrap}>
              <View style={[styles.iconBox, { backgroundColor: "#E0F2FE" }]}>
                <Ionicons name="notifications" size={20} color="#0EA5E9" />
              </View>
              <Text style={styles.settingText}>Nhận thông báo đẩy (Push)</Text>
            </View>
            <Switch
              trackColor={{ false: "#CBD5E1", true: COLORS.primary }}
              thumbColor={"#ffffff"}
              ios_backgroundColor="#CBD5E1"
              onValueChange={toggleNotifications}
              value={isNotificationsEnabled}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.iconTextWrap}>
              <View style={[styles.iconBox, { backgroundColor: "#FEF3C7" }]}>
                <Ionicons name="mail" size={20} color="#F59E0B" />
              </View>
              <Text style={styles.settingText}>Nhận email tin tức</Text>
            </View>
            <Switch
              trackColor={{ false: "#CBD5E1", true: COLORS.primary }}
              thumbColor={"#ffffff"}
              ios_backgroundColor="#CBD5E1"
              onValueChange={() => {}}
              value={false}
            />
          </View>
        </View>

        <View style={styles.footerInfo}>
          <Text style={styles.versionText}>Phiên bản hiện tại: 1.0.0</Text>
          <Text style={styles.companyText}>© 2026 HomeCycle VN</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  container: { flex: 1, padding: 16 },
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
  },
  settingText: { fontSize: 16, color: COLORS.text, fontWeight: "500" },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 12,
    marginLeft: 48,
  },
  footerInfo: { marginTop: 40, alignItems: "center" },
  versionText: { fontSize: 13, color: COLORS.textLight, marginBottom: 4 },
  companyText: { fontSize: 12, color: "#94A3B8" },
});
