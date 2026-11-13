import React, { Suspense } from 'react'
import { getTransactions, getAllUserTags, TransactionFilterParams } from '@/actions/transactions'
import { getAccounts } from '@/actions/accounts'
import { getCategories } from '@/actions/categories'
import { TransactionsView } from '@/components/transactions/transactions-view'
import { TransactionsSkeleton } from '@/components/transactions/transactions-skeleton'
import { TransactionType } from '@/types/database'
import { getLatestForexRates } from '@/actions/exchange-rate'

export const dynamic = 'force-dynamic'

interface TransactionsPageProps {
  searchParams: Promise<{
    type?: string
    accountId?: string
    categoryId?: string
    tag?: string
    startDate?: string
    endDate?: string
    search?: string
    sort?: string
  }>
}

async function TransactionsContent({ params }: { params: Awaited<TransactionsPageProps['searchParams']> }) {
  const sort =
    params.sort === 'date_desc' ||
    params.sort === 'date_asc' ||
    params.sort === 'amount_desc' ||
    params.sort === 'amount_asc'
      ? params.sort
      : undefined

  const filterParams: TransactionFilterParams = {
    type: params.type as TransactionType | 'all',
    accountId: params.accountId,
    categoryId: params.categoryId,
    tag: params.tag,
    startDate: params.startDate,
    endDate: params.endDate,
    search: params.search,
    sort,
  }

  const [transactions, accounts, categories, availableTags, exchangeRates] = await Promise.all([
    getTransactions(filterParams),
    getAccounts(),
    getCategories(),
    getAllUserTags(),
    getLatestForexRates(),
  ])

  return (
    <TransactionsView
      transactions={transactions}
      accounts={accounts}
      categories={categories}
      availableTags={availableTags}
      activeTag={params.tag}
      exchangeRates={exchangeRates}
    />
  )
}

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const params = await searchParams
  return (
    <Suspense fallback={<TransactionsSkeleton />}>
      <TransactionsContent params={params} />
    </Suspense>
  )
}
