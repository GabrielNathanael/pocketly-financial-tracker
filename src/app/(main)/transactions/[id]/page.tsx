import React from 'react'
import { notFound } from 'next/navigation'
import { getTransactionById } from '@/actions/transactions'
import { getAccounts } from '@/actions/accounts'
import { getCategories } from '@/actions/categories'
import { TransactionDetailView } from '@/components/transactions/transaction-detail-view'

export const dynamic = 'force-dynamic'

interface TransactionDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function TransactionDetailPage({ params }: TransactionDetailPageProps) {
  const { id } = await params
  const [transaction, accounts, categories] = await Promise.all([
    getTransactionById(id),
    getAccounts(),
    getCategories(),
  ])

  if (!transaction) {
    notFound()
  }

  return (
    <TransactionDetailView
      transaction={transaction}
      accounts={accounts}
      categories={categories}
    />
  )
}
