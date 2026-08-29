import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
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

export function getCurrentPeriodStartDate(): string {
  return format(startOfMonth(new Date()), "yyyy-MM-01");
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

export function getPreviousMonths(
  count: number = 6,
  lang: "id" | "en" = "id",
): Array<{ periodStart: string; label: string }> {
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

export function getNextMonth(periodStart: string): string {
  const d = parseISO(periodStart);
  return format(startOfMonth(addMonths(d, 1)), "yyyy-MM-01");
}

export function getPrevMonth(periodStart: string): string {
  const d = parseISO(periodStart);
  return format(startOfMonth(subMonths(d, 1)), "yyyy-MM-01");
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
