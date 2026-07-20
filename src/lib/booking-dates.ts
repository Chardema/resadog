const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const dateKeyToLocalDate = (dateKey: string) => {
  if (!DATE_KEY_PATTERN.test(dateKey)) return new Date(Number.NaN);
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
};

export const localDateToDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const addCalendarDays = (dateKey: string, dayCount: number) => {
  const date = dateKeyToLocalDate(dateKey);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + dayCount);
  return localDateToDateKey(date);
};

export const getTodayDateKey = (now = new Date(), timeZone = "Europe/Paris") => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export const getCalendarDayDifference = (startDate: string, endDate: string) => {
  const start = dateKeyToLocalDate(startDate);
  const end = dateKeyToLocalDate(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
};

export const getInclusiveCalendarDayCount = (startDate: string, endDate: string) => {
  if (!startDate || !endDate) return 0;
  const diff = getCalendarDayDifference(startDate, endDate);
  return diff >= 0 ? diff + 1 : 0;
};

export const buildDateRange = (startDate: string, endDate: string) => {
  const dayCount = getCalendarDayDifference(startDate, endDate);
  if (!startDate || !endDate || dayCount < 0) return [];
  return Array.from({ length: dayCount + 1 }, (_, index) => addCalendarDays(startDate, index));
};

export const getNextWeekendRange = (fromDateKey: string) => {
  const fromDate = dateKeyToLocalDate(fromDateKey);
  if (Number.isNaN(fromDate.getTime())) return { startDate: "", endDate: "" };
  const daysUntilSaturday = (6 - fromDate.getDay() + 7) % 7;
  const startDate = addCalendarDays(fromDateKey, daysUntilSaturday);
  return { startDate, endDate: addCalendarDays(startDate, 1) };
};

export const isPositiveSameDayTimeRange = (startTime: string, endTime: string) => {
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) return false;
  return endTime > startTime;
};
