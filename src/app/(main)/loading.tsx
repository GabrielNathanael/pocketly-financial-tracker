import React from 'react'

export default function GlobalLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse" aria-busy="true" aria-live="polite">
      {/* Header skeleton */}
      <div className="flex items-center justify-between pb-2">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-40 rounded-lg bg-[#E2E8F0] dark:bg-[#1E293B]" />
          <div className="h-4 w-60 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
        </div>
        <div className="h-9 w-24 rounded-xl bg-[#E2E8F0] dark:bg-[#1E293B]" />
      </div>

      {/* Main card skeleton */}
      <div className="h-44 w-full rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] p-6 shadow-xs flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2">
            <div className="h-3 w-28 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
            <div className="h-9 w-52 rounded-lg bg-[#CBD5E1] dark:bg-[#334155]" />
          </div>
          <div className="h-8 w-8 rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B]" />
        </div>
        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#F1F5F9] dark:border-[#1E293B]">
          <div className="h-10 rounded-lg bg-[#F8FAFC] dark:bg-[#18181B]" />
          <div className="h-10 rounded-lg bg-[#F8FAFC] dark:bg-[#18181B]" />
        </div>
      </div>

      {/* Content list skeleton */}
      <div className="flex flex-col gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-16 w-full rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] p-4 flex items-center justify-between shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#E2E8F0] dark:bg-[#1E293B]" />
              <div className="flex flex-col gap-1.5">
                <div className="h-4 w-32 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
                <div className="h-3 w-20 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
              </div>
            </div>
            <div className="h-5 w-24 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
          </div>
        ))}
      </div>
    </div>
  )
}
