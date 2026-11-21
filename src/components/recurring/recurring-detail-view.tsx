'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  processRecurringPayment,
  toggleRecurringActive,
  deleteRecurringTransaction,
} from '@/actions/recurring'
import {
  Account,
  Category,
  EnrichedRecurringTransaction,
} from '@/types/database'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import { useLanguage } from '@/lib/i18n/language-context'
import { cn } from '@/lib/utils/cn'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { RecurringFormModal } from '@/components/recurring/recurring-form-modal'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Wallet,
  History,
  Loader2,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Edit2,
  Trash2,
  Repeat,
} from 'lucide-react'

interface RecurringDetailViewProps {
  recurring: EnrichedRecurringTransaction
  accounts: Account[]
  categories: Category[]
}

export function RecurringDetailView({
  recurring,
  accounts,
  categories,
}: RecurringDetailViewProps) {
  const router = useRouter()
  const { t, language } = useLanguage()
  const [busy, setBusy] = useState<'pay' | 'toggle' | 'delete' | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const isExpense = recurring.type === 'expense'
  const isPaused = !recurring.is_active
  const amount = Number(recurring.amount)

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

  const runAction = async (
    kind: 'pay' | 'toggle' | 'delete',
    action: () => Promise<{ error?: string }>,
    successMessage: string,
  ) => {
    setBusy(kind)
    try {
      const res = await action()
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(successMessage)
      if (kind === 'delete') router.push('/recurring')
      else router.refresh()
    } catch {
      toast.error(t.recurring.unexpectedError)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/recurring"
          className="h-9 w-9 p-0 flex items-center justify-center shrink-0 rounded-xl bg-surface border border-border text-foreground-secondary hover:text-foreground hover:bg-surface-subtle transition-colors"
          aria-label={t.common.back}
          title={t.common.back}
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate">
            {recurring.name}
          </h1>
        </div>
        <Link
          href={`/recurring/${recurring.id}/history`}
          className="h-9 w-9 p-0 flex items-center justify-center shrink-0 ml-auto rounded-xl bg-surface border border-border text-foreground-secondary hover:text-foreground hover:bg-surface-subtle transition-colors"
          aria-label={t.recurring.viewFullHistory}
          title={t.recurring.viewFullHistory}
        >
          <History className="w-4 h-4" />
        </Link>
      </div>

      {/* Hero */}
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
              <span className="text-base font-bold text-foreground truncate">
                {recurring.name}
              </span>
              <span
                className={cn(
                  'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1',
                  isPaused
                    ? 'bg-warning-muted text-warning'
                    : 'bg-success-muted text-success',
                )}
              >
                {isPaused ? (
                  <><PauseCircle className="w-3 h-3" /><span>{t.recurring.statusPaused}</span></>
                ) : (
                  <><CheckCircle2 className="w-3 h-3" /><span>{t.recurring.statusActive}</span></>
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
              isExpense ? 'text-destructive' : 'text-success',
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

      {/* Schedule */}
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

        <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-secondary">
            {t.recurring.autoProcessLabel}
          </span>
          <span
            className={cn(
              'flex items-center gap-1.5 text-xs font-bold',
              recurring.auto_process ? 'text-success' : 'text-foreground-secondary',
            )}
          >
            <Repeat className="w-3.5 h-3.5" />
            {recurring.auto_process ? t.recurring.autoProcessOn : t.recurring.autoProcessOff}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-3 border-t border-border w-full">
        <Button
          size="sm"
          disabled={busy !== null}
          onClick={() =>
            runAction('pay', () => processRecurringPayment(recurring.id), t.recurring.processSuccess)
          }
          className="w-full h-10 py-0 px-3 cursor-pointer text-xs font-bold bg-primary text-primary-foreground rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
        >
          {busy === 'pay' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          {t.recurring.payNowRecord}
        </Button>

        <div className="grid grid-cols-3 gap-2 w-full">
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => setEditOpen(true)}
            className="h-10 py-0 px-2 gap-1.5 cursor-pointer text-xs justify-center rounded-xl w-full"
          >
            <Edit2 className="w-3.5 h-3.5" />
            {t.common.edit}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() =>
              runAction(
                'toggle',
                () => toggleRecurringActive(recurring.id, !recurring.is_active),
                isPaused ? t.recurring.scheduleResumed : t.recurring.schedulePaused,
              )
            }
            className="h-10 py-0 px-2 gap-1.5 cursor-pointer text-xs justify-center rounded-xl w-full"
          >
            {isPaused ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
            {isPaused ? t.recurring.activate : t.recurring.pause}
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={busy !== null}
            onClick={() => setDeleteOpen(true)}
            className="h-10 py-0 px-2 gap-1.5 cursor-pointer text-xs justify-center rounded-xl w-full"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t.common.delete}
          </Button>
        </div>

        <Link
          href="/recurring"
          className="mt-1 flex items-center justify-center gap-1.5 text-[11px] font-bold text-foreground-secondary hover:text-foreground transition-colors py-1"
        >
          {t.recurring.viewAllBtn}
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <RecurringFormModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        accounts={accounts}
        categories={categories}
        editItem={recurring}
        onSuccess={() => {
          toast.success(t.recurring.saveSuccess)
          router.refresh()
        }}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          setDeleteOpen(false)
          await runAction(
            'delete',
            () => deleteRecurringTransaction(recurring.id),
            t.recurring.deleteSuccess,
          )
        }}
        title={t.common.delete}
        message={t.recurring.deleteConfirm}
        isLoading={busy === 'delete'}
        variant="danger"
      />
    </div>
  )
}
