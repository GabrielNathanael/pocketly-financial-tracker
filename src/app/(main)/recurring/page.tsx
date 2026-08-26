import React from 'react'
import { getRecurringTransactions } from '@/actions/recurring'
import { getAccounts } from '@/actions/accounts'
import { getCategories } from '@/actions/categories'
import { getLatestForexRates } from '@/actions/exchange-rate'
import { RecurringManager } from '@/components/recurring/recurring-manager'

export const dynamic = 'force-dynamic'

export default async function RecurringPage() {
  const [recurringTransactions, accounts, categories, rates] = await Promise.all([
    getRecurringTransactions(),
    getAccounts(),
    getCategories(),
    getLatestForexRates(),
  ])

  return (
    <RecurringManager
      recurringTransactions={recurringTransactions}
      accounts={accounts}
      categories={categories}
      rates={rates}
    />
  )
}
