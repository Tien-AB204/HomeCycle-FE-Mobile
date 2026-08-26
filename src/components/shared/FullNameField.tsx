import { useEffect, useRef } from "react";
import {
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

import { COLORS } from "../../constants/theme";

type FullNameMode = "words" | "uppercase";

interface FullNameFieldProps
  extends Omit<
    TextInputProps,
    "value" | "onChangeText" | "style" | "autoCapitalize"
  > {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  mode?: FullNameMode;
  error?: string;
  helperText?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  labelStyle?: StyleProp<TextStyle>;
  helperTextStyle?: StyleProp<TextStyle>;
  errorTextStyle?: StyleProp<TextStyle>;
  overrideWindowMs?: number;
}

const isLetter = (value: string) =>
  Boolean(value) &&
  value.toLocaleLowerCase("vi-VN") !== value.toLocaleUpperCase("vi-VN");

const isLowercaseLetter = (value: string) =>
  isLetter(value) && value === value.toLocaleLowerCase("vi-VN");

const isWordStart = (value: string, index: number) =>
  index === 0 || /\s/u.test(value[index - 1] ?? "");

const getSingleDeletionIndex = (
  previousValue: string,
  nextValue: string,
): number | null => {
  if (nextValue.length !== previousValue.length - 1) return null;

  let index = 0;
  while (
    index < nextValue.length &&
    previousValue[index] === nextValue[index]
  ) {
    index += 1;
  }

  return previousValue.slice(index + 1) === nextValue.slice(index)
    ? index
    : null;
};

const getSingleInsertionIndex = (
  previousValue: string,
  nextValue: string,
): number | null => {
  if (nextValue.length !== previousValue.length + 1) return null;

  let index = 0;
  while (
    index < previousValue.length &&
    previousValue[index] === nextValue[index]
  ) {
    index += 1;
  }

  return previousValue.slice(index) === nextValue.slice(index + 1)
    ? index
    : null;
};

const capitalizeWordStarts = (value: string) =>
  value.replace(/(^|\s)(\S)/gu, (_match, prefix: string, char: string) => {
    return `${prefix}${char.toLocaleUpperCase("vi-VN")}`;
  });

export default function FullNameField({
  label,
  value,
  onChangeText,
  mode = "words",
  error,
  helperText,
  containerStyle,
  inputStyle,
  labelStyle,
  helperTextStyle,
  errorTextStyle,
  overrideWindowMs = 5000,
  placeholderTextColor = COLORS.textLight,
  ...textInputProps
}: FullNameFieldProps) {
  const previousValueRef = useRef(value);
  const lastEmittedValueRef = useRef<string | null>(null);

  // Khi user xóa ký tự auto-uppercase ở đầu từ, lần gõ lại kế tiếp tại
  // đúng vị trí đó được phép giữ lowercase.
  const pendingLowercaseOverrideIndexRef = useRef<number | null>(null);

  // Ghi nhớ các ký tự lowercase mà user đã chủ động override.
  // Nếu user xóa chính ký tự đó, lần nhập tiếp theo sẽ auto-uppercase lại.
  const manualLowercaseIndicesRef = useRef<Set<number>>(new Set());

  // Riêng ký tự đầu của toàn field: nếu user xóa chữ auto-uppercase và để
  // field trống quá 5 giây thì quyền override lowercase hết hạn.
  const firstCharOverrideDeadlineRef = useRef(0);
  const firstCharOverrideTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFirstCharOverrideTimer = () => {
    if (firstCharOverrideTimerRef.current) {
      clearTimeout(firstCharOverrideTimerRef.current);
      firstCharOverrideTimerRef.current = null;
    }
  };

  const resetPendingFirstCharOverride = () => {
    clearFirstCharOverrideTimer();
    firstCharOverrideDeadlineRef.current = 0;
    if (pendingLowercaseOverrideIndexRef.current === 0) {
      pendingLowercaseOverrideIndexRef.current = null;
    }
  };

  const startFirstCharOverrideWindow = () => {
    clearFirstCharOverrideTimer();
    firstCharOverrideDeadlineRef.current = Date.now() + overrideWindowMs;

    firstCharOverrideTimerRef.current = setTimeout(() => {
      if (previousValueRef.current.length === 0) {
        resetPendingFirstCharOverride();
      }
    }, overrideWindowMs);
  };

  const resetInteractiveOverrides = () => {
    pendingLowercaseOverrideIndexRef.current = null;
    manualLowercaseIndicesRef.current.clear();
    resetPendingFirstCharOverride();
  };

  useEffect(() => {
    // Nếu parent thay đổi value vì một field khác (ví dụ CCCD đồng bộ sang),
    // reset trạng thái override để value mới bắt đầu sạch.
    const isOwnEmission = value === lastEmittedValueRef.current;
    previousValueRef.current = value;

    if (isOwnEmission) {
      lastEmittedValueRef.current = null;
      return;
    }

    pendingLowercaseOverrideIndexRef.current = null;
    manualLowercaseIndicesRef.current.clear();
    firstCharOverrideDeadlineRef.current = 0;
    if (firstCharOverrideTimerRef.current) {
      clearTimeout(firstCharOverrideTimerRef.current);
      firstCharOverrideTimerRef.current = null;
    }
  }, [value]);

  useEffect(() => {
    return () => {
      if (firstCharOverrideTimerRef.current) {
        clearTimeout(firstCharOverrideTimerRef.current);
      }
    };
  }, []);

  const emitValue = (nextValue: string) => {
    previousValueRef.current = nextValue;
    lastEmittedValueRef.current = nextValue;
    onChangeText(nextValue);
  };

  const handleUppercaseChange = (nextRawValue: string) => {
    resetInteractiveOverrides();
    emitValue(nextRawValue.toLocaleUpperCase("vi-VN"));
  };

  const shiftManualIndicesAfterDeletion = (deletedIndex: number) => {
    const nextIndices = new Set<number>();
    manualLowercaseIndicesRef.current.forEach((index) => {
      if (index < deletedIndex) nextIndices.add(index);
      if (index > deletedIndex) nextIndices.add(index - 1);
    });
    manualLowercaseIndicesRef.current = nextIndices;
  };

  const shiftManualIndicesAfterInsertion = (insertedIndex: number) => {
    const nextIndices = new Set<number>();
    manualLowercaseIndicesRef.current.forEach((index) => {
      nextIndices.add(index >= insertedIndex ? index + 1 : index);
    });
    manualLowercaseIndicesRef.current = nextIndices;
  };

  const handleWordsChange = (nextRawValue: string) => {
    const previousValue = previousValueRef.current;
    let nextValue = nextRawValue;

    const deletionIndex = getSingleDeletionIndex(previousValue, nextRawValue);

    if (deletionIndex !== null) {
      const deletedCharacter = previousValue[deletionIndex] ?? "";
      const deletedManualLowercase =
        manualLowercaseIndicesRef.current.has(deletionIndex);

      shiftManualIndicesAfterDeletion(deletionIndex);

      if (deletedManualLowercase) {
        // User đã override thành lowercase rồi xóa chính chữ lowercase đó.
        // Lần gõ tiếp theo phải quay về auto-uppercase ngay.
        pendingLowercaseOverrideIndexRef.current = null;
        if (deletionIndex === 0 && nextRawValue.length === 0) {
          resetPendingFirstCharOverride();
        }
      } else {
        const deletedWasUppercaseWordStart =
          isWordStart(previousValue, deletionIndex) &&
          isLetter(deletedCharacter) &&
          deletedCharacter === deletedCharacter.toLocaleUpperCase("vi-VN");

        if (deletedWasUppercaseWordStart) {
          pendingLowercaseOverrideIndexRef.current = deletionIndex;

          if (deletionIndex === 0 && nextRawValue.length === 0) {
            startFirstCharOverrideWindow();
          }
        } else {
          pendingLowercaseOverrideIndexRef.current = null;
        }
      }

      emitValue(nextValue);
      return;
    }

    const insertionIndex = getSingleInsertionIndex(previousValue, nextRawValue);

    if (insertionIndex !== null) {
      shiftManualIndicesAfterInsertion(insertionIndex);

      const insertedCharacter = nextRawValue[insertionIndex] ?? "";
      const insertedAtWordStart = isWordStart(nextRawValue, insertionIndex);

      if (insertedAtWordStart && isLetter(insertedCharacter)) {
        let canUsePendingLowercaseOverride =
          pendingLowercaseOverrideIndexRef.current === insertionIndex;

        if (insertionIndex === 0 && canUsePendingLowercaseOverride) {
          canUsePendingLowercaseOverride =
            firstCharOverrideDeadlineRef.current > 0 &&
            Date.now() <= firstCharOverrideDeadlineRef.current;
        }

        if (canUsePendingLowercaseOverride) {
          // Tôn trọng đúng ký tự user nhập lại. Chỉ ghi nhớ override nếu user
          // thực sự nhập lowercase.
          if (isLowercaseLetter(insertedCharacter)) {
            manualLowercaseIndicesRef.current.add(insertionIndex);
          }

          pendingLowercaseOverrideIndexRef.current = null;
          if (insertionIndex === 0) resetPendingFirstCharOverride();
        } else {
          const upperCharacter = insertedCharacter.toLocaleUpperCase("vi-VN");
          nextValue =
            nextRawValue.slice(0, insertionIndex) +
            upperCharacter +
            nextRawValue.slice(insertionIndex + 1);

          manualLowercaseIndicesRef.current.delete(insertionIndex);
          pendingLowercaseOverrideIndexRef.current = null;
          if (insertionIndex === 0) resetPendingFirstCharOverride();
        }
      } else if (
        pendingLowercaseOverrideIndexRef.current !== null &&
        insertionIndex !== pendingLowercaseOverrideIndexRef.current
      ) {
        pendingLowercaseOverrideIndexRef.current = null;
      }

      emitValue(nextValue);
      return;
    }

    // Paste / autofill / thay đổi nhiều ký tự một lần: viết hoa đầu các từ
    // theo mặc định. User vẫn có thể sửa từng ký tự sau đó bằng cơ chế trên.
    resetInteractiveOverrides();
    emitValue(capitalizeWordStarts(nextRawValue));
  };

  const handleChangeText = (nextRawValue: string) => {
    if (mode === "uppercase") {
      handleUppercaseChange(nextRawValue);
      return;
    }

    handleWordsChange(nextRawValue);
  };

  const webInputStyle =
    Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : undefined;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={[styles.label, labelStyle]}>{label}</Text> : null}

      <TextInput
        {...textInputProps}
        style={[
          styles.input,
          webInputStyle,
          error ? styles.inputError : undefined,
          inputStyle,
        ]}
        placeholderTextColor={placeholderTextColor}
        autoCapitalize={mode === "uppercase" ? "characters" : "none"}
        value={value}
        onChangeText={handleChangeText}
      />

      {error ? (
        <Text style={[styles.errorText, errorTextStyle]}>{error}</Text>
      ) : helperText ? (
        <Text style={[styles.helperText, helperTextStyle]}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
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
    height: 48,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  inputError: {
    borderColor: "#7A1012",
  },
  errorText: {
    color: "#7A1012",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  helperText: {
    fontSize: 11,
    color: COLORS.textLight,
    fontStyle: "italic",
    marginTop: 6,
  },
});