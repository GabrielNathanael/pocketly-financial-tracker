import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function ReportsLoading() {
  return (
    <div className="flex flex-col gap-6 animate-in fade-in-50 duration-150" aria-busy="true" aria-live="polite">
      {/* 0. AI Cashflow Export Card Skeleton */}
      <div className="p-4 sm:p-5 rounded-xl border border-border bg-surface flex flex-col gap-3.5">
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <Skeleton className="w-9 h-9 rounded-lg bg-surface-muted shrink-0" />
            <div className="min-w-0 flex-1 flex flex-col gap-1.5">
              <Skeleton className="h-4 w-40 rounded-md bg-surface-muted" />
              <Skeleton className="h-3 w-full max-w-md rounded-md bg-surface-subtle" />
            </div>
          </div>
          <Skeleton className="h-9 w-28 rounded-md bg-surface-subtle shrink-0" />
        </div>
      </div>

      {/* 1. Header with Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-6 w-36 rounded-md bg-surface-muted" />
          <Skeleton className="h-3.5 w-56 rounded-md bg-surface-subtle" />
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <Skeleton className="h-8 w-16 rounded-xl bg-surface-subtle" />
          <Skeleton className="h-8 w-24 rounded-xl bg-surface-muted" />
        </div>
      </div>

      {/* 2. Period Selector Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 p-1 bg-surface-muted rounded-xl border border-border gap-1">
        <Skeleton className="h-8 rounded-lg bg-surface" />
        <Skeleton className="h-8 rounded-lg bg-transparent" />
        <Skeleton className="h-8 rounded-lg bg-transparent" />
        <Skeleton className="h-8 rounded-lg bg-transparent" />
      </div>

      {/* 3. 4 Health Scorecard Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl bg-surface border border-border flex flex-col justify-between gap-2 shadow-2xs"
          >
            <div className="flex items-center justify-between gap-1">
              <Skeleton className="h-3 w-20 rounded-md bg-surface-subtle" />
              <Skeleton className="w-3.5 h-3.5 rounded bg-surface-subtle" />
            </div>
            <Skeleton className="h-6 w-28 rounded-md bg-surface-muted mt-1" />
            <Skeleton className="h-2.5 w-16 rounded-md bg-surface-subtle" />
          </div>
        ))}
      </div>

      {/* 4. Cashflow Trend Chart Card Skeleton */}
      <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-border shadow-2xs flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-36 rounded-md bg-surface-muted" />
          <Skeleton className="h-3 w-24 rounded-md bg-surface-subtle" />
        </div>
        <Skeleton className="h-44 sm:h-52 w-full rounded-xl bg-surface-subtle" />
      </div>

      {/* 5. Category Breakdown Section Skeleton */}
      <div className="p-4 sm:p-5 rounded-2xl bg-surface border border-border shadow-2xs flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-40 rounded-md bg-surface-muted" />
          <Skeleton className="h-7 w-32 rounded-lg bg-surface-subtle" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-3 rounded-xl bg-surface-subtle border border-border flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <Skeleton className="w-7 h-7 rounded-lg bg-surface-muted" />
                <Skeleton className="h-3.5 w-24 rounded-md bg-surface-muted" />
              </div>
              <Skeleton className="h-4 w-20 rounded-md bg-surface-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
