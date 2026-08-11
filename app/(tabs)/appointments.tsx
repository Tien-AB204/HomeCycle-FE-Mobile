import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MainHeader from "../../src/components/shared/MainHeader";
import { COLORS } from "../../src/constants/theme";

const MOCK_SCHEDULES = [
  {
    id: "SCH-001",
    type: "Kiểm định",
    product: "Tivi Samsung UHD 55 inch",
    partner: "Công ty Thu Mua ABC",
    date: "15/08/2026 - 14:30",
    location: "123 Lê Lợi, Phường Bến Nghé, Quận 1, TPHCM",
    status: "Sắp diễn ra",
    statusColor: "#F59E0B",
  },
  {
    id: "SCH-002",
    type: "Thu gom",
    product: "Tủ lạnh Panasonic Inverter",
    partner: "Nguyễn Văn A (Cá nhân)",
    date: "16/08/2026 - 09:00",
    location: "456 Nguyễn Thị Minh Khai, Quận 3, TPHCM",
    status: "Chờ xác nhận đổi lịch",
    statusColor: "#3B82F6",
  },
];

export default function ScheduleScreen() {
  const [activeTab, setActiveTab] = useState("all");

  return (
    <SafeAreaView style={styles.container}>
      <MainHeader title="Quản lý Lịch hẹn" />

      <View style={styles.tabContainer}>
        {["all", "Kiểm định", "Thu gom"].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.activeTabText,
              ]}
            >
              {tab === "all" ? "Tất cả" : tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {MOCK_SCHEDULES.filter(
          (s) => activeTab === "all" || s.type === activeTab,
        ).map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.type}</Text>
              </View>
              <Text style={[styles.status, { color: item.statusColor }]}>
                {item.status}
              </Text>
            </View>

            <Text style={styles.productName}>{item.product}</Text>
            <Text style={styles.partnerName}>
              <Ionicons name="person-outline" size={14} /> Đối tác:{" "}
              {item.partner}
            </Text>

            <View style={styles.infoRow}>
              <Ionicons
                name="time-outline"
                size={16}
                color={COLORS.textLight}
              />
              <Text style={styles.infoText}>{item.date}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons
                name="location-outline"
                size={16}
                color={COLORS.textLight}
              />
              <Text style={styles.infoText} numberOfLines={2}>
                {item.location}
              </Text>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.outlineBtn}>
                <Text style={styles.outlineBtnText}>Đổi lịch</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.outlineBtn, { borderColor: COLORS.error }]}
              >
                <Text style={[styles.outlineBtnText, { color: COLORS.error }]}>
                  Hủy lịch
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
  },
  activeTab: { backgroundColor: "#0F172A" },
  tabText: { fontSize: 14, color: "#64748B", fontWeight: "600" },
  activeTabText: { color: "#FFF" },
  list: { padding: 16, gap: 16 },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  badge: {
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: { color: "#0284C7", fontSize: 12, fontWeight: "bold" },
  status: { fontSize: 13, fontWeight: "bold" },
  productName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 6,
  },
  partnerName: { fontSize: 14, color: "#475569", marginBottom: 12 },
  infoRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    alignItems: "center",
  },
  infoText: { fontSize: 13, color: "#475569", flex: 1 },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: "#F1F5F9",
  },
  outlineBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
  },
  outlineBtnText: { color: "#475569", fontWeight: "600", fontSize: 14 },
});
