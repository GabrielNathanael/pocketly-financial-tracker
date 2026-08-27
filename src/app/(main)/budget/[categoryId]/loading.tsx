import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function CategoryBudgetHistoryLoading() {
  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto animate-in fade-in-50 duration-150" aria-busy="true" aria-live="polite">
      {/* Back button */}
      <div>
        <Skeleton className="h-4 w-28 rounded-md bg-slate-200 dark:bg-[#27272A]" />
      </div>

      {/* Category Overview Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-2xs flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-[#27272A]" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-5 w-36 rounded-md bg-slate-200 dark:bg-[#27272A]" />
              <Skeleton className="h-3 w-20 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
            </div>
          </div>
          <Skeleton className="h-6 w-16 rounded-full bg-slate-100 dark:bg-[#1E1E24]" />
        </div>

        <div className="flex flex-col gap-1 pt-2 border-t border-[#E5E7EB] dark:border-[#27272A]">
          <Skeleton className="h-3 w-24 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
          <Skeleton className="h-8 w-44 rounded-lg bg-slate-200 dark:bg-[#27272A]" />
        </div>
      </div>

      {/* Monthly History Cards */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-32 rounded-md bg-slate-200 dark:bg-[#27272A]" />
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between"
            >
              <div className="flex flex-col gap-1">
                <Skeleton className="h-3.5 w-28 rounded-md bg-slate-200 dark:bg-[#27272A]" />
                <Skeleton className="h-2.5 w-16 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
              </div>
              <Skeleton className="h-4 w-20 rounded-md bg-slate-200 dark:bg-[#27272A]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
