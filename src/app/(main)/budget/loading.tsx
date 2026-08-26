import React from 'react'

export default function BudgetLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse" aria-busy="true" aria-live="polite">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="h-7 w-32 rounded-lg bg-[#E2E8F0] dark:bg-[#1E293B]" />
          <div className="h-4 w-48 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
        </div>
        <div className="h-9 w-32 rounded-xl bg-[#E2E8F0] dark:bg-[#1E293B]" />
      </div>

      {/* Month Picker Skeleton */}
      <div className="h-12 w-full rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] p-3 flex justify-between items-center" />

      {/* Total Budget Card */}
      <div className="h-40 w-full rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] p-6 shadow-xs flex flex-col justify-between">
        <div className="flex justify-between items-center">
          <div className="h-4 w-28 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
          <div className="h-6 w-16 rounded-full bg-[#F1F5F9] dark:bg-[#1E293B]" />
        </div>
        <div className="h-4 w-full rounded-full bg-[#E2E8F0] dark:bg-[#1E293B]" />
        <div className="flex justify-between items-center">
          <div className="h-4 w-32 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
          <div className="h-4 w-32 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
        </div>
      </div>

      {/* Category Budgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-32 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] p-5 flex flex-col justify-between shadow-xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#E2E8F0] dark:bg-[#1E293B]" />
                <div className="h-4 w-24 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
              </div>
              <div className="h-4 w-12 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
            </div>
            <div className="h-2.5 w-full rounded-full bg-[#E2E8F0] dark:bg-[#1E293B]" />
            <div className="flex justify-between items-center">
              <div className="h-3.5 w-20 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
              <div className="h-3.5 w-20 rounded-md bg-[#CBD5E1] dark:bg-[#334155]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
