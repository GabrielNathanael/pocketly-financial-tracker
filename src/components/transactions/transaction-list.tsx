'use client'

import React, { useState } from 'react'
import { EnrichedTransaction } from '@/types/database'
import { TransactionCard } from '@/components/transactions/transaction-card'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { formatLedgerDateHeader } from '@/lib/utils/date'
import { formatCurrency, convertAmount } from '@/lib/utils/currency'
import { usePreferredCurrency } from '@/lib/storage/preferred-currency'
import { useLanguage } from '@/lib/i18n/language-context'
import { useUndo } from '@/lib/context/undo-context'

interface TransactionListProps {
  transactions: EnrichedTransaction[]
  onAddClick?: () => void
}

const BATCH_SIZE = 50

export function TransactionList({ transactions, onAddClick }: TransactionListProps) {
  const { t, language } = useLanguage()
  const { isPendingDelete } = useUndo()
  const displayCurrency = usePreferredCurrency()
  const [displayLimit, setDisplayLimit] = useState(BATCH_SIZE)

  const visibleTransactions = transactions.filter((tx) => !isPendingDelete(tx.id))

  if (visibleTransactions.length === 0) {
    return (
      <EmptyState
        icon="Receipt"
        title={t.transactions.emptyTitle}
        description={t.transactions.emptyDesc}
        actionLabel={onAddClick ? t.transactions.addBtn : undefined}
        onAction={onAddClick}
      />
    )
  }

  const paginatedTransactions = visibleTransactions.slice(0, displayLimit)
  const hasMore = displayLimit < visibleTransactions.length

  const groups = new Map<string, EnrichedTransaction[]>()

  for (const tx of paginatedTransactions) {
    const dateKey = tx.transaction_date.split('T')[0]
    const list = groups.get(dateKey) || []
    list.push(tx)
    groups.set(dateKey, list)
  }

  const sortedDates = Array.from(groups.keys()).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  )

  return (
    <div className="flex flex-col gap-4">
      {sortedDates.map((dateKey) => {
        const dayTxs = groups.get(dateKey) || []
        const dayNet = dayTxs.reduce((sum, t) => {
          const amtConverted = convertAmount(Number(t.amount), t.currency, displayCurrency)
          return sum + (t.type === 'income' ? amtConverted : -amtConverted)
        }, 0)

        return (
          <div key={dateKey} className="flex flex-col gap-1.5">
            {/* Day Header Row with clean non-repetitive date */}
            <div className="flex items-center justify-between px-1 text-xs">
              <span className="font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider text-[10px]">
                {formatLedgerDateHeader(dateKey, language)}
              </span>
              <span className="font-mono font-bold text-[#64748B] dark:text-[#94A3B8] tnum">
                {dayNet >= 0 ? '+' : ''}{formatCurrency(dayNet, displayCurrency)}
              </span>
            </div>

            {/* Day Transactions */}
            <div className="flex flex-col gap-1.5">
              {dayTxs.map((tx) => (
                <TransactionCard key={tx.id} transaction={tx} />
              ))}
            </div>
          </div>
        )
      })}

      {/* Pagination Load More Controls */}
      {hasMore && (
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs">
          <span className="text-[#64748B] dark:text-[#94A3B8] font-medium text-center sm:text-left">
            {t.common.showing} <span className="font-bold text-[#0F172A] dark:text-[#FAFAFA]">{paginatedTransactions.length}</span> / {visibleTransactions.length}
          </span>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDisplayLimit((prev) => prev + BATCH_SIZE)}
              className="flex-1 sm:flex-initial text-xs font-bold cursor-pointer"
            >
              {t.common.loadMore} (+{Math.min(BATCH_SIZE, visibleTransactions.length - paginatedTransactions.length)})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDisplayLimit(visibleTransactions.length)}
              className="flex-1 sm:flex-initial text-xs text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] cursor-pointer"
            >
              {t.common.showAll}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
