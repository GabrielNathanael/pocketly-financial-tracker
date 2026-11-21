import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function GoalHistoryLoading() {
  return (
    <div
      className="flex flex-col gap-5 animate-in fade-in-50 duration-150"
      aria-busy="true"
      aria-live="polite"
    >
      {/* Header: back link, title + entry count, goal name */}
      <div className="flex flex-col gap-1.5">
        <div className="inline-flex items-center gap-1.5 w-fit">
          <Skeleton className="w-3.5 h-3.5 rounded bg-surface-subtle" />
          <Skeleton className="h-2.5 w-24 rounded-md bg-surface-subtle" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Skeleton className="w-4 h-4 rounded bg-surface-subtle shrink-0" />
            <Skeleton className="h-5 sm:h-6 w-40 rounded-md bg-surface-muted" />
          </div>
          <Skeleton className="h-3 w-16 rounded-md bg-surface-subtle shrink-0" />
        </div>
        <Skeleton className="h-2.5 w-32 rounded-md bg-surface-subtle" />
      </div>

      {/* Deposit & withdrawal history list (pagination is conditional and not in the common case) */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="p-3 rounded-xl bg-surface border border-border flex items-center gap-3 shadow-2xs"
            >
              <Skeleton className="w-7 h-7 rounded-lg bg-surface-muted shrink-0" />
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-3 w-40 rounded-md bg-surface-muted" />
                  <Skeleton className="h-3 w-20 rounded-md bg-surface-subtle shrink-0" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-2.5 w-20 rounded-md bg-surface-subtle" />
                  <Skeleton className="h-2.5 w-16 rounded-md bg-surface-subtle" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
