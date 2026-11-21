import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function DebtDetailLoading() {
  return (
    <div
      className="flex flex-col gap-4 sm:gap-5 max-w-xl mx-auto w-full px-0.5 animate-in fade-in-50 duration-150"
      aria-busy="true"
      aria-live="polite"
    >
      {/* Top Navigation: back-to-debts link (left) + history icon button (right) */}
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold">
          <Skeleton className="w-4 h-4 rounded-sm bg-surface-muted" />
          <Skeleton className="h-3.5 w-32 rounded-md bg-surface-muted" />
        </div>
        <Skeleton className="h-9 w-9 flex items-center justify-center rounded-xl border border-border bg-surface shrink-0" />
      </div>

      {/* Main Debt Overview Card */}
      <div className="p-4 sm:p-6 rounded-2xl bg-surface border border-border flex flex-col gap-4 sm:gap-5 shadow-2xs">
        {/* Header with Type & Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Skeleton className="w-10 h-10 rounded-xl bg-surface-subtle border border-border shrink-0" />
            <div className="flex flex-col min-w-0">
              <Skeleton className="h-5 sm:h-6 w-40 sm:w-48 rounded-md bg-surface-muted mb-1" />
              <Skeleton className="h-2.5 w-20 rounded-md bg-surface-subtle" />
            </div>
          </div>
          <Skeleton className="h-5 w-16 rounded-md bg-surface-subtle shrink-0" />
        </div>

        {/* Progress Bar & Summary */}
        <div className="flex flex-col gap-1.5">
          <Skeleton className="w-full h-2 rounded-full bg-surface-muted" />
          <div className="flex flex-wrap items-center justify-between gap-1">
            <Skeleton className="h-2.5 w-36 rounded-md bg-surface-muted" />
            <div className="flex items-center gap-1">
              <Skeleton className="w-3 h-3 rounded-sm bg-surface-subtle" />
              <Skeleton className="h-2.5 w-24 rounded-md bg-surface-subtle" />
            </div>
          </div>
        </div>

        {/* Amount Stack */}
        <div className="flex flex-col gap-2.5 pt-2 sm:pt-3 border-t border-border font-mono tnum text-xs">
          <div className="p-3 sm:p-3.5 rounded-xl bg-surface-subtle border border-border">
            <Skeleton className="h-2.5 w-24 rounded-md bg-surface-muted mb-1.5 block" />
            <Skeleton className="h-5 sm:h-6 w-36 rounded-md bg-surface-muted block" />
          </div>
          <div className="p-3 sm:p-3.5 rounded-xl bg-surface-subtle border border-border">
            <Skeleton className="h-2.5 w-28 rounded-md bg-surface-muted mb-1.5 block" />
            <Skeleton className="h-5 sm:h-6 w-40 rounded-md bg-surface-muted block" />
          </div>
        </div>

        {/* Terms Notes */}
        <div className="p-3 rounded-xl bg-surface-subtle border border-border flex items-start gap-2.5">
          <Skeleton className="w-4 h-4 rounded-md bg-surface-muted shrink-0 mt-0.5" />
          <div className="flex flex-col min-w-0 flex-1">
            <Skeleton className="h-2.5 w-20 rounded-md bg-surface-muted mb-1" />
            <Skeleton className="h-3 w-full rounded-md bg-surface-subtle" />
          </div>
        </div>

        {/* Action Buttons: primary row + 3 equal secondary buttons */}
        <div className="flex flex-col gap-2 pt-2 border-t border-border">
          <Skeleton className="h-10 w-full rounded-xl bg-surface-muted" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-10 w-full rounded-xl bg-surface-subtle" />
            <Skeleton className="h-10 w-full rounded-xl bg-surface-subtle" />
            <Skeleton className="h-10 w-full rounded-xl bg-surface-subtle" />
          </div>
        </div>
      </div>
    </div>
  )
}
