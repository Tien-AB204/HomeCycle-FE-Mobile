import * as signalR from "@microsoft/signalr";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from "jwt-decode";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { refreshAccessToken } from "../services/apis/axiosClient";
import conversationApi from "../services/apis/conversationApi";
import { getApiErrorMessage } from "../utils/apiFeedback";
import { useAuth } from "./AuthContext";

const CHAT_HUB_URL =
  "https://homecycle-backend.onrender.com/hubs/chat";

const TOKEN_REFRESH_SAFETY_WINDOW_MS = 30_000;
const SIGNALR_START_RETRY_DELAYS_MS = [
  1_000,
  2_000,
  5_000,
  10_000,
  15_000,
] as const;

const waitForRetry = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

type JwtPayload = {
  exp?: number;
};

type ChatConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

type ChatRealtimeContextValue = {
  connection: signalR.HubConnection | null;
  connectionStatus: ChatConnectionStatus;
  reconnectVersion: number;
  conversationSummaries: any[];
  chatUnreadCount: number;
  isConversationSummaryLoading: boolean;
  refreshConversationSummaries: (options?: {
    silent?: boolean;
  }) => Promise<boolean>;
  // Thông điệp lỗi (ưu tiên của BE) của lần tải danh sách hội thoại gần nhất.
  getConversationSummaryError: () => string | null;
  joinNegotiation: (negotiationId: string) => Promise<void>;
  leaveNegotiation: (negotiationId: string) => Promise<void>;
  joinConversation: (conversationId: string) => Promise<void>;
  leaveConversation: (conversationId: string) => Promise<void>;
  joinOrder: (orderId: string) => Promise<void>;
  leaveOrder: (orderId: string) => Promise<void>;
};

const ChatRealtimeContext =
  createContext<ChatRealtimeContextValue | undefined>(undefined);

const shouldRefreshAccessToken = (token: string) => {
  try {
    const decoded = jwtDecode<JwtPayload>(token);

    if (!decoded.exp) {
      return false;
    }

    return (
      decoded.exp * 1000 <=
      Date.now() + TOKEN_REFRESH_SAFETY_WINDOW_MS
    );
  } catch {
    return false;
  }
};

const getSignalRAccessToken = async () => {
  const storedAccessToken =
    await AsyncStorage.getItem("accessToken");

  if (!storedAccessToken) {
    return "";
  }

  if (!shouldRefreshAccessToken(storedAccessToken)) {
    return storedAccessToken;
  }

  return refreshAccessToken();
};

const isUnauthorizedSignalRError = (error: unknown) => {
  const statusCode =
    typeof error === "object" && error !== null
      ? (error as { statusCode?: number }).statusCode
      : undefined;

  return (
    statusCode === 401 ||
    String(error).includes("401")
  );
};

export function ChatRealtimeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { userToken } = useAuth();

  const [connection, setConnection] =
    useState<signalR.HubConnection | null>(null);

  const [connectionStatus, setConnectionStatus] =
    useState<ChatConnectionStatus>("idle");

  const [reconnectVersion, setReconnectVersion] =
    useState(0);
  const [conversationSummaries, setConversationSummaries] = useState<any[]>([]);
  const [isConversationSummaryLoading, setConversationSummaryLoading] =
    useState(false);

  const connectionRef =
    useRef<signalR.HubConnection | null>(null);

  const joinedNegotiationsRef = useRef<Set<string>>(new Set());
  const joinedConversationsRef = useRef<Set<string>>(new Set());
  const joinedOrdersRef = useRef<Set<string>>(new Set());
  // Nhiều màn hình (Chi tiết đơn hàng, Chi tiết lịch hẹn) có thể cùng theo dõi
  // một đơn: chỉ rời nhóm SignalR khi màn hình cuối cùng rời đi.
  const orderRoomRefCountsRef = useRef<Map<string, number>>(new Map());
  const conversationRequestRef = useRef(0);
  const conversationSummaryErrorRef = useRef<string | null>(null);
  const getConversationSummaryError = useCallback(
    () => conversationSummaryErrorRef.current,
    [],
  );

  const refreshConversationSummaries = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent === true;
      const requestId = ++conversationRequestRef.current;

      if (!userToken) {
        setConversationSummaries([]);
        setConversationSummaryLoading(false);
        return false;
      }

      if (!silent) {
        setConversationSummaryLoading(true);
      }

      try {
        const allItems: any[] = [];
        let pageNumber = 1;
        let totalPages = 1;

        do {
          const response = await conversationApi.getConversations({
            PageNumber: pageNumber,
            PageSize: 50,
          });
          const page = response?.data ?? response;
          const items = Array.isArray(page?.items) ? page.items : [];
          allItems.push(...items);
          totalPages = Math.max(1, Number(page?.totalPages ?? 1));
          pageNumber += 1;
        } while (pageNumber <= totalPages);

        if (requestId !== conversationRequestRef.current) {
          return true;
        }

        conversationSummaryErrorRef.current = null;
        setConversationSummaries(allItems);
        return true;
      } catch (error) {
        conversationSummaryErrorRef.current = getApiErrorMessage(
          error,
          "Không thể tải danh sách trò chuyện.",
        );
        return false;
      } finally {
        if (requestId === conversationRequestRef.current) {
          setConversationSummaryLoading(false);
        }
      }
    },
    [userToken],
  );

  const chatUnreadCount = conversationSummaries.reduce(
    (total, conversation) => {
      const unreadCount = Number(conversation?.unreadCount ?? 0);
      return total + (Number.isFinite(unreadCount) ? Math.max(0, unreadCount) : 0);
    },
    0,
  );

  useEffect(() => {
    conversationRequestRef.current += 1;

    if (!userToken) {
      setConversationSummaries([]);
      setConversationSummaryLoading(false);
      return;
    }

    void refreshConversationSummaries();
  }, [refreshConversationSummaries, userToken]);

  useEffect(() => {
    if (!userToken) return;

    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener("change", (nextState) => {
      const shouldRefresh = previousState !== "active" && nextState === "active";
      previousState = nextState;

      if (shouldRefresh) {
        void refreshConversationSummaries({ silent: true });
      }
    });

    return () => subscription.remove();
  }, [refreshConversationSummaries, userToken]);

  useEffect(() => {
    let cancelled = false;
    let hasConnectedOnce = false;
    let hadStartFailure = false;

    setReconnectVersion(0);

    if (!userToken) {
      joinedNegotiationsRef.current.clear();
      joinedConversationsRef.current.clear();
      joinedOrdersRef.current.clear();
      orderRoomRefCountsRef.current.clear();
      connectionRef.current = null;
      setConnection(null);
      setConnectionStatus("idle");
      return;
    }

    setConnectionStatus("connecting");

    const hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(CHAT_HUB_URL, {
        accessTokenFactory: getSignalRAccessToken,
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.None)
      .build();

    const handleConversationUpdated = () => {
      void refreshConversationSummaries({ silent: true });
    };

    hubConnection.on("ConversationUpdated", handleConversationUpdated);

    connectionRef.current = hubConnection;

    const rejoinTrackedRooms = async () => {
      const joinedNegotiations = Array.from(
        joinedNegotiationsRef.current,
      );
      const joinedConversations = Array.from(
        joinedConversationsRef.current,
      );
      const joinedOrders = Array.from(
        joinedOrdersRef.current,
      );

      await Promise.allSettled([
        ...joinedNegotiations.map((negotiationId) =>
          hubConnection.invoke(
            "JoinNegotiation",
            negotiationId,
          ),
        ),
        ...joinedConversations.map((conversationId) =>
          hubConnection.invoke(
            "JoinConversation",
            conversationId,
          ),
        ),
        ...joinedOrders.map((orderId) =>
          hubConnection.invoke(
            "JoinOrder",
            orderId,
          ),
        ),
      ]);
    };

    hubConnection.onreconnecting(() => {
      if (!cancelled) {
        setConnectionStatus("reconnecting");
      }
    });

    hubConnection.onreconnected(async () => {
      await rejoinTrackedRooms();
      void refreshConversationSummaries({ silent: true });

      if (!cancelled) {
        hasConnectedOnce = true;
        hadStartFailure = false;
        setConnectionStatus("connected");
        setReconnectVersion((current) => current + 1);
      }
    });

    const startConnection = async () => {
      let retryIndex = 0;

      while (!cancelled) {
        try {
          const preparedAccessToken =
            await getSignalRAccessToken();

          if (!preparedAccessToken || cancelled) {
            return;
          }

          try {
            await hubConnection.start();
          } catch (error) {
            if (!isUnauthorizedSignalRError(error)) {
              throw error;
            }

            await refreshAccessToken();
            await hubConnection.start();
          }

          if (cancelled) {
            await hubConnection.stop();
            return;
          }

          await rejoinTrackedRooms();

          if (cancelled) {
            await hubConnection.stop();
            return;
          }

          const shouldNotifyReconnect =
            hasConnectedOnce || hadStartFailure;

          hasConnectedOnce = true;
          hadStartFailure = false;
          setConnection(hubConnection);
          setConnectionStatus("connected");

          if (shouldNotifyReconnect) {
            setReconnectVersion((current) => current + 1);
          }

          return;
        } catch {
          if (cancelled) {
            return;
          }

          hadStartFailure = true;
          setConnectionStatus("disconnected");

          const retryDelay =
            SIGNALR_START_RETRY_DELAYS_MS[
              Math.min(
                retryIndex,
                SIGNALR_START_RETRY_DELAYS_MS.length - 1,
              )
            ];

          retryIndex += 1;
          await waitForRetry(retryDelay);
        }
      }
    };

    hubConnection.onclose(() => {
      if (cancelled) {
        return;
      }

      setConnectionStatus("disconnected");
      void startConnection();
    });

    void startConnection();

    return () => {
      cancelled = true;

      if (connectionRef.current === hubConnection) {
        connectionRef.current = null;
      }

      setConnection((current) =>
        current === hubConnection ? null : current,
      );
      setConnectionStatus("idle");

      hubConnection.off("ConversationUpdated", handleConversationUpdated);

      void hubConnection.stop();
    };
  }, [refreshConversationSummaries, userToken]);

  const joinNegotiation = useCallback(
    async (negotiationId: string) => {
      if (!negotiationId) return;

      joinedNegotiationsRef.current.add(negotiationId);

      const currentConnection = connectionRef.current;

      if (
        currentConnection?.state ===
        signalR.HubConnectionState.Connected
      ) {
        await currentConnection.invoke(
          "JoinNegotiation",
          negotiationId,
        );
      }
    },
    [],
  );

  const leaveNegotiation = useCallback(
    async (negotiationId: string) => {
      if (!negotiationId) return;

      joinedNegotiationsRef.current.delete(negotiationId);

      const currentConnection = connectionRef.current;

      if (
        currentConnection?.state ===
        signalR.HubConnectionState.Connected
      ) {
        try {
          await currentConnection.invoke(
            "LeaveNegotiation",
            negotiationId,
          );
        } catch {
          // Connection có thể vừa bị ngắt.
        }
      }
    },
    [],
  );

  const joinConversation = useCallback(
    async (conversationId: string) => {
      if (!conversationId) return;

      joinedConversationsRef.current.add(conversationId);

      const currentConnection = connectionRef.current;

      if (
        currentConnection?.state ===
        signalR.HubConnectionState.Connected
      ) {
        await currentConnection.invoke(
          "JoinConversation",
          conversationId,
        );
      }
    },
    [],
  );

  const leaveConversation = useCallback(
    async (conversationId: string) => {
      if (!conversationId) return;

      joinedConversationsRef.current.delete(conversationId);

      const currentConnection = connectionRef.current;

      if (
        currentConnection?.state ===
        signalR.HubConnectionState.Connected
      ) {
        try {
          await currentConnection.invoke(
            "LeaveConversation",
            conversationId,
          );
        } catch {
          // Connection có thể vừa bị ngắt.
        }
      }
    },
    [],
  );

  const joinOrder = useCallback(
    async (orderId: string) => {
      if (!orderId) return;

      orderRoomRefCountsRef.current.set(
        orderId,
        (orderRoomRefCountsRef.current.get(orderId) ?? 0) + 1,
      );
      joinedOrdersRef.current.add(orderId);

      const currentConnection = connectionRef.current;

      if (
        currentConnection?.state ===
        signalR.HubConnectionState.Connected
      ) {
        await currentConnection.invoke(
          "JoinOrder",
          orderId,
        );
      }
    },
    [],
  );

  const leaveOrder = useCallback(
    async (orderId: string) => {
      if (!orderId) return;

      const remaining = Math.max(
        0,
        (orderRoomRefCountsRef.current.get(orderId) ?? 1) - 1,
      );
      if (remaining > 0) {
        orderRoomRefCountsRef.current.set(orderId, remaining);
        return;
      }
      orderRoomRefCountsRef.current.delete(orderId);
      joinedOrdersRef.current.delete(orderId);

      const currentConnection = connectionRef.current;

      if (
        currentConnection?.state ===
        signalR.HubConnectionState.Connected
      ) {
        try {
          await currentConnection.invoke(
            "LeaveOrder",
            orderId,
          );
        } catch {
          // Connection có thể vừa bị ngắt.
        }
      }
    },
    [],
  );
  return (
    <ChatRealtimeContext.Provider
      value={{
        connection,
        connectionStatus,
        reconnectVersion,
        conversationSummaries,
        chatUnreadCount,
        isConversationSummaryLoading,
        refreshConversationSummaries,
        getConversationSummaryError,
        joinNegotiation,
        leaveNegotiation,
        joinConversation,
        leaveConversation,
        joinOrder,
        leaveOrder,
      }}
    >
      {children}
    </ChatRealtimeContext.Provider>
  );
}

export function useChatRealtime() {
  const context = useContext(ChatRealtimeContext);

  if (!context) {
    throw new Error(
      "useChatRealtime phải được dùng bên trong ChatRealtimeProvider",
    );
  }

  return context;
}
