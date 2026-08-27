'use client'

import React, { useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { EnrichedTransaction, Account, Category } from '@/types/database'
import { TransactionsHeader } from './transactions-header'
import { TransactionFilters } from './transaction-filters'
import { TransactionList } from './transaction-list'
import { TransactionSkeletonList } from './transaction-skeleton'
import { Hash } from 'lucide-react'

interface TransactionsViewProps {
  transactions: EnrichedTransaction[]
  accounts: Account[]
  categories: Category[]
  availableTags: string[]
  activeTag?: string
}

export function TransactionsView({
  transactions,
  accounts,
  categories,
  availableTags,
  activeTag,
}: TransactionsViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const handleFilterChange = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '' || value === 'all') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`)
    })
  }

  const handleReset = () => {
    startTransition(() => {
      router.replace(pathname)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Dynamic Bilingual Header */}
      <TransactionsHeader count={transactions.length} />

      {/* Filter Bar with Skeleton Feedback Hook */}
      <TransactionFilters
        accounts={accounts}
        categories={categories}
        availableTags={availableTags}
        isPending={isPending}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
      />

      {/* Active Tag Summary Pill */}
      {activeTag && activeTag !== 'all' && (
        <div className="p-3.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-white/10 dark:bg-black/10">
              <Hash className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-70 block">
                Filter Tagar Aktif
              </span>
              <span className="text-sm font-bold">#{activeTag}</span>
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

      {/* Render Skeleton Loader when isPending, otherwise render TransactionList */}
      {isPending ? (
        <TransactionSkeletonList count={6} />
      ) : (
        <TransactionList transactions={transactions} />
      )}
    </div>
  )
}
