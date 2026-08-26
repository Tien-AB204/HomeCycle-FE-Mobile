import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";

import { COLORS } from "../../constants/theme";

interface SensitiveValueProps {
  value?: unknown;
  fallback?: string;
  containerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export default function SensitiveValue({
  value,
  fallback = "Không có",
  containerStyle,
  textStyle,
}: SensitiveValueProps) {
  const [isVisible, setIsVisible] =
    useState(false);

  const normalizedValue =
    value === null ||
    value === undefined
      ? ""
      : String(value).trim();

  const hasValue =
    normalizedValue.length > 0;

  const displayValue = !hasValue
    ? fallback
    : isVisible
      ? normalizedValue
      : "••••••••";

  return (
    <View
      style={[
        styles.container,
        containerStyle,
      ]}
    >
      <Text
        style={[
          styles.text,
          textStyle,
        ]}
        selectable={isVisible && hasValue}
      >
        {displayValue}
      </Text>

      {hasValue ? (
        <TouchableOpacity
          onPress={() =>
            setIsVisible(
              (current) => !current,
            )
          }
          style={styles.eyeButton}
          accessibilityRole="button"
          accessibilityLabel={
            isVisible
              ? "Ẩn thông tin nhạy cảm"
              : "Hiện thông tin nhạy cảm"
          }
          hitSlop={8}
        >
          <Ionicons
            name={
              isVisible
                ? "eye-off-outline"
                : "eye-outline"
            }
            size={19}
            color={COLORS.textLight}
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },

  text: {
    color: COLORS.text,
  },

  eyeButton: {
    minWidth: 32,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
});
