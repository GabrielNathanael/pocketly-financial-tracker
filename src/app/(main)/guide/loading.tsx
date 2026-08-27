import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function GuideLoading() {
  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto animate-in fade-in-50 duration-150" aria-busy="true" aria-live="polite">
      {/* Top Nav Back */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-20 rounded-md bg-slate-200 dark:bg-[#27272A]" />
        <Skeleton className="h-6 w-24 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
      </div>

      {/* Hero Header */}
      <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-2xs flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-[#27272A] shrink-0" />
        <div className="flex flex-col gap-1.5 flex-1">
          <Skeleton className="h-5 w-40 rounded-md bg-slate-200 dark:bg-[#27272A]" />
          <Skeleton className="h-3.5 w-64 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
        </div>
      </div>

      {/* Guide Accordions */}
      <div className="flex flex-col gap-3.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between shadow-2xs"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <Skeleton className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-[#1A1A20] shrink-0" />
              <div className="flex flex-col gap-1.5 min-w-0">
                <Skeleton className="h-4 w-36 rounded-md bg-slate-200 dark:bg-[#27272A]" />
                <Skeleton className="h-3 w-56 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
              </div>
            </div>
            <Skeleton className="w-4 h-4 rounded bg-slate-100 dark:bg-[#1E1E24] shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
