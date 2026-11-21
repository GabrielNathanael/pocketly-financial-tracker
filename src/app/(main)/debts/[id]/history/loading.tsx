import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function DebtHistoryLoading() {
  return (
    <div
      className="flex flex-col gap-4 sm:gap-5 max-w-xl mx-auto w-full px-0.5 animate-in fade-in-50 duration-150"
      aria-busy="true"
      aria-live="polite"
    >
      {/* Back to detail link: arrow + short label */}
      <div className="inline-flex items-center gap-1.5 text-xs font-semibold">
        <Skeleton className="w-4 h-4 rounded-sm bg-surface-muted" />
        <Skeleton className="h-3.5 w-12 rounded-md bg-surface-muted" />
      </div>

      {/* History header: icon, title + counterparty, count */}
      <div className="flex items-center justify-between gap-3 px-0.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <Skeleton className="w-8 h-8 rounded-lg bg-surface-subtle border border-border shrink-0" />
          <div className="flex flex-col min-w-0">
            <Skeleton className="h-4 sm:h-5 w-36 sm:w-44 rounded-md bg-surface-muted mb-1" />
            <Skeleton className="h-2.5 w-24 rounded-md bg-surface-subtle" />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Skeleton className="h-3 w-4 rounded-md bg-surface-subtle" />
        </div>
      </div>

      {/* Payment installments list */}
      <div className="flex flex-col gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl bg-surface border border-border"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Skeleton className="w-7 h-7 rounded-full bg-success-muted shrink-0" />
              <div className="flex flex-col min-w-0">
                <Skeleton className="h-3.5 sm:h-4 w-28 sm:w-36 rounded-md bg-surface-muted mb-1" />
                <div className="flex items-center gap-1">
                  <Skeleton className="w-3 h-3 rounded-sm bg-surface-subtle" />
                  <Skeleton className="h-2.5 w-32 sm:w-40 rounded-md bg-surface-subtle" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Skeleton className="w-7 h-7 rounded-md bg-surface-subtle" />
              <Skeleton className="w-7 h-7 rounded-md bg-surface-subtle" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
