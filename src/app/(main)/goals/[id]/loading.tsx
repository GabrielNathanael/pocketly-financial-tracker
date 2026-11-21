import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function GoalDetailLoading() {
  return (
    <div
      className="flex flex-col gap-5 animate-in fade-in-50 duration-150"
      aria-busy="true"
      aria-live="polite"
    >
      {/* Header: back button + title/subtitle on the left, icon-only history button on the right */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Skeleton className="h-9 w-9 rounded-xl bg-surface border border-border shrink-0" />
          <div className="min-w-0">
            <Skeleton className="h-5 sm:h-6 w-44 rounded-md bg-surface-muted mb-1" />
            <Skeleton className="h-2.5 w-28 rounded-md bg-surface-subtle" />
          </div>
        </div>
        <Skeleton className="h-9 w-9 rounded-xl bg-surface border border-border shrink-0" />
      </div>

      {/* Hero: icon + name/status/category, percentage, progress bar + amount labels */}
      <div className="p-4 sm:p-5 rounded-2xl bg-canvas dark:bg-surface-subtle border border-border flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Skeleton className="w-12 h-12 rounded-xl bg-surface-muted shrink-0" />
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Skeleton className="h-5 w-36 rounded-md bg-surface-muted" />
                <Skeleton className="h-4 w-16 rounded-md bg-surface-subtle" />
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <Skeleton className="w-3.5 h-3.5 rounded bg-surface-subtle" />
                <Skeleton className="h-2.5 w-20 rounded-md bg-surface-subtle" />
              </div>
            </div>
          </div>
          <Skeleton className="h-6 sm:h-7 w-12 rounded-md bg-surface-muted shrink-0" />
        </div>

        {/* Progress Bar */}
        <div className="flex flex-col gap-1.5">
          <div className="h-3 w-full rounded-full bg-border overflow-hidden p-0.5">
            <Skeleton className="h-full w-2/5 rounded-full bg-surface-muted" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24 rounded-md bg-surface-subtle" />
            <Skeleton className="h-3 w-24 rounded-md bg-surface-subtle" />
          </div>
        </div>
      </div>

      {/* Target / Schedule info: three bordered rows + days-left banner */}
      <div className="flex flex-col gap-2.5">
        <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border flex items-center justify-between">
          <Skeleton className="h-2.5 w-24 rounded-md bg-surface-subtle" />
          <Skeleton className="h-3.5 w-24 rounded-md bg-surface-muted" />
        </div>
        <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border flex items-center justify-between">
          <Skeleton className="h-2.5 w-24 rounded-md bg-surface-subtle" />
          <div className="flex items-center gap-1.5">
            <Skeleton className="w-3.5 h-3.5 rounded bg-surface-subtle" />
            <Skeleton className="h-3.5 w-20 rounded-md bg-surface-muted" />
          </div>
        </div>
        <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border flex items-center justify-between">
          <Skeleton className="h-2.5 w-24 rounded-md bg-surface-subtle" />
          <Skeleton className="h-3.5 w-24 rounded-md bg-surface-muted" />
        </div>
        <div className="p-2 rounded-lg border border-border bg-surface-subtle flex items-center gap-2">
          <Skeleton className="w-3.5 h-3.5 rounded bg-surface-muted shrink-0" />
          <Skeleton className="h-2.5 w-40 rounded-md bg-surface-subtle" />
        </div>
      </div>

      {/* Actions: full-width deposit button + 3-column button grid */}
      <div className="flex flex-col gap-2 pt-3 border-t border-border w-full">
        <Skeleton className="h-10 w-full rounded-xl bg-surface-muted" />
        <div className="grid grid-cols-3 gap-2 w-full">
          <Skeleton className="h-10 w-full rounded-xl bg-surface border border-border" />
          <Skeleton className="h-10 w-full rounded-xl bg-surface border border-border" />
          <Skeleton className="h-10 w-full rounded-xl bg-surface border border-border" />
        </div>
      </div>
    </div>
  )
}
