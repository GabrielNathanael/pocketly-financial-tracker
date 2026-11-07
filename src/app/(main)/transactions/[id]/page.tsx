import React, { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getTransactionById } from '@/actions/transactions'
import { getAccounts } from '@/actions/accounts'
import { getCategories } from '@/actions/categories'
import { TransactionDetailView } from '@/components/transactions/transaction-detail-view'
import { TransactionDetailSkeleton } from '@/components/transactions/transaction-detail-skeleton'

export const dynamic = 'force-dynamic'

interface TransactionDetailPageProps {
  params: Promise<{ id: string }>
}

async function TransactionDetailContent({ id }: { id: string }) {
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

export default async function TransactionDetailPage({ params }: TransactionDetailPageProps) {
  const { id } = await params
  return (
    <Suspense fallback={<TransactionDetailSkeleton />}>
      <TransactionDetailContent id={id} />
    </Suspense>
  )
}
