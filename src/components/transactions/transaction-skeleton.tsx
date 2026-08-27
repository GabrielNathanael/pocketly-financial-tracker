'use client'

import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

interface TransactionSkeletonListProps {
  count?: number
}

export function TransactionSkeletonList({ count = 5 }: TransactionSkeletonListProps) {
  return (
    <div className="flex flex-col gap-4 animate-in fade-in-50 duration-200">
      {/* Group Header Skeleton */}
      <div className="flex items-center justify-between px-1">
        <Skeleton className="h-3.5 w-32 rounded-md bg-slate-200 dark:bg-[#27272A]" />
        <Skeleton className="h-3.5 w-20 rounded-md bg-slate-200 dark:bg-[#27272A]" />
      </div>

      {/* Cards Skeleton */}
      <div className="flex flex-col gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3 sm:p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-2xs"
          >
            {/* Left side: Icon + Titles */}
            <div className="flex items-center gap-3 min-w-0">
              <Skeleton className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#1A1A20] shrink-0" />
              <div className="flex flex-col gap-1.5 min-w-0">
                <Skeleton className="h-3.5 w-28 sm:w-36 rounded-md bg-slate-200 dark:bg-[#27272A]" />
                <Skeleton className="h-2.5 w-20 sm:w-28 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
              </div>
            </div>

            {/* Right side: Amount + Badge */}
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <Skeleton className="h-4 w-24 sm:w-28 rounded-md bg-slate-200 dark:bg-[#27272A]" />
              <Skeleton className="h-2.5 w-12 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
