import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import apiClient from "../services/apis/axiosClient";
import {
  navigateToNotificationTarget,
  normalizeNotificationItem,
  normalizeTargetType,
} from "../services/notifications/notificationTargets";
import {
  consumeInitialNotificationResponse,
  ensureNotificationPermissionAsync,
  presentLocalNotificationAsync,
  registerNotificationResponseHandler,
  type SystemNotificationTapData,
} from "../services/notifications/systemNotification";
import { useAuth } from "./AuthContext";
import { useChatRealtime } from "./ChatRealtimeContext";

type NotificationContextValue = {
  unreadCount: number;
  postNotificationSignal: {
    version: number;
    targetId: string | null;
  };
  refreshUnreadCount: () => Promise<number>;
  markNotificationAsRead: (notificationId: string) => Promise<any>;
  markAllNotificationsAsRead: () => Promise<any>;
  systemNotificationsEnabled: boolean;
  isSystemNotificationPreferenceLoaded: boolean;
  setSystemNotificationsEnabled: (enabled: boolean) => void;
};

const NotificationContext =
  createContext<NotificationContextValue | undefined>(undefined);

// Người dùng bật/tắt việc hiển thị thông báo hệ thống trên chính thiết bị này.
// Đây KHÔNG phải là push token/remote push — chỉ điều khiển hành vi hiển thị
// FE-local khi app đang hoạt động.
const SYSTEM_NOTIFICATIONS_PREFERENCE_KEY =
  "homecycle.systemNotificationsEnabled.v1";

const unwrapApiData = (value: any) => value?.data ?? value;

const getUnreadCount = (value: any) => {
  const data = unwrapApiData(value);
  const count = Number(
    data?.unreadCount ??
      data?.UnreadCount ??
      value?.unreadCount ??
      value?.UnreadCount ??
      0,
  );

  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
};

export function NotificationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user, userToken } = useAuth();
  const { connection, reconnectVersion } = useChatRealtime();

  const [unreadCount, setUnreadCount] = useState(0);
  const [postNotificationSignal, setPostNotificationSignal] = useState({
    version: 0,
    targetId: null as string | null,
  });
  const [systemNotificationsEnabled, setSystemNotificationsEnabledState] =
    useState(true);
  const [
    isSystemNotificationPreferenceLoaded,
    setIsSystemNotificationPreferenceLoaded,
  ] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const handledReconnectVersionRef = useRef(0);
  const currentUserIdRef = useRef<string | null>(null);
  const systemNotificationsEnabledRef = useRef(true);

  currentUserIdRef.current = String(user?.userId ?? user?.id ?? "") || null;
  systemNotificationsEnabledRef.current = systemNotificationsEnabled;
  const processedCreatedNotificationIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let isMounted = true;

    AsyncStorage.getItem(SYSTEM_NOTIFICATIONS_PREFERENCE_KEY)
      .then((stored) => {
        if (!isMounted) return;
        // Không có giá trị đã lưu -> giữ hành vi mặc định trước đây (bật).
        setSystemNotificationsEnabledState(stored !== "false");
      })
      .catch(() => {
        // Đọc thất bại: an toàn với mặc định bật, không chặn phần còn lại.
      })
      .finally(() => {
        if (isMounted) setIsSystemNotificationPreferenceLoaded(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const setSystemNotificationsEnabled = useCallback((enabled: boolean) => {
    setSystemNotificationsEnabledState(enabled);
    void AsyncStorage.setItem(
      SYSTEM_NOTIFICATIONS_PREFERENCE_KEY,
      enabled ? "true" : "false",
    ).catch(() => {
      // Giữ nguyên lựa chọn trong phiên hiện tại dù lưu thất bại.
    });
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    if (!userToken) {
      setUnreadCount(0);
      return 0;
    }

    const response = await apiClient.get("/notifications/unread-count");
    const count = getUnreadCount(response.data);
    setUnreadCount(count);
    return count;
  }, [userToken]);

  const markNotificationAsRead = useCallback(
    async (notificationId: string) => {
      const response = await apiClient.patch(
        `/notifications/${notificationId}/read`,
      );
      const data = unwrapApiData(response.data);
      const nextCount = getUnreadCount(data);

      if (
        data?.unreadCount !== undefined ||
        data?.UnreadCount !== undefined
      ) {
        setUnreadCount(nextCount);
      } else {
        setUnreadCount((current) => Math.max(0, current - 1));
      }

      return data;
    },
    [],
  );

  const markAllNotificationsAsRead = useCallback(async () => {
    const response = await apiClient.patch("/notifications/read-all");
    const data = unwrapApiData(response.data);

    if (
      data?.unreadCount !== undefined ||
      data?.UnreadCount !== undefined
    ) {
      setUnreadCount(getUnreadCount(data));
    } else {
      setUnreadCount(0);
    }

    return data;
  }, []);

  useEffect(() => {
    handledReconnectVersionRef.current = 0;
    processedCreatedNotificationIdsRef.current.clear();

    if (!userToken) {
      setUnreadCount(0);
      setPostNotificationSignal({ version: 0, targetId: null });
      return;
    }

    void refreshUnreadCount();
  }, [refreshUnreadCount, userToken]);

  // Requests/checks OS notification permission only once the user is
  // authenticated, the persisted preference has finished loading, and that
  // preference is enabled — never merely because the user logged in, and
  // never while the preference is off. Re-runs (safely; the underlying call
  // is idempotent) if the user flips the Settings switch on during an
  // authenticated session.
  useEffect(() => {
    if (
      !userToken ||
      !isSystemNotificationPreferenceLoaded ||
      !systemNotificationsEnabled
    ) {
      return;
    }

    void ensureNotificationPermissionAsync();
  }, [userToken, isSystemNotificationPreferenceLoaded, systemNotificationsEnabled]);

  useEffect(() => {
    if (!connection || !userToken) return;

    const handleCreated = (payload: any) => {
      const notification = payload?.data ?? payload;
      const item = normalizeNotificationItem(notification);

      // Fall back to raw id extraction so a malformed item (missing the
      // other canonical fields) still gets deduped; normalizeNotificationItem
      // returns null when notificationId itself is unresolvable.
      const notificationId =
        item?.notificationId ??
        notification?.notificationId ??
        notification?.NotificationId ??
        notification?.id ??
        notification?.Id;

      let isNewNotification = true;

      if (notificationId !== undefined && notificationId !== null) {
        const key = String(notificationId);
        const processedIds = processedCreatedNotificationIdsRef.current;

        if (processedIds.has(key)) {
          isNewNotification = false;
        } else {
          processedIds.add(key);

          // Giới hạn cache để không tăng vô hạn trong session dài.
          if (processedIds.size > 500) {
            const oldestKey = processedIds.values().next().value;

            if (oldestKey !== undefined) {
              processedIds.delete(oldestKey);
            }
          }
        }
      }

      if (!isNewNotification) return;

      if (item && normalizeTargetType(item.targetType) === "post") {
        setPostNotificationSignal((current) => ({
          version: current.version + 1,
          targetId: item.targetId,
        }));
      }

      const isRead = Boolean(
        notification?.isRead ?? notification?.IsRead ?? false,
      );

      if (!isRead) {
        setUnreadCount((current) => current + 1);
      }

      // One authoritative NotificationCreated -> at most one native system
      // notification, gated on it being both genuinely new (per the dedupe
      // set above, keyed by canonical notificationId), unread, and the user
      // having the device notification preference enabled — a reconnect
      // replay of an already-processed id, an already-read catch-up item,
      // or the preference being off, must never surface a system
      // notification. The in-app unread count above is never gated by this.
      if (item && !isRead && systemNotificationsEnabledRef.current) {
        void presentLocalNotificationAsync({
          notificationId: item.notificationId,
          title: item.title,
          message: item.message,
          targetType: item.targetType,
          targetId: item.targetId,
        });
      }
    };

    const handleRead = (payload: any) => {
      const data = payload?.data ?? payload;

      if (
        data?.unreadCount !== undefined ||
        data?.UnreadCount !== undefined
      ) {
        setUnreadCount(getUnreadCount(data));
      } else {
        // Không tự -1 ở đây vì markNotificationAsRead()
        // đã có local decrement fallback.
        // Lấy count authoritative một lần để tránh double decrement.
        void refreshUnreadCount();
      }
    };

    const handleAllRead = (payload: any) => {
      const data = payload?.data ?? payload;

      if (
        data?.unreadCount !== undefined ||
        data?.UnreadCount !== undefined
      ) {
        setUnreadCount(getUnreadCount(data));
      } else {
        setUnreadCount(0);
      }
    };

    connection.on("NotificationCreated", handleCreated);
    connection.on("NotificationRead", handleRead);
    connection.on("NotificationsReadAll", handleAllRead);

    return () => {
      connection.off("NotificationCreated", handleCreated);
      connection.off("NotificationRead", handleRead);
      connection.off("NotificationsReadAll", handleAllRead);
    };
  }, [connection, refreshUnreadCount, userToken]);

  useEffect(() => {
    if (
      !userToken ||
      reconnectVersion <= 0 ||
      handledReconnectVersionRef.current === reconnectVersion
    ) {
      return;
    }

    handledReconnectVersionRef.current = reconnectVersion;
    void refreshUnreadCount();
  }, [reconnectVersion, refreshUnreadCount, userToken]);

  useEffect(() => {
    if (!userToken) return;

    const subscription = AppState.addEventListener(
      "change",
      (nextState) => {
        const previousState = appStateRef.current;
        appStateRef.current = nextState;

        if (
          previousState !== "active" &&
          nextState === "active"
        ) {
          void refreshUnreadCount();
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, [refreshUnreadCount, userToken]);

  // Native notification tap handling. Registered exactly once at this
  // provider's lifetime (not per screen mount, not re-subscribed on
  // reconnect/user change) and resolves through the SAME canonical target
  // resolver the in-app Notification list uses, so a tap can never open a
  // different destination than the equivalent in-app row would.
  useEffect(() => {
    const handleTap = (data: SystemNotificationTapData) => {
      if (!currentUserIdRef.current) return;

      if (data.notificationId) {
        // Best-effort: keep read state in sync with the existing contract.
        // A failure here (e.g. already read, or offline) must not block
        // navigation.
        void markNotificationAsRead(data.notificationId).catch(() => {});
      }

      void navigateToNotificationTarget(data, currentUserIdRef.current);
    };

    const removeResponseListener = registerNotificationResponseHandler(handleTap);

    // A notification tapped while the process was not yet running surfaces
    // here once, on the first mount after that cold start; already-consumed
    // on any later mount (e.g. logout/login within the same process).
    const initialTap = consumeInitialNotificationResponse();
    if (initialTap) handleTap(initialTap);

    return () => {
      removeResponseListener();
    };
  }, [markNotificationAsRead]);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        postNotificationSignal,
        refreshUnreadCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        systemNotificationsEnabled,
        isSystemNotificationPreferenceLoaded,
        setSystemNotificationsEnabled,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error(
      "useNotifications phải được dùng bên trong NotificationProvider",
    );
  }

  return context;
}
