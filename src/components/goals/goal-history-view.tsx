'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { EnrichedSavingsGoal, EnrichedSavingsGoalDeposit } from '@/types/database'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import { useLanguage } from '@/lib/i18n/language-context'
import { cn } from '@/lib/utils/cn'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, History } from 'lucide-react'

interface GoalHistoryViewProps {
  goal: EnrichedSavingsGoal
}

export function GoalHistoryView({ goal }: GoalHistoryViewProps) {
  const { t, language } = useLanguage()
  const [selectedDeposit, setSelectedDeposit] = useState<EnrichedSavingsGoalDeposit | null>(null)
  const [displayLimit, setDisplayLimit] = useState(25)

  const deposits = goal.deposits || []

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <Link
          href={`/goals/${goal.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground-secondary hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t.goals.backToGoal}
        </Link>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2 min-w-0">
            <History className="w-4 h-4 text-foreground-secondary shrink-0" />
            <span className="truncate">{t.goals.historyTitleLabel}</span>
          </h1>
          <span className="text-xs font-mono text-foreground-muted shrink-0">
            {deposits.length} {t.goals.historyEntriesLabel}
          </span>
        </div>
        <p className="text-[11px] text-foreground-secondary truncate">{goal.name}</p>
      </div>

      {/* Deposit & Withdrawal History */}
      {deposits.length === 0 ? (
        <div className="p-6 rounded-xl border border-dashed border-border text-center text-xs text-foreground-muted">
          {t.goals.emptyHistoryLabel}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2">
            {deposits.slice(0, displayLimit).map((dep) => {
              const isDeposit = dep.type === 'deposit'
              return (
                <div
                  key={dep.id}
                  onClick={() => setSelectedDeposit(dep)}
                  className="p-3 rounded-xl bg-surface border border-border hover:border-border-strong flex items-center gap-3 shadow-2xs group transition-all cursor-pointer"
                >
                  <div
                    className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform',
                      isDeposit
                        ? 'bg-success-muted text-success'
                        : 'bg-destructive-muted text-destructive',
                    )}
                  >
                    {isDeposit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground truncate group-hover:text-success transition-colors">
                        {isDeposit ? t.goals.depositTypeLabel : t.goals.withdrawalTypeLabel}
                        {dep.account && ` • ${dep.account.name}`}
                      </span>
                      <span
                        className={cn(
                          'text-xs font-mono font-bold shrink-0',
                          isDeposit ? 'text-success' : 'text-destructive',
                        )}
                      >
                        {isDeposit ? '+' : '-'}
                        {formatCurrency(Number(dep.amount), dep.currency)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-foreground-secondary">
                      <span className="whitespace-nowrap shrink-0">
                        {formatDate(dep.deposit_date, 'd MMM yyyy', language)}
                      </span>
                      {dep.notes && <span className="truncate">({dep.notes})</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination controls */}
          {displayLimit < deposits.length && (
            <div className="pt-1 flex flex-col sm:flex-row items-center justify-between gap-2 p-2.5 rounded-xl bg-canvas dark:bg-surface-subtle border border-border text-xs">
              <span className="text-foreground-secondary font-medium text-center sm:text-left text-[11px]">
                {t.common.showing}{' '}
                <span className="font-bold text-foreground">
                  {Math.min(displayLimit, deposits.length)}
                </span>{' '}
                / {deposits.length}
              </span>
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDisplayLimit((prev) => prev + 25)}
                  className="flex-1 sm:flex-initial text-xs font-bold cursor-pointer h-7 px-2.5"
                >
                  {t.common.loadMore} (+{Math.min(25, deposits.length - displayLimit)})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDisplayLimit(deposits.length)}
                  className="flex-1 sm:flex-initial text-xs text-foreground-secondary hover:text-foreground cursor-pointer h-7 px-2"
                >
                  {t.common.showAll}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Deposit Slip Sub-Modal */}
      {selectedDeposit && (
        <Modal
          isOpen={!!selectedDeposit}
          onClose={() => setSelectedDeposit(null)}
          title={
            selectedDeposit.type === 'deposit'
              ? t.goals.depositReceiptTitle
              : t.goals.withdrawalReceiptTitle
          }
          description={`${goal.name} • ${formatDate(selectedDeposit.deposit_date, 'd MMMM yyyy', language)}`}
          maxWidth="sm"
        >
          <div className="flex flex-col gap-4 pt-1">
            {/* Amount Badge Card */}
            <div className="p-4 rounded-xl bg-canvas dark:bg-surface-subtle border border-border flex flex-col items-center justify-center text-center">
              <span className="text-[10px] uppercase font-bold tracking-wider text-foreground-secondary">
                {selectedDeposit.type === 'deposit'
                  ? t.goals.allocatedFundsAmountLabel
                  : t.goals.withdrawnFundsAmountLabel}
              </span>
              <span
                className={cn(
                  'text-2xl font-black font-mono mt-1',
                  selectedDeposit.type === 'deposit' ? 'text-success' : 'text-destructive',
                )}
              >
                {selectedDeposit.type === 'deposit' ? '+' : '-'}
                {formatCurrency(Number(selectedDeposit.amount), selectedDeposit.currency)}
              </span>
            </div>

            {/* Info Grid */}
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface border border-border">
                <span className="text-foreground-secondary">{t.goals.receiptGoalLabel}</span>
                <span className="font-bold text-foreground">{goal.name}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface border border-border">
                <span className="text-foreground-secondary">{t.goals.sourceAccountShortLabel}</span>
                <span className="font-bold text-foreground">
                  {selectedDeposit.account?.name || '-'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface border border-border">
                <span className="text-foreground-secondary">{t.goals.receiptDateLabel}</span>
                <span className="font-mono font-bold text-foreground">
                  {formatDate(selectedDeposit.deposit_date, 'd MMM yyyy, HH:mm', language)}
                </span>
              </div>
              {selectedDeposit.notes && (
                <div className="flex flex-col gap-1 p-2.5 rounded-lg bg-surface border border-border">
                  <span className="text-foreground-secondary">{t.goals.receiptNotesLabel}</span>
                  <span className="font-medium text-foreground">{selectedDeposit.notes}</span>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDeposit(null)}
              className="w-full mt-2 cursor-pointer"
            >
              {t.common.close}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
