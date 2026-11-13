import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  subMonths,
  isToday,
  isYesterday,
} from "date-fns";
import { id as idLocale, enUS as enLocale } from "date-fns/locale";

export function formatDate(
  dateInput: string | Date,
  formatStr: string = "dd MMM yyyy",
  lang: "id" | "en" = "id",
): string {
  try {
    const date =
      typeof dateInput === "string" ? parseISO(dateInput) : dateInput;
    return format(date, formatStr, {
      locale: lang === "en" ? enLocale : idLocale,
    });
  } catch {
    return String(dateInput);
  }
}

export function formatRelativeDate(
  dateInput: string | Date,
  lang: "id" | "en" = "id",
): string {
  try {
    const date =
      typeof dateInput === "string" ? parseISO(dateInput) : dateInput;
    if (isToday(date)) return lang === "en" ? "Today" : "Hari Ini";
    if (isYesterday(date)) return lang === "en" ? "Yesterday" : "Kemarin";
    return format(date, "EEEE", {
      locale: lang === "en" ? enLocale : idLocale,
    });
  } catch {
    return String(dateInput);
  }
}

export function formatLedgerDateHeader(
  dateInput: string | Date,
  lang: "id" | "en" = "id",
): string {
  try {
    const date =
      typeof dateInput === "string" ? parseISO(dateInput) : dateInput;
    const selectedLocale = lang === "en" ? enLocale : idLocale;

    if (isToday(date)) {
      const prefix = lang === "en" ? "Today" : "Hari Ini";
      const formatted = format(
        date,
        lang === "en" ? "MMMM d, yyyy" : "d MMMM yyyy",
        { locale: selectedLocale },
      );
      return `${prefix} • ${formatted}`;
    }

    if (isYesterday(date)) {
      const prefix = lang === "en" ? "Yesterday" : "Kemarin";
      const formatted = format(
        date,
        lang === "en" ? "MMMM d, yyyy" : "d MMMM yyyy",
        { locale: selectedLocale },
      );
      return `${prefix} • ${formatted}`;
    }

    // Single clean non-repetitive date: e.g. "Kamis, 20 Agustus 2026"
    return format(
      date,
      lang === "en" ? "EEEE, MMMM d, yyyy" : "EEEE, d MMMM yyyy",
      { locale: selectedLocale },
    );
  } catch {
    return String(dateInput);
  }
}

/**
 * Timezone helpers: convert a calendar date (YYYY-MM-DD) in a given IANA
 * timezone to UTC instants. This keeps server-side filtering consistent
 * with what the client sees on the device, regardless of where the server
 * itself runs (e.g. UTC on Vercel).
 */

export const TIMEZONE_COOKIE_NAME = "pocketly-tz";
export const DEFAULT_TIME_ZONE = "Asia/Jakarta";

export function isValidTimeZone(timeZone?: string | null): boolean {
  if (!timeZone || typeof timeZone !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/** Offset of `timeZone` ahead of UTC (in ms) at the given instant. */
export function getTimeZoneOffsetMs(timeZone: string, date: Date): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const map: Record<string, string> = {};
    for (const p of parts) map[p.type] = p.value;
    let hour = Number(map.hour);
    if (hour === 24) hour = 0;
    const wallAsUtc = Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      hour,
      Number(map.minute),
      Number(map.second),
    );
    return wallAsUtc - new Date(date.getTime()).setMilliseconds(0);
  } catch {
    return 0;
  }
}

/**
 * Convert YYYY-MM-DD (+ time) in `timeZone` to a UTC ISO string.
 * Falls back to treating the date as UTC midnight if invalid.
 */
export function zonedDateToUtc(
  dateStr: string,
  timeZone: string = "Asia/Jakarta",
  hours = 0,
  minutes = 0,
  seconds = 0,
): string {
  const fallback = `${dateStr}T00:00:00.000Z`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr ?? "")) return fallback;
  const tz = isValidTimeZone(timeZone) ? timeZone : "Asia/Jakarta";
  const [year, month, day] = dateStr.split("-").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hours, minutes, seconds);
  const offset = getTimeZoneOffsetMs(tz, new Date(utcGuess));
  return new Date(utcGuess - offset).toISOString();
}

function nextDayDateString(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
}

/**
 * Bounds for a local calendar date range in `timeZone`.
 * Returns an exclusive end (next local midnight) so callers can use `lt`
 * instead of fragile `23:59:59.999` inclusive bounds.
 */
export function getLocalDateRangeBoundsUTC(
  startDate: string,
  endDate: string,
  timeZone: string = "Asia/Jakarta",
): { startUtc: string; endUtcExclusive: string } {
  const tz = isValidTimeZone(timeZone) ? timeZone : "Asia/Jakarta";
  const startUtc = startDate
    ? zonedDateToUtc(startDate, tz, 0, 0, 0)
    : new Date(0).toISOString();
  const endUtcExclusive = endDate
    ? zonedDateToUtc(nextDayDateString(endDate), tz, 0, 0, 0)
    : new Date(8640000000000000).toISOString();
  return { startUtc, endUtcExclusive };
}

/** Start/end YYYY-MM-DD strings for the current month in `timeZone`. */
export function getCurrentMonthDateStrings(
  timeZone: string = "Asia/Jakarta",
  now: Date = new Date(),
): { startDate: string; endDate: string } {
  const tz = isValidTimeZone(timeZone) ? timeZone : "Asia/Jakarta";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const year = map.year;
  const month = map.month;
  const daysInMonth = new Date(
    Date.UTC(Number(year), Number(month), 0),
  ).getUTCDate();
  const startDate = `${year}-${month}-01`;
  const endDate = `${year}-${month}-${String(daysInMonth).padStart(2, "0")}`;
  return { startDate, endDate };
}

export function getCurrentPeriodStartDate(
  timeZone: string = "Asia/Jakarta",
): string {
  // Month string is a pure calendar value, e.g. "2026-11-01".
  // Derive it in the user's zone so a server in UTC does not pick the
  // wrong month during the early-morning WIB window.
  const tz = isValidTimeZone(timeZone) ? timeZone : "Asia/Jakarta";
  return getCurrentMonthDateStrings(tz).startDate;
}

export function getMonthPeriod(
  date: Date = new Date(),
  lang: "id" | "en" = "id",
): { periodStart: string; periodEnd: string; label: string } {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return {
    periodStart: format(start, "yyyy-MM-01"),
    periodEnd: format(end, "yyyy-MM-dd"),
    label: format(date, "MMMM yyyy", {
      locale: lang === "en" ? enLocale : idLocale,
    }),
  };
}

/** YYYY-MM-DD string for `date` as seen in `timeZone`. */
export function getZonedDateString(
  date: Date = new Date(),
  timeZone: string = "Asia/Jakarta",
): string {
  const tz = isValidTimeZone(timeZone) ? timeZone : "Asia/Jakarta";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return `${map.year}-${map.month}-${map.day}`;
}

/** Today's date string (YYYY-MM-DD) in `timeZone`. */
export function getTodayDateStringInTimeZone(
  timeZone: string = "Asia/Jakarta",
): string {
  return getZonedDateString(new Date(), timeZone);
}

export function getPreviousMonths(
  count: number = 6,
  lang: "id" | "en" = "id",
  timeZone?: string,
): Array<{ periodStart: string; label: string }> {
  if (!timeZone) {
    const months = [];
    const now = new Date();
    for (let i = 0; i < count; i++) {
      const d = subMonths(now, i);
      months.push({
        periodStart: format(startOfMonth(d), "yyyy-MM-01"),
        label: format(d, "MMM yyyy", {
          locale: lang === "en" ? enLocale : idLocale,
        }),
      });
    }
    return months;
  }
  const tz = isValidTimeZone(timeZone) ? timeZone : "Asia/Jakarta";
  const nowParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const nowMap: Record<string, string> = {};
  for (const p of nowParts) nowMap[p.type] = p.value;
  const nowIndex = Number(nowMap.year) * 12 + (Number(nowMap.month) - 1);
  const months: Array<{ periodStart: string; label: string }> = [];
  for (let i = 0; i < count; i++) {
    const idx = nowIndex - i;
    const year = Math.floor(idx / 12);
    const month = (idx % 12) + 1;
    const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const label = format(
      new Date(Date.UTC(year, month - 1, 1)),
      "MMM yyyy",
      { locale: lang === "en" ? enLocale : idLocale },
    );
    months.push({ periodStart, label });
  }
  return months;
}

export function getNextMonth(periodStart: string): string {
  const [year, month] = periodStart.split("-").map(Number);
  const idx = year * 12 + (month - 1) + 1;
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

export function getPrevMonth(periodStart: string): string {
  const [year, month] = periodStart.split("-").map(Number);
  const idx = year * 12 + (month - 1) - 1;
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

/** Last day of month as YYYY-MM-DD for a periodStart "YYYY-MM-01". */
export function getEndDateStringForPeriod(periodStart: string): string {
  const [year, month] = periodStart.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
}

/**
 * Combine a date string (YYYY-MM-DD) with current local time → proper UTC ISO string
 * Fixes timezone bug where toTimeString() + .000Z suffix causes 7-hour offset
 */
export function localDateToISO(dateStr: string): string {
  const now = new Date();
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(
    year,
    month - 1,
    day,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
  ).toISOString();
}

export function normalizeISODate(
  dateInput?: string,
  timeZone: string = "Asia/Jakarta",
): string {
  if (!dateInput) return new Date().toISOString();

  const trimmed = dateInput.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return zonedDateToUtc(trimmed, timeZone, 12, 0, 0);
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return new Date().toISOString();
}

/**
 * Convert a Date or ISO timestamp string to a "yyyy-MM-dd" string,
 * using the device's local timezone (not UTC).
 * Use this everywhere instead of .toISOString().split("T")[0] or .split("T")[0]
 * on a raw UTC timestamp — those silently use UTC and cause off-by-one-day bugs.
 */
export function getLocalDateString(
  dateInput: Date | string = new Date(),
): string {
  const date = typeof dateInput === "string" ? parseISO(dateInput) : dateInput;
  return format(date, "yyyy-MM-dd");
}
