import React from 'react'
import { notFound } from 'next/navigation'
import { getDebtById } from '@/actions/debts'
import { getAccounts } from '@/actions/accounts'
import { DebtHistoryView } from '@/components/debts/debt-history-view'

export const dynamic = 'force-dynamic'

interface DebtHistoryPageProps {
  params: Promise<{ id: string }>
}

export default async function DebtHistoryPage({ params }: DebtHistoryPageProps) {
  const { id } = await params
  const [debt, accounts] = await Promise.all([
    getDebtById(id),
    getAccounts(),
  ])

  if (!debt) {
    notFound()
  }

  return <DebtHistoryView debt={debt} accounts={accounts} />
}
