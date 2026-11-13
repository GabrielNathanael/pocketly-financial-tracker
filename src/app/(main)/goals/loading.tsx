import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function GoalsLoading() {
  return (
    <div className="flex flex-col gap-6 animate-in fade-in-50 duration-150" aria-busy="true" aria-live="polite">
      {/* 1. Header with Title & Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-6 w-36 rounded-md bg-surface-muted" />
          <Skeleton className="h-3.5 w-56 rounded-md bg-surface-subtle" />
        </div>

        <Skeleton className="h-9 w-36 rounded-xl bg-surface-muted self-start sm:self-auto" />
      </div>

      {/* 2. 4 Summary Metric Cards */}
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

      {/* 3. Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-surface-muted rounded-xl border border-border">
          <Skeleton className="h-7 w-16 rounded-lg bg-surface" />
          <Skeleton className="h-7 w-20 rounded-lg bg-transparent" />
          <Skeleton className="h-7 w-20 rounded-lg bg-transparent" />
        </div>
        <Skeleton className="h-8.5 w-full sm:w-48 rounded-xl bg-surface-subtle" />
      </div>

      {/* 4. Goals Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl bg-surface border border-border shadow-2xs flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Skeleton className="w-8 h-8 rounded-lg bg-surface-subtle" />
                <div className="flex flex-col gap-1">
                  <Skeleton className="h-4 w-28 rounded-md bg-surface-muted" />
                  <Skeleton className="h-2.5 w-16 rounded-md bg-surface-subtle" />
                </div>
              </div>
              <Skeleton className="h-5 w-12 rounded-md bg-surface-muted" />
            </div>
            <Skeleton className="h-2 w-full rounded-full bg-surface-subtle" />
            <div className="flex items-center justify-between pt-1 border-t border-border">
              <Skeleton className="h-3 w-20 rounded-md bg-surface-subtle" />
              <Skeleton className="h-4 w-24 rounded-md bg-surface-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
