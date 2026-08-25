import React from 'react'
import { notFound } from 'next/navigation'
import { getCategories } from '@/actions/categories'
import { getCategoryBudgetHistory } from '@/actions/budgets'
import { BudgetHistoryView } from '@/components/budget/budget-history-view'
import { CurrencyCode } from '@/lib/constants/currencies'

export const dynamic = 'force-dynamic'

interface CategoryBudgetHistoryPageProps {
  params: Promise<{ categoryId: string }>
  searchParams: Promise<{ currency?: CurrencyCode }>
}

export default async function CategoryBudgetHistoryPage({
  params,
  searchParams,
}: CategoryBudgetHistoryPageProps) {
  const { categoryId } = await params
  const sParams = await searchParams
  const currency: CurrencyCode = sParams.currency || 'IDR'

  const categories = await getCategories('expense')
  const category = categories.find((c) => c.id === categoryId)

  if (!category) {
    notFound()
  }

  const history = await getCategoryBudgetHistory(categoryId, currency, 6)

  return <BudgetHistoryView category={category} currency={currency} history={history} />
}
