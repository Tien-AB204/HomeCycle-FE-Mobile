// Đồng hồ đếm ngược phải bám giờ server: giờ điện thoại có thể lệch vài phút so với BE,
// trong khi hạn phản hồi/thanh toán chỉ tính bằng phút.
let serverOffsetMs = 0;

// Lấy độ lệch từ header Date của mỗi response. Header chỉ chính xác tới giây và đến chậm
// theo độ trễ mạng nên bỏ qua độ lệch nhỏ để đồng hồ không nhảy qua lại.
export const syncServerClock = (dateHeader: unknown) => {
  const serverMs = Date.parse(String(dateHeader ?? ""));
  if (!Number.isFinite(serverMs)) return;
  const offset = serverMs - Date.now();
  serverOffsetMs = Math.abs(offset) < 2000 ? 0 : offset;
};

export const serverNow = () => Date.now() + serverOffsetMs;

// BE trả thời gian UTC; chuỗi thiếu múi giờ vẫn được hiểu là UTC thay vì giờ máy.
export const parseServerDate = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const withZone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(text) ? text : `${text}Z`;
  const ms = Date.parse(withZone);
  return Number.isFinite(ms) ? ms : null;
};
