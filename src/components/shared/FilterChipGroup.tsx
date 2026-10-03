import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { COLORS } from "../../constants/theme";

type FilterChipGroupProps<Key extends string> = {
  options: { key: Key; label: string }[];
  value: Key;
  onChange: (key: Key) => void;
};

// Hàng chip chọn một giá trị, dùng trong các modal bộ lọc.
export default function FilterChipGroup<Key extends string>({
  options,
  value,
  onChange,
}: FilterChipGroupProps<Key>) {
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <TouchableOpacity
            key={option.key}
            style={[styles.chip, selected ? styles.chipActive : undefined]}
            onPress={() => onChange(option.key)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.chipText, selected ? styles.chipTextActive : undefined]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#F8F9FA",
  },
  chipActive: { borderColor: COLORS.primary, backgroundColor: "rgba(84, 123, 125, 0.12)" },
  chipText: { color: COLORS.text, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: COLORS.primary, fontWeight: "800" },
});
