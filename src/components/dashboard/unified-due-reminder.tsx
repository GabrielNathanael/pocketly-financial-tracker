'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { EnrichedRecurringTransaction, EnrichedSavingsGoal, Account } from '@/types/database'
import { EnrichedDebtWithPayments } from '@/actions/debts'
import { useLanguage } from '@/lib/i18n/language-context'
import { formatCurrency } from '@/lib/utils/currency'
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Repeat,
  Scale,
  Target,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { differenceInCalendarDays, parseISO } from 'date-fns'

interface UnifiedDueReminderProps {
  recurringTransactions: EnrichedRecurringTransaction[]
  debts: EnrichedDebtWithPayments[]
  goals: EnrichedSavingsGoal[]
  accounts: Account[]
}

interface DueItem {
  id: string
  source: 'recurring' | 'debt' | 'goal'
  title: string
  subtitle: string
  amount: number
  currency: string
  dueDate: string
  daysDiff: number // < 0: overdue, 0: today, > 0: upcoming
  icon: string
  link: string
  ctaText: string
}

export function UnifiedDueReminder({
  recurringTransactions,
  debts,
  goals,
}: UnifiedDueReminderProps) {
  const { t } = useLanguage()
  const [isExpanded, setIsExpanded] = useState(true)

  const today = new Date()
  const items: DueItem[] = []

  // 1. Process Recurring Transactions (Due in <= 7 days or overdue)
  recurringTransactions.forEach((rec) => {
    if (!rec.is_active) return
    const dueDate = parseISO(rec.next_due_date)
    const daysDiff = differenceInCalendarDays(dueDate, today)

    if (daysDiff <= 7) {
      items.push({
        id: `rec-${rec.id}`,
        source: 'recurring',
        title: rec.name,
        subtitle: rec.category?.name || t.dueCenter.recurringBill,
        amount: Number(rec.amount),
        currency: rec.currency,
        dueDate: rec.next_due_date,
        daysDiff,
        icon: rec.category?.icon || 'Repeat',
        link: '/recurring',
        ctaText: t.dueCenter.payBill,
      })
    }
  })

  // 2. Process Debts (Due in <= 14 days or overdue)
  debts.forEach((debt) => {
    if (debt.status !== 'active' || !debt.due_date) return
    const dueDate = parseISO(debt.due_date)
    const daysDiff = differenceInCalendarDays(dueDate, today)

    if (daysDiff <= 14) {
      const remainingAmount = Number(debt.remaining_amount)
      items.push({
        id: `debt-${debt.id}`,
        source: 'debt',
        title: `${debt.type === 'debt' ? 'Bayar Utang' : 'Tagih Piutang'}: ${debt.counterparty_name}`,
        subtitle: debt.notes || t.dueCenter.debtDue,
        amount: remainingAmount,
        currency: debt.currency,
        dueDate: debt.due_date,
        daysDiff,
        icon: 'Scale',
        link: `/debts/${debt.id}`,
        ctaText: t.dueCenter.payInstallment,
      })
    }
  })

  // 3. Process Savings Goals (Deadline in <= 30 days)
  goals.forEach((goal) => {
    if (goal.status !== 'in_progress' || !goal.target_date) return
    const dueDate = parseISO(goal.target_date)
    const daysDiff = differenceInCalendarDays(dueDate, today)

    if (daysDiff <= 30) {
      const remainingAmount = Math.max(0, Number(goal.target_amount) - Number(goal.current_amount))
      items.push({
        id: `goal-${goal.id}`,
        source: 'goal',
        title: goal.name,
        subtitle: t.dueCenter.goalDue,
        amount: remainingAmount,
        currency: goal.currency,
        dueDate: goal.target_date,
        daysDiff,
        icon: goal.icon || 'Target',
        link: '/goals',
        ctaText: t.dueCenter.depositGoal,
      })
    }
  })

  // Sort by urgency: most overdue/closest date first
  items.sort((a, b) => a.daysDiff - b.daysDiff)

  // Split into urgent vs upcoming
  const urgentCount = items.filter((i) => i.daysDiff <= 0).length
  const soonCount = items.filter((i) => i.daysDiff > 0 && i.daysDiff <= 7).length

  if (items.length === 0) {
    return (
      <div className="p-3.5 rounded-2xl bg-success-muted border border-success/30 flex items-center justify-between gap-3 text-xs text-success">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-success/10 text-success flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <span className="font-medium">{t.dueCenter.allClear}</span>
        </div>
        <Sparkles className="w-4 h-4 text-success shrink-0 opacity-75 hidden sm:block" />
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-surface border border-border shadow-xs overflow-hidden">
      {/* Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-surface-subtle transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-warning-muted text-warning flex items-center justify-center shrink-0">
            <CalendarClock className="w-4.5 h-4.5" />
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-foreground truncate">
              {t.dueCenter.title}
            </h3>
            <p className="text-[11px] text-foreground-secondary hidden sm:block truncate">
              {t.dueCenter.subtitle}
            </p>
          </div>
        </div>

        {/* Right side: Badges & Chevron Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {urgentCount > 0 && (
            <span className="whitespace-nowrap px-2.5 py-1 rounded-full bg-destructive text-foreground-inverse text-[10px] font-bold animate-pulse leading-none flex items-center gap-1 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-foreground-inverse animate-ping" />
              {urgentCount} {t.dashboard.urgentBadge}
            </span>
          )}
          {urgentCount === 0 && soonCount > 0 && (
            <span className="whitespace-nowrap px-2.5 py-1 rounded-full bg-warning text-foreground-inverse text-[10px] font-bold leading-none flex items-center shadow-2xs">
              {soonCount} {t.dashboard.dueSoonBadge}
            </span>
          )}

          <div className="p-1 rounded-lg text-foreground-muted hover:text-foreground">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* Item List */}
      {isExpanded && (
        <div className="p-3 sm:p-4 pt-0 flex flex-col gap-2 border-t border-border mt-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-3">
            {items.map((item) => {
              const isOverdue = item.daysDiff < 0
              const isToday = item.daysDiff === 0

              return (
                <div
                  key={item.id}
                  className={cn(
                    'p-3 rounded-xl border flex flex-col justify-between gap-3 transition-all',
                    isOverdue || isToday
                      ? 'bg-destructive-muted border-destructive/30'
                      : item.daysDiff <= 7
                        ? 'bg-warning-muted border-warning/30'
                        : 'bg-surface-subtle border-border'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0">
                        {item.source === 'recurring' && <Repeat className="w-4 h-4 text-info" />}
                        {item.source === 'debt' && <Scale className="w-4 h-4 text-warning" />}
                        {item.source === 'goal' && <Target className="w-4 h-4 text-success" />}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-foreground truncate">
                          {item.title}
                        </span>
                        <span className="text-[10px] text-foreground-secondary truncate">
                          {item.subtitle}
                        </span>
                      </div>
                    </div>

                    {/* Urgency Badge */}
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 flex items-center gap-1',
                        isOverdue
                          ? 'bg-destructive-muted text-destructive'
                          : isToday
                            ? 'bg-destructive text-foreground-inverse animate-pulse'
                            : item.daysDiff <= 7
                              ? 'bg-warning-muted text-warning'
                              : 'bg-surface-muted text-foreground-secondary'
                      )}
                    >
                      {isOverdue && <AlertTriangle className="w-3 h-3 shrink-0" />}
                      {isOverdue
                        ? t.dueCenter.overdueAlert.replace('{days}', String(Math.abs(item.daysDiff)))
                        : isToday
                          ? t.dueCenter.todayAlert
                          : t.dueCenter.daysLeft.replace('{days}', String(item.daysDiff))}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-foreground-muted block">
                        {item.source === 'goal' ? 'Sisa Target' : 'Nominal'}
                      </span>
                      <span className="text-xs font-mono font-bold text-foreground tnum">
                        {formatCurrency(item.amount, item.currency)}
                      </span>
                    </div>

                    <Link
                      href={item.link}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface border border-border text-[11px] font-bold text-foreground hover:bg-surface-inverse hover:text-foreground-inverse transition-all cursor-pointer shadow-2xs"
                    >
                      <span>{item.ctaText}</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
