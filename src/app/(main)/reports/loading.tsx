import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function ReportsLoading() {
  return (
    <div className="flex flex-col gap-6 animate-in fade-in-50 duration-150" aria-busy="true" aria-live="polite">
      {/* 1. Header with Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-6 w-36 rounded-md bg-slate-200 dark:bg-[#27272A]" />
          <Skeleton className="h-3.5 w-56 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <Skeleton className="h-8 w-16 rounded-xl bg-slate-100 dark:bg-[#1E1E24]" />
          <Skeleton className="h-8 w-24 rounded-xl bg-slate-200 dark:bg-[#27272A]" />
        </div>
      </div>

      {/* 2. Period Selector Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 p-1 bg-[#F1F3F5] dark:bg-[#1A1A20] rounded-xl border border-[#E5E7EB] dark:border-[#27272A] gap-1">
        <Skeleton className="h-8 rounded-lg bg-white dark:bg-[#121215]" />
        <Skeleton className="h-8 rounded-lg bg-transparent" />
        <Skeleton className="h-8 rounded-lg bg-transparent" />
        <Skeleton className="h-8 rounded-lg bg-transparent" />
      </div>

      {/* 3. 4 Health Scorecard Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col justify-between gap-2 shadow-2xs"
          >
            <div className="flex items-center justify-between gap-1">
              <Skeleton className="h-3 w-20 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
              <Skeleton className="w-3.5 h-3.5 rounded bg-slate-100 dark:bg-[#1E1E24]" />
            </div>
            <Skeleton className="h-6 w-28 rounded-md bg-slate-200 dark:bg-[#27272A] mt-1" />
            <Skeleton className="h-2.5 w-16 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
          </div>
        ))}
      </div>

      {/* 4. Cashflow Trend Chart Card Skeleton */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-2xs flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-36 rounded-md bg-slate-200 dark:bg-[#27272A]" />
          <Skeleton className="h-3 w-24 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
        </div>
        <Skeleton className="h-44 sm:h-52 w-full rounded-xl bg-slate-100 dark:bg-[#1A1A20]" />
      </div>

      {/* 5. Category Breakdown Section Skeleton */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-2xs flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-40 rounded-md bg-slate-200 dark:bg-[#27272A]" />
          <Skeleton className="h-7 w-32 rounded-lg bg-slate-100 dark:bg-[#1A1A20]" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <Skeleton className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-[#27272A]" />
                <Skeleton className="h-3.5 w-24 rounded-md bg-slate-200 dark:bg-[#27272A]" />
              </div>
              <Skeleton className="h-4 w-20 rounded-md bg-slate-200 dark:bg-[#27272A]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
