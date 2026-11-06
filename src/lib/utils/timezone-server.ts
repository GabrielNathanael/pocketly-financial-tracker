import { cookies } from "next/headers";
import { isValidTimeZone, TIMEZONE_COOKIE_NAME, DEFAULT_TIME_ZONE } from "@/lib/utils/date";

/**
 * Read the user's current IANA timezone from the cookie set by
 * `TimezoneCookieSync` on the client. Falls back to Asia/Jakarta
 * when the cookie is missing or invalid.
 */
export async function getUserTimeZone(): Promise<string> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(TIMEZONE_COOKIE_NAME)?.value;
    if (raw) {
      const decoded = decodeURIComponent(raw);
      if (isValidTimeZone(decoded)) return decoded;
    }
  } catch {
    // Should not fail the request
  }
  return DEFAULT_TIME_ZONE;
}
