import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useState,
} from "react";
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
import { useChatRealtime } from "../../src/contexts/ChatRealtimeContext";
import { useNotifications } from "../../src/contexts/NotificationContext";
import apiClient from "../../src/services/apis/axiosClient";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";

type NotificationItem = {
  notificationId: string;
  title: string;
  message: string;
  targetType: string | null;
  targetId: string | null;
  isRead: boolean;
  createdAt: string;
};

type InlineMessage = {
  type: "error" | "success" | "info";
  text: string;
} | null;

const unwrap = (value: any) => value?.data ?? value;

const notificationApi = {
  getNotifications: (params?: any) =>
    apiClient.get("/notifications", { params }).then((res) => res.data),
};

const normalizeNotificationItem = (value: any): NotificationItem | null => {
  const notificationId = String(
    value?.notificationId ?? value?.NotificationId ?? "",
  ).trim();

  if (!notificationId) return null;

  const targetIdRaw = value?.targetId ?? value?.TargetId;

  return {
    notificationId,
    title: String(value?.title ?? value?.Title ?? "Thông báo"),
    message: String(value?.message ?? value?.Message ?? ""),
    targetType:
      value?.targetType !== undefined && value?.targetType !== null
        ? String(value.targetType)
        : value?.TargetType !== undefined && value?.TargetType !== null
          ? String(value.TargetType)
          : null,
    targetId:
      targetIdRaw !== undefined && targetIdRaw !== null
        ? String(targetIdRaw)
        : null,
    isRead: Boolean(value?.isRead ?? value?.IsRead ?? false),
    createdAt: String(value?.createdAt ?? value?.CreatedAt ?? ""),
  };
};

const normalizeTargetType = (value: unknown) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  switch (normalized) {
    case "1":
    case "offer":
      return "offer";
    case "2":
    case "negotiation":
      return "negotiation";
    case "3":
    case "agreement":
      return "agreement";
    case "4":
    case "order":
      return "order";
    case "5":
    case "dispute":
      return "dispute";
    case "6":
    case "post":
      return "post";
    default:
      return "";
  }
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web" && width > 480;
  const { user } = useAuth();
  const { connection } = useChatRealtime();
  const {
    unreadCount,
    refreshUnreadCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  } = useNotifications();

  const currentUserId = user?.userId || user?.id;

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [openingNotificationId, setOpeningNotificationId] =
    useState<string | null>(null);
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
        const data = unwrap(response);
        const items = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data)
            ? data
            : [];

        setNotifications(
          items
            .map(normalizeNotificationItem)
            .filter((item: NotificationItem | null): item is NotificationItem => Boolean(item)),
        );
      } catch (error: unknown) {
        setNotifications([]);
        setMessage({
          type: "error",
          text: getApiErrorMessage(
            error,
            "Không thể tải thông báo lúc này.",
          ),
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
      void refreshUnreadCount();
    }, [fetchNotifications, refreshUnreadCount]),
  );

  useEffect(() => {
    if (!message || message.type !== "success") return;

    const timeoutId = setTimeout(() => {
      setMessage(null);
    }, 5_000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [message]);

  useEffect(() => {
    if (!connection) return;

    const handleCreated = (payload: any) => {
      const item = normalizeNotificationItem(payload?.data ?? payload);

      if (!item) return;

      setNotifications((current) => {
        if (
          current.some(
            (existing) =>
              existing.notificationId === item.notificationId,
          )
        ) {
          return current;
        }

        return [item, ...current];
      });
    };

    const handleRead = (payload: any) => {
      const data = payload?.data ?? payload;
      const notificationId = String(
        data?.notificationId ?? data?.NotificationId ?? "",
      );

      if (!notificationId) return;

      setNotifications((current) =>
        current.map((item) =>
          item.notificationId === notificationId
            ? { ...item, isRead: true }
            : item,
        ),
      );
    };

    const handleAllRead = () => {
      setNotifications((current) =>
        current.map((item) => ({ ...item, isRead: true })),
      );
    };

    connection.on("NotificationCreated", handleCreated);
    connection.on("NotificationRead", handleRead);
    connection.on("NotificationsReadAll", handleAllRead);

    return () => {
      connection.off("NotificationCreated", handleCreated);
      connection.off("NotificationRead", handleRead);
      connection.off("NotificationsReadAll", handleAllRead);
    };
  }, [connection]);

  const onRefresh = () => {
    setIsRefreshing(true);

    void Promise.allSettled([
      fetchNotifications(true),
      refreshUnreadCount(),
    ]);
  };

  const handleMarkAllAsRead = async () => {
    if (isMarkingAll || unreadCount <= 0) return;

    try {
      setIsMarkingAll(true);
      setMessage(null);

      await markAllNotificationsAsRead();

      setNotifications((current) =>
        current.map((item) => ({ ...item, isRead: true })),
      );

      setMessage({
        type: "success",
        text: "Đã đánh dấu tất cả thông báo là đã đọc.",
      });
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

  const navigateToNotificationTarget = async (
    item: NotificationItem,
  ) => {
    const targetType = normalizeTargetType(item.targetType);
    const targetId = item.targetId;

    if (!targetType || !targetId) {
      setMessage({
        type: "info",
        text: "Thông báo này chưa có khu vực chi tiết để mở.",
      });
      return;
    }

    switch (targetType) {
      case "offer": {
        const response = await apiClient.get(`/offers/${targetId}`);
        const offer = unwrap(response.data);

        const negotiationId = String(
          offer?.negotiationId ??
            offer?.NegotiationId ??
            "",
        ).trim();

        if (negotiationId) {
          router.push(`/chat/${negotiationId}` as any);
          return;
        }

        const offerStatus = String(
          offer?.offerStatus ??
            offer?.OfferStatus ??
            "",
        )
          .trim()
          .toLowerCase();

        const isPending =
          offerStatus === "pending" || offerStatus === "0";

        if (isPending) {
          const myUserId = String(
            user?.userId ?? user?.id ?? "",
          ).toLowerCase();
          const receiverId = String(
            offer?.receiver?.userId ??
              offer?.receiver?.UserId ??
              offer?.receiverId ??
              offer?.ReceiverId ??
              "",
          ).toLowerCase();

          router.push({
            pathname: "/chat" as any,
            params: {
              tab:
                receiverId && receiverId === myUserId
                  ? "received"
                  : "sent",
            },
          });
          return;
        }

        router.push(`/offers/${targetId}` as any);
        return;
      }
      case "negotiation":
        router.push(`/chat/${targetId}` as any);
        return;
      case "order":
        router.push(`/orders/${targetId}` as any);
        return;
      case "dispute":
        router.push(`/disputes/${targetId}` as any);
        return;
      case "post":
        router.push(`/posts/${targetId}` as any);
        return;
      case "agreement": {
        const response = await apiClient.get(`/agreements/${targetId}`);
        const agreement = unwrap(response.data);
        const negotiationId = String(
          agreement?.negotiationId ??
            agreement?.NegotiationId ??
            "",
        ).trim();

        if (!negotiationId) {
          throw new Error(
            "Không tìm thấy phiên thương lượng của hợp đồng này.",
          );
        }

        router.push({
          pathname: "/agreements/preview" as any,
          params: {
            agreementId: targetId,
            negotiationId,
          },
        });
        return;
      }
      default:
        return;
    }
  };

  const handleOpenNotification = async (
    item: NotificationItem,
  ) => {
    if (openingNotificationId) return;

    setOpeningNotificationId(item.notificationId);
    setMessage(null);

    if (!item.isRead) {
      try {
        await markNotificationAsRead(item.notificationId);
        setNotifications((current) =>
          current.map((currentItem) =>
            currentItem.notificationId === item.notificationId
              ? { ...currentItem, isRead: true }
              : currentItem,
          ),
        );
      } catch (error: unknown) {
        setMessage({
          type: "error",
          text: getApiErrorMessage(
            error,
            "Không thể cập nhật trạng thái đã đọc của thông báo.",
          ),
        });
      }
    }

    try {
      await navigateToNotificationTarget(item);
    } catch (error: unknown) {
      setMessage({
        type: "error",
        text: getApiErrorMessage(
          error,
          "Không thể mở nội dung liên quan của thông báo.",
        ),
      });
    } finally {
      setOpeningNotificationId(null);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";

    const diffInSeconds = Math.floor(
      (Date.now() - date.getTime()) / 1000,
    );
    if (diffInSeconds < 60) return "Vừa xong";

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} phút trước`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} giờ trước`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays} ngày trước`;

    return date.toLocaleDateString("vi-VN");
  };

  const getIconForTarget = (targetType: string | null) => {
    switch (normalizeTargetType(targetType)) {
      case "offer":
        return "pricetag-outline" as const;
      case "negotiation":
        return "chatbubbles-outline" as const;
      case "agreement":
        return "document-text-outline" as const;
      case "order":
        return "receipt-outline" as const;
      case "dispute":
        return "alert-circle-outline" as const;
      case "post":
        return "newspaper-outline" as const;
      default:
        return "notifications-outline" as const;
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View
          style={[
            styles.mobileWrapper,
            isWeb ? styles.webWrapper : undefined,
          ]}
        >
          <MainHeader title="Thông báo" />
          <View style={styles.unauthContainer}>
            <Ionicons
              name="notifications-off-outline"
              size={72}
              color={COLORS.border}
              style={styles.unauthIcon}
            />
            <Text style={styles.unauthTitle}>
              Bạn chưa đăng nhập
            </Text>
            <Text style={styles.unauthDesc}>
              Vui lòng đăng nhập để xem thông báo giao dịch của bạn.
            </Text>
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() =>
                router.push({
                  pathname: "/(auth)/login",
                  params: {
                    returnUrl: "/(tabs)/notifications",
                  },
                })
              }
            >
              <Text style={styles.loginBtnText}>
                Đăng nhập ngay
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View
        style={[
          styles.mobileWrapper,
          isWeb ? styles.webWrapper : undefined,
        ]}
      >
        <MainHeader title="Thông báo" />

        <View style={styles.subHeader}>
          <Text style={styles.subHeaderTitle}>
            Gần đây · {unreadCount} chưa đọc
          </Text>

          <TouchableOpacity
            onPress={() => void handleMarkAllAsRead()}
            disabled={isMarkingAll || unreadCount <= 0}
          >
            {isMarkingAll ? (
              <ActivityIndicator
                size="small"
                color={COLORS.primary}
              />
            ) : (
              <Text
                style={[
                  styles.markAllReadText,
                  unreadCount <= 0
                    ? styles.disabledText
                    : undefined,
                ]}
              >
                Đánh dấu tất cả đã đọc
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

            <TouchableOpacity
              onPress={() => setMessage(null)}
              hitSlop={8}
            >
              <Ionicons
                name="close"
                size={18}
                color={COLORS.textLight}
              />
            </TouchableOpacity>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color={COLORS.primary}
            />
            <Text style={styles.loadingText}>
              Đang tải thông báo...
            </Text>
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
                const isOpening =
                  openingNotificationId === item.notificationId;

                return (
                  <TouchableOpacity
                    key={item.notificationId}
                    activeOpacity={0.72}
                    disabled={Boolean(openingNotificationId)}
                    onPress={() =>
                      void handleOpenNotification(item)
                    }
                    style={[
                      styles.notificationCard,
                      !item.isRead
                        ? styles.notificationCardUnread
                        : undefined,
                      isOpening
                        ? styles.notificationCardOpening
                        : undefined,
                    ]}
                  >
                    <View style={styles.iconContainer}>
                      <Ionicons
                        name={getIconForTarget(item.targetType)}
                        size={22}
                        color={COLORS.primary}
                      />
                    </View>

                    <View style={styles.contentContainer}>
                      <Text
                        style={[
                          styles.title,
                          !item.isRead
                            ? styles.titleUnread
                            : undefined,
                        ]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>

                      <Text
                        style={styles.notificationMessage}
                        numberOfLines={2}
                      >
                        {item.message}
                      </Text>

                      <Text style={styles.timeAgo}>
                        {formatTimeAgo(item.createdAt)}
                      </Text>
                    </View>

                    {!item.isRead ? (
                      <View style={styles.unreadDot} />
                    ) : null}
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="notifications-off-outline"
                  size={60}
                  color={COLORS.border}
                  style={styles.emptyIcon}
                />
                <Text style={styles.emptyTitle}>
                  Chưa có thông báo nào
                </Text>
                <Text style={styles.emptyDesc}>
                  Khi có cập nhật mới về giao dịch, thông báo sẽ xuất
                  hiện tại đây.
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
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  mobileWrapper: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
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
  },
  unauthIcon: {
    marginBottom: 16,
  },
  unauthTitle: {
    marginBottom: 12,
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "bold",
  },
  unauthDesc: {
    marginBottom: 28,
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
  loginBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "bold",
  },
  subHeader: {
    minHeight: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#BAC2C1",
    backgroundColor: COLORS.white,
  },
  subHeaderTitle: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
  },
  markAllReadText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
  },
  disabledText: {
    color: COLORS.textLight,
  },
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
  messageError: {
    backgroundColor: "rgba(122, 16, 18, 0.08)",
    borderColor: "rgba(122, 16, 18, 0.22)",
  },
  messageSuccess: {
    backgroundColor: "rgba(47, 118, 93, 0.10)",
    borderColor: "rgba(47, 118, 93, 0.24)",
  },
  messageInfo: {
    backgroundColor: "rgba(84, 123, 125, 0.10)",
    borderColor: "rgba(84, 123, 125, 0.24)",
  },
  messageText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  messageErrorText: {
    color: "#7A1012",
  },
  messageSuccessText: {
    color: "#2F765D",
  },
  messageInfoText: {
    color: "#2B5659",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.textLight,
    fontSize: 13,
  },
  listContainer: {
    paddingBottom: 40,
  },
  notificationCard: {
    minHeight: 88,
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: "#BAC2C1",
    alignItems: "flex-start",
  },
  notificationCardUnread: {
    backgroundColor: "#F8F9FA",
  },
  notificationCardOpening: {
    opacity: 0.6,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    backgroundColor: "rgba(84, 123, 125, 0.10)",
  },
  contentContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 3,
  },
  titleUnread: {
    fontWeight: "800",
    color: "#172830",
  },
  notificationMessage: {
    fontSize: 13,
    color: COLORS.textLight,
    lineHeight: 19,
    marginBottom: 5,
  },
  timeAgo: {
    fontSize: 11,
    color: "#6D8687",
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: COLORS.error,
    marginTop: 5,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    color: COLORS.textLight,
  },
});
