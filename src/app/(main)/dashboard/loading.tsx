import React from 'react'

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse" aria-busy="true" aria-live="polite">
      {/* 1. Main Aggregate Balance Card Skeleton */}
      <div className="h-52 w-full rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] p-6 shadow-xs flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2.5">
            <div className="h-3 w-32 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
            <div className="h-10 w-64 rounded-lg bg-[#CBD5E1] dark:bg-[#334155]" />
          </div>
          <div className="h-9 w-20 rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B]" />
        </div>
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#F1F5F9] dark:border-[#1E293B]">
          <div className="h-12 rounded-xl bg-[#F8FAFC] dark:bg-[#18181B]" />
          <div className="h-12 rounded-xl bg-[#F8FAFC] dark:bg-[#18181B]" />
        </div>
      </div>

      {/* 2. Chart Widget Skeleton */}
      <div className="h-64 w-full rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] p-6 shadow-xs flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div className="h-5 w-44 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
          <div className="h-7 w-28 rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B]" />
        </div>
        <div className="flex-1 rounded-xl bg-[#F8FAFC] dark:bg-[#18181B]" />
      </div>

      {/* 3. Accounts Widget Skeleton */}
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center px-1">
          <div className="h-5 w-28 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
          <div className="h-4 w-16 rounded-md bg-[#F1F5F9] dark:bg-[#1E293B]" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-24 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] p-4 flex flex-col justify-between shadow-xs"
            >
              <div className="flex justify-between items-center">
                <div className="w-7 h-7 rounded-lg bg-[#E2E8F0] dark:bg-[#1E293B]" />
                <div className="h-3 w-10 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="h-3.5 w-16 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
                <div className="h-4 w-24 rounded-md bg-[#CBD5E1] dark:bg-[#334155]" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Recent Transactions Skeleton */}
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center px-1">
          <div className="h-5 w-36 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
          <div className="h-4 w-20 rounded-md bg-[#F1F5F9] dark:bg-[#1E293B]" />
        </div>
        <div className="flex flex-col gap-2.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] p-4 flex items-center justify-between shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E2E8F0] dark:bg-[#1E293B]" />
                <div className="flex flex-col gap-1.5">
                  <div className="h-4 w-36 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
                  <div className="h-3 w-20 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
                </div>
              </div>
              <div className="h-5 w-24 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
