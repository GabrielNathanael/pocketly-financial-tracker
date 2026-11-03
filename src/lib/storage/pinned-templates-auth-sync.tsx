"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { setPinnedTemplatesScope } from "@/lib/storage/pinned-templates";

/**
 * Keeps the in-memory pinned-template store scoped to the logged-in user.
 * Renders nothing and only listens for authentication changes.
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
