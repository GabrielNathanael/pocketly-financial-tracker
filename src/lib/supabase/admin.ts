import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role / secret client for server-only jobs (cron).
 * Bypasses RLS — never import from client components.
 * Supports both the legacy `service_role` JWT and the new
 * `sb_secret_...` key (Supabase deprecates legacy keys end of 2026).
 */
export function createAdminSupabaseClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const serviceRoleKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY belum diatur",
    );
  }
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
