import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getSplitBillById, getSplitBillContacts } from "@/actions/split-bills";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { SplitBillDetailClient } from "@/components/split-bill/split-bill-detail-client";
import { parseSplitBillUiCookie } from "@/lib/utils/split-bill";

export const dynamic = "force-dynamic";

export default async function SplitBillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { id } = await params;

  const [bill, contacts, accounts, categories] = await Promise.all([
    getSplitBillById(id),
    getSplitBillContacts(),
    getAccounts(),
    getCategories("expense"),
  ]);
  if (!bill) notFound();

  // Posisi langkah terakhir (Step 2/3/4) supaya refresh tidak balik ke Step 1.
  const cookieStore = await cookies();
  const initialUi = parseSplitBillUiCookie(
    cookieStore.get(`split-bill-ui-${id}`)?.value,
  );

  return (
    <SplitBillDetailClient
      key={bill.id}
      bill={bill}
      initialContacts={contacts}
      accounts={accounts}
      categories={categories}
      initialUi={initialUi}
    />
  );
}
