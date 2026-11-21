import React from 'react'
import { notFound } from 'next/navigation'
import {
  getRecurringTransactions,
  getRecurringPaymentHistory,
} from '@/actions/recurring'
import { RecurringHistoryView } from '@/components/recurring/recurring-history-view'
import type { EnrichedTransaction } from '@/types/database'

export const dynamic = 'force-dynamic'

interface RecurringHistoryPageProps {
  params: Promise<{ id: string }>
}

export default async function RecurringHistoryPage({
  params,
}: RecurringHistoryPageProps) {
  const { id } = await params

  // getRecurringTransactions is already scoped to the signed-in user.
  const recurrings = await getRecurringTransactions()
  const recurring = recurrings.find((item) => item.id === id)
  if (!recurring) notFound()

  const history = await getRecurringPaymentHistory(
    recurring.name,
    recurring.category_id || undefined,
    recurring.account_id,
  )

  return (
    <RecurringHistoryView
      recurring={recurring}
      history={history as EnrichedTransaction[]}
    />
  )
}
