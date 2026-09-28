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
  style?: StyleProp<ViewStyle>;
};

export default function DeadlineBanner({
  countdown,
  label,
  expiredText,
  note,
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
          size={18}
          color={tone}
        />
        <Text style={[styles.text, { color: tone }]}>
          {isExpired ? expiredText : `${label}: `}
          {isExpired ? null : (
            <Text style={styles.time}>{formatRemainingTime(remainingMs)}</Text>
          )}
        </Text>
      </View>
      {note && !isExpired ? <Text style={styles.note}>{note}</Text> : null}
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
