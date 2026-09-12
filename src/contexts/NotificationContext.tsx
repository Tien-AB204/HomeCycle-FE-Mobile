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
  refreshUnreadCount: () => Promise<number>;
  markNotificationAsRead: (notificationId: string) => Promise<any>;
  markAllNotificationsAsRead: () => Promise<any>;
};

const NotificationContext =
  createContext<NotificationContextValue | undefined>(undefined);

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
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const handledReconnectVersionRef = useRef(0);
  const currentUserIdRef = useRef<string | null>(null);
  const permissionRequestedForTokenRef = useRef<string | null>(null);

  currentUserIdRef.current = String(user?.userId ?? user?.id ?? "") || null;
  const processedCreatedNotificationIdsRef = useRef<Set<string>>(new Set());

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
      return;
    }

    void refreshUnreadCount();

    // Once per authenticated session — not on every reconnect/render, and
    // never while logged out. A denial here fails safe: unreadCount and the
    // in-app Notification screen keep working regardless of the outcome.
    if (permissionRequestedForTokenRef.current !== userToken) {
      permissionRequestedForTokenRef.current = userToken;
      void ensureNotificationPermissionAsync();
    }
  }, [refreshUnreadCount, userToken]);

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

      const isRead = Boolean(
        notification?.isRead ?? notification?.IsRead ?? false,
      );

      if (!isRead) {
        setUnreadCount((current) => current + 1);
      }

      // One authoritative NotificationCreated -> at most one native system
      // notification, gated on it being both genuinely new (per the dedupe
      // set above, keyed by canonical notificationId) and unread — a
      // reconnect replay of an already-processed id, or an already-read
      // catch-up item, must never re-surface here.
      if (item && !isRead) {
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
        refreshUnreadCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
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
