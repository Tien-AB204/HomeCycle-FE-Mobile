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

import MainHeader from "../../src/components/shared/MainHeader";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import apiClient from "../../src/services/apis/axiosClient";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  type: string;
  createdAt: string;
};

type InlineMessage = {
  type: "error" | "success" | "info";
  text: string;
} | null;

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
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [message, setMessage] = useState<InlineMessage>(null);

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
        setMessage(null);

        const response = await notificationApi.getNotifications({
          PageSize: 50,
          PageNumber: 1,
        });
        const items =
          response?.items || response?.data?.items || response?.data || [];

        setNotifications(Array.isArray(items) ? items : []);
      } catch (error: unknown) {
        setNotifications([]);
        setMessage({
          type: "error",
          text: getApiErrorMessage(error, "Không thể tải thông báo lúc này."),
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentUserId],
  );

  useFocusEffect(
    useCallback(() => {
      void fetchNotifications(false);
    }, [fetchNotifications]),
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    void fetchNotifications(true);
  };

  const handleMarkAllAsRead = async () => {
    if (isMarkingAll || notifications.length === 0) return;

    try {
      setIsMarkingAll(true);
      setMessage({ type: "info", text: "Đang cập nhật trạng thái thông báo..." });
      await notificationApi.markAllAsRead();
      setNotifications((current) =>
        current.map((item) => ({ ...item, isRead: true })),
      );
      setMessage({ type: "success", text: "Đã đánh dấu tất cả là đã đọc." });
    } catch (error: unknown) {
      setMessage({
        type: "error",
        text: getApiErrorMessage(
          error,
          "Không thể đánh dấu tất cả thông báo là đã đọc.",
        ),
      });
    } finally {
      setIsMarkingAll(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";

    const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
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
          background: "#FEF3C7",
        };
      case "success":
        return {
          name: "checkmark-circle-outline" as const,
          color: "#059669",
          background: "#D1FAE5",
        };
      case "offer":
        return {
          name: "pricetag-outline" as const,
          color: "#0284C7",
          background: "#E0F2FE",
        };
      default:
        return {
          name: "notifications-outline" as const,
          color: COLORS.primary,
          background: "#EFF6FF",
        };
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.mobileWrapper, isWeb ? styles.webWrapper : undefined]}>
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
                  params: { returnUrl: "/(tabs)/notifications" },
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
      <View style={[styles.mobileWrapper, isWeb ? styles.webWrapper : undefined]}>
        <MainHeader title="Thông báo" />

        <View style={styles.subHeader}>
          <Text style={styles.subHeaderTitle}>Gần đây</Text>
          <TouchableOpacity
            onPress={() => void handleMarkAllAsRead()}
            disabled={isMarkingAll || notifications.length === 0}
          >
            {isMarkingAll ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text
                style={[
                  styles.markAllReadText,
                  notifications.length === 0 ? styles.disabledText : undefined,
                ]}
              >
                Đánh dấu đã đọc
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {message ? (
          <View
            style={[
              styles.messageBox,
              message.type === "error"
                ? styles.messageError
                : message.type === "success"
                  ? styles.messageSuccess
                  : styles.messageInfo,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                message.type === "error"
                  ? styles.messageErrorText
                  : message.type === "success"
                    ? styles.messageSuccessText
                    : styles.messageInfoText,
              ]}
            >
              {message.text}
            </Text>
            <TouchableOpacity onPress={() => setMessage(null)} hitSlop={8}>
              <Ionicons name="close" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          </View>
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
                tintColor={COLORS.primary}
              />
            }
          >
            {notifications.length > 0 ? (
              notifications.map((item) => {
                const icon = getIconForType(item.type);
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.notificationCard,
                      !item.isRead ? styles.notificationCardUnread : undefined,
                    ]}
                  >
                    <View
                      style={[
                        styles.iconContainer,
                        { backgroundColor: icon.background },
                      ]}
                    >
                      <Ionicons name={icon.name} size={24} color={icon.color} />
                    </View>
                    <View style={styles.contentContainer}>
                      <Text
                        style={[
                          styles.title,
                          !item.isRead ? styles.titleUnread : undefined,
                        ]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      <Text style={styles.notificationMessage} numberOfLines={2}>
                        {item.message}
                      </Text>
                      <Text style={styles.timeAgo}>{formatTimeAgo(item.createdAt)}</Text>
                    </View>
                    {!item.isRead ? <View style={styles.unreadDot} /> : null}
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="notifications-off-outline"
                  size={64}
                  color="#CBD5E1"
                  style={styles.emptyIcon}
                />
                <Text style={styles.emptyTitle}>Chưa có thông báo nào</Text>
                <Text style={styles.emptyDesc}>
                  Khi có cập nhật mới về giao dịch của bạn, thông báo sẽ xuất hiện
                  tại đây.
                </Text>
              </View>
            )}
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
  markAllReadText: { fontSize: 14, fontWeight: "600", color: COLORS.primary },
  disabledText: { color: COLORS.textLight },
  messageBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 10,
    borderWidth: 1,
    borderRadius: 10,
  },
  messageError: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  messageSuccess: { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
  messageInfo: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
  messageText: { flex: 1, fontSize: 13, lineHeight: 18 },
  messageErrorText: { color: "#B91C1C" },
  messageSuccessText: { color: "#047857" },
  messageInfoText: { color: "#1D4ED8" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 10, color: COLORS.textLight, fontSize: 13 },
  listContainer: { paddingBottom: 40 },
  notificationCard: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    alignItems: "flex-start",
  },
  notificationCardUnread: { backgroundColor: "#F8FAFC" },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  contentContainer: { flex: 1, marginRight: 8 },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },
  titleUnread: { fontWeight: "bold", color: "#0F172A" },
  notificationMessage: {
    fontSize: 14,
    color: COLORS.textLight,
    lineHeight: 20,
    marginBottom: 8,
  },
  timeAgo: { fontSize: 12, color: "#94A3B8" },
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
  emptyIcon: { marginBottom: 16 },
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
