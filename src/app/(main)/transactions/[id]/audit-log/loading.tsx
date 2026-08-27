import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default function TransactionAuditLogLoading() {
  return (
    <div className="flex flex-col gap-5 max-w-lg mx-auto animate-in fade-in-50 duration-150" aria-busy="true" aria-live="polite">
      {/* Back Link Skeleton */}
      <div>
        <Skeleton className="h-4 w-32 rounded-md bg-slate-200 dark:bg-[#27272A]" />
      </div>

      {/* Title & Subtitle Skeleton */}
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-6 w-44 rounded-md bg-slate-200 dark:bg-[#27272A]" />
        <Skeleton className="h-3.5 w-72 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
      </div>

      {/* Log Entry Cards Skeleton */}
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-2.5"
          >
            {/* Badge + Title row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16 rounded-md bg-slate-200 dark:bg-[#27272A]" />
                <Skeleton className="h-4 w-28 rounded-md bg-slate-200 dark:bg-[#27272A]" />
              </div>
              <Skeleton className="h-3.5 w-32 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
            </div>

            {/* Summary text */}
            <Skeleton className="h-3.5 w-full rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
            <Skeleton className="h-3.5 w-4/5 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />

            {/* Changes diff block */}
            {i === 1 && (
              <div className="p-2.5 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-3 w-16 rounded bg-slate-200 dark:bg-[#27272A]" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-16 rounded bg-rose-200 dark:bg-rose-900/30" />
                    <Skeleton className="h-3 w-3 rounded bg-slate-200 dark:bg-[#27272A]" />
                    <Skeleton className="h-3 w-20 rounded bg-teal-200 dark:bg-teal-900/30" />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-3 w-12 rounded bg-slate-200 dark:bg-[#27272A]" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-14 rounded bg-rose-200 dark:bg-rose-900/30" />
                    <Skeleton className="h-3 w-3 rounded bg-slate-200 dark:bg-[#27272A]" />
                    <Skeleton className="h-3 w-14 rounded bg-teal-200 dark:bg-teal-900/30" />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
