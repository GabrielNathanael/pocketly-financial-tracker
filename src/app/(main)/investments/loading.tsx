import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function InvestmentsLoading() {
  return (
    <div
      className="mx-auto flex w-full max-w-7xl flex-col gap-3.5 px-1 pb-20 sm:gap-4 sm:px-2 animate-in fade-in-50 duration-150"
      aria-busy="true"
      aria-live="polite"
    >
      {/* 1. Header Card */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-3.5 shadow-2xs dark:border-[#27272A] dark:bg-[#121215] sm:p-5">
        <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-9 w-9 rounded-xl bg-slate-200 dark:bg-[#27272A] shrink-0" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-5 w-36 sm:w-44 rounded-md bg-slate-200 dark:bg-[#27272A]" />
              <Skeleton className="h-3 w-48 sm:w-60 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2.5">
            <Skeleton className="h-11 w-full sm:w-36 rounded-xl bg-slate-100 dark:bg-[#1A1A20]" />
            <Skeleton className="h-11 w-full sm:w-32 rounded-xl bg-slate-200 dark:bg-[#27272A]" />
          </div>
        </div>
      </div>

      {/* 2. 3-Tab Segmented Control */}
      <div className="grid grid-cols-3 gap-1 rounded-2xl border border-[#E5E7EB] bg-[#F1F3F5] p-1 dark:border-[#27272A] dark:bg-[#1A1A20]">
        {[1, 2, 3].map((i) => (
          <Skeleton
            key={i}
            className={`min-h-[42px] sm:min-h-[44px] rounded-xl ${i === 1 ? "bg-slate-200 dark:bg-[#27272A]" : "bg-slate-100 dark:bg-[#1E1E24]"}`}
          />
        ))}
      </div>

      {/* 3. Portfolio Holdings Grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-2xs dark:border-[#27272A] dark:bg-[#121215]"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 bg-slate-50 dark:bg-[#1A1A20]">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full bg-slate-200 dark:bg-[#27272A] shrink-0" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-16 rounded-md bg-slate-200 dark:bg-[#27272A]" />
                  <Skeleton className="h-2.5 w-12 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
                </div>
              </div>
              <Skeleton className="h-3 w-16 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
            </div>

            {/* Body */}
            <div className="p-4 sm:p-5 flex flex-col gap-3">
              {/* Quantity (kiri) + Modal (kanan) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-2.5 w-14 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
                  <Skeleton className="h-3.5 w-24 rounded-md bg-slate-200 dark:bg-[#27272A]" />
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Skeleton className="h-2.5 w-10 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
                  <Skeleton className="h-3.5 w-20 rounded-md bg-slate-200 dark:bg-[#27272A]" />
                </div>
              </div>

              {/* Avg — label kiri, value kanan */}
              <div className="flex items-center justify-between border-t border-[#E5E7EB] pt-2.5 dark:border-[#27272A]">
                <Skeleton className="h-2.5 w-24 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
                <Skeleton className="h-3.5 w-28 rounded-md bg-slate-200 dark:bg-[#27272A]" />
              </div>

              {/* Buy/Sell buttons */}
              <div className="flex items-center gap-2 border-t border-[#E5E7EB] pt-3 dark:border-[#27272A]">
                <Skeleton className="h-10 sm:h-11 flex-1 rounded-xl bg-slate-100 dark:bg-[#1E1E24]" />
                <Skeleton className="h-10 sm:h-11 flex-1 rounded-xl bg-slate-100 dark:bg-[#1E1E24]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
