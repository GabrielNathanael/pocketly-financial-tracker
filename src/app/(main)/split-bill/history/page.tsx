import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getSplitBills } from "@/actions/split-bills";
import { SplitBillClient } from "@/components/split-bill/split-bill-client";

export const dynamic = "force-dynamic";

export default async function SplitBillHistoryPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const bills = await getSplitBills();

  return <SplitBillClient initialBills={bills} />;
}
