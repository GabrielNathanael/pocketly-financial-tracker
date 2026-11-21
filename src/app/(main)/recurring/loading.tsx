import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function RecurringLoading() {
  return (
    <div
      className="flex flex-col gap-6 animate-in fade-in-50 duration-150"
      aria-busy="true"
      aria-live="polite"
    >
      {/* 1. Header with title, subtitle & Add button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-6 w-44 rounded-md bg-surface-muted" />
          <Skeleton className="h-3.5 w-56 rounded-md bg-surface-subtle" />
        </div>
        <Skeleton className="h-9 w-32 rounded-xl bg-surface-muted self-start sm:self-auto" />
      </div>

      {/* 2. Scorecard: 4 metric cards (2 cols on mobile, 4 on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border shadow-2xs flex flex-col justify-between gap-1.5"
          >
            <div className="flex items-center justify-between gap-1 min-h-[22px]">
              <Skeleton className="h-2.5 w-18 rounded-md bg-surface-subtle" />
              <Skeleton className="w-3.5 h-3.5 rounded bg-surface-subtle" />
            </div>
            <div className="flex flex-col gap-1">
              <Skeleton className="h-5 sm:h-6 w-24 sm:w-28 rounded-md bg-surface-muted" />
              <Skeleton className="h-2.5 w-20 rounded-md bg-surface-subtle" />
            </div>
          </div>
        ))}
      </div>

      {/* 3. Filter tabs (segmented container) + search bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-surface-subtle rounded-xl border border-border overflow-x-auto">
          <Skeleton className="h-7 w-14 rounded-lg bg-surface shrink-0" />
          <Skeleton className="h-7 w-16 rounded-lg bg-transparent shrink-0" />
          <Skeleton className="h-7 w-14 rounded-lg bg-transparent shrink-0" />
          <Skeleton className="h-7 w-14 rounded-lg bg-transparent shrink-0" />
        </div>
        <Skeleton className="h-9 w-full sm:w-64 rounded-xl bg-surface-subtle" />
      </div>

      {/* 4. Recurring cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 sm:p-5 rounded-2xl bg-surface border border-border shadow-2xs flex flex-col justify-between gap-4"
          >
            {/* Card top: icon, name/category & frequency badge */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Skeleton className="w-10 h-10 rounded-xl bg-surface-subtle shrink-0" />
                <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                  <Skeleton className="h-4 w-32 rounded-md bg-surface-muted" />
                  <Skeleton className="h-2.5 w-40 rounded-md bg-surface-subtle" />
                </div>
              </div>
              <Skeleton className="h-5 w-14 rounded-md bg-surface-subtle shrink-0" />
            </div>

            {/* Card middle: next-due details & amount */}
            <div className="flex items-end justify-between gap-3 pt-2 border-t border-border">
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-2.5 w-16 rounded-md bg-surface-subtle" />
                <Skeleton className="h-3.5 w-28 rounded-md bg-surface-muted" />
                <Skeleton className="h-2.5 w-20 rounded-md bg-surface-subtle" />
              </div>
              <Skeleton className="h-5 sm:h-6 w-28 rounded-md bg-surface-muted" />
            </div>

            {/* Card bottom: icon actions & process button */}
            <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4].map((j) => (
                  <Skeleton key={j} className="w-6 h-6 rounded-lg bg-surface-subtle" />
                ))}
              </div>
              <Skeleton className="h-8 w-28 rounded-lg bg-surface-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
