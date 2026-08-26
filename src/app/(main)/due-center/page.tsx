import React from 'react'
import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAccounts } from '@/actions/accounts'
import { getRecurringTransactions } from '@/actions/recurring'
import { getDebts } from '@/actions/debts'
import { getSavingsGoals } from '@/actions/goals'
import { getLatestExchangeRate } from '@/actions/exchange-rate'
import { DueCenterView } from '@/components/due-center/due-center-view'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Due Dates & Bills | Pocketly',
  description: 'Track upcoming recurring bills, loan installments, and savings milestones',
}

export default async function DueCenterPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [accounts, recurringTransactions, debts, goals, exchangeRate] = await Promise.all([
    getAccounts(),
    getRecurringTransactions(),
    getDebts('all', 'all'),
    getSavingsGoals(),
    getLatestExchangeRate('USD', 'IDR'),
  ])

  return (
    <DueCenterView
      recurringTransactions={recurringTransactions}
      debts={debts}
      goals={goals}
      accounts={accounts}
      exchangeRate={exchangeRate}
    />
  )
}
