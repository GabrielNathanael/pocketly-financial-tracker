'use client'

import React, { useState, useMemo } from 'react'
import { EnrichedTransaction } from '@/types/database'
import { formatCurrency, convertAmount } from '@/lib/utils/currency'
import { useLanguage } from '@/lib/i18n/language-context'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
  isWithinInterval,
  parseISO,
} from 'date-fns'

interface CashflowChartWidgetProps {
  transactions: EnrichedTransaction[]
  exchangeRate?: number
}

type PeriodFilter = 'this_week' | 'this_month' | 'last_month' | 'all'

export function CashflowChartWidget({
  transactions,
  exchangeRate = 16000,
}: CashflowChartWidgetProps) {
  const { t } = useLanguage()
  const [period, setPeriod] = useState<PeriodFilter>('this_month')
  const [activeTab, setActiveTab] = useState<'cashflow' | 'categories'>('cashflow')

  const now = new Date()

  // Filter transactions by selected period
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const txDate = parseISO(tx.transaction_date)

      if (period === 'this_week') {
        const start = startOfWeek(now, { weekStartsOn: 1 })
        const end = endOfWeek(now, { weekStartsOn: 1 })
        return isWithinInterval(txDate, { start, end })
      }

      if (period === 'this_month') {
        const start = startOfMonth(now)
        const end = endOfMonth(now)
        return isWithinInterval(txDate, { start, end })
      }

      if (period === 'last_month') {
        const lastMonth = subMonths(now, 1)
        const start = startOfMonth(lastMonth)
        const end = endOfMonth(lastMonth)
        return isWithinInterval(txDate, { start, end })
      }

      return true
    })
  }, [transactions, period, now])

  // Compute Aggregates in IDR
  const { totalIncome, totalExpense, netSavings, categoryDistribution } = useMemo(() => {
    let income = 0
    let expense = 0
    const catMap = new Map<string, { name: string; icon: string; amount: number; count: number }>()

    for (const tx of filteredTransactions) {
      const amtIdr = convertAmount(Number(tx.amount), tx.currency, 'IDR', exchangeRate)

      if (tx.type === 'income') {
        income += amtIdr
      } else {
        expense += amtIdr

        const catId = tx.category_id || 'other'
        const catName = tx.category?.name || 'Other'
        const catIcon = tx.category?.icon || 'Tag'

        const existing = catMap.get(catId) || { name: catName, icon: catIcon, amount: 0, count: 0 }
        existing.amount += amtIdr
        existing.count += 1
        catMap.set(catId, existing)
      }
    }

    const net = income - expense
    const sortedCats = Array.from(catMap.values()).sort((a, b) => b.amount - a.amount)

    return {
      totalIncome: income,
      totalExpense: expense,
      netSavings: net,
      categoryDistribution: sortedCats,
    }
  }, [filteredTransactions, exchangeRate])

  const maxCompare = Math.max(totalIncome, totalExpense, 1)
  const incomeBarWidth = Math.min(100, Math.max(2, (totalIncome / maxCompare) * 100))
  const expenseBarWidth = Math.min(100, Math.max(2, (totalExpense / maxCompare) * 100))

  return (
    <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-4 shadow-2xs">
      {/* Header with Period Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#F1F3F5] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] flex items-center justify-center shrink-0">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
              {t.dashboard.cashflowAnalyticsTitle}
            </h2>
            <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              {filteredTransactions.length} {t.dashboard.transactionsInPeriod}
            </span>
          </div>
        </div>

        {/* Period Chips */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar shrink-0">
          {[
            { id: 'this_week', label: t.dashboard.periodThisWeek },
            { id: 'this_month', label: t.dashboard.periodThisMonth },
            { id: 'last_month', label: t.dashboard.periodLastMonth },
            { id: 'all', label: t.dashboard.periodAll },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id as PeriodFilter)}
              className={cn(
                'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors shrink-0 whitespace-nowrap cursor-pointer border',
                period === p.id
                  ? 'bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A] border-transparent'
                  : 'bg-[#F8F9FA] dark:bg-[#1A1A20] text-[#64748B] dark:text-[#94A3B8] border-[#E5E7EB] dark:border-[#27272A] hover:bg-[#F1F3F5] dark:hover:bg-[#26262E]'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 font-mono tnum text-xs">
        {/* Income Card */}
        <div className="p-3 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-0.5">
          <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#0D9488] flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3 stroke-[2.5]" />
            {t.dashboard.inflow}
          </span>
          <span className="text-xs sm:text-sm font-bold text-[#0D9488] truncate">
            {formatCurrency(totalIncome, 'IDR')}
          </span>
        </div>

        {/* Expense Card */}
        <div className="p-3 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-0.5">
          <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#E11D48] flex items-center gap-1">
            <ArrowDownRight className="w-3 h-3 stroke-[2.5]" />
            {t.dashboard.outflow}
          </span>
          <span className="text-xs sm:text-sm font-bold text-[#E11D48] truncate">
            {formatCurrency(totalExpense, 'IDR')}
          </span>
        </div>

        {/* Net Delta Card */}
        <div className="p-3 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-0.5">
          <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
            {t.dashboard.netSavings}
          </span>
          <span
            className={cn(
              'text-xs sm:text-sm font-bold truncate',
              netSavings >= 0 ? 'text-[#0D9488]' : 'text-[#E11D48]'
            )}
          >
            {netSavings >= 0 ? '+' : ''}{formatCurrency(netSavings, 'IDR')}
          </span>
        </div>
      </div>

      {/* Sub-view Switcher Tabs */}
      <div className="flex items-center justify-between pt-1 border-t border-[#E5E7EB] dark:border-[#27272A]">
        <div className="inline-flex p-0.5 bg-[#F1F3F5] dark:bg-[#1A1A20] rounded-lg border border-[#E5E7EB] dark:border-[#27272A]">
          <button
            type="button"
            onClick={() => setActiveTab('cashflow')}
            className={cn(
              'px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer',
              activeTab === 'cashflow'
                ? 'bg-white dark:bg-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] shadow-2xs'
                : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]'
            )}
          >
            {t.dashboard.cashflowCompareTab}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={cn(
              'px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer',
              activeTab === 'categories'
                ? 'bg-white dark:bg-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] shadow-2xs'
                : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]'
            )}
          >
            {t.dashboard.categoryDistTab} ({categoryDistribution.length})
          </button>
        </div>
      </div>

      {/* View 1: Comparative Cashflow Bars */}
      {activeTab === 'cashflow' && (
        <div className="flex flex-col gap-3">
          {/* Inflow Bar */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-sans font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                {t.dashboard.totalIncome}
              </span>
              <span className="font-bold text-[#0D9488] tnum">
                {formatCurrency(totalIncome, 'IDR')}
              </span>
            </div>
            <div className="w-full bg-[#F1F3F5] dark:bg-[#1A1A20] h-3 rounded-full overflow-hidden border border-[#E5E7EB] dark:border-[#27272A]">
              <div
                className="h-full bg-[#0D9488] rounded-full transition-all duration-500"
                style={{ width: `${incomeBarWidth}%` }}
              />
            </div>
          </div>

          {/* Outflow Bar */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-sans font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                {t.dashboard.totalExpense}
              </span>
              <span className="font-bold text-[#E11D48] tnum">
                {formatCurrency(totalExpense, 'IDR')}
              </span>
            </div>
            <div className="w-full bg-[#F1F3F5] dark:bg-[#1A1A20] h-3 rounded-full overflow-hidden border border-[#E5E7EB] dark:border-[#27272A]">
              <div
                className="h-full bg-[#E11D48] rounded-full transition-all duration-500"
                style={{ width: `${expenseBarWidth}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* View 2: Category Breakdown List & Bars */}
      {activeTab === 'categories' && (
        <div className="flex flex-col gap-2.5">
          {categoryDistribution.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#94A3B8]">
              {t.dashboard.noExpenseInPeriod}
            </div>
          ) : (
            categoryDistribution.map((cat, idx) => {
              const pct = totalExpense > 0 ? (cat.amount / totalExpense) * 100 : 0

              return (
                <div key={idx} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded bg-[#F1F3F5] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] flex items-center justify-center shrink-0">
                        <DynamicIcon name={cat.icon} className="w-3 h-3" />
                      </div>
                      <span className="font-medium text-[#0F172A] dark:text-[#F8FAFC] truncate">
                        {cat.name}
                      </span>
                      <span className="text-[10px] text-[#94A3B8] font-mono">
                        ({cat.count}x)
                      </span>
                    </div>

                    <div className="flex items-center gap-2 font-mono shrink-0 ml-2">
                      <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC] tnum">
                        {formatCurrency(cat.amount, 'IDR')}
                      </span>
                      <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] w-8 text-right tnum">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  <div className="w-full bg-[#F1F3F5] dark:bg-[#1A1A20] h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0F172A] dark:bg-[#FAFAFA] rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
