import { SafeAreaView, ScrollView, StyleSheet, Text, View, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../src/constants/theme";

const MOCK_CART = [
  { id: 1, shop: "Home Appliance HCM", name: "Lò vi sóng Sharp 20L", price: "800.000 đ", isSoldOut: false },
  { id: 2, shop: "Nội Thất Nam", name: "Sofa góc L bọc nỉ", price: "3.200.000 đ", isSoldOut: true }, // Mô phỏng Sold out
];

export default function CartScreen() {
  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER GIỐNG ẢNH MOCKUP */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Giỏ hàng của bạn</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconBtn}><Ionicons name="chatbubbles-outline" size={24} color="#0F172A" /></TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}><Ionicons name="notifications-outline" size={24} color="#0F172A" /></TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}><Ionicons name="person-circle-outline" size={26} color="#0F172A" /></TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {MOCK_CART.map(item => (
          <View key={item.id} style={[styles.cartItem, item.isSoldOut && styles.soldOutItem]}>
            {/* Checkbox */}
            <TouchableOpacity style={styles.checkbox}>
              {!item.isSoldOut && <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />}
              {item.isSoldOut && <Ionicons name="ellipse-outline" size={24} color="#CBD5E1" />}
            </TouchableOpacity>

            <Image source={{ uri: "https://via.placeholder.com/80" }} style={[styles.image, item.isSoldOut && { opacity: 0.5 }]} />
            
            <View style={styles.info}>
              <Text style={styles.shopName}><Ionicons name="storefront-outline" /> {item.shop}</Text>
              <Text style={[styles.productName, item.isSoldOut && { color: "#94A3B8" }]} numberOfLines={2}>{item.name}</Text>
              
              {item.isSoldOut ? (
                <View style={styles.soldOutBadge}><Text style={styles.soldOutText}>Đã bán hết (Sold out)</Text></View>
              ) : (
                <Text style={styles.price}>{item.price}</Text>
              )}
            </View>

            <TouchableOpacity style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* FOOTER ĐẶT HÀNG */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.totalLabel}>Tạm tính (1 sản phẩm):</Text>
          <Text style={styles.totalPrice}>800.000 đ</Text>
        </View>
        <TouchableOpacity style={styles.checkoutBtn}>
          <Text style={styles.checkoutText}>Gửi yêu cầu mua</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#FFF", borderBottomWidth: 1, borderColor: "#E2E8F0" },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#0F172A" },
  headerIcons: { flexDirection: "row", gap: 8, alignItems: "center" },
  iconBtn: { padding: 4 },
  list: { padding: 16, gap: 12 },
  cartItem: { flexDirection: "row", backgroundColor: "#FFF", padding: 12, borderRadius: 12, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  soldOutItem: { backgroundColor: "#F8FAFC" },
  checkbox: { marginRight: 12 },
  image: { width: 70, height: 70, borderRadius: 8, backgroundColor: "#E2E8F0" },
  info: { flex: 1, marginLeft: 12 },
  shopName: { fontSize: 12, color: "#64748B", marginBottom: 4 },
  productName: { fontSize: 14, fontWeight: "bold", color: "#1E293B", marginBottom: 6 },
  price: { fontSize: 15, fontWeight: "bold", color: COLORS.error },
  soldOutBadge: { backgroundColor: "#FEE2E2", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: "flex-start" },
  soldOutText: { color: "#EF4444", fontSize: 11, fontWeight: "bold" },
  deleteBtn: { padding: 8 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FFF", padding: 16, borderTopWidth: 1, borderColor: "#E2E8F0", paddingBottom: 32 }, // paddingBottom for iOS safe area
  totalLabel: { fontSize: 13, color: "#64748B" },
  totalPrice: { fontSize: 18, fontWeight: "bold", color: COLORS.error },
  checkoutBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  checkoutText: { color: "#FFF", fontWeight: "bold", fontSize: 15 }
});