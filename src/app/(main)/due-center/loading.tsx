import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function DueCenterLoading() {
  return (
    <div className="flex flex-col gap-5 animate-in fade-in-50 duration-150" aria-busy="true" aria-live="polite">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-6 w-36 rounded-md bg-slate-200 dark:bg-[#27272A]" />
        <Skeleton className="h-3.5 w-52 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
      </div>

      {/* Hero Summary Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-2xs flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-28 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
          <Skeleton className="h-7 w-40 rounded-lg bg-slate-200 dark:bg-[#27272A]" />
        </div>
        <Skeleton className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#1A1A20]" />
      </div>

      {/* Due Items List */}
      <div className="flex flex-col gap-2.5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-2xs flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#1A1A20]" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-32 rounded-md bg-slate-200 dark:bg-[#27272A]" />
                <Skeleton className="h-2.5 w-24 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Skeleton className="h-4 w-24 rounded-md bg-slate-200 dark:bg-[#27272A]" />
              <Skeleton className="h-2.5 w-16 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
