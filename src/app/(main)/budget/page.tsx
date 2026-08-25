import React from 'react'
import { getBudgetsWithActuals } from '@/actions/budgets'
import { getCategories } from '@/actions/categories'
import { getLatestExchangeRate } from '@/actions/exchange-rate'
import { BudgetManager } from '@/components/budget/budget-manager'
import { getCurrentPeriodStartDate } from '@/lib/utils/date'

export const dynamic = 'force-dynamic'

interface BudgetPageProps {
  searchParams: Promise<{ period?: string }>
}

export default async function BudgetPage({ searchParams }: BudgetPageProps) {
  const params = await searchParams
  const currentPeriod = params.period || getCurrentPeriodStartDate()

  const [budgets, categories, exchangeRate] = await Promise.all([
    getBudgetsWithActuals(currentPeriod),
    getCategories('expense'),
    getLatestExchangeRate(),
  ])

  return (
    <div className="flex flex-col gap-4">
      <BudgetManager
        budgets={budgets}
        categories={categories}
        exchangeRate={exchangeRate}
        currentPeriod={currentPeriod}
      />
    </div>
  )
}
