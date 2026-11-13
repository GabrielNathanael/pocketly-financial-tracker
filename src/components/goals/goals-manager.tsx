'use client'

import React, { useState, useMemo } from 'react'
import { Account, Category, EnrichedSavingsGoal } from '@/types/database'
import { formatCurrency, convertAmount, ForexRatesMap } from '@/lib/utils/currency'
import { usePreferredCurrency } from '@/lib/storage/preferred-currency'
import { usePrivacyMode, maskCurrency } from '@/lib/storage/privacy-mode'
import { useLanguage } from '@/lib/i18n/language-context'
import { updateSavingsGoal, deleteSavingsGoal } from '@/actions/goals'
import { GoalFormModal } from '@/components/goals/goal-form-modal'
import { GoalDepositModal } from '@/components/goals/goal-deposit-modal'
import { GoalDetailModal } from '@/components/goals/goal-detail-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils/cn'
import { parseISO, differenceInCalendarDays, differenceInCalendarMonths, format } from 'date-fns'
import { id as idLocale, enUS } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  Plus,
  Search,
  Calendar,
  Sparkles,
  Trophy,
  Target,
  PiggyBank,
  TrendingUp,
  Percent,
  Edit2,
  Trash2,
  PauseCircle,
  PlayCircle,
  Coins,
} from 'lucide-react'

interface GoalsManagerProps {
  savingsGoals: EnrichedSavingsGoal[]
  accounts: Account[]
  categories: Category[]
  rates?: ForexRatesMap
}

type TabType = 'all' | 'in_progress' | 'completed' | 'paused'

export function GoalsManager({
  savingsGoals,
  accounts,
  categories,
  rates,
}: GoalsManagerProps) {
  const { t, language } = useLanguage()
  const displayCurrency = usePreferredCurrency()
  const isPrivate = usePrivacyMode()
  const dateFnsLocale = language === 'id' ? idLocale : enUS

  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [depositModalOpen, setDepositModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState<EnrichedSavingsGoal | null>(null)
  const [detailGoal, setDetailGoal] = useState<EnrichedSavingsGoal | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const today = new Date()

  // Calculate Scorecard Aggregates
  const { totalTargetCapital, totalSavedCapital, overallProgressPct, completedGoalsCount } = useMemo(() => {
    let targetSum = 0
    let savedSum = 0
    let completedCount = 0

    savingsGoals.forEach((goal) => {
      const convertedTarget = convertAmount(
        goal.target_amount,
        goal.currency || 'IDR',
        displayCurrency,
        rates
      )
      const convertedSaved = convertAmount(
        goal.current_amount,
        goal.currency || 'IDR',
        displayCurrency,
        rates
      )

      targetSum += convertedTarget
      savedSum += convertedSaved

      if (goal.status === 'completed' || goal.current_amount >= goal.target_amount) {
        completedCount += 1
      }
    })

    const overallPct = targetSum > 0 ? Math.min(100, Math.round((savedSum / targetSum) * 1000) / 10) : 0

    return {
      totalTargetCapital: targetSum,
      totalSavedCapital: savedSum,
      overallProgressPct: overallPct,
      completedGoalsCount: completedCount,
    }
  }, [savingsGoals, displayCurrency, rates])

  // Filtered Goals
  const filteredGoals = useMemo(() => {
    return savingsGoals.filter((goal) => {
      if (activeTab === 'in_progress') {
        if (goal.status !== 'in_progress') return false
      } else if (activeTab === 'completed') {
        if (goal.status !== 'completed' && goal.current_amount < goal.target_amount) return false
      } else if (activeTab === 'paused') {
        if (goal.status !== 'paused') return false
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesName = goal.name.toLowerCase().includes(q)
        const matchesCat = goal.category?.name.toLowerCase().includes(q) || false
        if (!matchesName && !matchesCat) return false
      }

      return true
    })
  }, [savingsGoals, activeTab, searchQuery])

  // Handle Toggle Pause/Resume
  const handleToggleStatus = async (goal: EnrichedSavingsGoal) => {
    const isPaused = goal.status === 'paused'
    const newStatus = isPaused ? 'in_progress' : 'paused'
    try {
      const res = await updateSavingsGoal(goal.id, { status: newStatus })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(
          isPaused ? t.goals.resumeSuccess : t.goals.pauseSuccess
        )
      }
    } catch {
      toast.error(t.goals.errorUpdateStatus)
    }
  }

  // Handle Delete Goal
  const handleConfirmDelete = async () => {
    if (!deletingId) return
    setIsDeleting(true)
    try {
      const res = await deleteSavingsGoal(deletingId)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(t.goals.deleteSuccess)
      }
    } catch {
      toast.error(t.goals.errorDeleteGoal)
    } finally {
      setIsDeleting(false)
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {t.goals.title}
          </h1>
          <p className="text-xs text-foreground-secondary font-mono leading-relaxed mt-0.5">
            {t.goals.subtitle}
          </p>
        </div>

        <Button
          onClick={() => {
            setSelectedGoal(null)
            setFormModalOpen(true)
          }}
          size="sm"
          className="gap-1.5 cursor-pointer text-xs font-bold bg-primary text-primary-foreground self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t.goals.addBtn}</span>
        </Button>
      </div>

      {/* Scorecard (4 Metric Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Card 1: Total Target */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border flex flex-col justify-between gap-1.5 shadow-2xs">
          <div className="flex items-center justify-between gap-1 min-h-5.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-secondary leading-tight">
              {t.goals.totalTarget}
            </span>
            <Target className="w-3.5 h-3.5 text-foreground shrink-0" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold font-mono text-foreground tracking-tight tnum">
              {maskCurrency(formatCurrency(totalTargetCapital, displayCurrency), isPrivate)}
            </h3>
            <span className="text-[10px] font-mono text-foreground-muted mt-0.5 block">
              {savingsGoals.length} {t.goals.milestonesLabel}
            </span>
          </div>
        </div>

        {/* Card 2: Total Saved */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border flex flex-col justify-between gap-1.5 shadow-2xs">
          <div className="flex items-center justify-between gap-1 min-h-5.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-secondary leading-tight">
              {t.goals.totalSaved}
            </span>
            <PiggyBank className="w-3.5 h-3.5 text-success shrink-0" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold font-mono text-success tracking-tight tnum">
              {maskCurrency(formatCurrency(totalSavedCapital, displayCurrency), isPrivate)}
            </h3>
            <span className="text-[10px] font-mono text-foreground-muted mt-0.5 block">
              {t.goals.allocatedFundsLabel}
            </span>
          </div>
        </div>

        {/* Card 3: Overall Progress */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border flex flex-col justify-between gap-1.5 shadow-2xs">
          <div className="flex items-center justify-between gap-1 min-h-5.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-secondary leading-tight">
              {t.goals.overallProgress}
            </span>
            <Percent className="w-3.5 h-3.5 text-info shrink-0" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold font-mono text-info tracking-tight tnum">
              {overallProgressPct}%
            </h3>
            <div className="w-full bg-border h-1.5 rounded-full overflow-hidden mt-1">
              <div
                className="bg-info h-full rounded-full transition-all duration-500"
                style={{ width: `${overallProgressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 4: Goals Achieved */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border flex flex-col justify-between gap-1.5 shadow-2xs">
          <div className="flex items-center justify-between gap-1 min-h-5.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-secondary leading-tight">
              {t.goals.completedCount}
            </span>
            <Trophy className="w-3.5 h-3.5 text-warning shrink-0" />
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-base sm:text-lg font-bold font-mono tracking-tight text-foreground">
                {completedGoalsCount}
              </span>
              <span className="text-[11px] font-medium text-foreground-secondary">
                / {savingsGoals.length}
              </span>
            </div>
            <span className="text-[10px] font-bold text-warning mt-0.5 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              {completedGoalsCount > 0
                ? t.goals.goalsReachedLabel
                : t.goals.inJourneyLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs without Truncation & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Segmented Tabs */}
        <div className="flex items-center gap-1 p-1 bg-surface-subtle rounded-xl border border-border overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={cn(
              'py-1.5 px-3 text-xs font-bold rounded-lg transition-all text-center cursor-pointer whitespace-nowrap shrink-0',
              activeTab === 'all'
                ? 'bg-surface text-foreground shadow-xs'
                : 'text-foreground-secondary hover:text-foreground'
            )}
          >
            {t.goals.tabAll}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('in_progress')}
            className={cn(
              'py-1.5 px-3 text-xs font-bold rounded-lg transition-all text-center cursor-pointer whitespace-nowrap shrink-0',
              activeTab === 'in_progress'
                ? 'bg-surface text-success shadow-xs'
                : 'text-foreground-secondary hover:text-foreground'
            )}
          >
            {t.goals.tabInProgress}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('completed')}
            className={cn(
              'py-1.5 px-3 text-xs font-bold rounded-lg transition-all text-center cursor-pointer whitespace-nowrap shrink-0',
              activeTab === 'completed'
                ? 'bg-surface text-warning shadow-xs'
                : 'text-foreground-secondary hover:text-foreground'
            )}
          >
            {t.goals.tabCompleted}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('paused')}
            className={cn(
              'py-1.5 px-3 text-xs font-bold rounded-lg transition-all text-center cursor-pointer whitespace-nowrap shrink-0',
              activeTab === 'paused'
                ? 'bg-surface text-foreground-secondary shadow-xs'
                : 'text-foreground-secondary hover:text-foreground'
            )}
          >
            {t.goals.tabPaused}
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground-muted" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.common.search}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Goals Cards Grid */}
      {filteredGoals.length === 0 ? (
        <EmptyState
          icon="Target"
          title={t.goals.emptyTitle}
          description={t.goals.emptyDesc}
          actionLabel={t.goals.addBtn}
          onAction={() => {
            setSelectedGoal(null)
            setFormModalOpen(true)
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredGoals.map((goal) => {
            const targetAmt = Number(goal.target_amount)
            const currentAmt = Number(goal.current_amount)
            const progressPct = targetAmt > 0 ? Math.min(100, Math.round((currentAmt / targetAmt) * 1000) / 10) : 0
            const isCompleted = goal.status === 'completed' || currentAmt >= targetAmt

            // Date calculations
            let daysUntil = 0
            let monthsUntil = 1
            try {
              const targetDate = parseISO(goal.target_date)
              daysUntil = differenceInCalendarDays(targetDate, today)
              monthsUntil = Math.max(1, differenceInCalendarMonths(targetDate, today))
            } catch {
              // ignore
            }

            // Monthly pace calculator
            const remainingAmt = Math.max(0, targetAmt - currentAmt)
            const monthlyPace = remainingAmt / monthsUntil

            return (
              <div
                key={goal.id}
                className={cn(
                  'p-4 sm:p-5 rounded-2xl bg-surface border flex flex-col justify-between gap-4 transition-all shadow-2xs',
                  goal.status === 'paused'
                    ? 'border-border opacity-60'
                    : isCompleted
                      ? 'border-warning/40 bg-warning-muted/30'
                      : 'border-border hover:border-border-strong'
                )}
              >
                {/* Card Click Area (Top & Middle) */}
                <div
                  onClick={() => {
                    setDetailGoal(goal)
                    setDetailModalOpen(true)
                  }}
                  className="cursor-pointer flex flex-col gap-4"
                >
                  {/* Card Top: Icon, Name, Category & Badges */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                        style={{
                          backgroundColor: `${goal.color || '#0D9488'}15`,
                          borderColor: `${goal.color || '#0D9488'}40`,
                          color: goal.color || '#0D9488',
                        }}
                      >
                        <DynamicIcon name={goal.icon || 'Target'} className="w-5 h-5" />
                      </div>

                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-foreground truncate">
                            {goal.name}
                          </span>
                          {isCompleted && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-warning-muted text-warning flex items-center gap-0.5 shrink-0">
                              <Trophy className="w-2.5 h-2.5" />
                              {t.goals.statusCompleted}
                            </span>
                          )}
                          {goal.status === 'paused' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-foreground-secondary shrink-0">
                              {t.goals.statusPaused}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-foreground-secondary truncate">
                          <span>{goal.category?.name || t.common.custom}</span>
                          <span>•</span>
                          <Calendar className="w-3 h-3 text-foreground-muted" />
                          <span>{format(parseISO(goal.target_date), 'dd MMM yyyy', { locale: dateFnsLocale })}</span>
                        </div>
                      </div>
                    </div>

                    {/* Countdown Badge */}
                    {!isCompleted && goal.status !== 'paused' && (
                      <span
                        className={cn(
                          'text-[10px] font-bold font-mono px-2 py-0.5 rounded-md shrink-0 border',
                          daysUntil < 0
                            ? 'bg-destructive-muted text-destructive border-destructive/20'
                            : 'bg-surface-subtle text-foreground border-border'
                        )}
                      >
                        {daysUntil < 0
                          ? t.goals.overdueTarget.replace('{days}', String(Math.abs(daysUntil)))
                          : t.goals.daysRemaining.replace('{days}', String(daysUntil))}
                      </span>
                    )}
                  </div>

                  {/* Card Middle: Progress Bar & Amounts */}
                  <div className="flex flex-col gap-2.5">
                    {/* Amount Balance Numbers */}
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-foreground-muted">
                          {t.goals.totalSaved}
                        </span>
                        <span className="text-base sm:text-lg font-bold font-mono text-success tnum">
                          {maskCurrency(formatCurrency(currentAmt, goal.currency), isPrivate)}
                        </span>
                      </div>

                      <div className="flex flex-col items-end">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-foreground-muted">
                          {t.goals.targetAmountLabel}
                        </span>
                        <span className="text-xs sm:text-sm font-bold font-mono text-foreground-secondary tnum">
                          {maskCurrency(formatCurrency(targetAmt, goal.currency), isPrivate)}
                        </span>
                      </div>
                    </div>

                    {/* Progress Track */}
                    <div className="flex items-center gap-2.5">
                      <div className="h-2.5 w-full rounded-full bg-border overflow-hidden p-0.5">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${progressPct}%`,
                            backgroundColor: goal.color || '#0D9488',
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono font-bold text-foreground shrink-0">
                        {progressPct}%
                      </span>
                    </div>

                    {/* Smart Pace Recommendation Banner */}
                    <div
                      className={cn(
                        'p-2 rounded-lg text-xs leading-relaxed flex items-center gap-2',
                        isCompleted
                          ? 'bg-warning-muted text-warning font-bold border border-warning/30'
                          : 'bg-canvas dark:bg-surface-subtle text-foreground-secondary border border-border'
                      )}
                    >
                      {isCompleted ? (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-warning shrink-0" />
                          <span>{t.goals.goalReached}</span>
                        </>
                      ) : (
                        <>
                          <TrendingUp className="w-3.5 h-3.5 text-success shrink-0" />
                          <span>
                            {t.goals.monthlyNeeded
                              .replace('{amount}', formatCurrency(monthlyPace, goal.currency))
                              .replace('{months}', String(monthsUntil))}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Bottom Actions */}
                <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* Toggle Status (Pause/Resume) */}
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(goal)}
                      className="p-1.5 rounded-lg text-foreground-secondary hover:text-foreground hover:bg-surface-subtle transition-colors cursor-pointer"
                      title={goal.status === 'paused' ? t.goals.resumeLabel : t.goals.pauseLabel}
                    >
                      {goal.status === 'paused' ? (
                        <PlayCircle className="w-3.5 h-3.5 text-success" />
                      ) : (
                        <PauseCircle className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedGoal(goal)
                        setFormModalOpen(true)
                      }}
                      className="p-1.5 rounded-lg text-foreground-secondary hover:text-foreground hover:bg-surface-subtle transition-colors cursor-pointer"
                      title={t.common.edit}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => setDeletingId(goal.id)}
                      className="p-1.5 rounded-lg text-foreground-secondary hover:text-destructive hover:bg-destructive-muted transition-colors cursor-pointer"
                      title={t.common.delete}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Setor / Tarik Dana Button */}
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedGoal(goal)
                      setDepositModalOpen(true)
                    }}
                    className={cn(
                      'text-xs font-bold gap-1.5 cursor-pointer h-8 px-3',
                      isCompleted
                        ? 'bg-warning text-warning-foreground hover:opacity-90'
                        : 'bg-success text-success-foreground hover:opacity-90'
                    )}
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>{t.goals.depositWithdrawBtn}</span>
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Goal Detail Modal */}
      <GoalDetailModal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false)
          setDetailGoal(null)
        }}
        goal={detailGoal}
        onDeposit={(g) => {
          setSelectedGoal(g)
          setDepositModalOpen(true)
        }}
        onEdit={(g) => {
          setSelectedGoal(g)
          setFormModalOpen(true)
        }}
        onTogglePause={handleToggleStatus}
        onDelete={(id) => setDeletingId(id)}
      />

      {/* Goal Form Modal */}
      <GoalFormModal
        isOpen={formModalOpen}
        onClose={() => {
          setFormModalOpen(false)
          setSelectedGoal(null)
        }}
        categories={categories}
        editItem={selectedGoal}
        onSuccess={() => {
          toast.success(t.goals.saveSuccess)
        }}
      />

      {/* Deposit / Withdraw Modal */}
      <GoalDepositModal
        isOpen={depositModalOpen}
        onClose={() => {
          setDepositModalOpen(false)
          setSelectedGoal(null)
        }}
        goal={selectedGoal}
        accounts={accounts}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        onConfirm={handleConfirmDelete}
        title={t.common.delete}
        message={t.goals.deleteConfirm}
        isLoading={isDeleting}
        variant="danger"
      />
    </div>
  )
}
