import React from 'react'

export default function AccountsLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse" aria-busy="true" aria-live="polite">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="h-7 w-36 rounded-lg bg-[#E2E8F0] dark:bg-[#1E293B]" />
          <div className="h-4 w-52 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-20 rounded-xl bg-[#E2E8F0] dark:bg-[#1E293B]" />
          <div className="h-9 w-28 rounded-xl bg-[#E2E8F0] dark:bg-[#1E293B]" />
        </div>
      </div>

      {/* Total Liquidity Banner Card */}
      <div className="h-32 w-full rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] p-6 shadow-xs flex flex-col justify-between">
        <div className="h-3.5 w-32 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
        <div className="h-10 w-64 rounded-lg bg-[#CBD5E1] dark:bg-[#334155]" />
        <div className="h-3 w-40 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
      </div>

      {/* Accounts Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-36 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] p-5 flex flex-col justify-between shadow-xs"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E2E8F0] dark:bg-[#1E293B]" />
                <div className="flex flex-col gap-1.5">
                  <div className="h-4 w-28 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
                  <div className="h-3 w-16 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
                </div>
              </div>
              <div className="h-5 w-12 rounded-md bg-[#F1F5F9] dark:bg-[#1E293B]" />
            </div>
            <div className="flex items-end justify-between pt-3 border-t border-[#F1F5F9] dark:border-[#1E293B]">
              <div className="h-3 w-20 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
              <div className="h-6 w-32 rounded-md bg-[#CBD5E1] dark:bg-[#334155]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
