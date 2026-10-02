// Khung giờ BE cho phép đặt lịch (kiểm định, thu gom, đổi lịch), theo giờ Việt Nam, tính cả hai đầu.
// BE: AppointmentScheduleHelper. Đổi giờ kết thúc ở đây khi BE đổi.
export const SCHEDULE_START_TIME = "08:00";
export const SCHEDULE_END_TIME = "22:00";

export const SCHEDULE_HOURS_MESSAGE = `Chỉ đặt lịch trong khoảng ${SCHEDULE_START_TIME} đến ${SCHEDULE_END_TIME}.`;

const toMinutes = (hhmm: string) => {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(hhmm ?? "").trim());
  if (!match) return Number.NaN;
  return Number(match[1]) * 60 + Number(match[2]);
};

export const isWithinScheduleHours = (hhmm: string) => {
  const minutes = toMinutes(hhmm);
  return (
    Number.isFinite(minutes) &&
    minutes >= toMinutes(SCHEDULE_START_TIME) &&
    minutes <= toMinutes(SCHEDULE_END_TIME)
  );
};
