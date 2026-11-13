import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function RecurringLoading() {
  return (
    <div className="flex flex-col gap-5 animate-in fade-in-50 duration-150" aria-busy="true" aria-live="polite">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-6 w-40 rounded-md bg-surface-muted" />
        <Skeleton className="h-3.5 w-56 rounded-md bg-surface-subtle" />
      </div>

      {/* Monthly Commitment Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-border shadow-2xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3.5 w-32 rounded-md bg-surface-muted" />
          <Skeleton className="h-3 w-20 rounded-md bg-surface-subtle" />
        </div>
        <Skeleton className="h-8 w-44 rounded-lg bg-surface-muted" />
      </div>

      {/* Action & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Skeleton className="h-9 w-full sm:w-36 rounded-xl bg-surface-muted" />
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-8 w-16 rounded-lg bg-surface-muted" />
          <Skeleton className="h-8 w-20 rounded-lg bg-surface-subtle" />
          <Skeleton className="h-8 w-20 rounded-lg bg-surface-subtle" />
        </div>
      </div>

      {/* List Cards */}
      <div className="flex flex-col gap-2.5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-3.5 sm:p-4 rounded-xl bg-surface border border-border shadow-2xs flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-xl bg-surface-subtle" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-32 rounded-md bg-surface-muted" />
                <Skeleton className="h-2.5 w-24 rounded-md bg-surface-subtle" />
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Skeleton className="h-4 w-24 rounded-md bg-surface-muted" />
              <Skeleton className="h-2.5 w-16 rounded-md bg-surface-subtle" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
