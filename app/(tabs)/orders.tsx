import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../src/constants/theme";

const MOCK_ORDERS = [
  {
    id: "ORD-998877",
    product: "Máy giặt LG Inverter 9kg",
    price: "2.500.000 đ",
    shipping: "GHN Delivery",
    status: "Chờ lấy hàng",
    payment: "Đã cọc 500k",
    image: "https://via.placeholder.com/80"
  },
  {
    id: "ORD-665544",
    product: "Bàn ăn gỗ sồi 6 ghế",
    price: "1.200.000 đ",
    shipping: "Người mua tự đến lấy",
    status: "Đã hoàn thành",
    payment: "Thanh toán toàn phần",
    image: "https://via.placeholder.com/80"
  }
];

export default function OrdersScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Quản lý Đơn hàng</Text>
      </View>

      <View style={styles.tabs}>
        <Text style={styles.tabActive}>Đang xử lý</Text>
        <Text style={styles.tab}>Lịch sử</Text>
        <Text style={styles.tab}>Khiếu nại</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {MOCK_ORDERS.map(order => (
          <View key={order.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.orderId}>Mã: {order.id}</Text>
              <Text style={[styles.status, order.status === 'Đã hoàn thành' ? { color: '#10B981' } : { color: '#F59E0B' }]}>
                {order.status}
              </Text>
            </View>

            <View style={styles.body}>
              <Image source={{ uri: order.image }} style={styles.image} />
              <View style={styles.info}>
                <Text style={styles.productName}>{order.product}</Text>
                <Text style={styles.textLight}>Vận chuyển: {order.shipping}</Text>
                <Text style={styles.textLight}>Thanh toán: <Text style={{ color: COLORS.primary }}>{order.payment}</Text></Text>
                <Text style={styles.price}>{order.price}</Text>
              </View>
            </View>

            <View style={styles.actions}>
              {order.status === "Chờ lấy hàng" && (
                <TouchableOpacity style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>Xác nhận bàn giao</Text>
                </TouchableOpacity>
              )}
              {order.status === "Đã hoàn thành" && (
                <TouchableOpacity style={styles.outlineBtn}>
                  <Text style={styles.outlineBtnText}>Đánh giá đối tác</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  header: { padding: 16, backgroundColor: "#FFF" },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#0F172A" },
  tabs: { flexDirection: "row", backgroundColor: "#FFF", paddingHorizontal: 16, borderBottomWidth: 1, borderColor: "#E2E8F0" },
  tab: { paddingVertical: 12, marginRight: 24, color: "#64748B", fontWeight: "600" },
  tabActive: { paddingVertical: 12, marginRight: 24, color: COLORS.primary, fontWeight: "bold", borderBottomWidth: 2, borderColor: COLORS.primary },
  list: { padding: 16, gap: 16 },
  card: { backgroundColor: "#FFF", borderRadius: 12, padding: 16 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "#F1F5F9", paddingBottom: 12, marginBottom: 12 },
  orderId: { fontSize: 13, color: "#475569", fontWeight: "600" },
  status: { fontSize: 13, fontWeight: "bold" },
  body: { flexDirection: "row", gap: 12 },
  image: { width: 80, height: 80, borderRadius: 8, backgroundColor: "#F1F5F9" },
  info: { flex: 1, justifyContent: "space-between" },
  productName: { fontSize: 15, fontWeight: "bold", color: "#1E293B" },
  textLight: { fontSize: 12, color: "#64748B", marginTop: 4 },
  price: { fontSize: 16, fontWeight: "bold", color: COLORS.error, marginTop: 4 },
  actions: { marginTop: 16 },
  primaryBtn: { backgroundColor: COLORS.primary, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  primaryBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 14 },
  outlineBtn: { borderWidth: 1, borderColor: COLORS.primary, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  outlineBtnText: { color: COLORS.primary, fontWeight: "bold", fontSize: 14 }
});