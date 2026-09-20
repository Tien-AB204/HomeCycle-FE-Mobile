import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { COLORS } from "../../constants/theme";
import { ModalBackdrop, ModalSurface } from "./ModalBackdrop";

/**
 * Ô giờ dùng chung cho các trường DateTime (giờ trong ngày, 24h).
 * Không cho gõ tự do: chạm vào ô → mở bộ chọn giờ của hệ thống
 * (Android: đồng hồ; iOS: bánh xe trong sheet; Web: điều khiển time của trình duyệt).
 * Giá trị ra/vào là chuỗi "HH:mm" (hoặc "" khi chưa chọn) — không đổi ngữ nghĩa
 * ngày+giờ địa phương → toISOString của các màn hình hiện có.
 */

interface ClockTimeFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  clearable?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

const CLOCK_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isClockTime = (value: string) => CLOCK_PATTERN.test(String(value ?? "").trim());

const pad2 = (value: number) => String(value).padStart(2, "0");

const toClockString = (date: Date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

// Date địa phương chỉ dùng để khởi tạo bộ chọn; ngày không có ý nghĩa.
const toPickerDate = (value: string) => {
  const date = new Date();
  date.setSeconds(0, 0);
  if (isClockTime(value)) {
    const [hour, minute] = value.trim().split(":");
    date.setHours(Number(hour), Number(minute), 0, 0);
  }
  return date;
};

export default function ClockTimeField({
  value,
  onChange,
  placeholder = "Chọn giờ",
  disabled = false,
  hasError = false,
  clearable = false,
  accessibilityLabel,
  style,
}: ClockTimeFieldProps) {
  const [isIosPickerVisible, setIsIosPickerVisible] = useState(false);
  const [iosDraft, setIosDraft] = useState<Date>(() => toPickerDate(value));
  const displayValue = isClockTime(value) ? value.trim() : "";

  const openPicker = () => {
    if (disabled) return;
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: toPickerDate(value),
        mode: "time",
        is24Hour: true,
        display: "clock",
        onChange: (event: DateTimePickerEvent, selected?: Date) => {
          if (event.type !== "set" || !selected) return;
          onChange(toClockString(selected));
        },
      });
      return;
    }
    setIosDraft(toPickerDate(value));
    setIsIosPickerVisible(true);
  };

  const confirmIos = () => {
    onChange(toClockString(iosDraft));
    setIsIosPickerVisible(false);
  };

  if (Platform.OS === "web") {
    // Web: điều khiển time của trình duyệt (vẫn là bộ chọn, không phải ô chữ tự do).
    const WebInput = "input" as unknown as React.ComponentType<Record<string, unknown>>;
    return (
      <View
        style={[
          styles.trigger,
          hasError ? styles.triggerError : undefined,
          disabled ? styles.triggerDisabled : undefined,
          style,
        ]}
      >
        <Ionicons name="time-outline" size={18} color={COLORS.textLight} />
        <WebInput
          type="time"
          step={60}
          value={displayValue}
          disabled={disabled}
          aria-label={accessibilityLabel ?? placeholder}
          onChange={(event: { target: { value: string } }) => {
            const next = String(event?.target?.value ?? "");
            onChange(isClockTime(next) ? next : "");
          }}
          style={{
            flex: 1,
            marginLeft: 8,
            border: "none",
            outline: "none",
            backgroundColor: "transparent",
            fontSize: 14,
            color: displayValue ? COLORS.text : COLORS.textLight,
          }}
        />
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        style={[
          styles.trigger,
          hasError ? styles.triggerError : undefined,
          disabled ? styles.triggerDisabled : undefined,
          style,
        ]}
        onPress={openPicker}
        disabled={disabled}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? placeholder}
        accessibilityValue={{ text: displayValue || "Chưa chọn" }}
        accessibilityState={{ disabled }}
      >
        <View style={styles.triggerLeft}>
          <Ionicons name="time-outline" size={18} color={COLORS.textLight} />
          <Text style={displayValue ? styles.valueText : styles.placeholderText}>
            {displayValue || placeholder}
          </Text>
        </View>
        {clearable && displayValue && !disabled ? (
          <TouchableOpacity
            onPress={() => onChange("")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Bỏ chọn giờ"
          >
            <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
          </TouchableOpacity>
        ) : (
          <Ionicons name="chevron-down" size={16} color={COLORS.textLight} />
        )}
      </TouchableOpacity>

      {Platform.OS === "ios" ? (
        <Modal
          visible={isIosPickerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsIosPickerVisible(false)}
        >
          <ModalBackdrop style={styles.sheetBackdrop} onPress={() => setIsIosPickerVisible(false)}>
            <ModalSurface style={styles.sheet}>
              <Text style={styles.sheetTitle}>{accessibilityLabel ?? placeholder}</Text>
              <DateTimePicker
                value={iosDraft}
                mode="time"
                display="spinner"
                is24Hour
                locale="vi-VN"
                onChange={(_event: DateTimePickerEvent, selected?: Date) => {
                  if (selected) setIosDraft(selected);
                }}
              />
              <View style={styles.sheetActions}>
                <TouchableOpacity
                  style={styles.sheetSecondary}
                  onPress={() => setIsIosPickerVisible(false)}
                  accessibilityRole="button"
                >
                  <Text style={styles.sheetSecondaryText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.sheetPrimary} onPress={confirmIos} accessibilityRole="button">
                  <Text style={styles.sheetPrimaryText}>Xong</Text>
                </TouchableOpacity>
              </View>
            </ModalSurface>
          </ModalBackdrop>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#BAC2C1",
    borderRadius: 8,
    backgroundColor: COLORS.white,
  },
  triggerError: { borderColor: COLORS.error },
  triggerDisabled: { backgroundColor: COLORS.background, opacity: 0.7 },
  triggerLeft: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  valueText: { color: COLORS.text, fontSize: 14 },
  placeholderText: { color: COLORS.textLight, fontSize: 14 },
  sheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(23, 40, 48, 0.48)" },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    paddingBottom: 24,
  },
  sheetTitle: { fontSize: 15, fontWeight: "700", color: COLORS.text, marginBottom: 8, textAlign: "center" },
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  sheetSecondary: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetSecondaryText: { color: COLORS.primary, fontWeight: "700", fontSize: 14 },
  sheetPrimary: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetPrimaryText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },
});
