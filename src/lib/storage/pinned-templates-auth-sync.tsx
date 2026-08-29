"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { setPinnedTemplatesScope } from "@/lib/storage/pinned-templates";

/**
 * Keeps the pinned-templates localStorage cache scoped to whichever
 * user is currently logged in. Renders nothing — it only listens.
 *
 * Without this, pinned templates are stored under a single global
 * localStorage key, so on a shared device (e.g. a demo account and a
 * real account both used in the same browser) pins from one account
 * can leak into the other. onAuthStateChange fires for every kind of
 * session change (sign in, sign out, token refresh, account switch),
 * so this works regardless of which of the app's logout buttons was
 * used, or whether the session simply expired.
 */
export function PinnedTemplatesAuthSync() {
  useEffect(() => {
    const supabase = createClient();

    // Set the initial scope from whatever session already exists.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setPinnedTemplatesScope(session?.user?.id ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setPinnedTemplatesScope(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
