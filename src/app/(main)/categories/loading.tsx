import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function CategoriesLoading() {
  return (
    <div className="flex flex-col gap-5 animate-in fade-in-50 duration-150" aria-busy="true" aria-live="polite">
      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-6 w-36 rounded-md bg-surface-muted" />
        <Skeleton className="h-3.5 w-56 rounded-md bg-surface-subtle" />
      </div>

      {/* Action Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-9 w-32 rounded-xl bg-surface-muted" />
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-8 w-16 rounded-lg bg-surface-muted" />
          <Skeleton className="h-8 w-24 rounded-lg bg-surface-subtle" />
          <Skeleton className="h-8 w-24 rounded-lg bg-surface-subtle" />
        </div>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="p-3.5 rounded-xl bg-surface border border-border flex items-center justify-between shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-lg bg-surface-subtle" />
              <div className="flex flex-col gap-1">
                <Skeleton className="h-3.5 w-24 rounded-md bg-surface-muted" />
                <Skeleton className="h-2.5 w-16 rounded-md bg-surface-subtle" />
              </div>
            </div>
            <Skeleton className="w-4 h-4 rounded bg-surface-subtle" />
          </div>
        ))}
      </div>
    </div>
  )
}
