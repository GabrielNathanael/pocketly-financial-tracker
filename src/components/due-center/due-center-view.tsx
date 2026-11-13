'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { EnrichedRecurringTransaction, EnrichedSavingsGoal, Account } from '@/types/database'
import { EnrichedDebtWithPayments } from '@/actions/debts'
import { processRecurringPayment } from '@/actions/recurring'
import { useLanguage } from '@/lib/i18n/language-context'
import { formatCurrency } from '@/lib/utils/currency'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Search,
  Check,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { toast } from 'sonner'

interface DueCenterViewProps {
  recurringTransactions: EnrichedRecurringTransaction[]
  debts: EnrichedDebtWithPayments[]
  goals: EnrichedSavingsGoal[]
  accounts: Account[]
  exchangeRate?: number
}

interface DueItem {
  id: string
  source: 'recurring' | 'debt' | 'goal'
  rawId: string
  title: string
  subtitle: string
  amount: number
  currency: string
  dueDate: string
  daysDiff: number
  icon: string
  color?: string
  link: string
  ctaText: string
  accountName?: string
  categoryName?: string
}

export function DueCenterView({
  recurringTransactions,
  debts,
  goals,
}: DueCenterViewProps) {
  const { t } = useLanguage()
  const router = useRouter()
  const [filterSource, setFilterSource] = useState<'all' | 'recurring' | 'debt' | 'goal'>('all')
  const [filterUrgency, setFilterUrgency] = useState<'all' | 'overdue' | 'today' | 'soon' | 'later'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)

  const today = new Date()
  const items: DueItem[] = []

  // 1. Process Recurring Transactions
  recurringTransactions.forEach((rec) => {
    if (!rec.is_active) return
    const dueDate = parseISO(rec.next_due_date)
    const daysDiff = differenceInCalendarDays(dueDate, today)

    items.push({
      id: `rec-${rec.id}`,
      rawId: rec.id,
      source: 'recurring',
      title: rec.name,
      subtitle: rec.category?.name || t.dueCenter.recurringBill,
      amount: Number(rec.amount),
      currency: rec.currency,
      dueDate: rec.next_due_date,
      daysDiff,
      icon: rec.category?.icon || 'Repeat',
      color: 'var(--token-muted-foreground)',
      link: '/recurring',
      ctaText: t.dueCenter.payBill,
      accountName: rec.account?.name,
      categoryName: rec.category?.name,
    })
  })

  // 2. Process Debts
  debts.forEach((debt) => {
    if (debt.status !== 'active' || !debt.due_date) return
    const dueDate = parseISO(debt.due_date)
    const daysDiff = differenceInCalendarDays(dueDate, today)
    const remainingAmount = Number(debt.remaining_amount)

    items.push({
      id: `debt-${debt.id}`,
      rawId: debt.id,
      source: 'debt',
      title: `${debt.type === 'debt' ? t.dueCenter.payDebt : t.dueCenter.collectLoan}: ${debt.counterparty_name}`,
      subtitle: debt.notes || t.dueCenter.debtDue,
      amount: remainingAmount,
      currency: debt.currency,
      dueDate: debt.due_date,
      daysDiff,
      icon: 'Scale',
      color: debt.type === 'debt' ? 'var(--token-destructive)' : 'var(--token-success)',
      link: `/debts/${debt.id}`,
      ctaText: t.dueCenter.payInstallment,
    })
  })

  // 3. Process Goals
  goals.forEach((goal) => {
    if (goal.status !== 'in_progress' || !goal.target_date) return
    const dueDate = parseISO(goal.target_date)
    const daysDiff = differenceInCalendarDays(dueDate, today)
    const remainingAmount = Math.max(0, Number(goal.target_amount) - Number(goal.current_amount))

    items.push({
      id: `goal-${goal.id}`,
      rawId: goal.id,
      source: 'goal',
      title: goal.name,
      subtitle: t.dueCenter.goalDue,
      amount: remainingAmount,
      currency: goal.currency,
      dueDate: goal.target_date,
      daysDiff,
      icon: goal.icon || 'Target',
      color: goal.color || 'var(--token-info)',
      link: '/goals',
      ctaText: t.dueCenter.depositGoal,
      categoryName: goal.category?.name,
    })
  })

  // Sort by urgency: most overdue first, then closest due date
  items.sort((a, b) => a.daysDiff - b.daysDiff)

  // Compute urgency counts
  const overdueCount = items.filter((i) => i.daysDiff < 0).length
  const todayCount = items.filter((i) => i.daysDiff === 0).length
  const soonCount = items.filter((i) => i.daysDiff > 0 && i.daysDiff <= 7).length
  const laterCount = items.filter((i) => i.daysDiff > 7).length

  // Filter by source, urgency, and search query
  const filteredItems = items.filter((item) => {
    if (filterSource !== 'all' && item.source !== filterSource) return false
    
    if (filterUrgency === 'overdue' && item.daysDiff >= 0) return false
    if (filterUrgency === 'today' && item.daysDiff !== 0) return false
    if (filterUrgency === 'soon' && (item.daysDiff <= 0 || item.daysDiff > 7)) return false
    if (filterUrgency === 'later' && item.daysDiff <= 7) return false

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        (item.accountName && item.accountName.toLowerCase().includes(q))
      )
    }
    return true
  })

  // Direct Pay Recurring handler
  const handleQuickPayRecurring = async (recurringId: string) => {
    setProcessingId(recurringId)
    try {
      const res = await processRecurringPayment(recurringId)
      if (res.error) {
        toast.error('Gagal Memproses Tagihan', { description: res.error })
      } else {
        toast.success(t.dueCenter.billPaymentSuccess)
        router.refresh()
      }
    } catch (err: unknown) {
      toast.error('Terjadi Kesalahan', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-warning-muted text-warning flex items-center justify-center shrink-0">
            <CalendarClock className="w-5 h-5" />
          </div>
          <span>{t.dueCenter.centerTitle}</span>
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          {t.dueCenter.subtitle}
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl bg-surface border border-border shadow-xs">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-50">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.dueCenter.searchPlaceholder}
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-canvas dark:bg-surface-subtle border border-border text-xs font-medium text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-border-strong transition-colors"
          />
        </div>

        {/* Dropdown Filters Container */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Source Select */}
          <div className="flex-1 sm:flex-none min-w-40">
            <Select
              value={filterSource}
              onValueChange={(val) =>
                setFilterSource(val as "all" | "recurring" | "debt" | "goal")
              }
            >
              <SelectTrigger className="px-3 py-2 rounded-xl bg-canvas dark:bg-surface-subtle text-xs font-semibold">
                <SelectValue placeholder={t.dueCenter.allSources} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t.dueCenter.allSourcesCount.replace('{count}', String(items.length))}
                </SelectItem>
                <SelectItem value="recurring">
                  {t.dueCenter.recurringCount.replace('{count}', String(items.filter((i) => i.source === 'recurring').length))}
                </SelectItem>
                <SelectItem value="debt">
                  {t.dueCenter.debtsCount.replace('{count}', String(items.filter((i) => i.source === 'debt').length))}
                </SelectItem>
                <SelectItem value="goal">
                  {t.dueCenter.goalsCount.replace('{count}', String(items.filter((i) => i.source === 'goal').length))}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Urgency Select */}
          <div className="flex-1 sm:flex-none min-w-40">
            <Select
              value={filterUrgency}
              onValueChange={(val) =>
                setFilterUrgency(val as "all" | "overdue" | "today" | "soon" | "later")
              }
            >
              <SelectTrigger className="px-3 py-2 rounded-xl bg-canvas dark:bg-surface-subtle text-xs font-semibold">
                <SelectValue placeholder={t.dueCenter.allUrgencies} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t.dueCenter.allUrgencies}
                </SelectItem>
                <SelectItem value="overdue">
                  {t.dueCenter.overdueFilter.replace('{count}', String(overdueCount))}
                </SelectItem>
                <SelectItem value="today">
                  {t.dueCenter.dueTodayFilter.replace('{count}', String(todayCount))}
                </SelectItem>
                <SelectItem value="soon">
                  {t.dueCenter.dueSoonFilter.replace('{count}', String(soonCount))}
                </SelectItem>
                <SelectItem value="later">
                  {t.dueCenter.laterFilter.replace('{count}', String(laterCount))}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Main Schedule List */}
      {filteredItems.length === 0 ? (
        <div className="p-10 rounded-2xl bg-surface border border-border text-center flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-success-muted text-success flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {t.dueCenter.allClear}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              {t.dueCenter.noMatches}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
          {filteredItems.map((item) => {
            const isOverdue = item.daysDiff < 0
            const isToday = item.daysDiff === 0
            const isUrgent = item.daysDiff <= 7

            return (
              <div
                key={item.id}
                className={cn(
                  'p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 shadow-2xs hover:shadow-sm',
                  isOverdue
                    ? 'bg-destructive-muted border-destructive/30'
                    : isToday
                    ? 'bg-warning-muted border-warning/30'
                    : 'bg-surface border-border'
                )}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-primary-foreground shrink-0 shadow-xs"
                      style={{ backgroundColor: item.color || 'var(--token-info)' }}
                    >
                      <DynamicIcon name={item.icon} className="w-5 h-5" />
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground truncate">
                          {item.title}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {item.subtitle}
                        {item.accountName && ` • ${item.accountName}`}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 flex items-center gap-1',
                      isOverdue
                        ? 'bg-destructive text-destructive-foreground'
                        : isToday
                        ? 'bg-warning text-warning-foreground'
                        : isUrgent
                        ? 'bg-info-muted text-info'
                        : 'bg-muted dark:bg-accent text-muted-foreground'
                    )}
                  >
                    {isOverdue && <AlertTriangle className="w-3 h-3" />}
                    {isToday && <Clock className="w-3 h-3" />}
                    <span>
                      {isOverdue
                        ? t.dueCenter.overdueAlert.replace('{days}', String(Math.abs(item.daysDiff)))
                        : isToday
                        ? t.dueCenter.todayAlert
                        : t.dueCenter.daysLeft.replace('{days}', String(item.daysDiff))}
                    </span>
                  </span>
                </div>

                {/* Amount & Action Row */}
                <div className="pt-3 border-t border-border flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-foreground-muted block leading-none">
                      {t.dueCenter.amountDue}
                    </span>
                    <span className="font-mono font-black text-sm sm:text-base text-foreground mt-0.5 block">
                      {formatCurrency(item.amount, item.currency)}
                    </span>
                  </div>

                  {item.source === 'recurring' ? (
                    <button
                      type="button"
                      disabled={processingId === item.rawId}
                      onClick={() => handleQuickPayRecurring(item.rawId)}
                      className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary-hover active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      {processingId === item.rawId ? (
                        <span>{t.dueCenter.processing}</span>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>{t.dueCenter.payBill}</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <Link
                      href={item.link}
                      className="px-3.5 py-1.5 rounded-xl bg-surface dark:bg-surface-subtle border border-border text-foreground text-xs font-bold hover:bg-surface-subtle dark:hover:bg-surface-muted active:scale-95 transition-all cursor-pointer flex items-center gap-1 shrink-0 shadow-2xs"
                    >
                      <span>{item.ctaText}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
