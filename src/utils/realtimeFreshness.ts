import { parseServerDate, serverNow } from "./serverClock";

// Chống event realtime cũ ghi đè dữ liệu mới hơn.
// - BE đặt UpdatedAt của event = thời điểm server đọc snapshot sau khi commit, nên event
//   nào có UpdatedAt lớn hơn thì mang trạng thái mới hơn hoặc bằng.
// - Dữ liệu REST được đánh dấu bằng giờ server lúc BẮT ĐẦU gọi API: state trả về ít nhất
//   mới bằng mọi snapshot đọc trước mốc đó.
export type RealtimeFreshness = {
  // UpdatedAt (ms, giờ server) của event gần nhất đã áp dụng.
  lastEventAt: number | null;
  // Giờ server lúc bắt đầu lượt REST gần nhất đã áp dụng.
  restStartedAt: number | null;
};

export const createRealtimeFreshness = (): RealtimeFreshness => ({
  lastEventAt: null,
  restStartedAt: null,
});

// "apply": cập nhật state từ event.
// "stale": event cũ hơn hoặc trùng event đã áp dụng, bỏ qua.
// "older-than-rest": snapshot đọc trước lượt REST đang hiển thị; không cập nhật state.
//   Giờ server phía máy chỉ là ước lượng nên màn hình nào không tự tải lại sau event
//   thì nên gọi lại REST trong trường hợp này.
// "unknown": event không có UpdatedAt hợp lệ, chỉ dùng làm tín hiệu tải lại.
export type RealtimeEventDecision =
  | "apply"
  | "stale"
  | "older-than-rest"
  | "unknown";

export const readEventUpdatedAt = (payload: any): number | null =>
  parseServerDate(payload?.updatedAt ?? payload?.UpdatedAt);

export const classifyRealtimeEvent = (
  freshness: RealtimeFreshness,
  eventUpdatedAt: number | null,
): RealtimeEventDecision => {
  if (eventUpdatedAt === null) return "unknown";
  if (freshness.lastEventAt !== null && eventUpdatedAt <= freshness.lastEventAt) {
    return "stale";
  }
  if (freshness.restStartedAt !== null && eventUpdatedAt < freshness.restStartedAt) {
    return "older-than-rest";
  }
  return "apply";
};

export const markRealtimeEventApplied = (
  freshness: RealtimeFreshness,
  eventUpdatedAt: number,
) => {
  freshness.lastEventAt = eventUpdatedAt;
};

// Gọi trước khi bắt đầu một lượt REST; dùng giá trị trả về khi áp dụng kết quả.
export const beginRestLoad = () => serverNow();

// Có event mới hơn đã được áp dụng trong lúc lượt REST này đang chạy hay không.
// Khi có, kết quả REST có thể đã cũ hơn state đang hiển thị.
export const wasOvertakenByEvent = (
  freshness: RealtimeFreshness,
  restStartedAt: number,
) => freshness.lastEventAt !== null && freshness.lastEventAt > restStartedAt;

export const markRestApplied = (
  freshness: RealtimeFreshness,
  restStartedAt: number,
) => {
  freshness.restStartedAt = Math.max(freshness.restStartedAt ?? 0, restStartedAt);
};

export const resetRealtimeFreshness = (freshness: RealtimeFreshness) => {
  freshness.lastEventAt = null;
  freshness.restStartedAt = null;
};
