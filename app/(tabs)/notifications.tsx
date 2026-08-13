import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import {
  InlineFeedback,
  useActionFeedback,
} from "../../src/components/shared/ActionFeedback";
import MainHeader from "../../src/components/shared/MainHeader";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import apiClient from "../../src/services/apis/axiosClient";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  type: string;
  createdAt: string;
};

// Chuẩn bị sẵn API call cho Notifications (BE cập nhật endpoint thì sửa lại path ở đây)
const notificationApi = {
  getNotifications: (params?: any) =>
    apiClient.get("/notifications", { params }).then((res) => res.data),
  markAllAsRead: () =>
    apiClient.put("/notifications/mark-all-read").then((res) => res.data),
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web" && width > 480;

  const { user } = useAuth();
  const currentUserId = user?.userId || user?.id;

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { feedback, clearFeedback, showInfo, showError } = useActionFeedback();

  const fetchNotifications = useCallback(
    async (isRefresh = false) => {
      if (!currentUserId) {
        setNotifications([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      try {
        if (!isRefresh) setIsLoading(true);

        // Gọi API thực tế (nếu endpoint chưa có, nó sẽ văng xuống catch và hiện lỗi / empty state mượt mà)
        const res = await notificationApi.getNotifications({
          PageSize: 50,
          PageNumber: 1,
        });
        const items = res?.items || res?.data?.items || res?.data || [];
        setNotifications(items);
      } catch (error: any) {
        console.error("Lỗi tải thông báo:", error);
        // Tạm thời ẩn lỗi nếu BE chưa có endpoint này để UI hiện Empty State cho đẹp
        // Nếu muốn báo lỗi thì mở comment dòng dưới:
        // showError(error?.response?.status === 500 ? "Lỗi server. Vui lòng thử lại sau." : "Không thể tải thông báo lúc này.");
        setNotifications([]);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentUserId, showError],
  );

  useFocusEffect(
    useCallback(() => {
      void fetchNotifications(false);
    }, [fetchNotifications]),
  );

  const onRefresh = () => {
    clearFeedback();
    setIsRefreshing(true);
    void fetchNotifications(true);
  };

  const handleMarkAllAsRead = async () => {
    clearFeedback();
    try {
      showInfo("Đang cập nhật trạng thái...");
      await notificationApi.markAllAsRead();
      void fetchNotifications(true);
    } catch (error) {
      showInfo("Tính năng Đánh dấu đã đọc đang được hoàn thiện.");
    }
  };

  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Vừa xong";
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} phút trước`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} giờ trước`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays} ngày trước`;
    return date.toLocaleDateString("vi-VN");
  };

  const getIconForType = (type: string) => {
    switch (type?.toLowerCase()) {
      case "warning":
        return {
          name: "warning-outline" as const,
          color: "#D97706",
          bg: "#FEF3C7",
        };
      case "success":
        return {
          name: "checkmark-circle-outline" as const,
          color: "#059669",
          bg: "#D1FAE5",
        };
      case "offer":
        return {
          name: "pricetag-outline" as const,
          color: "#0284C7",
          bg: "#E0F2FE",
        };
      default:
        return {
          name: "notifications-outline" as const,
          color: COLORS.primary,
          bg: "#EFF6FF",
        };
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View
          style={[styles.mobileWrapper, isWeb ? styles.webWrapper : undefined]}
        >
          <MainHeader title="Thông báo" />
          <View style={styles.unauthContainer}>
            <Ionicons
              name="notifications-off-outline"
              size={80}
              color="#CBD5E1"
              style={styles.unauthIcon}
            />
            <Text style={styles.unauthTitle}>Bạn chưa đăng nhập</Text>
            <Text style={styles.unauthDesc}>
              Vui lòng đăng nhập để xem các thông báo mới nhất về đơn hàng, lịch
              hẹn và tin đăng của bạn.
            </Text>
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() =>
                router.push({
                  pathname: "/(auth)/login",
                  params: { returnUrl: "/notifications" },
                })
              }
            >
              <Text style={styles.loginBtnText}>Đăng nhập ngay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View
        style={[styles.mobileWrapper, isWeb ? styles.webWrapper : undefined]}
      >
        <MainHeader title="Thông báo" />

        {/* Thanh công cụ phụ */}
        <View style={styles.subHeader}>
          <Text style={styles.subHeaderTitle}>Gần đây</Text>
          <TouchableOpacity onPress={handleMarkAllAsRead}>
            <Text style={styles.markAllReadText}>Đánh dấu đã đọc</Text>
          </TouchableOpacity>
        </View>

        {feedback ? (
          <InlineFeedback
            feedback={feedback}
            onDismiss={clearFeedback}
            style={{ marginHorizontal: 16, marginTop: 8 }}
          />
        ) : null}

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Đang tải thông báo...</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                colors={[COLORS.primary]}
              />
            }
          >
            {notifications.length > 0 ? (
              notifications.map((item) => {
                const iconConf = getIconForType(item.type);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.notificationCard,
                      !item.isRead && styles.notificationCardUnread,
                    ]}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.iconContainer,
                        { backgroundColor: iconConf.bg },
                      ]}
                    >
                      <Ionicons
                        name={iconConf.name}
                        size={24}
                        color={iconConf.color}
                      />
                    </View>
                    <View style={styles.contentContainer}>
                      <Text
                        style={[
                          styles.title,
                          !item.isRead && styles.titleUnread,
                        ]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      <Text style={styles.message} numberOfLines={2}>
                        {item.message}
                      </Text>
                      <Text style={styles.timeAgo}>
                        {formatTimeAgo(item.createdAt)}
                      </Text>
                    </View>
                    {!item.isRead && <View style={styles.unreadDot} />}
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="notifications-off-outline"
                  size={64}
                  color="#CBD5E1"
                  style={{ marginBottom: 16 }}
                />
                <Text style={styles.emptyTitle}>Chưa có thông báo nào</Text>
                <Text style={styles.emptyDesc}>
                  Khi có cập nhật mới về giao dịch của bạn, thông báo sẽ xuất
                  hiện tại đây.
                </Text>
              </View>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  mobileWrapper: { flex: 1, backgroundColor: COLORS.white },
  webWrapper: {
    width: 480,
    alignSelf: "center",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: COLORS.border,
  },

  unauthContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: COLORS.white,
  },
  unauthIcon: { marginBottom: 16 },
  unauthTitle: {
    marginBottom: 12,
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "bold",
  },
  unauthDesc: {
    marginBottom: 32,
    color: COLORS.textLight,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  loginBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  loginBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "bold" },

  subHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    backgroundColor: COLORS.white,
  },
  subHeaderTitle: { fontSize: 15, fontWeight: "bold", color: COLORS.text },
  markAllReadText: { fontSize: 14, fontWeight: "600", color: "#64748B" },

  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 10, color: COLORS.textLight, fontSize: 13 },

  listContainer: { paddingBottom: 20 },

  notificationCard: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    alignItems: "flex-start",
  },
  notificationCardUnread: {
    backgroundColor: "#F8FAFC",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  contentContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },
  titleUnread: {
    fontWeight: "bold",
    color: "#0F172A",
  },
  message: {
    fontSize: 14,
    color: COLORS.textLight,
    lineHeight: 20,
    marginBottom: 8,
  },
  timeAgo: {
    fontSize: 12,
    color: "#94A3B8",
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.error,
    marginTop: 6,
  },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: "center",
    lineHeight: 22,
  },
});
