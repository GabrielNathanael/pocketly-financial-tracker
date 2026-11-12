"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function DetailHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 pt-1">
      <div className="flex items-center gap-2 min-w-0">
        <Skeleton className="w-10 h-10 shrink-0 rounded-full bg-slate-100 dark:bg-[#1A1A20]" />
        <Skeleton className="w-10 h-10 shrink-0 rounded-full bg-slate-100 dark:bg-[#1A1A20]" />
        <div className="min-w-0 flex flex-col gap-1.5">
          <Skeleton className="h-6 w-36 sm:w-52 rounded-md bg-slate-200 dark:bg-[#27272A]" />
          <Skeleton className="h-3 w-28 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Skeleton className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#1A1A20]" />
        <Skeleton className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#1A1A20]" />
      </div>
    </div>
  );
}

export function DetailStepperSkeleton({ active }: { active: 1 | 2 | 3 | 4 }) {
  const widths = [88, 86, 112, 86];
  return (
    <div className="flex items-center gap-1 overflow-hidden py-2 border-b border-[#E5E7EB]/70 dark:border-[#27272A]/70">
      {([1, 2, 3, 4] as const).map((i) => (
        <Skeleton
          key={i}
          className={`h-8 shrink-0 rounded-full ${i === active ? "bg-slate-300 dark:bg-[#3f3f46]" : "bg-slate-100 dark:bg-[#1A1A20]"}`}
          style={{ width: `${widths[i - 1]}px` }}
        />
      ))}
    </div>
  );
}

function Step1EditSkeleton() {
  return (
    <div className="rounded-xl border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] p-4 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-3 w-20 rounded bg-slate-100 dark:bg-[#1E1E24]" />
        <Skeleton className="h-10 w-full rounded-lg bg-slate-100 dark:bg-[#1A1A20]" />
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-[#E5E7EB] dark:border-[#27272A] bg-[#F8F9FA] dark:bg-[#1A1A20] p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 flex-1 rounded-md bg-white dark:bg-[#121215]" />
              <Skeleton className="w-8 h-8 rounded bg-white dark:bg-[#121215]" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="flex flex-col gap-1">
                  <Skeleton className="h-2.5 w-10 rounded bg-slate-200 dark:bg-[#27272A]" />
                  <Skeleton className="h-8 w-full rounded-md bg-white dark:bg-[#121215]" />
                </div>
              ))}
            </div>
            <Skeleton className="h-3 w-24 rounded bg-slate-200 dark:bg-[#27272A]" />
          </div>
        ))}
        <Skeleton className="h-9 w-full rounded-lg bg-slate-50 dark:bg-[#17171c]" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-16 rounded bg-slate-100 dark:bg-[#1E1E24]" />
        <Skeleton className="h-4 w-24 rounded bg-slate-200 dark:bg-[#27272A]" />
      </div>
      <div className="border-t border-[#E5E7EB] dark:border-[#27272A] pt-3 flex flex-col gap-2">
        <Skeleton className="h-2.5 w-20 rounded bg-slate-100 dark:bg-[#1E1E24]" />
        <Skeleton className="h-10 w-full rounded-lg bg-slate-100 dark:bg-[#1A1A20]" />
        <Skeleton className="h-2.5 w-40 rounded bg-slate-100 dark:bg-[#1E1E24]" />
      </div>
    </div>
  );
}

function Step1ReviewSkeleton() {
  return (
    <div className="rounded-xl border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] p-4 flex flex-col gap-4">
      <Skeleton className="h-4 w-24 rounded bg-slate-200 dark:bg-[#27272A]" />
      <div className="flex flex-col divide-y divide-[#E5E7EB] dark:divide-[#27272A]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0 flex flex-col gap-1.5">
              <Skeleton className="h-4 w-32 sm:w-44 rounded bg-slate-200 dark:bg-[#27272A]" />
              <Skeleton className="h-3 w-28 rounded bg-slate-100 dark:bg-[#1E1E24]" />
            </div>
            <Skeleton className="h-4 w-20 shrink-0 rounded bg-slate-200 dark:bg-[#27272A]" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="h-3.5 w-16 rounded bg-slate-100 dark:bg-[#1E1E24]" />
        <Skeleton className="h-4 w-24 rounded bg-slate-200 dark:bg-[#27272A]" />
      </div>
      <div className="flex flex-col gap-1.5">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-24 rounded bg-slate-100 dark:bg-[#1E1E24]" />
            <Skeleton className="h-3.5 w-16 rounded bg-slate-100 dark:bg-[#1E1E24]" />
          </div>
        ))}
      </div>
      <div className="border-t border-[#E5E7EB] dark:border-[#27272A] pt-3 flex flex-col gap-1.5">
        <Skeleton className="h-2.5 w-24 rounded bg-slate-100 dark:bg-[#1E1E24]" />
        <Skeleton className="h-8 w-36 rounded bg-slate-200 dark:bg-[#27272A]" />
      </div>
    </div>
  );
}

function Step2Skeleton() {
  return (
    <div className="rounded-xl border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-24 rounded bg-slate-200 dark:bg-[#27272A]" />
          <Skeleton className="h-2.5 w-52 rounded bg-slate-100 dark:bg-[#1E1E24]" />
        </div>
        <Skeleton className="h-8 w-24 rounded-md bg-slate-100 dark:bg-[#1A1A20]" />
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <Skeleton className="h-9 w-full sm:w-56 rounded-lg bg-slate-100 dark:bg-[#1A1A20]" />
        <Skeleton className="h-9 w-28 rounded-md bg-slate-100 dark:bg-[#1A1A20]" />
      </div>
      <div className="flex flex-col gap-1.5 pt-2 border-t border-[#F1F3F5] dark:border-[#1A1A20]">
        <Skeleton className="h-2.5 w-16 rounded bg-slate-100 dark:bg-[#1E1E24]" />
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-[#27272A]">
              <Skeleton className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#1A1A20]" />
              <Skeleton className="h-3.5 w-16 rounded bg-slate-200 dark:bg-[#27272A]" />
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="h-2.5 w-full max-w-sm rounded bg-slate-100 dark:bg-[#1E1E24]" />
    </div>
  );
}

function Step3Skeleton() {
  return (
    <div className="rounded-xl border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] p-4 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex flex-col gap-1.5">
          <Skeleton className="h-4 w-28 rounded bg-slate-200 dark:bg-[#27272A]" />
          <Skeleton className="h-2.5 w-64 max-w-full rounded bg-slate-100 dark:bg-[#1E1E24]" />
        </div>
        <Skeleton className="h-8 w-36 shrink-0 rounded-xl bg-slate-100 dark:bg-[#1A1A20]" />
      </div>
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#E5E7EB] dark:border-[#27272A]">
            <Skeleton className="w-6 h-6 rounded-full bg-slate-100 dark:bg-[#1A1A20]" />
            <Skeleton className="h-3.5 w-14 rounded bg-slate-200 dark:bg-[#27272A]" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="p-3 rounded-lg border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1.5 min-w-0">
                <Skeleton className="h-4 w-32 rounded bg-slate-200 dark:bg-[#27272A]" />
                <Skeleton className="h-2.5 w-24 rounded bg-slate-100 dark:bg-[#1E1E24]" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full bg-slate-100 dark:bg-[#1A1A20]" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-md bg-slate-100 dark:bg-[#1A1A20]" />
              <Skeleton className="h-8 w-20 rounded-md bg-slate-100 dark:bg-[#1A1A20]" />
              <Skeleton className="h-8 w-8 rounded-md bg-slate-100 dark:bg-[#1A1A20]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Step4Skeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] p-4 sm:p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-36 rounded bg-slate-200 dark:bg-[#27272A]" />
            <Skeleton className="h-2.5 w-28 rounded bg-slate-100 dark:bg-[#1E1E24]" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full bg-slate-100 dark:bg-[#1A1A20]" />
        </div>
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <Skeleton className="h-3.5 w-28 rounded bg-slate-100 dark:bg-[#1E1E24]" />
              <Skeleton className="h-3.5 w-24 rounded bg-slate-200 dark:bg-[#27272A]" />
            </div>
          ))}
        </div>
        <div className="border-t border-[#E5E7EB] dark:border-[#27272A] pt-3 flex items-center justify-between">
          <Skeleton className="h-3.5 w-20 rounded bg-slate-100 dark:bg-[#1E1E24]" />
          <Skeleton className="h-6 w-28 rounded bg-slate-200 dark:bg-[#27272A]" />
        </div>
      </div>
      <div className="rounded-2xl border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] p-4 flex flex-col gap-3">
        <Skeleton className="h-4 w-32 rounded bg-slate-200 dark:bg-[#27272A]" />
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center justify-between gap-3 py-2 border-b border-[#E5E7EB] dark:border-[#27272A] last:border-b-0">
            <div className="flex items-center gap-2 min-w-0">
              <Skeleton className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#1A1A20]" />
              <Skeleton className="h-3.5 w-24 rounded bg-slate-200 dark:bg-[#27272A]" />
            </div>
            <Skeleton className="h-4 w-20 rounded bg-slate-200 dark:bg-[#27272A]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SplitBillDetailStepSkeleton({ step, editing }: { step: 1 | 2 | 3 | 4; editing?: boolean }) {
  if (step === 1) return editing ? <Step1EditSkeleton /> : <Step1ReviewSkeleton />;
  if (step === 2) return <Step2Skeleton />;
  if (step === 3) return <Step3Skeleton />;
  return <Step4Skeleton />;
}
