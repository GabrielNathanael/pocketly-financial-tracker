'use client'

import React from 'react'
import Link from 'next/link'
import { EnrichedBudget } from '@/types/database'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { BudgetProgressBar } from '@/components/budget/budget-progress-bar'
import { formatCurrency } from '@/lib/utils/currency'
import { usePrivacyMode, maskCurrency } from '@/lib/storage/privacy-mode'
import { useLanguage } from '@/lib/i18n/language-context'
import { AlertTriangle, ChevronRight, Check } from 'lucide-react'

interface BudgetCardProps {
  budget: EnrichedBudget
  onEditClick?: () => void
}

export function BudgetCard({ budget, onEditClick }: BudgetCardProps) {
  const { t } = useLanguage()
  const isPrivate = usePrivacyMode()
  const cat = budget.category
  const currency = budget.currency || 'IDR'
  const spent = budget.actual_spent || 0
  const budgetAmount = budget.amount || 0
  const remaining = budgetAmount - spent
  const percentage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0
  const isOver = budgetAmount > 0 && spent > budgetAmount

  return (
    <div className="p-4 rounded-xl bg-surface border border-border flex flex-col gap-3 transition-colors hover:border-foreground">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 min-w-0">
        <Link
          href={`/budget/${budget.category_id}?currency=${currency}`}
          className="flex items-center gap-2.5 min-w-0 flex-1 group cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-surface-subtle border border-border text-foreground flex items-center justify-center shrink-0">
            <DynamicIcon name={cat?.icon || 'Tag'} className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs sm:text-sm font-bold text-foreground truncate">
                {cat?.name || t.common.category}
              </span>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-surface-subtle text-foreground-secondary dark:text-foreground-muted border border-border shrink-0">
                {currency}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-foreground-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
            <span className="text-[11px] font-mono text-foreground-secondary dark:text-foreground-muted truncate">
              {budgetAmount > 0
                ? `${percentage.toFixed(0)}% ${t.budgets.consumed}`
                : t.dashboard.noBudgetsSet}
            </span>
          </div>
        </Link>

        {onEditClick && (
          <button
            type="button"
            onClick={onEditClick}
            className="shrink-0 whitespace-nowrap text-xs font-semibold text-foreground hover:bg-surface-subtle border border-border px-2.5 py-1 rounded-md transition-colors cursor-pointer"
          >
            {budgetAmount > 0 ? t.common.edit : `+ ${t.dashboard.setLimits}`}
          </button>
        )}
      </div>

      {/* Progress Bar (Only when limit is active) */}
      {budgetAmount > 0 && <BudgetProgressBar spent={spent} budget={budgetAmount} />}

      {/* Financial breakdown */}
      <div className="flex items-center justify-between text-xs pt-0.5 font-mono tnum">
        {/* Spent column */}
        <div className="flex flex-col">
          <span className="text-foreground-muted text-[10px] uppercase tracking-wider">{t.common.spent}</span>
          <span className="font-bold text-foreground">
            {maskCurrency(formatCurrency(spent, currency), isPrivate)}
          </span>
        </div>

        {/* Limit column */}
        <div className="flex flex-col items-center">
          <span className="text-foreground-muted text-[10px] uppercase tracking-wider">{t.common.limit}</span>
          <span className="font-medium text-foreground-secondary dark:text-foreground-muted">
            {budgetAmount > 0 ? maskCurrency(formatCurrency(budgetAmount, currency), isPrivate) : '—'}
          </span>
        </div>

        {/* Remaining / Deficit column */}
        <div className="flex flex-col items-end">
          <span className="text-foreground-muted text-[10px] uppercase tracking-wider">
            {budgetAmount > 0 ? (isOver ? t.common.deficit : t.common.remaining) : t.common.remaining}
          </span>
          {budgetAmount > 0 ? (
            <span
              className={`font-bold flex items-center gap-1 ${
                isOver ? 'text-destructive' : 'text-success'
              }`}
            >
              {isOver && <AlertTriangle className="w-3 h-3" />}
              {!isOver && <Check className="w-3 h-3" />}
              {maskCurrency(formatCurrency(Math.abs(remaining), currency), isPrivate)}
            </span>
          ) : (
            <span className="font-medium text-foreground-muted">
              —
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
