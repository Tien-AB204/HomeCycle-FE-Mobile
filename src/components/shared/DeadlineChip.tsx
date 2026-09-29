import { Ionicons } from "@expo/vector-icons";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

import { COLORS } from "../../constants/theme";
import { formatRemainingTime } from "../../utils/useDeadlineCountdown";

const WARNING_THRESHOLD_MS = 60_000;

type DeadlineChipProps = {
  // Thời gian còn lại (ms); null thì không hiển thị.
  remainingMs: number | null;
  // Ví dụ: "Còn" → "Còn 02:15"
  label?: string;
  expiredText?: string;
  style?: StyleProp<ViewStyle>;
};

// Nhãn đếm ngược nhỏ cho thẻ trong danh sách.
export default function DeadlineChip({
  remainingMs,
  label = "Còn",
  expiredText = "Đã hết hạn",
  style,
}: DeadlineChipProps) {
  if (remainingMs === null) return null;

  const isExpired = remainingMs <= 0;
  const isWarning = !isExpired && remainingMs <= WARNING_THRESHOLD_MS;
  const tone = isExpired ? COLORS.error : isWarning ? COLORS.warning : COLORS.primary;

  return (
    <View
      style={[
        styles.chip,
        isExpired ? styles.expired : isWarning ? styles.warning : styles.normal,
        style,
      ]}
    >
      <Ionicons
        name={isExpired ? "alert-circle-outline" : "time-outline"}
        size={13}
        color={tone}
      />
      <Text style={[styles.text, { color: tone }]}>
        {isExpired ? expiredText : `${label} ${formatRemainingTime(remainingMs)}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  normal: { backgroundColor: "#EEF4F4" },
  warning: { backgroundColor: "#FBF3E6" },
  expired: { backgroundColor: "#F8ECEC" },
  text: {
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
