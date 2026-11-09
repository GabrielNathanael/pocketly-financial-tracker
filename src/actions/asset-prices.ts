"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { refreshAssetPrices } from "@/lib/net-worth/prices";

export async function refreshAssetPricesAction() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const admin = createAdminSupabaseClient();
    const result = await refreshAssetPrices(admin);
    revalidatePath("/investments");
    revalidatePath("/net-worth");
    return { success: true, ...result };
  } catch (err) {
    return { error: (err as Error).message };
  }
}
