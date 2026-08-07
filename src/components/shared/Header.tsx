// src/components/Header.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../constants/theme";

interface HeaderProps {
  title?: string;
  centerContent?: React.ReactNode;
  showBack?: boolean;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
}

export default function Header({
  title,
  centerContent,
  showBack = false,
  leftContent,
  rightContent,
}: HeaderProps) {
  const router = useRouter();
  
  // 2. Lấy thông số safe area phía trên của thiết bị
  const insets = useSafeAreaInsets();

  // LOGIC BACK AN TOÀN: Có trang trước thì lùi, không có thì về Home
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  };

  return (
    // Đã đổi height thành 60 + insets.top để đạt chuẩn 60px
    <View style={[styles.header, { paddingTop: insets.top, height: 60 + insets.top }]}>
      <View style={styles.headerLeft}>
        {showBack && (
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={26} color={COLORS.text} />
          </TouchableOpacity>
        )}
        {leftContent}
      </View>

      <View style={styles.headerCenter}>
        {centerContent ? (
          centerContent
        ) : title ? (
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </View>

      <View style={styles.headerRight}>{rightContent}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center", // Thuộc tính này sẽ tự động căn giữa đều trên/dưới
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  headerCenter: { flex: 1, marginHorizontal: 12, justifyContent: "center" },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    justifyContent: "flex-end",
  },
  backButton: { padding: 4, marginLeft: -4 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text },
});