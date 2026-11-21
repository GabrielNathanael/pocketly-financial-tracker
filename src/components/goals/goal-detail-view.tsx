'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { deleteSavingsGoal, updateSavingsGoal } from '@/actions/goals'
import { Account, Category, EnrichedSavingsGoal } from '@/types/database'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import { useLanguage } from '@/lib/i18n/language-context'
import { cn } from '@/lib/utils/cn'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { GoalFormModal } from '@/components/goals/goal-form-modal'
import { GoalDepositModal } from '@/components/goals/goal-deposit-modal'
import { parseISO, differenceInCalendarDays, differenceInCalendarMonths } from 'date-fns'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  Edit2,
  History,
  Loader2,
  PauseCircle,
  PlayCircle,
  Target,
  Trash2,
  Trophy,
} from 'lucide-react'

interface GoalDetailViewProps {
  goal: EnrichedSavingsGoal
  accounts: Account[]
  categories: Category[]
}

export function GoalDetailView({ goal, accounts, categories }: GoalDetailViewProps) {
  const router = useRouter()
  const { t, language } = useLanguage()

  const [depositOpen, setDepositOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState<'pause' | 'delete' | null>(null)

  const targetAmt = Number(goal.target_amount)
  const currentAmt = Number(goal.current_amount)
  const remainingAmt = Math.max(0, targetAmt - currentAmt)
  const progressPct = targetAmt > 0 ? Math.min(100, Math.round((currentAmt / targetAmt) * 1000) / 10) : 0
  const isCompleted = goal.status === 'completed' || currentAmt >= targetAmt
  const isPaused = goal.status === 'paused'

  const today = new Date()
  let daysUntil = 0
  let monthsLeft = 1
  let monthlyNeeded = 0
  if (goal.target_date) {
    try {
      const targetDate = parseISO(goal.target_date)
      daysUntil = differenceInCalendarDays(targetDate, today)
      monthsLeft = Math.max(1, differenceInCalendarMonths(targetDate, today))
      if (remainingAmt > 0) monthlyNeeded = remainingAmt / monthsLeft
    } catch {
      // ignore
    }
  }

  const handleTogglePause = async () => {
    setBusy('pause')
    try {
      const res = await updateSavingsGoal(goal.id, {
        status: isPaused ? 'in_progress' : 'paused',
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(isPaused ? t.goals.resumeSuccess : t.goals.pauseSuccess)
      router.refresh()
    } catch {
      toast.error(t.goals.errorUpdateStatus)
    } finally {
      setBusy(null)
    }
  }

  const handleDelete = async () => {
    setBusy('delete')
    try {
      const res = await deleteSavingsGoal(goal.id)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(t.goals.deleteSuccess)
      router.push('/goals')
    } catch {
      toast.error(t.goals.errorDeleteGoal)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/goals"
            className="p-2 rounded-xl bg-surface border border-border text-foreground-secondary hover:text-foreground hover:bg-surface-subtle transition-colors shrink-0"
            aria-label={t.common.back}
            title={t.common.back}
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate">
              {goal.name}
            </h1>
            <p className="text-[11px] text-foreground-secondary">
              {t.goals.detailPageSubtitle}
            </p>
          </div>
        </div>
        <Link
          href={`/goals/${goal.id}/history`}
          className="h-9 w-9 p-2 rounded-xl bg-surface border border-border text-foreground-secondary hover:text-foreground hover:bg-surface-subtle transition-colors shrink-0 flex items-center justify-center"
          aria-label={t.goals.viewFullHistory}
          title={t.goals.viewFullHistory}
        >
          <History className="w-4 h-4" />
        </Link>
      </div>

      {/* Hero */}
      <div className="p-4 sm:p-5 rounded-2xl bg-canvas dark:bg-surface-subtle border border-border flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
              style={{ backgroundColor: goal.color || '#0D9488' }}
            >
              <DynamicIcon name={goal.icon || 'Target'} className="w-6 h-6" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-foreground truncate">
                  {goal.name}
                </h2>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1',
                    isCompleted
                      ? 'bg-success-muted text-success'
                      : isPaused
                        ? 'bg-warning-muted text-warning'
                        : 'bg-success-muted text-success',
                  )}
                >
                  {isCompleted ? (
                    <><CheckCircle2 className="w-3 h-3" /><span>{t.goals.statusCompleted}</span></>
                  ) : isPaused ? (
                    <><PauseCircle className="w-3 h-3" /><span>{t.goals.statusPaused}</span></>
                  ) : (
                    <><Clock className="w-3 h-3" /><span>{t.goals.statusActive}</span></>
                  )}
                </span>
              </div>
              {goal.category && (
                <span className="text-xs text-foreground-secondary flex items-center gap-1 mt-0.5">
                  <DynamicIcon name={goal.category.icon || 'Tag'} className="w-3.5 h-3.5" />
                  <span>{goal.category.name}</span>
                </span>
              )}
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-foreground">
              {progressPct}%
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex flex-col gap-1.5">
          <div className="h-3 w-full rounded-full bg-border overflow-hidden p-0.5">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progressPct}%`, backgroundColor: goal.color || '#0D9488' }}
            />
          </div>
          <div className="flex items-center justify-between text-xs font-mono font-bold">
            <span className="text-success">{formatCurrency(currentAmt, goal.currency)}</span>
            <span className="text-foreground-secondary">{formatCurrency(targetAmt, goal.currency)}</span>
          </div>
        </div>
      </div>

      {/* Target / Schedule info */}
      <div className="flex flex-col gap-2.5">
        <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-secondary">
            {t.goals.remainingNeededLabel}
          </span>
          <span className="text-xs sm:text-sm font-bold font-mono text-foreground">
            {formatCurrency(remainingAmt, goal.currency)}
          </span>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-secondary">
            {t.goals.targetDateDetailLabel}
          </span>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-foreground-secondary" />
            <span className="text-xs sm:text-sm font-bold font-mono text-foreground">
              {goal.target_date ? formatDate(goal.target_date, 'd MMM yyyy', language) : '-'}
            </span>
          </div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-secondary">
            {t.goals.estMonthlySavingLabel}
          </span>
          <span className="text-xs sm:text-sm font-bold font-mono text-success">
            {isCompleted
              ? t.goals.targetReachedLabel
              : monthlyNeeded > 0
                ? formatCurrency(monthlyNeeded, goal.currency)
                : '-'}
          </span>
        </div>

        {!isCompleted && goal.target_date && (
          <div
            className={cn(
              'p-2 rounded-lg text-xs leading-relaxed flex items-center gap-2 border',
              daysUntil < 0
                ? 'bg-destructive-muted text-destructive border-destructive/20'
                : 'bg-warning-muted text-warning border-warning/30',
            )}
          >
            {daysUntil < 0 ? <Trophy className="w-3.5 h-3.5 shrink-0" /> : <Target className="w-3.5 h-3.5 shrink-0" />}
            <span>
              {daysUntil < 0
                ? t.goals.overdueTarget.replace('{days}', String(Math.abs(daysUntil)))
                : t.goals.daysRemaining.replace('{days}', String(daysUntil))}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-3 border-t border-border w-full">
        <Button
          size="sm"
          disabled={busy !== null}
          onClick={() => setDepositOpen(true)}
          className="w-full h-10 py-0 cursor-pointer text-xs font-bold bg-primary text-primary-foreground rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
        >
          <Coins className="w-4 h-4" />
          {t.goals.depositWithdrawBtn}
        </Button>

        <div className="grid grid-cols-3 gap-2 w-full">
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => setEditOpen(true)}
            className="gap-1.5 h-10 py-0 cursor-pointer text-xs justify-center rounded-xl w-full"
          >
            <Edit2 className="w-3.5 h-3.5" />
            {t.common.edit}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={handleTogglePause}
            className="gap-1.5 h-10 py-0 cursor-pointer text-xs justify-center rounded-xl w-full"
          >
            {busy === 'pause' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isPaused ? (
              <PlayCircle className="w-3.5 h-3.5" />
            ) : (
              <PauseCircle className="w-3.5 h-3.5" />
            )}
            {isPaused ? t.goals.resumeLabel : t.goals.pauseLabel}
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={busy !== null}
            onClick={() => setDeleteOpen(true)}
            className="gap-1.5 h-10 py-0 cursor-pointer text-xs justify-center rounded-xl w-full"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t.common.delete}
          </Button>
        </div>
      </div>

      {/* Input modals */}
      <GoalDepositModal
        isOpen={depositOpen}
        onClose={() => setDepositOpen(false)}
        goal={goal}
        accounts={accounts}
        onSuccess={() => router.refresh()}
      />

      <GoalFormModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        categories={categories}
        editItem={goal}
        onSuccess={() => {
          toast.success(t.goals.saveSuccess)
          router.refresh()
        }}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          setDeleteOpen(false)
          await handleDelete()
        }}
        title={t.common.delete}
        message={t.goals.deleteConfirm}
        isLoading={busy === 'delete'}
        variant="danger"
      />
    </div>
  )
}
