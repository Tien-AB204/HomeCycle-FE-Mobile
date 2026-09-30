import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";

import { COLORS } from "../../constants/theme";

const COLLAPSED_LINES = 2;

type CollapsibleNoticeProps = {
  text: string;
  style?: StyleProp<ViewStyle>;
};

// Khung lưu ý dài: mặc định chỉ hiện vài dòng đầu, chạm để mở hoặc thu gọn.
export default function CollapsibleNotice({ text, style }: CollapsibleNoticeProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      activeOpacity={0.8}
      onPress={() => setIsExpanded((value) => !value)}
      accessibilityRole="button"
      accessibilityState={{ expanded: isExpanded }}
      accessibilityHint={isExpanded ? "Thu gọn lưu ý" : "Xem toàn bộ lưu ý"}
    >
      <Ionicons
        name="information-circle-outline"
        size={18}
        color={COLORS.primary}
        style={styles.icon}
      />
      <View style={styles.body}>
        <Text
          style={styles.text}
          numberOfLines={isExpanded ? undefined : COLLAPSED_LINES}
        >
          {text}
        </Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleText}>
            {isExpanded ? "Thu gọn" : "Xem thêm"}
          </Text>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={14}
            color={COLORS.primary}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(84, 123, 125, 0.08)",
  },
  icon: { marginTop: 1 },
  body: { flex: 1, gap: 4 },
  text: {
    color: COLORS.text,
    fontSize: 12.5,
    lineHeight: 18,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  toggleText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "700",
  },
});
