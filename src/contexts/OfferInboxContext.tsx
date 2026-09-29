import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

import apiClient from "../services/apis/axiosClient";
import { parseServerDate, serverNow } from "../utils/serverClock";
import { useAuth } from "./AuthContext";
import { useChatRealtime } from "./ChatRealtimeContext";

// Hộp đề nghị nhận được:
// - pendingCount: đề nghị còn chờ bạn phản hồi (tự giảm khi phản hồi hoặc hết hạn 3 phút).
// - unseenCount: trong số đó, những đề nghị đến sau lần cuối bạn mở mục Đề nghị.
// "Đã xem" lưu theo mốc thời gian trên máy, riêng cho từng tài khoản.
type OfferInboxValue = {
  pendingCount: number;
  unseenCount: number;
  isNewOffer: (createdAt: unknown) => boolean;
  markOffersSeen: () => void;
  refreshOfferInbox: () => void;
};

type PendingOffer = { createdAtMs: number; deadlineMs: number | null };

const OfferInboxContext = createContext<OfferInboxValue>({
  pendingCount: 0,
  unseenCount: 0,
  isNewOffer: () => false,
  markOffersSeen: () => {},
  refreshOfferInbox: () => {},
});

const REFRESH_DEBOUNCE_MS = 400;
const seenStorageKey = (userId: string) => `offerInbox.lastSeenAt.${userId}`;

const isPendingStatus = (value: unknown) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "pending" || normalized === "0";
};

export function OfferInboxProvider({ children }: { children: React.ReactNode }) {
  const { user, userToken } = useAuth();
  const { connection, reconnectVersion } = useChatRealtime();
  const userId = String(user?.userId || user?.id || "");

  const [pendingOffers, setPendingOffers] = useState<PendingOffer[]>([]);
  const [lastSeenAt, setLastSeenAt] = useState<number | null>(null);
  // Mốc để tô "Mới" trên thẻ: giữ mốc xem trước đó để thẻ vẫn nổi bật trong lúc đang xem.
  const [highlightSince, setHighlightSince] = useState<number | null>(null);
  const [now, setNow] = useState(() => serverNow());
  const requestRef = useRef(0);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const fetchPending = useCallback(async () => {
    if (!userToken || !userId) return;
    const request = ++requestRef.current;
    try {
      const response = await apiClient.get("/offers/received", {
        params: { PageNumber: 1, PageSize: 100, Status: "Pending" },
      });
      if (request !== requestRef.current) return;
      const page = response.data?.data ?? response.data;
      const items: any[] = Array.isArray(page?.items) ? page.items : [];
      setPendingOffers(
        items
          .filter((item) => isPendingStatus(item?.offerStatus))
          .map((item) => ({
            createdAtMs: parseServerDate(item?.createdAt) ?? 0,
            deadlineMs: parseServerDate(item?.responseDeadlineAt),
          })),
      );
      setNow(serverNow());
    } catch {
      // Giữ số cũ khi lỗi mạng; lần cập nhật sau sẽ sửa lại.
    }
  }, [userId, userToken]);

  const refreshOfferInbox = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => void fetchPending(), REFRESH_DEBOUNCE_MS);
  }, [fetchPending]);

  // Đổi tài khoản: nạp mốc "đã xem" của tài khoản đó và tải lại.
  useEffect(() => {
    setPendingOffers([]);
    setLastSeenAt(null);
    setHighlightSince(null);
    if (!userToken || !userId) return;
    let active = true;
    AsyncStorage.getItem(seenStorageKey(userId))
      .then((stored) => {
        if (!active) return;
        const value = Number(stored);
        if (Number.isFinite(value) && value > 0) {
          setLastSeenAt(value);
          setHighlightSince(value);
        }
      })
      .catch(() => {});
    void fetchPending();
    return () => {
      active = false;
    };
  }, [fetchPending, userId, userToken]);

  // Có đề nghị mới, bị phản hồi hoặc hết hạn: BE bắn OfferCreated / OfferUpdated.
  useEffect(() => {
    if (!connection || !userToken) return;
    const handleOfferChanged = () => refreshOfferInbox();
    connection.on("OfferCreated", handleOfferChanged);
    connection.on("OfferUpdated", handleOfferChanged);
    return () => {
      connection.off("OfferCreated", handleOfferChanged);
      connection.off("OfferUpdated", handleOfferChanged);
    };
  }, [connection, refreshOfferInbox, userToken]);

  useEffect(() => {
    if (reconnectVersion > 0) refreshOfferInbox();
  }, [reconnectVersion, refreshOfferInbox]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshOfferInbox();
    });
    return () => subscription.remove();
  }, [refreshOfferInbox]);

  useEffect(
    () => () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    },
    [],
  );

  // Hết 3 phút thì bỏ khỏi số đếm ngay, không chờ realtime từ worker.
  const activeOffers = useMemo(
    () => pendingOffers.filter((offer) => offer.deadlineMs === null || offer.deadlineMs > now),
    [now, pendingOffers],
  );
  useEffect(() => {
    const nextDeadline = Math.min(
      ...activeOffers.map((offer) => offer.deadlineMs ?? Infinity),
    );
    if (!Number.isFinite(nextDeadline)) return;
    const timer = setTimeout(
      () => setNow(serverNow()),
      Math.max(0, nextDeadline - serverNow()) + 250,
    );
    return () => clearTimeout(timer);
  }, [activeOffers]);

  const unseenCount = useMemo(
    () => activeOffers.filter((offer) => lastSeenAt === null || offer.createdAtMs > lastSeenAt).length,
    [activeOffers, lastSeenAt],
  );

  const markOffersSeen = useCallback(() => {
    if (!userId || unseenCount === 0) return;
    const latestCreated = Math.max(0, ...activeOffers.map((offer) => offer.createdAtMs));
    const seenAt = Math.max(serverNow(), latestCreated);
    setHighlightSince(lastSeenAt);
    setLastSeenAt(seenAt);
    AsyncStorage.setItem(seenStorageKey(userId), String(seenAt)).catch(() => {});
  }, [activeOffers, lastSeenAt, unseenCount, userId]);

  const isNewOffer = useCallback(
    (createdAt: unknown) => {
      const createdMs = parseServerDate(createdAt);
      if (createdMs === null) return false;
      return highlightSince === null || createdMs > highlightSince;
    },
    [highlightSince],
  );

  const value = useMemo(
    () => ({
      pendingCount: activeOffers.length,
      unseenCount,
      isNewOffer,
      markOffersSeen,
      refreshOfferInbox,
    }),
    [activeOffers.length, isNewOffer, markOffersSeen, refreshOfferInbox, unseenCount],
  );

  return <OfferInboxContext.Provider value={value}>{children}</OfferInboxContext.Provider>;
}

export const useOfferInbox = () => useContext(OfferInboxContext);

export const formatBadgeCount = (count: number) => (count > 99 ? "99+" : String(count));
