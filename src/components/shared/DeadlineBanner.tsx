import { Ionicons } from "@expo/vector-icons";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

import { COLORS } from "../../constants/theme";
import {
  DeadlineCountdown,
  formatRemainingTime,
} from "../../utils/useDeadlineCountdown";

const WARNING_THRESHOLD_MS = 60_000;

type DeadlineBannerProps = {
  countdown: DeadlineCountdown;
  // Ví dụ: "Thời gian phản hồi còn lại"
  label: string;
  expiredText: string;
  note?: string;
  // Bản gọn một dòng (vd. dưới màn chat, khi chi tiết đã nằm trên thẻ).
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function DeadlineBanner({
  countdown,
  label,
  expiredText,
  note,
  compact = false,
  style,
}: DeadlineBannerProps) {
  if (!countdown.hasDeadline || countdown.remainingMs === null) return null;

  const { isExpired, remainingMs } = countdown;
  const isWarning = !isExpired && remainingMs <= WARNING_THRESHOLD_MS;
  const tone = isExpired ? COLORS.error : isWarning ? COLORS.warning : COLORS.primary;

  return (
    <View
      style={[
        styles.container,
        compact ? styles.compact : undefined,
        { borderColor: tone },
        isExpired ? styles.expired : isWarning ? styles.warning : styles.normal,
        style,
      ]}
      accessibilityRole="timer"
      accessibilityLiveRegion={isExpired || isWarning ? "polite" : "none"}
    >
      <View style={styles.row}>
        <Ionicons
          name={isExpired ? "alert-circle-outline" : "time-outline"}
          size={compact ? 15 : 18}
          color={tone}
        />
        <Text
          // Bản gọn co theo nội dung nên không được dùng flex (flex làm chữ co về 0).
          style={[compact ? styles.compactText : styles.text, { color: tone }]}
          numberOfLines={compact ? 1 : undefined}
        >
          {isExpired ? expiredText : `${label}: `}
          {isExpired ? null : (
            <Text style={styles.time}>{formatRemainingTime(remainingMs)}</Text>
          )}
        </Text>
      </View>
      {note && !isExpired && !compact ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  compact: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  compactText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  normal: {
    backgroundColor: "#EEF4F4",
  },
  warning: {
    backgroundColor: "#FBF3E6",
  },
  expired: {
    backgroundColor: "#F8ECEC",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  time: {
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  note: {
    fontSize: 12,
    color: COLORS.textLight,
    marginLeft: 26,
  },
});
