'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  History,
} from 'lucide-react'
import type { EnrichedRecurringTransaction, EnrichedTransaction } from '@/types/database'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import { useLanguage } from '@/lib/i18n/language-context'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'

interface RecurringHistoryViewProps {
  recurring: EnrichedRecurringTransaction
  history: EnrichedTransaction[]
}

export function RecurringHistoryView({
  recurring,
  history,
}: RecurringHistoryViewProps) {
  const { t, language } = useLanguage()
  const [displayLimit, setDisplayLimit] = useState(25)

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/recurring/${recurring.id}`}
          className="p-2 rounded-xl bg-surface border border-border text-foreground-secondary hover:text-foreground hover:bg-surface-subtle transition-colors shrink-0"
          aria-label={t.common.back}
          title={t.common.back}
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-1.5">
            <History className="w-4 h-4 text-foreground-secondary shrink-0" />
            {t.recurring.paymentHistory}
          </h1>
          <p className="text-[11px] text-foreground-secondary truncate">
            {recurring.name}
          </p>
        </div>
      </div>

      {/* Payment History */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
            {t.recurring.paymentHistory}
          </h2>
          <span className="text-xs font-mono text-foreground-muted">
            {t.recurring.historyCount.replace('{count}', String(history.length))}
          </span>
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center bg-surface border border-border border-dashed rounded-2xl text-foreground-muted text-xs">
            {t.recurring.noHistory}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2">
              {history.slice(0, displayLimit).map((tx) => {
                const isTxExpense = tx.type === 'expense'
                return (
                  <Link
                    key={tx.id}
                    href={`/transactions/${tx.id}`}
                    className="p-3 rounded-xl bg-surface border border-border hover:border-primary flex items-center gap-3 shadow-2xs group cursor-pointer transition-all"
                  >
                    <div
                      className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform',
                        isTxExpense
                          ? 'bg-destructive-muted text-destructive'
                          : 'bg-success-muted text-success',
                      )}
                    >
                      {isTxExpense ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                          {tx.description || recurring.name}
                        </span>
                        <span
                          className={cn(
                            'text-xs font-mono font-bold shrink-0',
                            isTxExpense ? 'text-destructive' : 'text-success',
                          )}
                        >
                          {isTxExpense ? '-' : '+'}
                          {formatCurrency(Number(tx.amount), tx.currency)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-foreground-secondary">
                        <span className="whitespace-nowrap shrink-0">
                          {formatDate(tx.transaction_date, 'd MMM yyyy', language)}
                        </span>
                        {tx.account && <span className="truncate">• {tx.account.name}</span>}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>

            {displayLimit < history.length && (
              <div className="pt-1 flex flex-col sm:flex-row items-center justify-between gap-2 p-2.5 rounded-xl bg-canvas dark:bg-surface-subtle border border-border text-xs">
                <span className="text-foreground-secondary font-medium text-center sm:text-left text-[11px]">
                  {t.common.showing}{' '}
                  <span className="font-bold text-foreground">
                    {Math.min(displayLimit, history.length)}
                  </span>{' '}
                  / {history.length}
                </span>
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDisplayLimit((prev) => prev + 25)}
                    className="flex-1 sm:flex-initial text-xs font-bold cursor-pointer h-7 px-2.5"
                  >
                    {t.common.loadMore} (+{Math.min(25, history.length - displayLimit)})
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDisplayLimit(history.length)}
                    className="flex-1 sm:flex-initial text-xs text-foreground-secondary hover:text-foreground cursor-pointer h-7 px-2"
                  >
                    {t.common.showAll}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
