import React from 'react'
import { notFound } from 'next/navigation'
import { getCategories } from '@/actions/categories'
import { getCategoryBudgetHistory } from '@/actions/budgets'
import { BudgetHistoryView } from '@/components/budget/budget-history-view'

export const dynamic = 'force-dynamic'

interface CategoryBudgetHistoryPageProps {
  params: Promise<{ categoryId: string }>
}

export default async function CategoryBudgetHistoryPage({ params }: CategoryBudgetHistoryPageProps) {
  const { categoryId } = await params
  const categories = await getCategories('expense')
  const category = categories.find((c) => c.id === categoryId)

  if (!category) {
    notFound()
  }

  const history = await getCategoryBudgetHistory(categoryId, 6)

  return <BudgetHistoryView category={category} history={history} />
}
