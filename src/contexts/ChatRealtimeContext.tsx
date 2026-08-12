import * as signalR from "@microsoft/signalr";
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
import { useAuth } from "./AuthContext";

const CHAT_HUB_URL =
  "https://homecycle-backend.onrender.com/hubs/chat";

type ChatRealtimeContextValue = {
  connection: signalR.HubConnection | null;
  joinNegotiation: (negotiationId: string) => Promise<void>;
  leaveNegotiation: (negotiationId: string) => Promise<void>;
};

const ChatRealtimeContext =
  createContext<ChatRealtimeContextValue | undefined>(undefined);

export function ChatRealtimeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { userToken } = useAuth();

  const [connection, setConnection] =
    useState<signalR.HubConnection | null>(null);

  const connectionRef =
    useRef<signalR.HubConnection | null>(null);

  const joinedNegotiationsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    if (!userToken) {
      joinedNegotiationsRef.current.clear();
      connectionRef.current = null;
      setConnection(null);
      return;
    }

    const hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(CHAT_HUB_URL, {
        accessTokenFactory: async () =>
          (await AsyncStorage.getItem("accessToken")) || "",
      })
      .withAutomaticReconnect()
      .build();

    connectionRef.current = hubConnection;

    hubConnection.onreconnected(async () => {
      const joinedNegotiations = Array.from(
        joinedNegotiationsRef.current,
      );

      await Promise.allSettled(
        joinedNegotiations.map((negotiationId) =>
          hubConnection.invoke(
            "JoinNegotiation",
            negotiationId,
          ),
        ),
      );
    });

    const startConnection = async () => {
      try {
        await hubConnection.start();

        if (cancelled) {
          await hubConnection.stop();
          return;
        }

        setConnection(hubConnection);
      } catch (error) {
        console.log("Không thể kết nối SignalR:", error);
      }
    };

    void startConnection();

    return () => {
      cancelled = true;

      if (connectionRef.current === hubConnection) {
        connectionRef.current = null;
      }

      setConnection((current) =>
        current === hubConnection ? null : current,
      );

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

  return (
    <ChatRealtimeContext.Provider
      value={{
        connection,
        joinNegotiation,
        leaveNegotiation,
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