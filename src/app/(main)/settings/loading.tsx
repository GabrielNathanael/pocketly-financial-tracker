import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-5 max-w-xl mx-auto animate-in fade-in-50 duration-150" aria-busy="true" aria-live="polite">
      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-6 w-36 rounded-md bg-slate-200 dark:bg-[#27272A]" />
        <Skeleton className="h-3.5 w-60 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
      </div>

      {/* Account Section */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3 shadow-2xs">
        <Skeleton className="h-4 w-32 rounded-md bg-slate-200 dark:bg-[#27272A]" />
        <Skeleton className="h-10 w-full rounded-lg bg-slate-100 dark:bg-[#1A1A20]" />
      </div>

      {/* Preferences Section */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3 shadow-2xs">
        <Skeleton className="h-4 w-32 rounded-md bg-slate-200 dark:bg-[#27272A]" />
        <Skeleton className="h-10 w-full rounded-lg bg-slate-100 dark:bg-[#1A1A20]" />
        <Skeleton className="h-10 w-full rounded-lg bg-slate-100 dark:bg-[#1A1A20]" />
      </div>
    </div>
  )
}
