import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-5 max-w-xl mx-auto animate-in fade-in-50 duration-150" aria-busy="true" aria-live="polite">
      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-6 w-36 rounded-md bg-surface-muted" />
        <Skeleton className="h-3.5 w-60 rounded-md bg-surface-subtle" />
      </div>

      {/* Account Section */}
      <div className="p-4 rounded-xl bg-surface border border-border flex flex-col gap-3 shadow-2xs">
        <Skeleton className="h-4 w-32 rounded-md bg-surface-muted" />
        <Skeleton className="h-10 w-full rounded-lg bg-surface-subtle" />
      </div>

      {/* Preferences Section */}
      <div className="p-4 rounded-xl bg-surface border border-border flex flex-col gap-3 shadow-2xs">
        <Skeleton className="h-4 w-32 rounded-md bg-surface-muted" />
        <Skeleton className="h-10 w-full rounded-lg bg-surface-subtle" />
        <Skeleton className="h-10 w-full rounded-lg bg-surface-subtle" />
      </div>
    </div>
  )
}
