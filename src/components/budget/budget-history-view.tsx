'use client'

import React from 'react'
import Link from 'next/link'
import { Category } from '@/types/database'
import { CategoryHistoryItem } from '@/actions/budgets'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { BudgetProgressBar } from '@/components/budget/budget-progress-bar'
import { formatCurrency } from '@/lib/utils/currency'
import { usePrivacyMode, maskCurrency } from '@/lib/storage/privacy-mode'
import { CurrencyCode } from '@/lib/constants/currencies'
import { useLanguage } from '@/lib/i18n/language-context'
import { ArrowLeft, AlertTriangle } from 'lucide-react'

interface BudgetHistoryViewProps {
  category: Category
  currency?: CurrencyCode
  history: CategoryHistoryItem[]
}

export function BudgetHistoryView({ category, currency = 'IDR', history }: BudgetHistoryViewProps) {
  const { t } = useLanguage()
  const isPrivate = usePrivacyMode()

  return (
    <div className="flex flex-col gap-5 max-w-xl mx-auto">
      <div>
        <Link
          href="/budget"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-secondary hover:text-foreground dark:hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.budgets.backToBudgets}</span>
        </Link>
      </div>

      {/* Category Header Card */}
      <div className="p-5 rounded-xl bg-surface border border-border flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-lg bg-surface-subtle border border-border text-foreground flex items-center justify-center shrink-0">
          <DynamicIcon name={category.icon} className="w-5 h-5" />
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-foreground">
              {category.name}
            </h1>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-surface-subtle text-foreground-secondary dark:text-foreground-muted border border-border">
              {currency}
            </span>
          </div>
          <p className="text-xs text-foreground-secondary dark:text-foreground-muted font-mono">
            {t.budgets.historySubtitle}
          </p>
        </div>
      </div>

      {/* 6-Month Historical List */}
      <div className="flex flex-col gap-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-foreground px-0.5">
          {t.budgets.historyTitle}
        </h2>

        {history.map((item) => {
          const isOver = item.budgetAmount > 0 && item.actualSpent > item.budgetAmount
          const pct = item.budgetAmount > 0 ? (item.actualSpent / item.budgetAmount) * 100 : 0

          return (
            <div
              key={item.periodStart}
              className="p-4 rounded-xl bg-surface border border-border flex flex-col gap-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">
                  {item.periodLabel}
                </span>
                <span
                  className={`text-xs font-mono font-bold flex items-center gap-1 ${
                    isOver ? 'text-destructive' : 'text-foreground-secondary dark:text-foreground-muted'
                  }`}
                >
                  {isOver && <AlertTriangle className="w-3.5 h-3.5" />}
                  {item.budgetAmount > 0 ? `${pct.toFixed(0)}% ${t.budgets.consumed}` : '—'}
                </span>
              </div>

              {item.budgetAmount > 0 && (
                <BudgetProgressBar spent={item.actualSpent} budget={item.budgetAmount} />
              )}

              <div className="flex items-center justify-between text-xs pt-1 border-t border-border font-mono tnum">
                <div>
                  <span className="text-[10px] font-sans text-foreground-muted uppercase tracking-wider block">
                    {t.budgets.actualSpent}
                  </span>
                  <span className="font-bold text-foreground">
                    {maskCurrency(formatCurrency(item.actualSpent, currency), isPrivate)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-sans text-foreground-muted uppercase tracking-wider block">
                    {t.budgets.totalLimit}
                  </span>
                  <span className="font-medium text-foreground-secondary dark:text-foreground-muted">
                    {item.budgetAmount > 0 ? maskCurrency(formatCurrency(item.budgetAmount, currency), isPrivate) : '—'}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
