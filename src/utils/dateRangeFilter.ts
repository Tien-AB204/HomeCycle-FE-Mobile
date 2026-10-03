// Bộ lọc thời gian dùng chung cho các màn quản lý (lịch hẹn nhìn về phía trước,
// đơn hàng nhìn về phía sau). Tính theo ngày giờ địa phương của máy.

export type DateRangeOption<Key extends string> = {
  key: Key;
  label: string;
};

export type AppointmentDateRange = "all" | "today" | "next7" | "next30" | "past";
export type OrderDateRange = "all" | "today" | "last7" | "last30" | "last90";

export const APPOINTMENT_DATE_RANGE_OPTIONS: DateRangeOption<AppointmentDateRange>[] = [
  { key: "all", label: "Tất cả" },
  { key: "today", label: "Hôm nay" },
  { key: "next7", label: "7 ngày tới" },
  { key: "next30", label: "30 ngày tới" },
  { key: "past", label: "Đã qua" },
];

export const ORDER_DATE_RANGE_OPTIONS: DateRangeOption<OrderDateRange>[] = [
  { key: "all", label: "Tất cả" },
  { key: "today", label: "Hôm nay" },
  { key: "last7", label: "7 ngày qua" },
  { key: "last30", label: "30 ngày qua" },
  { key: "last90", label: "3 tháng qua" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

export const getDateRangeLabel = <Key extends string>(
  options: DateRangeOption<Key>[],
  key: Key,
) => options.find((option) => option.key === key)?.label ?? "";

// "Hôm nay" và "N ngày tới" tính từ đầu ngày hôm nay, nên lịch hẹn sáng nay
// vẫn nằm trong "Hôm nay" dù giờ hẹn đã qua.
export const matchesAppointmentDateRange = (date: Date | null, range: AppointmentDateRange) => {
  if (range === "all") return true;
  if (!date) return false;

  const time = date.getTime();
  const todayStart = startOfToday();
  if (range === "today") return time >= todayStart && time < todayStart + DAY_MS;
  if (range === "next7") return time >= todayStart && time < todayStart + 7 * DAY_MS;
  if (range === "next30") return time >= todayStart && time < todayStart + 30 * DAY_MS;
  return time < todayStart;
};

export const matchesOrderDateRange = (date: Date | null, range: OrderDateRange) => {
  if (range === "all") return true;
  if (!date) return false;

  const time = date.getTime();
  const tomorrowStart = startOfToday() + DAY_MS;
  const days = range === "today" ? 1 : range === "last7" ? 7 : range === "last30" ? 30 : 90;
  return time >= tomorrowStart - days * DAY_MS && time < tomorrowStart;
};
