import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 animate-in fade-in-50 duration-150" aria-busy="true" aria-live="polite">
      {/* 0. Compact Due Banner Skeleton */}
      <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Skeleton className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-[#1A1A20]" />
          <Skeleton className="h-3.5 w-36 sm:w-48 rounded-md bg-slate-200 dark:bg-[#27272A]" />
        </div>
        <Skeleton className="h-6 w-16 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
      </div>

      {/* 1. Main Aggregate Balance Card Skeleton */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-2xs flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-28 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
            <Skeleton className="h-8 sm:h-9 w-48 sm:w-60 rounded-lg bg-slate-200 dark:bg-[#27272A]" />
          </div>
          <Skeleton className="h-7 w-16 rounded-lg bg-slate-100 dark:bg-[#1E1E24]" />
        </div>

        {/* Income / Expense Stats 2 Columns */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#E5E7EB] dark:border-[#27272A]">
          <div className="p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] flex flex-col gap-1">
            <Skeleton className="h-2.5 w-16 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
            <Skeleton className="h-4 sm:h-5 w-24 rounded-md bg-slate-200 dark:bg-[#27272A]" />
          </div>
          <div className="p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] flex flex-col gap-1">
            <Skeleton className="h-2.5 w-16 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
            <Skeleton className="h-4 sm:h-5 w-24 rounded-md bg-slate-200 dark:bg-[#27272A]" />
          </div>
        </div>
      </div>

      {/* 2. Chart Widget Card Skeleton */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-2xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32 rounded-md bg-slate-200 dark:bg-[#27272A]" />
          <Skeleton className="h-7 w-24 rounded-lg bg-slate-100 dark:bg-[#1E1E24]" />
        </div>
        <Skeleton className="h-40 sm:h-48 w-full rounded-xl bg-slate-100 dark:bg-[#1A1A20]" />
      </div>

      {/* 3. Accounts Widget Skeleton */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <Skeleton className="h-4 w-28 rounded-md bg-slate-200 dark:bg-[#27272A]" />
          <Skeleton className="h-3 w-16 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-3 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Skeleton className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#1A1A20]" />
                <div className="flex flex-col gap-1">
                  <Skeleton className="h-3 w-16 rounded-md bg-slate-200 dark:bg-[#27272A]" />
                  <Skeleton className="h-2.5 w-12 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Recent Transactions Skeleton */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <Skeleton className="h-4 w-32 rounded-md bg-slate-200 dark:bg-[#27272A]" />
          <Skeleton className="h-3 w-16 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
        </div>
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-2xs"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#1A1A20]" />
                <div className="flex flex-col gap-1">
                  <Skeleton className="h-3.5 w-28 rounded-md bg-slate-200 dark:bg-[#27272A]" />
                  <Skeleton className="h-2.5 w-18 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
                </div>
              </div>
              <Skeleton className="h-4 w-20 rounded-md bg-slate-200 dark:bg-[#27272A]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
