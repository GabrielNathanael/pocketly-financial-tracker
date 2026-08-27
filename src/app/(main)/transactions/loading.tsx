import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function TransactionsLoading() {
  return (
    <div className="flex flex-col gap-4 animate-in fade-in-50 duration-150" aria-busy="true" aria-live="polite">
      {/* 1. Header Skeleton */}
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-6 w-32 rounded-md bg-slate-200 dark:bg-[#27272A]" />
        <Skeleton className="h-3.5 w-48 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
      </div>

      {/* 2. Filter Card Skeleton (1:1 with TransactionFilters) */}
      <div className="flex flex-col gap-2 p-3 sm:p-4 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-2xs">
        {/* Row 1: Search Input & Filter Button */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 sm:h-9 flex-1 rounded-lg bg-slate-100 dark:bg-[#1A1A20]" />
          <Skeleton className="h-8 sm:h-9 w-8 sm:w-9 rounded-lg bg-slate-100 dark:bg-[#1A1A20] shrink-0" />
        </div>

        {/* Row 2: Type Filter Pills & Sort Dropdown */}
        <div className="flex items-center justify-between gap-1.5 pt-0.5">
          <div className="flex items-center gap-1 shrink-0">
            <Skeleton className="h-7 w-14 rounded-md bg-slate-200 dark:bg-[#27272A]" />
            <Skeleton className="h-7 w-20 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
            <Skeleton className="h-7 w-20 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
          </div>
          <Skeleton className="h-7 w-24 sm:w-28 rounded-md bg-slate-100 dark:bg-[#1E1E24] shrink-0" />
        </div>
      </div>

      {/* 3. Grouped Transaction List Skeleton */}
      <div className="flex flex-col gap-4">
        {/* Date Group 1 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <Skeleton className="h-3.5 w-28 rounded-md bg-slate-200 dark:bg-[#27272A]" />
            <Skeleton className="h-3.5 w-20 rounded-md bg-slate-200 dark:bg-[#27272A]" />
          </div>

          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 sm:p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-2xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Skeleton className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#1A1A20] shrink-0" />
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <Skeleton className="h-3.5 w-28 sm:w-36 rounded-md bg-slate-200 dark:bg-[#27272A]" />
                    <Skeleton className="h-2.5 w-20 sm:w-28 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <Skeleton className="h-4 w-20 sm:w-24 rounded-md bg-slate-200 dark:bg-[#27272A]" />
                  <Skeleton className="h-2.5 w-12 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Date Group 2 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <Skeleton className="h-3.5 w-32 rounded-md bg-slate-200 dark:bg-[#27272A]" />
            <Skeleton className="h-3.5 w-20 rounded-md bg-slate-200 dark:bg-[#27272A]" />
          </div>

          <div className="flex flex-col gap-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 sm:p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-2xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Skeleton className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#1A1A20] shrink-0" />
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <Skeleton className="h-3.5 w-28 sm:w-36 rounded-md bg-slate-200 dark:bg-[#27272A]" />
                    <Skeleton className="h-2.5 w-20 sm:w-28 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <Skeleton className="h-4 w-20 sm:w-24 rounded-md bg-slate-200 dark:bg-[#27272A]" />
                  <Skeleton className="h-2.5 w-12 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
