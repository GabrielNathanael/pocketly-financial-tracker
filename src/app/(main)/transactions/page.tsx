import React from 'react'
import { getTransactions, TransactionFilterParams } from '@/actions/transactions'
import { getAccounts } from '@/actions/accounts'
import { getCategories } from '@/actions/categories'
import { TransactionFilters } from '@/components/transactions/transaction-filters'
import { TransactionList } from '@/components/transactions/transaction-list'
import { TransactionType } from '@/types/database'

export const dynamic = 'force-dynamic'

interface TransactionsPageProps {
  searchParams: Promise<{
    type?: string
    account?: string
    category?: string
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
    accountId: params.account,
    categoryId: params.category,
    startDate: params.startDate,
    endDate: params.endDate,
    search: params.search,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sort: params.sort as any,
  }

  const [transactions, accounts, categories] = await Promise.all([
    getTransactions(filterParams),
    getAccounts(),
    getCategories(),
  ])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
            Buku Kas Transaksi
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-mono">
            {transactions.length} catatan transaksi sesuai filter
          </p>
        </div>
      </div>

      {/* URL-Persisted Filter Bar */}
      <TransactionFilters accounts={accounts} categories={categories} />

      {/* List */}
      <TransactionList transactions={transactions} />
    </div>
  )
}
