import React from 'react'
import { getTransactions } from '@/actions/transactions'
import { getAccounts } from '@/actions/accounts'
import { getCategories } from '@/actions/categories'
import { getLatestForexRates } from '@/actions/exchange-rate'
import { ReportsView } from '@/components/reports/reports-view'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const [transactions, accounts, categories, rates] = await Promise.all([
    getTransactions(),
    getAccounts(),
    getCategories(),
    getLatestForexRates(),
  ])

  return (
    <ReportsView
      transactions={transactions}
      accounts={accounts}
      categories={categories}
      rates={rates}
    />
  )
}
