import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { COLORS } from "../../constants/theme";

type SwipeToConfirmProps = {
  label: string;
  onConfirm: () => void | Promise<void>;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
};

const KNOB_SIZE = 48;
const TRACK_PADDING = 4;
// Kéo quá 85% quãng đường thì coi như xác nhận; thả sớm hơn thì nút trượt về.
const CONFIRM_RATIO = 0.85;

// Thanh trượt từ trái sang phải để xác nhận thao tác không hoàn tác được
// (thay cho nút bấm + hộp xác nhận), tránh bấm nhầm.
export default function SwipeToConfirm({
  label,
  onConfirm,
  icon = "arrow-forward",
  loading = false,
  disabled = false,
}: SwipeToConfirmProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const maxTravel = Math.max(0, trackWidth - KNOB_SIZE - TRACK_PADDING * 2);
  const maxTravelRef = useRef(maxTravel);
  const lockedRef = useRef(false);
  const onConfirmRef = useRef(onConfirm);
  maxTravelRef.current = maxTravel;
  onConfirmRef.current = onConfirm;
  const isInactive = disabled || loading;
  const isInactiveRef = useRef(isInactive);
  isInactiveRef.current = isInactive;

  const resetKnob = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: false,
      bounciness: 6,
    }).start();
  };

  // Xong việc (hết loading) mà nút vẫn còn hiện thì trả nút về đầu để thử lại được.
  useEffect(() => {
    if (loading) return;
    lockedRef.current = false;
    resetKnob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !isInactiveRef.current && !lockedRef.current,
        onMoveShouldSetPanResponder: (_, gesture) =>
          !isInactiveRef.current && !lockedRef.current && Math.abs(gesture.dx) > 4,
        // Không nhường cử chỉ cho ScrollView/điều hướng khi đang kéo.
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, gesture) => {
          const next = Math.min(Math.max(gesture.dx, 0), maxTravelRef.current);
          translateX.setValue(next);
        },
        onPanResponderRelease: (_, gesture) => {
          const travel = maxTravelRef.current;
          if (travel > 0 && gesture.dx >= travel * CONFIRM_RATIO) {
            lockedRef.current = true;
            Animated.timing(translateX, {
              toValue: travel,
              duration: 120,
              useNativeDriver: false,
            }).start(() => {
              void Promise.resolve(onConfirmRef.current()).finally(() => {
                // Nếu loading do màn cha điều khiển thì effect ở trên sẽ trả nút về.
                if (!isInactiveRef.current) {
                  lockedRef.current = false;
                  resetKnob();
                }
              });
            });
            return;
          }
          resetKnob();
        },
        onPanResponderTerminate: resetKnob,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const labelOpacity =
    maxTravel > 0
      ? translateX.interpolate({
          inputRange: [0, maxTravel * 0.6],
          outputRange: [1, 0],
          extrapolate: "clamp",
        })
      : 1;
  const fillWidth = translateX.interpolate({
    inputRange: [0, Math.max(maxTravel, 1)],
    outputRange: [KNOB_SIZE + TRACK_PADDING * 2, Math.max(trackWidth, 1)],
    extrapolate: "clamp",
  });

  return (
    <View
      style={[styles.track, isInactive && !loading ? styles.trackDisabled : undefined]}
      onLayout={(event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width)}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityHint="Trượt sang phải để xác nhận"
    >
      {/* Phần đã trượt qua được tô đậm dần theo nút. */}
      <Animated.View style={[styles.fill, { width: fillWidth }]} />
      <Animated.Text style={[styles.label, { opacity: labelOpacity }]} numberOfLines={1}>
        {loading ? "Đang xác nhận..." : label}
      </Animated.Text>
      <View pointerEvents="none" style={styles.chevrons}>
        <Ionicons name="chevron-forward" size={16} color="rgba(43, 86, 89, 0.35)" />
        <Ionicons name="chevron-forward" size={16} color="rgba(43, 86, 89, 0.6)" />
      </View>
      <Animated.View
        style={[styles.knob, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.primary} />
        ) : (
          <Ionicons name={icon} size={22} color={COLORS.primary} />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: KNOB_SIZE + TRACK_PADDING * 2,
    borderRadius: (KNOB_SIZE + TRACK_PADDING * 2) / 2,
    justifyContent: "center",
    padding: TRACK_PADDING,
    overflow: "hidden",
    backgroundColor: "rgba(84, 123, 125, 0.14)",
  },
  trackDisabled: { opacity: 0.5 },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: (KNOB_SIZE + TRACK_PADDING * 2) / 2,
    backgroundColor: COLORS.primary,
  },
  label: {
    position: "absolute",
    left: KNOB_SIZE + 20,
    right: 44,
    textAlign: "center",
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: "800",
  },
  chevrons: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
});
