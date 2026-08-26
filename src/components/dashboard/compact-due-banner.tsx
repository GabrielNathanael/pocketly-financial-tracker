'use client'

import React from 'react'
import Link from 'next/link'
import { EnrichedRecurringTransaction, EnrichedSavingsGoal, Account } from '@/types/database'
import { EnrichedDebtWithPayments } from '@/actions/debts'
import { useLanguage } from '@/lib/i18n/language-context'
import { usePreferredCurrency } from '@/lib/storage/preferred-currency'
import { formatCurrency, convertAmount } from '@/lib/utils/currency'
import {
  CalendarClock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  BellRing,
} from 'lucide-react'
import { differenceInCalendarDays, parseISO } from 'date-fns'

interface CompactDueBannerProps {
  recurringTransactions: EnrichedRecurringTransaction[]
  debts: EnrichedDebtWithPayments[]
  goals: EnrichedSavingsGoal[]
  accounts: Account[]
  exchangeRate?: number
}

export function CompactDueBanner({
  recurringTransactions,
  debts,
  goals,
  exchangeRate = 15800,
}: CompactDueBannerProps) {
  const { t, language } = useLanguage()
  const displayCurrency = usePreferredCurrency()
  const today = new Date()

  let overdueCount = 0
  let todayCount = 0
  let upcomingWeekCount = 0
  let totalUrgentAmount = 0

  // 1. Recurring
  recurringTransactions.forEach((rec) => {
    if (!rec.is_active) return
    const dueDate = parseISO(rec.next_due_date)
    const diff = differenceInCalendarDays(dueDate, today)
    const amt = convertAmount(Number(rec.amount), rec.currency, displayCurrency, exchangeRate)

    if (diff < 0) {
      overdueCount++
      totalUrgentAmount += amt
    } else if (diff === 0) {
      todayCount++
      totalUrgentAmount += amt
    } else if (diff <= 7) {
      upcomingWeekCount++
    }
  })

  // 2. Debts
  debts.forEach((debt) => {
    if (debt.status !== 'active' || !debt.due_date) return
    const dueDate = parseISO(debt.due_date)
    const diff = differenceInCalendarDays(dueDate, today)
    const amt = convertAmount(Number(debt.remaining_amount), debt.currency, displayCurrency, exchangeRate)

    if (diff < 0) {
      overdueCount++
      totalUrgentAmount += amt
    } else if (diff === 0) {
      todayCount++
      totalUrgentAmount += amt
    } else if (diff <= 7) {
      upcomingWeekCount++
    }
  })

  // 3. Goals
  let upcomingGoalsCount = 0
  goals.forEach((goal) => {
    if (goal.status !== 'in_progress' || !goal.target_date) return
    const dueDate = parseISO(goal.target_date)
    const diff = differenceInCalendarDays(dueDate, today)
    if (diff >= 0 && diff <= 30) {
      upcomingGoalsCount++
    }
  })

  const totalUrgentCount = overdueCount + todayCount

  // If completely clear
  if (totalUrgentCount === 0 && upcomingWeekCount === 0 && upcomingGoalsCount === 0) {
    return (
      <div className="py-2.5 px-4 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between text-xs text-[#64748B] dark:text-[#94A3B8]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <span className="font-medium truncate">{t.dueCenter.allClear}</span>
        </div>
        <Link
          href="/due-center"
          className="text-[11px] font-semibold text-[#0F172A] dark:text-[#FAFAFA] hover:underline flex items-center gap-1 shrink-0 ml-2"
        >
          <span>{language === 'en' ? 'View Schedule' : 'Jadwal Lengkap'}</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    )
  }

  return (
    <div
      className={
        totalUrgentCount > 0
          ? 'p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-transparent border border-rose-500/30 dark:border-rose-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs'
          : 'p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs'
      }
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={
            totalUrgentCount > 0
              ? 'w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse'
              : 'w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0'
          }
        >
          {totalUrgentCount > 0 ? (
            <BellRing className="w-4.5 h-4.5" />
          ) : (
            <CalendarClock className="w-4.5 h-4.5" />
          )}
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              {totalUrgentCount > 0
                ? `${totalUrgentCount} ${language === 'en' ? 'Urgent Commitments Due' : 'Tagihan Perlu Dibayar Segera'}`
                : `${upcomingWeekCount + upcomingGoalsCount} ${language === 'en' ? 'Upcoming Dues This Month' : 'Jadwal Keuangan Mendatang'}`}
            </span>
            {totalUrgentAmount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300 font-mono font-bold text-[11px]">
                {formatCurrency(totalUrgentAmount, displayCurrency)}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate mt-0.5">
            {[
              overdueCount > 0 ? `${overdueCount} ${language === 'en' ? 'overdue' : 'terlewat'}` : null,
              todayCount > 0 ? `${todayCount} ${language === 'en' ? 'due today' : 'jatuh tempo hari ini'}` : null,
              upcomingWeekCount > 0 ? `${upcomingWeekCount} ${language === 'en' ? 'in next 7 days' : '7 hari ke depan'}` : null,
              upcomingGoalsCount > 0 ? `${upcomingGoalsCount} ${language === 'en' ? 'goals deadline' : 'target tabungan'}` : null,
            ]
              .filter(Boolean)
              .join(' • ')}
          </p>
        </div>
      </div>

      <Link
        href="/due-center"
        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0F172A] dark:bg-[#FAFAFA] text-white dark:text-[#0F172A] text-xs font-bold hover:opacity-90 active:scale-95 transition-all shrink-0 cursor-pointer shadow-xs"
      >
        <span>{language === 'en' ? 'Open Due Center' : 'Buka Pusat Tagihan'}</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  )
}
