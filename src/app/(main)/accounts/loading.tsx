import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function AccountsLoading() {
  return (
    <div className="flex flex-col gap-4 animate-in fade-in-50 duration-150" aria-busy="true" aria-live="polite">
      {/* Total Liquidity Banner Card (1:1 with AccountsManager) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-2xs flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3 w-36 rounded-md bg-slate-200 dark:bg-[#27272A]" />
          <Skeleton className="h-8 sm:h-9 w-52 sm:w-60 rounded-lg bg-slate-200 dark:bg-[#27272A] mt-0.5" />
          <Skeleton className="h-3 w-40 rounded-md bg-slate-100 dark:bg-[#1E1E24] mt-0.5" />
        </div>

        {/* Action Buttons inside Card */}
        <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E5E7EB] dark:border-[#27272A]">
          <Skeleton className="h-8 flex-1 sm:flex-initial sm:w-28 rounded-lg bg-slate-100 dark:bg-[#1E1E24]" />
          <Skeleton className="h-8 flex-1 sm:flex-initial sm:w-28 rounded-lg bg-slate-200 dark:bg-[#27272A]" />
        </div>
      </div>

      {/* Account List Grid (1:1 with AccountCard) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-2xs"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Skeleton className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-[#1A1A20] shrink-0" />
              <div className="flex flex-col gap-1.5 min-w-0">
                <Skeleton className="h-3.5 w-28 sm:w-36 rounded-md bg-slate-200 dark:bg-[#27272A]" />
                <Skeleton className="h-2.5 w-20 sm:w-24 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-3">
              <Skeleton className="h-4 w-20 sm:w-24 rounded-md bg-slate-200 dark:bg-[#27272A]" />
              <Skeleton className="w-4 h-4 rounded bg-slate-100 dark:bg-[#1E1E24]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
