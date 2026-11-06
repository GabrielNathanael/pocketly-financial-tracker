'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TIMEZONE_COOKIE_NAME } from '@/lib/utils/date';

/**
 * Keeps the `pocketly-tz` cookie in sync with the device's current
 * IANA timezone so server-side date filtering can convert local
 * calendar dates (YYYY-MM-DD) to correct UTC bounds.
 * Falls back to Asia/Jakarta only when detection fails.
 */
export function TimezoneCookieSync() {
  const router = useRouter();

  useEffect(() => {
    const sync = () => {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (!tz) return;
        const match = document.cookie
          .split('; ')
          .find((c) => c.startsWith(`${TIMEZONE_COOKIE_NAME}=`));
        const current = match
          ? decodeURIComponent(match.slice(TIMEZONE_COOKIE_NAME.length + 1))
          : null;
        if (current !== tz) {
          document.cookie = `${TIMEZONE_COOKIE_NAME}=${encodeURIComponent(tz)}; path=/; max-age=31536000; SameSite=Lax`;
          // Refresh server components so they re-query with the new zone.
          router.refresh();
        }
      } catch {
        // Ignore failures (privacy mode, SSR, etc.)
      }
    };

    sync();
    window.addEventListener('focus', sync);
    window.addEventListener('pageshow', sync);
    // Covers traveling across zones while the tab stays open.
    const interval = window.setInterval(sync, 60000);
    return () => {
      window.removeEventListener('focus', sync);
      window.removeEventListener('pageshow', sync);
      window.clearInterval(interval);
    };
  }, [router]);

  return null;
}
