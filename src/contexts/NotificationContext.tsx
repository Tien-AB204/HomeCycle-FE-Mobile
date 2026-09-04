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
  const { userToken } = useAuth();
  const { connection, reconnectVersion } = useChatRealtime();

  const [unreadCount, setUnreadCount] = useState(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const handledReconnectVersionRef = useRef(0);
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
  }, [refreshUnreadCount, userToken]);

  useEffect(() => {
    if (!connection || !userToken) return;

    const handleCreated = (payload: any) => {
      const notification = payload?.data ?? payload;

      const notificationId =
        notification?.notificationId ??
        notification?.NotificationId ??
        notification?.id ??
        notification?.Id;

      if (notificationId !== undefined && notificationId !== null) {
        const key = String(notificationId);
        const processedIds = processedCreatedNotificationIdsRef.current;

        if (processedIds.has(key)) {
          return;
        }

        processedIds.add(key);

        // Giới hạn cache để không tăng vô hạn trong session dài.
        if (processedIds.size > 500) {
          const oldestKey = processedIds.values().next().value;

          if (oldestKey !== undefined) {
            processedIds.delete(oldestKey);
          }
        }
      }

      const isRead = Boolean(
        notification?.isRead ?? notification?.IsRead ?? false,
      );

      if (!isRead) {
        setUnreadCount((current) => current + 1);
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
