import React from 'react'
import { notFound } from 'next/navigation'
import { getDebtById } from '@/actions/debts'
import { getAccounts } from '@/actions/accounts'
import { DebtDetailView } from '@/components/debts/debt-detail-view'

export const dynamic = 'force-dynamic'

interface DebtDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function DebtDetailPage({ params }: DebtDetailPageProps) {
  const { id } = await params
  const [debt, accounts] = await Promise.all([
    getDebtById(id),
    getAccounts(),
  ])

  if (!debt) {
    notFound()
  }

  return <DebtDetailView debt={debt} accounts={accounts} />
}
