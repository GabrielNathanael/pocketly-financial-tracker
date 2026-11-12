import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getSplitBills } from "@/actions/split-bills";
import { getSplitBillContacts } from "@/actions/split-bills";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { SplitBillHomeClient } from "@/components/split-bill/split-bill-home-client";
import { SplitBillDetailClient } from "@/components/split-bill/split-bill-detail-client";
import { ManualDraftLoading } from "@/components/split-bill/manual-draft-loading";

export const dynamic = "force-dynamic";

export default async function SplitBillPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const mode =
    params?.mode === "scan" || params?.mode === "manual" ? params.mode : undefined;

  // Mode manual -> langsung tampilkan halaman transisi (skeleton step 1)
  // lalu buat draft & redirect ke /split-bill/{id} di client, supaya tidak
  // ada spinner menunggu di halaman awal / tampilan kosong.
  if (mode === "manual") {
    return <ManualDraftLoading />;
  }

  // Mode scan -> langsung buka flow-nya (bukan landing)
  if (mode === "scan") {
    const [contacts, accounts, categories] = await Promise.all([
      getSplitBillContacts(),
      getAccounts(),
      getCategories("expense"),
    ]);
    return (
      <SplitBillDetailClient
        bill={null}
        initialContacts={contacts}
        accounts={accounts}
        categories={categories}
        initialMode={mode}
      />
    );
  }

  const bills = await getSplitBills();

  return <SplitBillHomeClient bills={bills} />;
}
