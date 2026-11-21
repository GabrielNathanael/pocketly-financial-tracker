import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function DebtsLoading() {
  return (
    <div
      className="flex flex-col gap-5 animate-in fade-in-50 duration-150"
      aria-busy="true"
      aria-live="polite"
    >
      {/* Bilingual header: title + subtitle */}
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-6 w-36 rounded-md bg-surface-muted" />
        <Skeleton className="h-3.5 w-52 rounded-md bg-surface-subtle" />
      </div>

      {/* Overview stats: grid 1 / sm:2 with icon + stacked label/amount */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="p-4 sm:p-5 rounded-xl bg-surface border border-border flex items-center gap-3.5"
          >
            <Skeleton className="w-10 h-10 rounded-lg bg-surface-subtle shrink-0" />
            <div className="flex flex-col gap-1.5 min-w-0">
              <Skeleton className="h-2.5 w-20 rounded-md bg-surface-muted" />
              <Skeleton className="h-6 w-32 rounded-md bg-surface-muted" />
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs + select on the left, add button on the right */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-6 w-16 rounded-md bg-surface-subtle" />
          <Skeleton className="h-6 w-12 rounded-md bg-surface-subtle" />
          <Skeleton className="h-6 w-20 rounded-md bg-surface-subtle" />
          <Skeleton className="h-8 w-28 rounded-lg bg-surface-muted" />
        </div>
        <Skeleton className="h-8 w-24 rounded-lg bg-surface-muted shrink-0 self-start sm:self-auto" />
      </div>

      {/* Debt cards: responsive 1 / sm:2 grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl bg-surface border border-border flex flex-col gap-3"
          >
            {/* Identity row: icon, name + meta, status badge */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <Skeleton className="w-8 h-8 rounded-lg bg-surface-subtle shrink-0" />
                <div className="flex flex-col gap-1 min-w-0">
                  <Skeleton className="h-4 w-28 rounded-md bg-surface-muted" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-2.5 w-12 rounded-md bg-surface-subtle" />
                    <Skeleton className="h-2.5 w-14 rounded-md bg-surface-subtle" />
                  </div>
                </div>
              </div>
              <Skeleton className="h-5 w-14 rounded-md bg-surface-subtle shrink-0" />
            </div>

            {/* Progress track */}
            <Skeleton className="h-1.5 w-full rounded-full bg-surface-muted" />

            {/* Remaining / principal amounts */}
            <div className="flex items-center justify-between gap-3 pt-0.5">
              <div className="flex flex-col gap-1">
                <Skeleton className="h-2.5 w-16 rounded-md bg-surface-subtle" />
                <Skeleton className="h-3.5 w-24 rounded-md bg-surface-muted" />
              </div>
              <div className="flex flex-col items-end gap-1">
                <Skeleton className="h-2.5 w-16 rounded-md bg-surface-subtle" />
                <Skeleton className="h-3.5 w-24 rounded-md bg-surface-muted" />
              </div>
            </div>

            {/* Record payment footer */}
            <div className="pt-2 border-t border-border flex justify-end">
              <Skeleton className="h-3 w-20 rounded-md bg-surface-subtle" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
