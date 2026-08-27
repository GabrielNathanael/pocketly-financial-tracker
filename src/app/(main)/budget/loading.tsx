import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function BudgetLoading() {
  return (
    <div className="flex flex-col gap-4 animate-in fade-in-50 duration-150" aria-busy="true" aria-live="polite">
      {/* 1. Header */}
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-6 w-32 rounded-md bg-slate-200 dark:bg-[#27272A]" />
        <Skeleton className="h-3.5 w-48 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
      </div>

      {/* 2. Month Navigator Bar & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex-1">
          <Skeleton className="w-7 h-7 rounded-md bg-slate-100 dark:bg-[#1A1A20]" />
          <div className="flex flex-col items-center gap-1">
            <Skeleton className="h-4 w-28 rounded-md bg-slate-200 dark:bg-[#27272A]" />
            <Skeleton className="h-2.5 w-16 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
          </div>
          <Skeleton className="w-7 h-7 rounded-md bg-slate-100 dark:bg-[#1A1A20]" />
        </div>

        <Skeleton className="h-10 w-full sm:w-36 rounded-xl bg-slate-200 dark:bg-[#27272A] shrink-0" />
      </div>

      {/* 3. Aggregate Overview Card */}
      <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-32 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
          <Skeleton className="h-3 w-20 rounded-md bg-slate-200 dark:bg-[#27272A]" />
        </div>
        <Skeleton className="h-2 w-full rounded-full bg-slate-100 dark:bg-[#1E1E24]" />
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E5E7EB] dark:border-[#27272A]">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-2.5 w-14 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
            <Skeleton className="h-4 w-20 rounded-md bg-slate-200 dark:bg-[#27272A]" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <Skeleton className="h-2.5 w-14 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
            <Skeleton className="h-4 w-20 rounded-md bg-slate-200 dark:bg-[#27272A]" />
          </div>
          <div className="flex flex-col items-end gap-1">
            <Skeleton className="h-2.5 w-14 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
            <Skeleton className="h-4 w-20 rounded-md bg-slate-200 dark:bg-[#27272A]" />
          </div>
        </div>
      </div>

      {/* 4. Category Budgets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3 shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Skeleton className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#1A1A20]" />
                <Skeleton className="h-4 w-24 rounded-md bg-slate-200 dark:bg-[#27272A]" />
              </div>
              <Skeleton className="h-4 w-12 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
            </div>
            <Skeleton className="h-2 w-full rounded-full bg-slate-100 dark:bg-[#1E1E24]" />
            <div className="flex items-center justify-between pt-1 border-t border-[#E5E7EB] dark:border-[#27272A]">
              <Skeleton className="h-3 w-20 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
              <Skeleton className="h-4 w-24 rounded-md bg-slate-200 dark:bg-[#27272A]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
