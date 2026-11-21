import React from 'react'
import { notFound } from 'next/navigation'
import { getSavingsGoals } from '@/actions/goals'
import { getAccounts } from '@/actions/accounts'
import { getCategories } from '@/actions/categories'
import { GoalDetailView } from '@/components/goals/goal-detail-view'

export const dynamic = 'force-dynamic'

interface GoalDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function GoalDetailPage({ params }: GoalDetailPageProps) {
  const { id } = await params

  const [goals, accounts, categories] = await Promise.all([
    getSavingsGoals(),
    getAccounts(),
    getCategories(),
  ])

  // getSavingsGoals is already scoped to the signed-in user.
  const goal = goals.find((item) => item.id === id)
  if (!goal) notFound()

  return <GoalDetailView goal={goal} accounts={accounts} categories={categories} />
}
