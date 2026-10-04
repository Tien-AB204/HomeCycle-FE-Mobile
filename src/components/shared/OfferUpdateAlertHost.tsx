import { Ionicons } from "@expo/vector-icons";
import { usePathname } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { COLORS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useNotifications } from "../../contexts/NotificationContext";
import apiClient from "../../services/apis/axiosClient";
import {
  normalizeNotificationItem,
  normalizeTargetType,
} from "../../services/notifications/notificationTargets";
import { localizeSystemText } from "../../utils/localizeSystemText";
import { ModalBackdrop, ModalSurface } from "./ModalBackdrop";

type OfferAlert = {
  notificationId: string;
  title: string;
  message: string;
  targetId: string | null;
};

// Thông báo BE gửi khi giá/số lượng của đề nghị bị đổi (OfferService). Toast chỉ
// hiện vài giây nên các thông báo này còn hiện thêm modal tới khi người dùng xác nhận.
const PRICE_CHANGE_TITLES = new Set([
  "đề nghị đã được cập nhật",
  "bạn nhận được đề nghị đối ứng",
]);

const isOfferPriceChange = (targetType: unknown, title: unknown) =>
  normalizeTargetType(targetType) === "offer" &&
  PRICE_CHANGE_TITLES.has(String(title ?? "").trim().toLowerCase());

const RECENT_NOTIFICATION_PAGE_SIZE = 30;

// "/offers/<id>" → id; các màn đề nghị khác → null (xem mọi đề nghị).
const getOfferIdFromPath = (pathname: string) => {
  const match = pathname.match(/^\/offers\/([^/]+)$/);
  return match && match[1] !== "by-post" ? match[1] : null;
};

export default function OfferUpdateAlertHost() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { inAppNotification, markNotificationAsRead } = useNotifications();
  const [queue, setQueue] = useState<OfferAlert[]>([]);
  // Đã xác nhận trong phiên này: không hiện lại dù danh sách thông báo chưa kịp cập nhật.
  const acknowledgedIdsRef = useRef<Set<string>>(new Set());
  const userId = String(user?.userId ?? user?.id ?? "");

  const enqueue = useCallback((alerts: OfferAlert[]) => {
    setQueue((current) => {
      const known = new Set(current.map((alert) => alert.notificationId));
      const next = alerts.filter(
        (alert) =>
          !known.has(alert.notificationId) &&
          !acknowledgedIdsRef.current.has(alert.notificationId),
      );
      return next.length > 0 ? [...current, ...next] : current;
    });
  }, []);

  useEffect(() => {
    setQueue([]);
    acknowledgedIdsRef.current.clear();
  }, [userId]);

  // Thông báo realtime vừa tới (cùng lúc với toast).
  useEffect(() => {
    if (!inAppNotification) return;
    if (!isOfferPriceChange(inAppNotification.targetType, inAppNotification.title)) return;
    enqueue([
      {
        notificationId: inAppNotification.notificationId,
        title: inAppNotification.title,
        message: inAppNotification.message,
        targetId: inAppNotification.targetId ?? null,
      },
    ]);
  }, [enqueue, inAppNotification]);

  // Vào lại màn đề nghị (danh sách theo bài, chi tiết, hoặc tab Tin đăng có mục Đề nghị):
  // thông báo đổi giá còn chưa xem thì hiện lại modal.
  const isOfferScreen = pathname.startsWith("/offers") || pathname === "/posts";
  const routeOfferId = isOfferScreen ? getOfferIdFromPath(pathname) : null;

  useEffect(() => {
    if (!userId || !isOfferScreen) return;
    let active = true;

    void (async () => {
      try {
        const response = await apiClient.get("/notifications", {
          params: { PageNumber: 1, PageSize: RECENT_NOTIFICATION_PAGE_SIZE },
        });
        const data = response.data?.data ?? response.data;
        const rawItems = data?.items ?? data?.Items ?? (Array.isArray(data) ? data : []);
        if (!active || !Array.isArray(rawItems)) return;

        const alerts = rawItems
          .map(normalizeNotificationItem)
          .filter(
            (item): item is NonNullable<ReturnType<typeof normalizeNotificationItem>> =>
              Boolean(item) &&
              !item!.isRead &&
              isOfferPriceChange(item!.targetType, item!.title) &&
              (!routeOfferId || item!.targetId === routeOfferId),
          )
          // Cũ nhất trước để người dùng đọc theo đúng thứ tự thay đổi.
          .reverse()
          .map((item) => ({
            notificationId: item.notificationId,
            title: item.title,
            message: item.message,
            targetId: item.targetId,
          }));
        enqueue(alerts);
      } catch {
        // Không tải được thì vẫn còn toast và màn Thông báo; không chặn màn hiện tại.
      }
    })();

    return () => {
      active = false;
    };
  }, [enqueue, isOfferScreen, routeOfferId, userId]);

  const current = queue[0] ?? null;

  const acknowledge = () => {
    if (!current) return;
    const notificationId = current.notificationId;
    acknowledgedIdsRef.current.add(notificationId);
    // Đóng ngay, không bắt người dùng chờ mạng.
    setQueue((items) => items.filter((item) => item.notificationId !== notificationId));
    // Bấm "Đã hiểu" = đã xem thông báo này.
    markNotificationAsRead(notificationId).catch(() => {
      // Đã ghi nhận trong phiên; thông báo vẫn còn ở màn Thông báo để đánh dấu lại.
    });
  };

  return (
    <Modal
      visible={Boolean(current)}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={acknowledge}
    >
      {/* Chạm nền không đóng: phải bấm "Đã hiểu" để ghi nhận đã xem. */}
      <ModalBackdrop style={styles.backdrop} onPress={() => {}}>
        <ModalSurface style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="pricetags" size={26} color={COLORS.white} />
          </View>
          <Text style={styles.title}>
            {localizeSystemText(current?.title, "Đề nghị đã thay đổi")}
          </Text>
          <Text style={styles.message}>
            {localizeSystemText(current?.message, "Giá hoặc số lượng của đề nghị đã được cập nhật.")}
          </Text>
          <View style={styles.hint}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
            <Text style={styles.hintText}>
              Kiểm tra lại giá và số lượng mới trước khi phản hồi đề nghị.
            </Text>
          </View>
          {queue.length > 1 ? (
            <Text style={styles.counter}>Còn {queue.length - 1} cập nhật khác</Text>
          ) : null}
          <TouchableOpacity style={styles.button} onPress={acknowledge} activeOpacity={0.85}>
            <Text style={styles.buttonText}>Đã hiểu</Text>
          </TouchableOpacity>
        </ModalSurface>
      </ModalBackdrop>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(23, 40, 48, 0.55)",
  },
  card: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    padding: 22,
    borderRadius: 20,
    backgroundColor: COLORS.white,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    backgroundColor: COLORS.primary,
  },
  title: { color: COLORS.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
  message: {
    marginTop: 8,
    color: COLORS.textLight,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  hint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 14,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(84, 123, 125, 0.10)",
  },
  hintText: { flex: 1, color: COLORS.primary, fontSize: 12.5, lineHeight: 18, fontWeight: "600" },
  counter: { marginTop: 10, color: COLORS.textLight, fontSize: 12 },
  button: {
    alignSelf: "stretch",
    minHeight: 48,
    marginTop: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  buttonText: { color: COLORS.white, fontSize: 15, fontWeight: "800" },
});
