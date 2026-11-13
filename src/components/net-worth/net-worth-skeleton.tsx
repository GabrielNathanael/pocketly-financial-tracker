import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export function NetWorthSkeleton() {
  return (
    <div className="flex flex-col gap-4 max-w-4xl mx-auto animate-in fade-in-50 duration-150" aria-busy="true">
      {/* Hero */}
      <div className="p-5 sm:p-8 rounded-2xl bg-foreground dark:bg-surface flex flex-col gap-4">
        <Skeleton className="h-3 w-40 rounded bg-white/10" />
        <Skeleton className="h-10 w-64 rounded-lg bg-white/10" />
        <Skeleton className="h-3 w-56 rounded bg-white/10" />
      </div>

      {/* Trend chart */}
      <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-border flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Skeleton className="h-4 w-36 rounded bg-muted" />
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-6 w-8 rounded-md bg-surface-subtle" />
            ))}
          </div>
        </div>
        <Skeleton className="h-50 w-full rounded-xl bg-surface-subtle" />
      </div>

      {/* Allocation */}
      <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-border flex flex-col gap-3">
        <Skeleton className="h-4 w-32 rounded bg-muted" />
        <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-5 items-center">
          <Skeleton className="mx-auto h-50 w-50 rounded-full bg-surface-subtle" />
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl bg-surface-subtle" />
            ))}
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-surface border border-border flex flex-col gap-3">
          <Skeleton className="h-4 w-32 rounded bg-muted" />
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl bg-surface-subtle" />
          ))}
        </div>
        <div className="p-5 rounded-2xl bg-surface border border-border flex flex-col gap-3">
          <Skeleton className="h-4 w-32 rounded bg-muted" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl bg-surface-subtle" />
          ))}
        </div>
      </div>
    </div>
  )
}
