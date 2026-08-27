import React from 'react'
import { getTransactions, getAllUserTags, TransactionFilterParams } from '@/actions/transactions'
import { getAccounts } from '@/actions/accounts'
import { getCategories } from '@/actions/categories'
import { TransactionsView } from '@/components/transactions/transactions-view'
import { TransactionType } from '@/types/database'

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

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const params = await searchParams

  const filterParams: TransactionFilterParams = {
    type: params.type as TransactionType | 'all',
    accountId: params.accountId,
    categoryId: params.categoryId,
    tag: params.tag,
    startDate: params.startDate,
    endDate: params.endDate,
    search: params.search,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sort: params.sort as any,
  }

  const [transactions, accounts, categories, availableTags] = await Promise.all([
    getTransactions(filterParams),
    getAccounts(),
    getCategories(),
    getAllUserTags(),
  ])

  return (
    <TransactionsView
      transactions={transactions}
      accounts={accounts}
      categories={categories}
      availableTags={availableTags}
      activeTag={params.tag}
    />
  )
}
