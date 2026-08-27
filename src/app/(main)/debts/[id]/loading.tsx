import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function DebtDetailLoading() {
  return (
    <div className="flex flex-col gap-5 max-w-lg mx-auto animate-in fade-in-50 duration-150" aria-busy="true" aria-live="polite">
      {/* Back button */}
      <div>
        <Skeleton className="h-4 w-28 rounded-md bg-slate-200 dark:bg-[#27272A]" />
      </div>

      {/* Main Debt Overview Card */}
      <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-2xs flex flex-col gap-4">
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

        <Skeleton className="h-2 w-full rounded-full bg-slate-100 dark:bg-[#1E1E24]" />

        {/* Amount Stack */}
        <div className="flex flex-col gap-2.5 pt-2 border-t border-[#E5E7EB] dark:border-[#27272A]">
          <div className="p-3.5 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-1">
            <Skeleton className="h-2.5 w-24 rounded-md bg-slate-200 dark:bg-[#27272A]" />
            <Skeleton className="h-5 w-36 rounded-md bg-slate-200 dark:bg-[#27272A]" />
          </div>
          <div className="p-3.5 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-1">
            <Skeleton className="h-2.5 w-24 rounded-md bg-slate-200 dark:bg-[#27272A]" />
            <Skeleton className="h-5 w-36 rounded-md bg-slate-200 dark:bg-[#27272A]" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-[#E5E7EB] dark:border-[#27272A]">
          <Skeleton className="h-9 flex-1 rounded-xl bg-slate-200 dark:bg-[#27272A]" />
          <Skeleton className="h-9 w-20 rounded-xl bg-slate-100 dark:bg-[#1E1E24]" />
          <Skeleton className="h-9 w-10 rounded-xl bg-slate-100 dark:bg-[#1E1E24]" />
        </div>
      </div>
    </div>
  )
}
