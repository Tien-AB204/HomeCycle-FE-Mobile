import { Ionicons } from "@expo/vector-icons";
import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { COLORS } from "../../constants/theme";

export interface CalendarDateFieldHandle {
  open: () => void;
}

interface CalendarDateFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  defaultViewDate?: string;
  maximumDate?: Date;
}

const parseDate = (value?: string) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
};

const formatApiDate = (date: Date) => {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

const formatDisplayDate = (value: string) => {
  const date = parseDate(value);

  if (!date) {
    return value;
  }

  return [
    String(date.getDate()).padStart(2, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    date.getFullYear(),
  ].join("/");
};

const CalendarDateField = forwardRef<
  CalendarDateFieldHandle,
  CalendarDateFieldProps
>(function CalendarDateField(
  {
    value,
    onChange,
    placeholder = "Chọn ngày",
    disabled = false,
    hasError = false,
    defaultViewDate = "2000-01-01",
    maximumDate,
  },
  ref,
) {
  const [visible, setVisible] = useState(false);

  const [viewDate, setViewDate] = useState(
    () =>
      parseDate(value) ??
      parseDate(defaultViewDate) ??
      new Date(),
  );

  const open = () => {
    if (disabled) {
      return;
    }

    setViewDate(
      parseDate(value) ??
        parseDate(defaultViewDate) ??
        new Date(),
    );

    setVisible(true);
  };

  useImperativeHandle(
    ref,
    () => ({
      open,
    }),
    [disabled, value, defaultViewDate],
  );

  const calendarCells = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstWeekday = new Date(
      year,
      month,
      1,
    ).getDay();

    const daysInMonth = new Date(
      year,
      month + 1,
      0,
    ).getDate();

    return [
      ...Array.from(
        { length: firstWeekday },
        () => null,
      ),
      ...Array.from(
        { length: daysInMonth },
        (_, index) => index + 1,
      ),
    ];
  }, [viewDate]);

  const moveMonth = (offset: number) => {
    setViewDate(
      (current) =>
        new Date(
          current.getFullYear(),
          current.getMonth() + offset,
          1,
        ),
    );
  };

  const moveYear = (offset: number) => {
    setViewDate(
      (current) =>
        new Date(
          current.getFullYear() + offset,
          current.getMonth(),
          1,
        ),
    );
  };

  const selectDay = (day: number) => {
    const selectedDate = new Date(
      viewDate.getFullYear(),
      viewDate.getMonth(),
      day,
    );

    if (
      maximumDate &&
      selectedDate.getTime() >
        maximumDate.getTime()
    ) {
      return;
    }

    onChange(formatApiDate(selectedDate));
    setVisible(false);
  };

  const weekdays = [
    "CN",
    "T2",
    "T3",
    "T4",
    "T5",
    "T6",
    "T7",
  ];

  return (
    <>
      <TouchableOpacity
        style={[
          styles.trigger,
          hasError
            ? styles.triggerError
            : undefined,
          disabled
            ? styles.triggerDisabled
            : undefined,
        ]}
        onPress={open}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={
          value
            ? `Ngày đã chọn ${formatDisplayDate(
                value,
              )}`
            : placeholder
        }
      >
        <Text
          style={
            value
              ? styles.valueText
              : styles.placeholderText
          }
        >
          {value
            ? formatDisplayDate(value)
            : placeholder}
        </Text>

        <Ionicons
          name="calendar-outline"
          size={20}
          color={COLORS.primary}
        />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setVisible(false)
        }
      >
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <View
              style={styles.yearNavigation}
            >
              <TouchableOpacity
                style={styles.yearButton}
                onPress={() => moveYear(-1)}
              >
                <Ionicons
                  name="play-back-outline"
                  size={18}
                  color={COLORS.primary}
                />

                <Text
                  style={styles.yearButtonText}
                >
                  Năm trước
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.yearButton}
                onPress={() => moveYear(1)}
              >
                <Text
                  style={styles.yearButtonText}
                >
                  Năm sau
                </Text>

                <Ionicons
                  name="play-forward-outline"
                  size={18}
                  color={COLORS.primary}
                />
              </TouchableOpacity>
            </View>

            <View
              style={styles.monthNavigation}
            >
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => moveMonth(-1)}
              >
                <Ionicons
                  name="chevron-back"
                  size={24}
                  color={COLORS.text}
                />
              </TouchableOpacity>

              <Text style={styles.monthTitle}>
                Tháng{" "}
                {viewDate.getMonth() + 1}/
                {viewDate.getFullYear()}
              </Text>

              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => moveMonth(1)}
              >
                <Ionicons
                  name="chevron-forward"
                  size={24}
                  color={COLORS.text}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.weekdayRow}>
              {weekdays.map((weekday) => (
                <Text
                  key={weekday}
                  style={styles.weekdayText}
                >
                  {weekday}
                </Text>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {calendarCells.map(
                (day, index) => {
                  if (!day) {
                    return (
                      <View
                        key={`empty-${index}`}
                        style={styles.dayCell}
                      />
                    );
                  }

                  const cellDate = new Date(
                    viewDate.getFullYear(),
                    viewDate.getMonth(),
                    day,
                  );

                  const currentValue =
                    formatApiDate(cellDate);

                  const isSelected =
                    currentValue === value;

                  const isDisabled = Boolean(
                    maximumDate &&
                      cellDate.getTime() >
                        maximumDate.getTime(),
                  );

                  return (
                    <TouchableOpacity
                      key={currentValue}
                      style={[
                        styles.dayCell,
                        isSelected
                          ? styles.selectedDay
                          : undefined,
                      ]}
                      onPress={() =>
                        selectDay(day)
                      }
                      disabled={isDisabled}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          isSelected
                            ? styles.selectedDayText
                            : undefined,
                          isDisabled
                            ? styles.disabledDayText
                            : undefined,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                },
              )}
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() =>
                setVisible(false)
              }
            >
              <Text
                style={styles.closeButtonText}
              >
                Đóng
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
});

export default CalendarDateField;

const styles = StyleSheet.create({
  trigger: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    backgroundColor: COLORS.white,
    marginBottom: 16,
  },

  triggerError: {
    borderColor: COLORS.error,
  },

  triggerDisabled: {
    opacity: 0.6,
  },

  valueText: {
    color: COLORS.text,
    fontSize: 14,
  },

  placeholderText: {
    color: COLORS.textLight,
    fontSize: 14,
  },

  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor:
      "rgba(15, 23, 42, 0.48)",
  },

  modalCard: {
    width: "100%",
    maxWidth: 380,
    padding: 18,
    borderRadius: 18,
    backgroundColor: COLORS.white,

    ...Platform.select({
      android: {
        elevation: 8,
      },
      web: {
        boxShadow:
          "0 12px 30px rgba(15, 23, 42, 0.22)",
      } as any,
    }),
  },

  yearNavigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  yearButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
  },

  yearButtonText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "600",
  },

  monthNavigation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  monthTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "700",
  },

  weekdayRow: {
    flexDirection: "row",
  },

  weekdayText: {
    width: "14.285%",
    textAlign: "center",
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: "600",
    paddingVertical: 8,
  },

  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  dayCell: {
    width: "14.285%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },

  selectedDay: {
    backgroundColor: COLORS.primary,
  },

  dayText: {
    color: COLORS.text,
    fontSize: 14,
  },

  selectedDayText: {
    color: COLORS.white,
    fontWeight: "700",
  },

  disabledDayText: {
    color: "#CBD5E1",
  },

  closeButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: "#EEF3F4",
  },

  closeButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "700",
  },
});