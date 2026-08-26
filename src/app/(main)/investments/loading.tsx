import React from 'react'

export default function InvestmentsLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse" aria-busy="true" aria-live="polite">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="h-7 w-40 rounded-lg bg-[#E2E8F0] dark:bg-[#1E293B]" />
          <div className="h-4 w-56 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-28 rounded-xl bg-[#E2E8F0] dark:bg-[#1E293B]" />
        </div>
      </div>

      {/* Portfolio Value Summary Card */}
      <div className="h-36 w-full rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] p-6 shadow-xs flex flex-col justify-between">
        <div className="h-3.5 w-32 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
        <div className="h-10 w-60 rounded-lg bg-[#CBD5E1] dark:bg-[#334155]" />
        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#F1F5F9] dark:border-[#1E293B]">
          <div className="h-4 w-28 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
          <div className="h-4 w-28 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
        </div>
      </div>

      {/* Stock Holdings List */}
      <div className="flex flex-col gap-3">
        <div className="h-5 w-32 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] p-4 flex items-center justify-between shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#E2E8F0] dark:bg-[#1E293B]" />
              <div className="flex flex-col gap-1.5">
                <div className="h-4 w-28 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
                <div className="h-3 w-20 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div className="h-5 w-28 rounded-md bg-[#CBD5E1] dark:bg-[#334155]" />
              <div className="h-3 w-16 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
