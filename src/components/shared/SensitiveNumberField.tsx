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
import { useState } from "react";

import { COLORS } from "../../constants/theme";

interface SensitiveNumberFieldProps
  extends Omit<
    TextInputProps,
    "style" | "secureTextEntry"
  > {
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  hasError?: boolean;
}

export default function SensitiveNumberField({
  containerStyle,
  inputStyle,
  hasError = false,
  editable = true,
  placeholderTextColor = COLORS.textLight,
  ...props
}: SensitiveNumberFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

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
        editable={editable}
        secureTextEntry={!isVisible}
        placeholderTextColor={placeholderTextColor}
        style={[
          styles.input,
          webInputStyle,
          inputStyle,
        ]}
      />

      <TouchableOpacity
        style={styles.eyeButton}
        onPress={() =>
          setIsVisible((current) => !current)
        }
        disabled={!editable}
        accessibilityRole="button"
        accessibilityLabel={
          isVisible
            ? "Ẩn thông tin nhạy cảm"
            : "Hiện thông tin nhạy cảm"
        }
        accessibilityState={{
          disabled: !editable,
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
});
