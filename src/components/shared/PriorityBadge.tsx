import { Ionicons } from "@expo/vector-icons";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

import { COLORS } from "../../constants/theme";

const PRIORITY_GOLD = "#C8951A";

// BE tự tính isPriority (chủ tin đang có gói trả phí còn hạn); app chỉ hiển thị.
export const isPriorityPost = (post: any) =>
  post?.isPriority === true ||
  String(post?.priorityStatus ?? "").toUpperCase() === "PRIORITIZED";

type PriorityBadgeProps = {
  post: any;
  style?: StyleProp<ViewStyle>;
};

// Nhãn nhỏ trên thẻ tin.
export default function PriorityBadge({ post, style }: PriorityBadgeProps) {
  if (!isPriorityPost(post)) return null;
  return (
    <View style={[styles.badge, style]} accessibilityLabel="Tin được ưu tiên">
      <Ionicons name="star" size={10} color={COLORS.white} />
      <Text style={styles.badgeText}>Ưu tiên</Text>
    </View>
  );
}

// Dòng giải thích ở trang chi tiết tin.
export function PriorityNotice({ post, style }: PriorityBadgeProps) {
  if (!isPriorityPost(post)) return null;
  return (
    <View style={[styles.notice, style]}>
      <Ionicons name="star" size={16} color={PRIORITY_GOLD} />
      <Text style={styles.noticeText}>
        Bài viết này được ưu tiên vì chủ tin đang dùng gói trả phí.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: PRIORITY_GOLD,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "800",
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(200, 149, 26, 0.35)",
    backgroundColor: "#FBF5E6",
  },
  noticeText: {
    flex: 1,
    color: "#7A5A10",
    fontSize: 13,
    fontWeight: "600",
  },
});
