import React from 'react'
import { getSavingsGoals } from '@/actions/goals'
import { getAccounts } from '@/actions/accounts'
import { getCategories } from '@/actions/categories'
import { getLatestForexRates } from '@/actions/exchange-rate'
import { GoalsManager } from '@/components/goals/goals-manager'

export const dynamic = 'force-dynamic'

export default async function GoalsPage() {
  const [savingsGoals, accounts, categories, rates] = await Promise.all([
    getSavingsGoals(),
    getAccounts(),
    getCategories(),
    getLatestForexRates(),
  ])

  return (
    <GoalsManager
      savingsGoals={savingsGoals}
      accounts={accounts}
      categories={categories}
      rates={rates}
    />
  )
}
