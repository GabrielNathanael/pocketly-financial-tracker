'use client'

import React from 'react'
import { cn } from '@/lib/utils/cn'

interface BudgetProgressBarProps {
  spent: number
  budget: number
  className?: string
}

export function BudgetProgressBar({ spent, budget, className }: BudgetProgressBarProps) {
  const percentage = budget > 0 ? (spent / budget) * 100 : 0
  const clampedPercentage = Math.min(100, Math.max(0, percentage))

  // Flat color determination
  let barColor = 'bg-success'
  if (percentage >= 100) {
    barColor = 'bg-destructive'
  } else if (percentage >= 85) {
    barColor = 'bg-warning'
  } else if (percentage >= 70) {
    barColor = 'bg-warning'
  }

  return (
    <div className={cn('w-full flex flex-col gap-1', className)}>
      <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300 ease-out', barColor)}
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>
    </div>
  )
}
