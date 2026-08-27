import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function TransactionDetailLoading() {
  return (
    <div className="flex flex-col gap-5 max-w-lg mx-auto animate-in fade-in-50 duration-150" aria-busy="true" aria-live="polite">
      {/* Top Bar Navigation Skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-36 rounded-md bg-slate-200 dark:bg-[#27272A]" />
        <Skeleton className="h-4 w-24 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
      </div>

      {/* Hero Detail Card Skeleton */}
      <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-2xs flex flex-col gap-4">
        {/* Amount & Type */}
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-20 rounded-md bg-slate-200 dark:bg-[#27272A]" />
          <Skeleton className="h-10 w-48 rounded-lg bg-slate-200 dark:bg-[#27272A]" />
        </div>

        {/* Info Items Stack (Account, Category, Date) */}
        <div className="flex flex-col gap-2.5 pt-2 border-t border-[#E5E7EB] dark:border-[#27272A]">
          {/* Account item */}
          <div className="p-3 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-[#27272A] shrink-0" />
            <div className="flex flex-col gap-1.5 min-w-0 flex-1">
              <Skeleton className="h-2.5 w-16 rounded-md bg-slate-200 dark:bg-[#27272A]" />
              <Skeleton className="h-3.5 w-32 rounded-md bg-slate-200 dark:bg-[#27272A]" />
            </div>
          </div>

          {/* Category item */}
          <div className="p-3 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-[#27272A] shrink-0" />
            <div className="flex flex-col gap-1.5 min-w-0 flex-1">
              <Skeleton className="h-2.5 w-16 rounded-md bg-slate-200 dark:bg-[#27272A]" />
              <Skeleton className="h-3.5 w-28 rounded-md bg-slate-200 dark:bg-[#27272A]" />
            </div>
          </div>

          {/* Date item */}
          <div className="p-3 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex items-center gap-2.5">
            <Skeleton className="w-4 h-4 rounded bg-slate-200 dark:bg-[#27272A] shrink-0" />
            <Skeleton className="h-3.5 w-44 rounded-md bg-slate-200 dark:bg-[#27272A]" />
          </div>
        </div>

        {/* Action Buttons Toolbar Skeleton */}
        <div className="flex items-center gap-2 pt-2 border-t border-[#E5E7EB] dark:border-[#27272A]">
          <Skeleton className="h-9 flex-1 rounded-xl bg-slate-200 dark:bg-[#27272A]" />
          <Skeleton className="h-9 w-20 rounded-xl bg-slate-100 dark:bg-[#1E1E24]" />
          <Skeleton className="h-9 w-10 rounded-xl bg-slate-100 dark:bg-[#1E1E24]" />
        </div>
      </div>
    </div>
  )
}
