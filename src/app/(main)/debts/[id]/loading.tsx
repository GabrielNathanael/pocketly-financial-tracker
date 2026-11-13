import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function DebtDetailLoading() {
  return (
    <div className="flex flex-col gap-5 max-w-lg mx-auto animate-in fade-in-50 duration-150" aria-busy="true" aria-live="polite">
      {/* Back button */}
      <div>
        <Skeleton className="h-4 w-28 rounded-md bg-surface-muted" />
      </div>

      {/* Main Debt Overview Card */}
      <div className="p-4 sm:p-6 rounded-2xl bg-surface border border-border shadow-2xs flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl bg-surface-muted" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-5 w-36 rounded-md bg-surface-muted" />
              <Skeleton className="h-3 w-20 rounded-md bg-surface-subtle" />
            </div>
          </div>
          <Skeleton className="h-6 w-16 rounded-full bg-surface-subtle" />
        </div>

        <Skeleton className="h-2 w-full rounded-full bg-surface-subtle" />

        {/* Amount Stack */}
        <div className="flex flex-col gap-2.5 pt-2 border-t border-border">
          <div className="p-3.5 rounded-xl bg-surface-subtle border border-border flex flex-col gap-1">
            <Skeleton className="h-2.5 w-24 rounded-md bg-surface-muted" />
            <Skeleton className="h-5 w-36 rounded-md bg-surface-muted" />
          </div>
          <div className="p-3.5 rounded-xl bg-surface-subtle border border-border flex flex-col gap-1">
            <Skeleton className="h-2.5 w-24 rounded-md bg-surface-muted" />
            <Skeleton className="h-5 w-36 rounded-md bg-surface-muted" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <Skeleton className="h-9 flex-1 rounded-xl bg-surface-muted" />
          <Skeleton className="h-9 w-20 rounded-xl bg-surface-subtle" />
          <Skeleton className="h-9 w-10 rounded-xl bg-surface-subtle" />
        </div>
      </div>
    </div>
  )
}
