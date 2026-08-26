import React from 'react'

export default function TransactionsLoading() {
  return (
    <div className="flex flex-col gap-4 animate-pulse" aria-busy="true" aria-live="polite">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-32 rounded-lg bg-[#E2E8F0] dark:bg-[#1E293B]" />
          <div className="h-6 w-14 rounded-full bg-[#F1F5F9] dark:bg-[#1E293B]" />
        </div>
        <div className="h-9 w-28 rounded-xl bg-[#E2E8F0] dark:bg-[#1E293B]" />
      </div>

      {/* Filter Bar Skeleton */}
      <div className="flex items-center gap-2 overflow-x-auto py-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-24 rounded-xl bg-[#E2E8F0] dark:bg-[#1E293B] shrink-0" />
        ))}
      </div>

      {/* Search Input Skeleton */}
      <div className="h-11 w-full rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A]" />

      {/* Transactions List Skeleton */}
      <div className="flex flex-col gap-2.5 mt-1">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div
            key={i}
            className="h-18 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] p-4 flex items-center justify-between shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#E2E8F0] dark:bg-[#1E293B]" />
              <div className="flex flex-col gap-1.5">
                <div className="h-4 w-40 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
                <div className="flex items-center gap-2">
                  <div className="h-3 w-20 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
                  <div className="h-3 w-16 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div className="h-5 w-28 rounded-md bg-[#CBD5E1] dark:bg-[#334155]" />
              <div className="h-3 w-14 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
