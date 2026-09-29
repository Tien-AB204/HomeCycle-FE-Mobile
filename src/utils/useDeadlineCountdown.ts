import { useEffect, useRef, useState } from "react";

import { parseServerDate, serverNow } from "./serverClock";

export type DeadlineCountdown = {
  hasDeadline: boolean;
  remainingMs: number | null;
  isExpired: boolean;
};

// Đếm ngược tới hạn do BE trả (responseDeadlineAt/paymentDeadlineAt). onExpire chạy
// đúng một lần cho mỗi hạn, kể cả khi mở màn lúc hạn đã qua, để màn tải lại trạng thái mới.
export function useDeadlineCountdown(
  deadline: unknown,
  onExpire?: () => void,
): DeadlineCountdown {
  const deadlineMs = parseServerDate(deadline);
  const [now, setNow] = useState(() => serverNow());
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const expiredForRef = useRef<number | null>(null);

  useEffect(() => {
    if (deadlineMs === null) return;
    setNow(serverNow());
    if (serverNow() >= deadlineMs) return;

    const timer = setInterval(() => {
      const current = serverNow();
      setNow(current);
      if (current >= deadlineMs) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [deadlineMs]);

  const remainingMs =
    deadlineMs === null ? null : Math.max(0, deadlineMs - now);
  const isExpired = remainingMs === 0;

  useEffect(() => {
    if (!isExpired || deadlineMs === null) return;
    if (expiredForRef.current === deadlineMs) return;
    expiredForRef.current = deadlineMs;
    onExpireRef.current?.();
  }, [deadlineMs, isExpired]);

  return { hasDeadline: deadlineMs !== null, remainingMs, isExpired };
}

// Một bộ đếm theo giờ server dùng chung cho cả danh sách, thay vì mỗi thẻ một setInterval.
export function useServerNowTicker(active: boolean) {
  const [now, setNow] = useState(() => serverNow());

  useEffect(() => {
    if (!active) return;
    setNow(serverNow());
    const timer = setInterval(() => setNow(serverNow()), 1000);
    return () => clearInterval(timer);
  }, [active]);

  return now;
}

// Thời gian còn lại (ms) tới hạn do BE trả; null khi không có hạn.
export const remainingUntil = (deadline: unknown, now: number) => {
  const deadlineMs = parseServerDate(deadline);
  return deadlineMs === null ? null : Math.max(0, deadlineMs - now);
};

export const formatRemainingTime = (remainingMs: number) => {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
};
