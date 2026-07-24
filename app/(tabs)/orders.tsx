import { StyleSheet, Text, View } from "react-native";

export default function OrdersScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Màn hình Quản lý Đơn hàng</Text>
      <Text style={styles.subText}>(Đang phát triển)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
  },
  text: { fontSize: 18, fontWeight: "bold", color: "#2C3E50" },
  subText: { fontSize: 14, color: "#7F8C8D", marginTop: 8 },
});
