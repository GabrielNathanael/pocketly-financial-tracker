import React from 'react'

export default function NetWorthLoading() {
  return (
    <div className="flex flex-col gap-5 max-w-xl mx-auto animate-pulse" aria-busy="true" aria-live="polite">
      {/* Back button skeleton */}
      <div className="h-4 w-28 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />

      {/* Main Net Worth Hero skeleton */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-4 shadow-2xs">
        <div className="h-3 w-44 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
        <div className="flex flex-col gap-2">
          <div className="h-10 w-64 rounded-lg bg-[#CBD5E1] dark:bg-[#334155]" />
          <div className="h-3 w-48 rounded-md bg-[#F1F5F9] dark:bg-[#1E293B]" />
        </div>

        {/* Half-Donut visual skeleton */}
        <div className="flex flex-col items-center pt-4 border-t border-[#E5E7EB] dark:border-[#27272A] gap-3">
          <div className="flex items-center justify-between w-full">
            <div className="h-3 w-36 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
            <div className="h-3 w-16 rounded-md bg-[#F1F5F9] dark:bg-[#1E293B]" />
          </div>
          <div className="w-48 h-24 rounded-t-full border-t-8 border-x-8 border-[#E2E8F0] dark:border-[#1E293B] flex items-end justify-center pb-2">
            <div className="h-3 w-20 rounded-md bg-[#CBD5E1] dark:bg-[#334155]" />
          </div>
          <div className="h-8 w-44 rounded-lg bg-[#CBD5E1] dark:bg-[#334155]" />
        </div>
      </div>

      {/* Balance Sheet Ledger skeleton */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-4 shadow-2xs">
        <div className="h-3 w-40 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-14 rounded-xl bg-[#F8FAFC] dark:bg-[#18181B] border border-[#E5E7EB] dark:border-[#27272A] p-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#E2E8F0] dark:bg-[#1E293B]" />
                <div className="h-4 w-32 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
              </div>
              <div className="h-4 w-24 rounded-md bg-[#CBD5E1] dark:bg-[#334155]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
