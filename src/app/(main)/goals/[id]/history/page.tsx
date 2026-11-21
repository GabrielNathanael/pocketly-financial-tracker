import React from 'react'
import { notFound } from 'next/navigation'
import { getSavingsGoals } from '@/actions/goals'
import { GoalHistoryView } from '@/components/goals/goal-history-view'

export const dynamic = 'force-dynamic'

interface GoalHistoryPageProps {
  params: Promise<{ id: string }>
}

export default async function GoalHistoryPage({ params }: GoalHistoryPageProps) {
  const { id } = await params

  // getSavingsGoals is already scoped to the signed-in user and returns
  // deposit history joined and sorted descending.
  const goals = await getSavingsGoals()
  const goal = goals.find((item) => item.id === id)
  if (!goal) notFound()

  return <GoalHistoryView goal={goal} />
}
