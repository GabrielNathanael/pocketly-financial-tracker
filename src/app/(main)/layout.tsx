import React from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAccounts } from "@/actions/accounts";
import { getCategories, seedUserDefaultCategories } from "@/actions/categories";
import {
  getTransactions,
  getMostUsedCategoriesByAccount,
} from "@/actions/transactions";
import { getDebts } from "@/actions/debts";
import { BottomNav } from "@/components/layout/bottom-nav";
import { DemoNoticeBanner } from "@/components/dashboard/demo-notice-banner";

export const dynamic = "force-dynamic";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Ensure default categories seeded for new users
  await seedUserDefaultCategories(user.id);

  const [accounts, categories, transactions, debts, mostUsedCategoryByAccount] =
    await Promise.all([
      getAccounts(),
      getCategories(),
      getTransactions({ limit: 50 }),
      getDebts("all", "all"),
      getMostUsedCategoriesByAccount(),
    ]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#09090B] text-[#0F172A] dark:text-[#F8FAFC] flex flex-col pb-20 md:pb-10">
      <DemoNoticeBanner userEmail={user.email} />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 md:px-8 pt-5 md:pt-7 pb-6 md:pl-72">
        {children}
      </main>

      <BottomNav
        accounts={accounts}
        categories={categories}
        transactions={transactions}
        debts={debts}
        mostUsedCategoryByAccount={mostUsedCategoryByAccount}
      />
    </div>
  );
}
