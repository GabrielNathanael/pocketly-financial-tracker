import React from 'react'
import { getTransactions, getAllUserTags, TransactionFilterParams } from '@/actions/transactions'
import { getAccounts } from '@/actions/accounts'
import { getCategories } from '@/actions/categories'
import { TransactionsHeader } from '@/components/transactions/transactions-header'
import { TransactionFilters } from '@/components/transactions/transaction-filters'
import { TransactionList } from '@/components/transactions/transaction-list'
import { TransactionType } from '@/types/database'
import { Hash } from 'lucide-react'

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
    <div className="flex flex-col gap-4">
      {/* Dynamic Bilingual Header */}
      <TransactionsHeader count={transactions.length} />

      {/* URL-Persisted Filter Bar with Tags Support */}
      <TransactionFilters
        accounts={accounts}
        categories={categories}
        availableTags={availableTags}
      />

      {/* Active Tag Summary Pill */}
      {params.tag && params.tag !== 'all' && (
        <div className="p-3.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-white/10 dark:bg-black/10">
              <Hash className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-70 block">
                Filter Tagar Aktif
              </span>
              <span className="text-sm font-bold">#{params.tag}</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-70 block">
              Jumlah Catatan
            </span>
            <span className="text-sm font-mono font-bold">{transactions.length} transaksi</span>
          </div>
        </div>
      )}

      {/* List */}
      <TransactionList transactions={transactions} />
    </div>
  )
}
