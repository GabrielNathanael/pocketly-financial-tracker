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
  let barColor = 'bg-[#0D9488]' // crisp teal green
  if (percentage >= 100) {
    barColor = 'bg-[#E11D48]' // crisp crimson
  } else if (percentage >= 85) {
    barColor = 'bg-[#D97706]' // crisp amber
  } else if (percentage >= 70) {
    barColor = 'bg-[#CA8A04]' // crisp yellow-amber
  }

  return (
    <div className={cn('w-full flex flex-col gap-1', className)}>
      <div className="w-full h-1.5 bg-[#E5E7EB] dark:bg-[#27272A] rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300 ease-out', barColor)}
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>
    </div>
  )
}
