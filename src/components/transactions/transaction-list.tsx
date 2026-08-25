'use client'

import React from 'react'
import { EnrichedTransaction } from '@/types/database'
import { TransactionCard } from '@/components/transactions/transaction-card'
import { EmptyState } from '@/components/ui/empty-state'
import { formatLedgerDateHeader } from '@/lib/utils/date'
import { formatCurrency } from '@/lib/utils/currency'
import { useLanguage } from '@/lib/i18n/language-context'
import { useUndo } from '@/lib/context/undo-context'

interface TransactionListProps {
  transactions: EnrichedTransaction[]
  onAddClick?: () => void
}

export function TransactionList({ transactions, onAddClick }: TransactionListProps) {
  const { t, language } = useLanguage()
  const { isPendingDelete } = useUndo()

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

  const groups = new Map<string, EnrichedTransaction[]>()

  for (const tx of visibleTransactions) {
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
          return sum + (t.type === 'income' ? Number(t.amount) : -Number(t.amount))
        }, 0)

        return (
          <div key={dateKey} className="flex flex-col gap-1.5">
            {/* Day Header Row with clean non-repetitive date */}
            <div className="flex items-center justify-between px-1 text-xs">
              <span className="font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider text-[10px]">
                {formatLedgerDateHeader(dateKey, language)}
              </span>
              <span className="font-mono font-bold text-[#64748B] dark:text-[#94A3B8] tnum">
                {dayNet >= 0 ? '+' : ''}{formatCurrency(dayNet, 'IDR')}
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
    </div>
  )
}
