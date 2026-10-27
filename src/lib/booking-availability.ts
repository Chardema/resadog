import { extractServiceDetails } from "@/lib/booking-details";
import { isHourlyServiceType } from "@/lib/services";

export type AvailabilityBooking = {
  id: string;
  startDate: Date;
  endDate: Date;
  startTime?: string | null;
  endTime?: string | null;
  serviceType: string;
  specialRequests?: string | null;
};

export type BookingDateSlot = {
  date?: string;
  startTime: string;
  duration: number;
};

export function parseUTCDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

export function toDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function getDateKeysInRange(start: Date, end: Date): string[] {
  const days: string[] = [];
  const currentDate = new Date(start);

  while (currentDate <= end) {
    days.push(toDateKey(currentDate));
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return days;
}

export function getBookingDateKeys(booking: AvailabilityBooking): string[] {
  const details = extractServiceDetails(booking.specialRequests);
  const visitDates = details?.visitSlots
    ?.map((slot) => slot.date)
    .filter((date): date is string => /^\d{4}-\d{2}-\d{2}$/.test(date));

  if (isHourlyServiceType(booking.serviceType) && visitDates?.length) {
    return [...new Set(visitDates)].sort();
  }

  return getDateKeysInRange(booking.startDate, booking.endDate);
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function getSlotDurationFromTimes(startTime?: string | null, endTime?: string | null) {
  if (!startTime || !endTime) return 30;

  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start === null || end === null || end <= start) return 30;

  return end - start;
}

export function getBookingSlotsForDate(
  booking: AvailabilityBooking,
  dateKey: string
): BookingDateSlot[] {
  const details = extractServiceDetails(booking.specialRequests);

  const detailSlots = details?.visitSlots
    ?.filter((slot) => slot.date === dateKey)
    .map((slot) => ({
      date: slot.date,
      startTime: slot.startTime,
      duration: slot.duration,
    })) || [];

  if (detailSlots.length > 0) return detailSlots;

  if (!isHourlyServiceType(booking.serviceType) || !getBookingDateKeys(booking).includes(dateKey)) {
    return [];
  }

  return [{
    date: dateKey,
    startTime: booking.startTime || "09:00",
    duration: getSlotDurationFromTimes(booking.startTime, booking.endTime),
  }];
}

export function getDateRangeBounds(dateKeys: string[]) {
  const sortedDateKeys = [...dateKeys].sort();
  const start = parseUTCDate(sortedDateKeys[0]);
  const end = parseUTCDate(sortedDateKeys[sortedDateKeys.length - 1]);

  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(23, 59, 59, 999);

  return { start, end };
}

export function countBookingsByDate(
  bookings: AvailabilityBooking[],
  allowedDateKeys?: Set<string>
) {
  const counts = new Map<string, number>();

  for (const booking of bookings) {
    for (const dateKey of getBookingDateKeys(booking)) {
      if (allowedDateKeys && !allowedDateKeys.has(dateKey)) continue;
      counts.set(dateKey, (counts.get(dateKey) || 0) + 1);
    }
  }

  return counts;
}

function slotsOverlap(first: BookingDateSlot, second: BookingDateSlot) {
  if (first.date && second.date && first.date !== second.date) return false;

  const firstStart = timeToMinutes(first.startTime);
  const secondStart = timeToMinutes(second.startTime);
  if (firstStart === null || secondStart === null) return false;

  const firstEnd = firstStart + first.duration;
  const secondEnd = secondStart + second.duration;

  return firstStart < secondEnd && secondStart < firstEnd;
}

export function getHourlyBookingConflicts(
  bookings: AvailabilityBooking[],
  requestedSlots: BookingDateSlot[]
) {
  return requestedSlots.filter((requestedSlot) =>
    Boolean(requestedSlot.date) &&
    bookings.some((booking) =>
      getBookingSlotsForDate(booking, requestedSlot.date || "").some((bookingSlot) =>
        slotsOverlap(bookingSlot, requestedSlot)
      )
    )
  );
}
