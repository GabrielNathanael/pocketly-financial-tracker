import React from 'react'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAccounts } from '@/actions/accounts'
import { getCategories, seedUserDefaultCategories } from '@/actions/categories'
import { getTransactions } from '@/actions/transactions'
import { getDebts } from '@/actions/debts'
import { BottomNav } from '@/components/layout/bottom-nav'

export const dynamic = 'force-dynamic'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Ensure default categories seeded for new users
  await seedUserDefaultCategories(user.id)

  const [accounts, categories, transactions, debts] = await Promise.all([
    getAccounts(),
    getCategories(),
    getTransactions({ limit: 50 }),
    getDebts('all', 'all'),
  ])

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#09090B] text-[#0F172A] dark:text-[#F8FAFC] flex flex-col md:pt-14 pb-20 md:pb-10">
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 pt-5 pb-6">
        {children}
      </main>

      <BottomNav
        accounts={accounts}
        categories={categories}
        transactions={transactions}
        debts={debts}
      />
    </div>
  )
}
