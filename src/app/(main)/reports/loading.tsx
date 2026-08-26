import React from 'react'

export default function ReportsLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse" aria-busy="true" aria-live="polite">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="h-7 w-36 rounded-lg bg-[#E2E8F0] dark:bg-[#1E293B]" />
          <div className="h-4 w-52 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
        </div>
      </div>

      {/* Date Filter & Export Card */}
      <div className="h-28 w-full rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] p-5 shadow-xs flex flex-wrap justify-between items-center gap-4">
        <div className="h-10 w-64 rounded-xl bg-[#E2E8F0] dark:bg-[#1E293B]" />
        <div className="h-10 w-36 rounded-xl bg-[#CBD5E1] dark:bg-[#334155]" />
      </div>

      {/* Income & Expense Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="h-32 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] p-5 flex flex-col justify-between shadow-xs">
          <div className="h-4 w-28 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
          <div className="h-8 w-44 rounded-lg bg-[#CBD5E1] dark:bg-[#334155]" />
        </div>
        <div className="h-32 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] p-5 flex flex-col justify-between shadow-xs">
          <div className="h-4 w-28 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
          <div className="h-8 w-44 rounded-lg bg-[#CBD5E1] dark:bg-[#334155]" />
        </div>
      </div>

      {/* Category Breakdown Skeleton */}
      <div className="h-64 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] p-6 shadow-xs flex flex-col gap-4">
        <div className="h-5 w-40 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex justify-between items-center">
              <div className="h-4 w-32 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
              <div className="h-4 w-24 rounded-md bg-[#CBD5E1] dark:bg-[#334155]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
