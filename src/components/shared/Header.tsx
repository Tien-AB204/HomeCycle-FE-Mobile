// src/components/Header.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
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

  // LOGIC BACK AN TOÀN: Có trang trước thì lùi, không có thì về Home
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)"); // Đường dẫn trỏ về màn hình gốc (Home)
    }
  };

  return (
    <View style={styles.header}>
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 56,
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
