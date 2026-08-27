import React from 'react'

export default function DebtsLoading() {
  return (
    <div className="flex flex-col gap-5 animate-pulse" aria-busy="true" aria-live="polite">
      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <div className="h-6 w-36 rounded-lg bg-[#E2E8F0] dark:bg-[#1E293B]" />
        <div className="h-3.5 w-64 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-[#E2E8F0] dark:bg-[#1E293B] shrink-0" />
          <div className="flex flex-col gap-1.5 w-full">
            <div className="h-3 w-28 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
            <div className="h-6 w-36 rounded-lg bg-[#E2E8F0] dark:bg-[#1E293B]" />
          </div>
        </div>
        <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-[#E2E8F0] dark:bg-[#1E293B] shrink-0" />
          <div className="flex flex-col gap-1.5 w-full">
            <div className="h-3 w-28 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
            <div className="h-6 w-36 rounded-lg bg-[#E2E8F0] dark:bg-[#1E293B]" />
          </div>
        </div>
      </div>

      {/* Action and Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-20 rounded-lg bg-[#E2E8F0] dark:bg-[#1E293B]" />
          <div className="h-8 w-20 rounded-lg bg-[#E2E8F0] dark:bg-[#1E293B]" />
          <div className="h-8 w-20 rounded-lg bg-[#E2E8F0] dark:bg-[#1E293B]" />
        </div>
        <div className="h-8 w-full sm:w-32 rounded-lg bg-[#E2E8F0] dark:bg-[#1E293B]" />
      </div>

      {/* Cards List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3 shadow-2xs"
          >
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-1.5">
                <div className="h-4 w-36 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
                <div className="h-3 w-24 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
              </div>
              <div className="h-5 w-16 rounded-full bg-[#E2E8F0] dark:bg-[#1E293B]" />
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-[#F1F5F9] dark:border-[#1E293B]">
              <div className="h-5 w-28 rounded-md bg-[#E2E8F0] dark:bg-[#1E293B]" />
              <div className="h-4 w-20 rounded-md bg-[#F1F5F9] dark:bg-[#0F172A]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
