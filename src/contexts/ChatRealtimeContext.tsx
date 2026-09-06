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
import { refreshAccessToken } from "../services/apis/axiosClient";
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
  joinNegotiation: (negotiationId: string) => Promise<void>;
  leaveNegotiation: (negotiationId: string) => Promise<void>;
  joinConversation: (conversationId: string) => Promise<void>;
  leaveConversation: (conversationId: string) => Promise<void>;
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

  const connectionRef =
    useRef<signalR.HubConnection | null>(null);

  const joinedNegotiationsRef = useRef<Set<string>>(new Set());
  const joinedConversationsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    let hasConnectedOnce = false;
    let hadStartFailure = false;

    setReconnectVersion(0);

    if (!userToken) {
      joinedNegotiationsRef.current.clear();
      joinedConversationsRef.current.clear();
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

    connectionRef.current = hubConnection;

    const rejoinTrackedRooms = async () => {
      const joinedNegotiations = Array.from(
        joinedNegotiationsRef.current,
      );
      const joinedConversations = Array.from(
        joinedConversationsRef.current,
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
      ]);
    };

    hubConnection.onreconnecting(() => {
      if (!cancelled) {
        setConnectionStatus("reconnecting");
      }
    });

    hubConnection.onreconnected(async () => {
      await rejoinTrackedRooms();

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

      void hubConnection.stop();
    };
  }, [userToken]);

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

  return (
    <ChatRealtimeContext.Provider
      value={{
        connection,
        connectionStatus,
        reconnectVersion,
        joinNegotiation,
        leaveNegotiation,
        joinConversation,
        leaveConversation,
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
