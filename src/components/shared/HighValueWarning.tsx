import { Ionicons } from "@expo/vector-icons";
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";

import { COLORS } from "../../constants/theme";
import { HIGH_VALUE_THRESHOLD_VND } from "../../utils/highValue";

type HighValueWarningProps = {
  totalAmount: number;
  // Có truyền onToggleAcknowledge thì hiện ô xác nhận "đã hiểu" (dùng cho Người mua).
  acknowledged?: boolean;
  onToggleAcknowledge?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const formatVnd = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);

export default function HighValueWarning({
  totalAmount,
  acknowledged = false,
  onToggleAcknowledge,
  disabled = false,
  style,
}: HighValueWarningProps) {
  return (
    <View style={[styles.container, style]} accessibilityRole="alert">
      <View style={styles.header}>
        <Ionicons name="warning-outline" size={20} color={COLORS.warning} />
        <Text style={styles.title}>Hàng giá trị cao</Text>
      </View>
      <Text style={styles.body}>
        Tổng giá trị hợp đồng là {formatVnd(totalAmount)}, trên{" "}
        {formatVnd(HIGH_VALUE_THRESHOLD_VND)}. HomeCycle khuyến nghị nên kiểm định trước khi nhận hàng.
      </Text>
      <Text style={styles.body}>
        Nếu bỏ qua kiểm định, nền tảng không cam kết giải quyết đầy đủ tranh chấp và không cam kết
        hoàn 100% giá trị đơn hàng khi sản phẩm hư hỏng hoặc sai khác so với mô tả.
      </Text>
      {onToggleAcknowledge ? (
        <TouchableOpacity
          style={styles.ackRow}
          onPress={onToggleAcknowledge}
          disabled={disabled}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: acknowledged, disabled }}
        >
          <Ionicons
            name={acknowledged ? "checkbox" : "square-outline"}
            size={22}
            color={acknowledged ? COLORS.primary : COLORS.textLight}
          />
          <Text style={styles.ackText}>Tôi đã hiểu và vẫn chọn không kiểm định</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: COLORS.warning,
    backgroundColor: "#FBF3E6",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    marginBottom: 16,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: COLORS.warning, fontSize: 15, fontWeight: "800" },
  body: { color: COLORS.text, fontSize: 13, lineHeight: 19 },
  ackRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  ackText: { flex: 1, color: COLORS.text, fontSize: 13, fontWeight: "600" },
});
