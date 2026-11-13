'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { Button } from '@/components/ui/button'
import { EnrichedRecurringTransaction, EnrichedTransaction } from '@/types/database'
import { formatCurrency, ForexRatesMap } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import { useLanguage } from '@/lib/i18n/language-context'
import { getRecurringPaymentHistory } from '@/actions/recurring'
import { cn } from '@/lib/utils/cn'

import {
  Calendar,
  Edit2,
  Trash2,
  PauseCircle,
  PlayCircle,
  CheckCircle2,
  Wallet,
  History,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
} from 'lucide-react'

interface RecurringDetailModalProps {
  isOpen: boolean
  onClose: () => void
  recurring: EnrichedRecurringTransaction | null
  rates?: ForexRatesMap
  onPayNow: (recurring: EnrichedRecurringTransaction) => void
  onEdit: (recurring: EnrichedRecurringTransaction) => void
  onToggleActive: (recurring: EnrichedRecurringTransaction) => void
  onDelete: (id: string) => void
  isProcessing?: boolean
}

export function RecurringDetailModal({
  isOpen,
  onClose,
  recurring,
  onPayNow,
  onEdit,
  onToggleActive,
  onDelete,
  isProcessing = false,
}: RecurringDetailModalProps) {
  const router = useRouter()
  const { t, language } = useLanguage()
  const [history, setHistory] = useState<EnrichedTransaction[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [displayLimit, setDisplayLimit] = useState(25)

  useEffect(() => {
    if (!isOpen || !recurring) return
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setIsLoadingHistory(true)
    })
    getRecurringPaymentHistory(recurring.name, recurring.category_id || undefined, recurring.account_id)
      .then((data) => {
        if (!cancelled) setHistory(data as EnrichedTransaction[])
      })
      .catch(() => {
        if (!cancelled) setHistory([])
      })
      .finally(() => {
        if (!cancelled) setIsLoadingHistory(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, recurring])

  if (!recurring) return null

  const isExpense = recurring.type === 'expense'
  const isPaused = !recurring.is_active
  const amount = Number(recurring.amount)

  // Due-date indicators intentionally not shown in this modal header.

  // Calculate annual commitment projection
  let annualMultiplier = 12
  if (recurring.frequency === 'daily') annualMultiplier = 365
  else if (recurring.frequency === 'weekly') annualMultiplier = 52
  else if (recurring.frequency === 'yearly') annualMultiplier = 1

  const annualTotal = amount * annualMultiplier

  const freqLabel =
    recurring.frequency === 'daily'
      ? t.recurring.frequencyDaily
      : recurring.frequency === 'weekly'
        ? t.recurring.frequencyWeekly
        : recurring.frequency === 'yearly'
          ? t.recurring.frequencyYearly
          : t.recurring.frequencyMonthly

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={recurring.name}
      description={recurring.notes || t.recurring.modalDescription}
      maxWidth="lg"
    >
      <div className="flex flex-col gap-5 pt-1">
        {/* Header Hero Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-canvas dark:bg-surface-subtle border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center shrink-0 shadow-xs">
              <DynamicIcon
                name={recurring.category?.icon || (isExpense ? 'CreditCard' : 'Wallet')}
                className="w-6 h-6 text-foreground"
              />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-foreground truncate">
                  {recurring.name}
                </h2>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1',
                    isPaused
                      ? 'bg-warning-muted text-warning'
                      : 'bg-success-muted text-success'
                  )}
                >
                  {isPaused ? (
                    <>
                      <PauseCircle className="w-3 h-3" />
                      <span>{t.recurring.statusPaused}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{t.recurring.statusActive}</span>
                    </>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-foreground-secondary mt-0.5">
                <span>{freqLabel}</span>
                {recurring.category && <span>• {recurring.category.name}</span>}
              </div>
            </div>
          </div>

          <div className="flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-center shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-border">
            <span
              className={cn(
                'text-lg sm:text-2xl font-black font-mono tracking-tight',
                isExpense ? 'text-destructive' : 'text-success'
              )}
            >
              {isExpense ? '-' : '+'}
              {formatCurrency(amount, recurring.currency)}
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-foreground-muted">
              / {freqLabel.toLowerCase()}
            </span>
          </div>
        </div>

        {/* Schedule & Timing Stack (Vertical) */}
        <div className="flex flex-col gap-2.5">
          <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-secondary">
              {t.recurring.nextDueDate}
            </span>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-foreground-secondary" />
              <span className="text-xs sm:text-sm font-bold font-mono text-foreground">
                {formatDate(recurring.next_due_date, 'd MMM yyyy', language)}
              </span>
            </div>
          </div>

          <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-secondary">
              {t.recurring.paymentAccount}
            </span>
            <div className="flex items-center gap-1.5 min-w-0">
              <Wallet className="w-3.5 h-3.5 text-foreground-secondary shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-foreground truncate">
                {recurring.account?.name || '-'} ({recurring.currency})
              </span>
            </div>
          </div>

          <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-secondary">
              {t.recurring.annualProjection}
            </span>
            <span className="text-xs sm:text-sm font-bold font-mono text-foreground">
              {formatCurrency(annualTotal, recurring.currency)}
            </span>
          </div>
        </div>

        {/* Payment History Timeline */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-foreground-secondary" />
              <span>{t.recurring.paymentHistory}</span>
            </h3>
            <span className="text-xs font-mono text-foreground-muted">
              {t.recurring.historyCount.replace('{count}', String(history.length))}
            </span>
          </div>

          {isLoadingHistory ? (
            <div className="p-4 rounded-xl border border-border flex items-center justify-center gap-2 text-xs text-foreground-muted">
              <Loader2 className="w-4 h-4 animate-spin text-foreground" />
              <span>{t.recurring.loadingHistory}</span>
            </div>
          ) : history.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-foreground-muted">
              {t.recurring.noHistory}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                {history.slice(0, displayLimit).map((tx) => {
                  const isTxExpense = tx.type === 'expense'
                  return (
                    <div
                      key={tx.id}
                      onClick={() => {
                        onClose()
                        router.push(`/transactions/${tx.id}`)
                      }}
                      className="p-3 rounded-xl bg-surface border border-border hover:border-primary flex items-center gap-3 shadow-2xs group cursor-pointer transition-all"
                    >
                      <div
                        className={cn(
                          'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform',
                          isTxExpense
                            ? 'bg-destructive-muted text-destructive'
                            : 'bg-success-muted text-success'
                        )}
                      >
                        {isTxExpense ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-foreground truncate group-hover:text-success transition-colors">
                            {tx.description || recurring.name}
                          </span>
                          <span
                            className={cn(
                              'text-xs font-mono font-bold shrink-0',
                              isTxExpense ? 'text-destructive' : 'text-success'
                            )}
                          >
                            {isTxExpense ? '-' : '+'}
                            {formatCurrency(Number(tx.amount), tx.currency)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-foreground-secondary">
                          <span className="whitespace-nowrap shrink-0">{formatDate(tx.transaction_date, 'd MMM yyyy', language)}</span>
                          {tx.account && <span className="truncate">• {tx.account.name}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Pagination Load More Controls */}
              {displayLimit < history.length && (
                <div className="pt-1 flex flex-col sm:flex-row items-center justify-between gap-2 p-2.5 rounded-xl bg-canvas dark:bg-surface-subtle border border-border text-xs">
                  <span className="text-foreground-secondary font-medium text-center sm:text-left text-[11px]">
                    {t.common.showing} <span className="font-bold text-foreground">{Math.min(displayLimit, history.length)}</span> / {history.length}
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

        {/* Modal Action Footer */}
        <div className="flex flex-col gap-2 pt-3 border-t border-border w-full">
          <Button
            size="sm"
            onClick={() => {
              onClose()
              onPayNow(recurring)
            }}
            isLoading={isProcessing}
            className="w-full py-2.5 h-auto cursor-pointer text-xs font-bold bg-primary text-primary-foreground rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{t.recurring.payNowRecord}</span>
          </Button>

          <div className="grid grid-cols-3 gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onClose()
                onEdit(recurring)
              }}
              className="gap-1.5 cursor-pointer text-xs justify-center py-2 h-auto rounded-xl w-full"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>{t.common.edit}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onToggleActive(recurring)
              }}
              className="gap-1.5 cursor-pointer text-xs justify-center py-2 h-auto rounded-xl w-full"
            >
              {isPaused ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
              <span>{isPaused ? t.recurring.activate : t.recurring.pause}</span>
            </Button>

            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                onClose()
                onDelete(recurring.id)
              }}
              className="gap-1.5 cursor-pointer text-xs justify-center py-2 h-auto rounded-xl w-full"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.common.delete}</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
