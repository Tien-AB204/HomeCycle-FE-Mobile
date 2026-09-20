import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { COLORS } from "../../constants/theme";
import { useOptionalSubscription } from "../../contexts/SubscriptionContext";

/**
 * Vương miện VIP cho CHÍNH người dùng đang đăng nhập.
 * Chỉ hiển thị khi SubscriptionContext xác nhận Active + chưa hết hạn
 * (không có gói / Pending / Cancelled / Expired → không hiển thị).
 * Backend chưa công khai trạng thái VIP của người khác → không dùng cho hồ sơ/bài đăng người khác.
 */
type Props = {
  size?: "small" | "medium";
  withLabel?: boolean;
  style?: ViewStyle;
};

export default function VipCrownBadge({ size = "small", withLabel = false, style }: Props) {
  const subscription = useOptionalSubscription();
  if (!subscription?.isVip) return null;
  const iconSize = size === "medium" ? 14 : 10;
  return (
    <View
      style={[styles.badge, size === "medium" ? styles.badgeMedium : styles.badgeSmall, style]}
      accessibilityLabel="Tài khoản VIP"
    >
      <Ionicons name="star" size={iconSize} color="#FFFFFF" />
      {withLabel ? <Text style={styles.label}>VIP</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: "#C8951A",
    borderWidth: 1,
    borderColor: COLORS.white,
  },
  badgeSmall: { width: 16, height: 16 },
  badgeMedium: { paddingHorizontal: 8, height: 22 },
  label: { color: COLORS.white, fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
});
