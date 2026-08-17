import React, { useEffect, useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type {
  NativeSyntheticEvent,
  StyleProp,
  TextInputChangeEventData,
  TextInputProps,
  TextStyle,
  ViewStyle,
} from "react-native";
import { COLORS } from "../../constants/theme";
import { toUppercaseText } from "../../utils/textFormat";

type IdentityNameFieldProps = Omit<
  TextInputProps,
  "value" | "onChange" | "onChangeText" | "autoCapitalize" | "style"
> & {
  value: string;
  onChangeText: (value: string) => void;
  label?: string;
  required?: boolean;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  labelStyle?: StyleProp<TextStyle>;
  errorTextStyle?: StyleProp<TextStyle>;
};

/**
 * Shared field dành cho họ tên trên giấy tờ tùy thân (CCCD/CMND...).
 * Giá trị hiển thị và mọi ký tự user nhập luôn được chuẩn hóa FULL UPPERCASE.
 */
export default function IdentityNameField({
  value,
  onChangeText,
  label,
  required = false,
  error,
  containerStyle,
  inputStyle,
  labelStyle,
  errorTextStyle,
  editable = true,
  placeholder = "Nhập họ tên như trên CCCD",
  placeholderTextColor = COLORS.textLight,
  ...textInputProps
}: IdentityNameFieldProps) {
  const [displayValue, setDisplayValue] = useState(() =>
    toUppercaseText(value),
  );

  useEffect(() => {
    const normalizedValue = toUppercaseText(value);
    setDisplayValue((currentValue) =>
      currentValue === normalizedValue ? currentValue : normalizedValue,
    );
  }, [value]);

  const commitUppercaseValue = (text: string) => {
    const nextValue = toUppercaseText(text);
    setDisplayValue(nextValue);
    onChangeText(nextValue);
  };

  const handleNativeChange = (
    event: NativeSyntheticEvent<TextInputChangeEventData>,
  ) => {
    const nextValue = toUppercaseText(event.nativeEvent.text);
    if (nextValue !== displayValue) {
      setDisplayValue(nextValue);
      onChangeText(nextValue);
    }
  };

  return (
    <View style={containerStyle}>
      {label ? (
        <Text style={[styles.label, labelStyle]}>
          {label}
          {required ? " *" : ""}
        </Text>
      ) : null}

      <TextInput
        {...textInputProps}
        style={[
          styles.input,
          error ? styles.inputError : undefined,
          inputStyle,
        ]}
        value={displayValue}
        onChange={handleNativeChange}
        onChangeText={commitUppercaseValue}
        autoCapitalize="characters"
        autoCorrect={false}
        editable={editable}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
      />

      {error ? (
        <Text style={[styles.errorText, errorTextStyle]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    minHeight: 48,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.white,
    marginBottom: 16,
    textTransform: "uppercase",
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  } as any,
  inputError: {
    borderColor: "#B91C1C",
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 12,
    lineHeight: 17,
    marginTop: -10,
    marginBottom: 14,
  },
});
