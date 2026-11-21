import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

function ScoreCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-border shadow-2xs flex flex-col justify-between gap-1.5">
      <div className="flex items-center justify-between gap-1 min-h-[22px]">
        <Skeleton className="h-2.5 w-16 rounded-md bg-surface-subtle" />
        <Skeleton className="w-3.5 h-3.5 rounded bg-surface-subtle" />
      </div>
      {children}
    </div>
  )
}

export default function GoalsLoading() {
  return (
    <div className="flex flex-col gap-6 animate-in fade-in-50 duration-150" aria-busy="true" aria-live="polite">
      {/* Header: title + subtitle, add button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-6 w-36 rounded-md bg-surface-muted" />
          <Skeleton className="h-3 w-52 rounded-md bg-surface-subtle" />
        </div>
        <Skeleton className="h-8 w-32 rounded-lg bg-surface-muted self-start sm:self-auto" />
      </div>

      {/* Scorecard: 4 metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Total target */}
        <ScoreCard>
          <div className="flex flex-col gap-1">
            <Skeleton className="h-5 sm:h-6 w-24 sm:w-28 rounded-md bg-surface-muted" />
            <Skeleton className="h-2.5 w-20 rounded-md bg-surface-subtle" />
          </div>
        </ScoreCard>

        {/* Total saved */}
        <ScoreCard>
          <div className="flex flex-col gap-1">
            <Skeleton className="h-5 sm:h-6 w-24 sm:w-28 rounded-md bg-surface-muted" />
            <Skeleton className="h-2.5 w-20 rounded-md bg-surface-subtle" />
          </div>
        </ScoreCard>

        {/* Overall progress: value + slim track */}
        <ScoreCard>
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-5 sm:h-6 w-14 rounded-md bg-surface-muted" />
            <Skeleton className="h-1.5 w-full rounded-full bg-surface-subtle" />
          </div>
        </ScoreCard>

        {/* Goals achieved: count / total + caption */}
        <ScoreCard>
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-1">
              <Skeleton className="h-5 sm:h-6 w-7 rounded-md bg-surface-muted" />
              <Skeleton className="h-2.5 w-8 rounded-md bg-surface-subtle" />
            </div>
            <div className="flex items-center gap-1">
              <Skeleton className="w-2.5 h-2.5 rounded bg-surface-subtle" />
              <Skeleton className="h-2.5 w-20 rounded-md bg-surface-subtle" />
            </div>
          </div>
        </ScoreCard>
      </div>

      {/* Filter tabs + search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-surface-subtle rounded-xl border border-border overflow-x-auto">
          <Skeleton className="h-7 w-12 shrink-0 rounded-lg bg-surface" />
          <Skeleton className="h-7 w-20 shrink-0 rounded-lg bg-surface-muted" />
          <Skeleton className="h-7 w-16 shrink-0 rounded-lg bg-surface-muted" />
          <Skeleton className="h-7 w-14 shrink-0 rounded-lg bg-surface-muted" />
        </div>
        <Skeleton className="h-9 w-full sm:w-64 rounded-lg bg-surface-subtle border border-border" />
      </div>

      {/* Goal cards grid: 1 col mobile, 2 col md */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 sm:p-5 rounded-2xl bg-surface border border-border shadow-2xs flex flex-col justify-between gap-4"
          >
            <div className="flex flex-col gap-4">
              {/* Card top: icon, name, category/date, countdown badge */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Skeleton className="w-10 h-10 rounded-xl bg-surface-subtle border border-border shrink-0" />
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Skeleton className="h-4 w-28 rounded-md bg-surface-muted" />
                      <Skeleton className="h-4 w-14 rounded-md bg-surface-subtle" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Skeleton className="h-2.5 w-14 rounded-md bg-surface-subtle" />
                      <Skeleton className="w-3 h-3 rounded bg-surface-subtle" />
                      <Skeleton className="h-2.5 w-16 rounded-md bg-surface-subtle" />
                    </div>
                  </div>
                </div>
                <Skeleton className="h-5 w-16 rounded-md bg-surface-muted border border-border shrink-0" />
              </div>

              {/* Card middle: amounts, progress track, pace banner */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-2.5 w-14 rounded-md bg-surface-subtle" />
                    <Skeleton className="h-5 sm:h-6 w-28 rounded-md bg-surface-muted" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Skeleton className="h-2.5 w-16 rounded-md bg-surface-subtle" />
                    <Skeleton className="h-3.5 w-20 rounded-md bg-surface-subtle" />
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-2.5 w-full rounded-full bg-surface-subtle" />
                  <Skeleton className="h-3.5 w-8 rounded-md bg-surface-muted shrink-0" />
                </div>

                <div className="p-2 rounded-lg bg-canvas dark:bg-surface-subtle border border-border flex items-center gap-2">
                  <Skeleton className="w-3.5 h-3.5 rounded bg-surface-muted shrink-0" />
                  <Skeleton className="h-2.5 w-3/4 rounded-md bg-surface-subtle" />
                </div>
              </div>
            </div>

            {/* Card bottom: icon actions + deposit button */}
            <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Skeleton className="w-7 h-7 rounded-lg bg-surface-subtle" />
                <Skeleton className="w-7 h-7 rounded-lg bg-surface-subtle" />
                <Skeleton className="w-7 h-7 rounded-lg bg-surface-subtle" />
              </div>
              <Skeleton className="h-8 w-28 rounded-lg bg-surface-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
