import { Ionicons } from "@expo/vector-icons";
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

const MOCK_NOTIFS = [
  {
    id: 1,
    type: "warning",
    title: "Lịch hẹn sắp quá hạn!",
    message:
      "Lịch kiểm định đơn ORD-998877 đã trôi qua 1 giờ. Vui lòng cập nhật trạng thái nếu không hệ thống sẽ tự động hủy đơn.",
    time: "10 phút trước",
    unread: true,
    icon: "warning-outline",
    color: "#F59E0B",
    bg: "#FEF3C7",
  },
  {
    id: 2,
    type: "offer",
    title: "Yêu cầu thương lượng mới",
    message:
      "Công ty ABC vừa gửi đề nghị mua Tủ lạnh Panasonic của bạn với giá 2.500.000đ.",
    time: "2 giờ trước",
    unread: true,
    icon: "pricetag-outline",
    color: "#10B981",
    bg: "#D1FAE5",
  },
  {
    id: 3,
    type: "system",
    title: "Kiểm duyệt thành công",
    message:
      "Tin đăng 'Sofa góc L' của bạn đã được kiểm duyệt và đang hiển thị công khai.",
    time: "1 ngày trước",
    unread: false,
    icon: "checkmark-circle-outline",
    color: "#3B82F6",
    bg: "#DBEAFE",
  },
];

export default function NotificationsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <MainHeader title="Thông báo" />

      <View style={styles.subHeader}>
        <Text style={styles.subHeaderTitle}>Gần đây</Text>
        <TouchableOpacity>
          <Text style={styles.markRead}>Đánh dấu đã đọc</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {MOCK_NOTIFS.map((notif) => (
          <TouchableOpacity
            key={notif.id}
            style={[styles.notifItem, notif.unread && styles.unreadItem]}
          >
            <View style={[styles.iconBox, { backgroundColor: notif.bg }]}>
              <Ionicons
                name={notif.icon as any}
                size={24}
                color={notif.color}
              />
            </View>
            <View style={styles.content}>
              <Text
                style={[
                  styles.title,
                  notif.unread && { fontWeight: "bold", color: "#0F172A" },
                ]}
              >
                {notif.title}
              </Text>
              <Text style={styles.message} numberOfLines={2}>
                {notif.message}
              </Text>
              <Text style={styles.time}>{notif.time}</Text>
            </View>
            {notif.unread && <View style={styles.dot} />}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  subHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  subHeaderTitle: { fontSize: 14, fontWeight: "bold", color: "#64748B" },
  markRead: { fontSize: 13, color: COLORS.primary, fontWeight: "600" },
  list: { paddingBottom: 20 },
  notifItem: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
    alignItems: "flex-start",
  },
  unreadItem: { backgroundColor: "#F8FAFC" },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  content: { flex: 1 },
  title: { fontSize: 15, color: "#334155", marginBottom: 4 },
  message: { fontSize: 13, color: "#64748B", lineHeight: 18, marginBottom: 8 },
  time: { fontSize: 11, color: "#94A3B8" },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.error,
    marginTop: 6,
    marginLeft: 8,
  },
});
