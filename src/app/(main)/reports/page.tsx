import React from 'react'
import { getTransactions } from '@/actions/transactions'
import { getCategories } from '@/actions/categories'
import { getLatestForexRates } from '@/actions/exchange-rate'
import { ReportsView } from '@/components/reports/reports-view'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const [transactions, categories, rates] = await Promise.all([
    getTransactions(),
    getCategories(),
    getLatestForexRates(),
  ])

  return (
    <ReportsView
      transactions={transactions}
      categories={categories}
      rates={rates}
    />
  )
}
