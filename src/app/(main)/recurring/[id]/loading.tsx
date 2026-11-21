import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function RecurringDetailLoading() {
  return (
    <div
      className="flex flex-col gap-5 animate-in fade-in-50 duration-150"
      aria-busy="true"
      aria-live="polite"
    >
      {/* Header: back button (left) + title + icon-only history button (right) */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 p-0 flex items-center justify-center shrink-0 rounded-xl bg-surface border border-border" />
        <div className="min-w-0">
          <Skeleton className="h-6 w-48 rounded-md bg-surface-muted" />
        </div>
        <Skeleton className="h-9 w-9 p-0 flex items-center justify-center shrink-0 ml-auto rounded-xl bg-surface border border-border" />
      </div>

      {/* Hero card: icon + name/status badge, amount + frequency */}
      <div className="p-4 sm:p-5 rounded-2xl bg-canvas dark:bg-surface-subtle border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <Skeleton className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center shrink-0 shadow-xs" />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Skeleton className="h-5 w-40 rounded-md bg-surface-muted" />
              <div className="px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1">
                <Skeleton className="w-3 h-3 rounded-sm bg-surface-subtle" />
                <Skeleton className="h-2.5 w-12 rounded-md bg-surface-subtle" />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <Skeleton className="h-3 w-16 rounded-md bg-surface-subtle" />
              <Skeleton className="h-3 w-20 rounded-md bg-surface-subtle" />
            </div>
          </div>
        </div>
        <div className="flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-center shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-border">
          <Skeleton className="h-6 sm:h-8 w-32 rounded-md bg-surface-muted" />
          <Skeleton className="h-2.5 w-16 rounded-md bg-surface-subtle" />
        </div>
      </div>

      {/* Schedule info rows: label + value (icons where the real rows have them) */}
      <div className="flex flex-col gap-2.5">
        <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border flex items-center justify-between">
          <Skeleton className="h-2.5 w-24 rounded-md bg-surface-subtle" />
          <div className="flex items-center gap-1.5">
            <Skeleton className="w-3.5 h-3.5 rounded bg-surface-subtle" />
            <Skeleton className="h-4 w-28 rounded-md bg-surface-muted" />
          </div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border flex items-center justify-between">
          <Skeleton className="h-2.5 w-24 rounded-md bg-surface-subtle" />
          <div className="flex items-center gap-1.5 min-w-0">
            <Skeleton className="w-3.5 h-3.5 rounded bg-surface-subtle shrink-0" />
            <Skeleton className="h-4 w-36 rounded-md bg-surface-muted" />
          </div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border flex items-center justify-between">
          <Skeleton className="h-2.5 w-24 rounded-md bg-surface-subtle" />
          <Skeleton className="h-4 w-28 rounded-md bg-surface-muted" />
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border flex items-center justify-between">
          <Skeleton className="h-2.5 w-24 rounded-md bg-surface-subtle" />
          <div className="flex items-center gap-1.5">
            <Skeleton className="w-3.5 h-3.5 rounded bg-surface-subtle" />
            <Skeleton className="h-3.5 w-16 rounded-md bg-surface-muted" />
          </div>
        </div>
      </div>

      {/* Actions: full-width pay button, 3-button grid, centered view-all link */}
      <div className="flex flex-col gap-2 pt-3 border-t border-border w-full">
        <Skeleton className="h-10 w-full rounded-xl bg-surface-muted" />
        <div className="grid grid-cols-3 gap-2 w-full">
          <Skeleton className="h-10 w-full rounded-xl bg-surface border border-border" />
          <Skeleton className="h-10 w-full rounded-xl bg-surface border border-border" />
          <Skeleton className="h-10 w-full rounded-xl bg-surface border border-border" />
        </div>
        <div className="mt-1 flex items-center justify-center gap-1.5 py-1">
          <Skeleton className="h-2.5 w-24 rounded-md bg-surface-subtle" />
          <Skeleton className="w-3 h-3 rounded-sm bg-surface-subtle" />
        </div>
      </div>
    </div>
  )
}
