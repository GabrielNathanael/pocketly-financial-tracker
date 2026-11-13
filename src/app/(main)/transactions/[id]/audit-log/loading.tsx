import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function TransactionAuditLogLoading() {
  return (
    <div className="flex flex-col gap-5 max-w-lg mx-auto animate-in fade-in-50 duration-150" aria-busy="true" aria-live="polite">
      {/* Back Link Skeleton */}
      <div>
        <Skeleton className="h-4 w-32 rounded-md bg-surface-muted" />
      </div>

      {/* Title & Subtitle Skeleton */}
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-6 w-44 rounded-md bg-surface-muted" />
        <Skeleton className="h-3.5 w-72 rounded-md bg-surface-subtle" />
      </div>

      {/* Log Entry Cards Skeleton */}
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl bg-surface border border-border flex flex-col gap-2.5"
          >
            {/* Badge + Title row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16 rounded-md bg-surface-muted" />
                <Skeleton className="h-4 w-28 rounded-md bg-surface-muted" />
              </div>
              <Skeleton className="h-3.5 w-32 rounded-md bg-surface-subtle" />
            </div>

            {/* Summary text */}
            <Skeleton className="h-3.5 w-full rounded-md bg-surface-subtle" />
            <Skeleton className="h-3.5 w-4/5 rounded-md bg-surface-subtle" />

            {/* Changes diff block */}
            {i === 1 && (
              <div className="p-2.5 rounded-lg bg-surface-subtle border border-border flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-3 w-16 rounded bg-surface-muted" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-16 rounded bg-destructive/20" />
                    <Skeleton className="h-3 w-3 rounded bg-surface-muted" />
                    <Skeleton className="h-3 w-20 rounded bg-success/20" />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-3 w-12 rounded bg-surface-muted" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-14 rounded bg-destructive/20" />
                    <Skeleton className="h-3 w-3 rounded bg-surface-muted" />
                    <Skeleton className="h-3 w-14 rounded bg-success/20" />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
