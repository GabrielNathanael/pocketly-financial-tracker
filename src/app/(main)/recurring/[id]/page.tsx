import React from 'react'
import { notFound } from 'next/navigation'
import { getRecurringTransactions } from '@/actions/recurring'
import { getAccounts } from '@/actions/accounts'
import { getCategories } from '@/actions/categories'
import { RecurringDetailView } from '@/components/recurring/recurring-detail-view'

export const dynamic = 'force-dynamic'

interface RecurringDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function RecurringDetailPage({
  params,
}: RecurringDetailPageProps) {
  const { id } = await params

  const [recurrings, accounts, categories] = await Promise.all([
    getRecurringTransactions(),
    getAccounts(),
    getCategories(),
  ])

  // getRecurringTransactions is already scoped to the signed-in user.
  const recurring = recurrings.find((item) => item.id === id)
  if (!recurring) notFound()

  return (
    <RecurringDetailView
      recurring={recurring}
      accounts={accounts}
      categories={categories}
    />
  )
}
