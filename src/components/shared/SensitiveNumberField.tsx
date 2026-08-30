import { Ionicons } from "@expo/vector-icons";
import {
  Platform,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { useEffect, useState } from "react";

import { COLORS } from "../../constants/theme";

interface SensitiveNumberFieldProps
  extends Omit<
    TextInputProps,
    "style" | "secureTextEntry"
  > {
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  hasError?: boolean;
  isEditing?: boolean;
  visibleStartDigits?: number;
  visibleEndDigits?: number;
}

const maskSensitiveValue = (
  rawValue: string,
  visibleStartDigits: number,
  visibleEndDigits: number,
) => {
  if (!rawValue) return "";

  if (rawValue.length <= 2) {
    return "•".repeat(rawValue.length);
  }

  const minimumHiddenDigits = Math.min(2, rawValue.length - 1);
  const visibleBudget = Math.max(
    0,
    rawValue.length - minimumHiddenDigits,
  );

  let startCount = Math.min(
    Math.max(1, visibleStartDigits),
    Math.ceil(visibleBudget / 2),
  );
  let endCount = Math.min(
    Math.max(1, visibleEndDigits),
    visibleBudget - startCount,
  );

  if (endCount < 1 && visibleBudget >= 2) {
    endCount = 1;
    startCount = visibleBudget - 1;
  }

  const hiddenCount = Math.max(
    1,
    rawValue.length - startCount - endCount,
  );

  return (
    rawValue.slice(0, startCount) +
    "•".repeat(hiddenCount) +
    rawValue.slice(rawValue.length - endCount)
  );
};

export default function SensitiveNumberField({
  containerStyle,
  inputStyle,
  hasError = false,
  editable = true,
  isEditing,
  placeholderTextColor = COLORS.textLight,
  visibleStartDigits = 3,
  visibleEndDigits = 3,
  value,
  ...props
}: SensitiveNumberFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  const rawValue = String(value ?? "");
  const hasValue = rawValue.length > 0;
  const privacyEditing = isEditing ?? editable;

  useEffect(() => {
    setIsVisible(false);
  }, [privacyEditing]);

  const displayValue =
    privacyEditing || isVisible
      ? rawValue
      : maskSensitiveValue(
          rawValue,
          visibleStartDigits,
          visibleEndDigits,
        );

  const webInputStyle =
    Platform.OS === "web"
      ? ({ outlineStyle: "none" } as any)
      : undefined;

  return (
    <View
      style={[
        styles.container,
        hasError ? styles.containerError : undefined,
        containerStyle,
      ]}
    >
      <TextInput
        {...props}
        value={displayValue}
        editable={editable}
        secureTextEntry={
          privacyEditing && !isVisible && hasValue
        }
        placeholderTextColor={placeholderTextColor}
        style={[
          styles.input,
          webInputStyle,
          inputStyle,
        ]}
      />

      <TouchableOpacity
        style={[
          styles.eyeButton,
          !hasValue ? styles.eyeButtonDisabled : undefined,
        ]}
        onPress={(event) => {
          event.stopPropagation();
          if (!hasValue) return;
          setIsVisible((current) => !current);
        }}
        disabled={!hasValue}
        accessibilityRole="button"
        accessibilityLabel={
          isVisible
            ? "Ẩn thông tin nhạy cảm"
            : "Hiện thông tin nhạy cảm"
        }
        accessibilityState={{
          disabled: !hasValue,
        }}
        hitSlop={8}
      >
        <Ionicons
          name={
            isVisible
              ? "eye-off-outline"
              : "eye-outline"
          }
          size={20}
          color={COLORS.textLight}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    flexDirection: "row",
    alignItems: "center",
  },

  containerError: {
    borderColor: COLORS.error,
  },

  input: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
  },

  eyeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingRight: 4,
  },

  eyeButtonDisabled: {
    opacity: 0.45,
  },
});
