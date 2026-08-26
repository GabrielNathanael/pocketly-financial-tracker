import React from 'react'

export default function DebtsLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse" aria-busy="true" aria-live="polite">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="h-7 w-40 rounded-lg bg-[#E2E8F0] dark:bg-[#1E293B]" />
          <div className="h-4 w-56 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
        </div>
        <div className="h-9 w-32 rounded-xl bg-[#E2E8F0] dark:bg-[#1E293B]" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="h-28 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] p-5 flex flex-col justify-between shadow-xs">
          <div className="h-3.5 w-24 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
          <div className="h-7 w-36 rounded-lg bg-[#CBD5E1] dark:bg-[#334155]" />
        </div>
        <div className="h-28 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] p-5 flex flex-col justify-between shadow-xs">
          <div className="h-3.5 w-24 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
          <div className="h-7 w-36 rounded-lg bg-[#CBD5E1] dark:bg-[#334155]" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] p-5 flex flex-col justify-between shadow-xs"
          >
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-1.5">
                <div className="h-4 w-36 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
                <div className="h-3 w-24 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
              </div>
              <div className="h-5 w-16 rounded-full bg-[#F1F5F9] dark:bg-[#1E293B]" />
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-[#F1F5F9] dark:border-[#1E293B]">
              <div className="h-5 w-28 rounded-md bg-[#CBD5E1] dark:bg-[#334155]" />
              <div className="h-4 w-20 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
