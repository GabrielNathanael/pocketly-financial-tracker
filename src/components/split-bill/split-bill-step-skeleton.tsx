"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function DetailHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 pt-1">
      <div className="flex items-center gap-2 min-w-0">
        <Skeleton className="w-10 h-10 shrink-0 rounded-full bg-surface-subtle" />
        <Skeleton className="w-10 h-10 shrink-0 rounded-full bg-surface-subtle" />
        <div className="min-w-0 flex flex-col gap-1.5">
          <Skeleton className="h-6 w-36 sm:w-52 rounded-md bg-surface-muted dark:bg-border" />
          <Skeleton className="h-3 w-28 rounded-md bg-surface-subtle dark:bg-surface-muted" />
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Skeleton className="w-10 h-10 rounded-full bg-surface-subtle" />
        <Skeleton className="w-10 h-10 rounded-full bg-surface-subtle" />
      </div>
    </div>
  );
}

export function DetailStepperSkeleton({ active }: { active: 1 | 2 | 3 | 4 }) {
  const widths = [88, 86, 112, 86];
  return (
    <div className="flex items-center gap-1 overflow-hidden py-2 border-b border-border/70">
      {([1, 2, 3, 4] as const).map((i) => (
        <Skeleton
          key={i}
          className={`h-8 shrink-0 rounded-full ${i === active ? "bg-surface-muted dark:bg-border-strong/30" : "bg-surface-subtle"}`}
          style={{ width: `${widths[i - 1]}px` }}
        />
      ))}
    </div>
  );
}

function Step1EditSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-3 w-20 rounded bg-surface-subtle dark:bg-surface-muted" />
        <Skeleton className="h-10 w-full rounded-lg bg-surface-subtle" />
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-border bg-canvas dark:bg-surface-subtle p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 flex-1 rounded-md bg-surface" />
              <Skeleton className="w-8 h-8 rounded bg-surface" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="flex flex-col gap-1">
                  <Skeleton className="h-2.5 w-10 rounded bg-surface-muted dark:bg-border" />
                  <Skeleton className="h-8 w-full rounded-md bg-surface" />
                </div>
              ))}
            </div>
            <Skeleton className="h-3 w-24 rounded bg-surface-muted dark:bg-border" />
          </div>
        ))}
        <Skeleton className="h-9 w-full rounded-lg bg-canvas dark:bg-surface-subtle" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-16 rounded bg-surface-subtle dark:bg-surface-muted" />
        <Skeleton className="h-4 w-24 rounded bg-surface-muted dark:bg-border" />
      </div>
      <div className="border-t border-border pt-3 flex flex-col gap-2">
        <Skeleton className="h-2.5 w-20 rounded bg-surface-subtle dark:bg-surface-muted" />
        <Skeleton className="h-10 w-full rounded-lg bg-surface-subtle" />
        <Skeleton className="h-2.5 w-40 rounded bg-surface-subtle dark:bg-surface-muted" />
      </div>
    </div>
  );
}

function Step1ReviewSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-4">
      <Skeleton className="h-4 w-24 rounded bg-surface-muted dark:bg-border" />
      <div className="flex flex-col divide-y divide-border">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0 flex flex-col gap-1.5">
              <Skeleton className="h-4 w-32 sm:w-44 rounded bg-surface-muted dark:bg-border" />
              <Skeleton className="h-3 w-28 rounded bg-surface-subtle dark:bg-surface-muted" />
            </div>
            <Skeleton className="h-4 w-20 shrink-0 rounded bg-surface-muted dark:bg-border" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="h-3.5 w-16 rounded bg-surface-subtle dark:bg-surface-muted" />
        <Skeleton className="h-4 w-24 rounded bg-surface-muted dark:bg-border" />
      </div>
      <div className="flex flex-col gap-1.5">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-24 rounded bg-surface-subtle dark:bg-surface-muted" />
            <Skeleton className="h-3.5 w-16 rounded bg-surface-subtle dark:bg-surface-muted" />
          </div>
        ))}
      </div>
      <div className="border-t border-border pt-3 flex flex-col gap-1.5">
        <Skeleton className="h-2.5 w-24 rounded bg-surface-subtle dark:bg-surface-muted" />
        <Skeleton className="h-8 w-36 rounded bg-surface-muted dark:bg-border" />
      </div>
    </div>
  );
}

function Step2Skeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-24 rounded bg-surface-muted dark:bg-border" />
          <Skeleton className="h-2.5 w-52 rounded bg-surface-subtle dark:bg-surface-muted" />
        </div>
        <Skeleton className="h-8 w-24 rounded-md bg-surface-subtle" />
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <Skeleton className="h-9 w-full sm:w-56 rounded-lg bg-surface-subtle" />
        <Skeleton className="h-9 w-28 rounded-md bg-surface-subtle" />
      </div>
      <div className="flex flex-col gap-1.5 pt-2 border-t border-surface-subtle">
        <Skeleton className="h-2.5 w-16 rounded bg-surface-subtle dark:bg-surface-muted" />
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-border">
              <Skeleton className="w-8 h-8 rounded-full bg-surface-subtle" />
              <Skeleton className="h-3.5 w-16 rounded bg-surface-muted dark:bg-border" />
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="h-2.5 w-full max-w-sm rounded bg-surface-subtle dark:bg-surface-muted" />
    </div>
  );
}

function Step3Skeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex flex-col gap-1.5">
          <Skeleton className="h-4 w-28 rounded bg-surface-muted dark:bg-border" />
          <Skeleton className="h-2.5 w-64 max-w-full rounded bg-surface-subtle dark:bg-surface-muted" />
        </div>
        <Skeleton className="h-8 w-36 shrink-0 rounded-xl bg-surface-subtle" />
      </div>
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border">
            <Skeleton className="w-6 h-6 rounded-full bg-surface-subtle" />
            <Skeleton className="h-3.5 w-14 rounded bg-surface-muted dark:bg-border" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="p-3 rounded-lg border border-border flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1.5 min-w-0">
                <Skeleton className="h-4 w-32 rounded bg-surface-muted dark:bg-border" />
                <Skeleton className="h-2.5 w-24 rounded bg-surface-subtle dark:bg-surface-muted" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full bg-surface-subtle" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-md bg-surface-subtle" />
              <Skeleton className="h-8 w-20 rounded-md bg-surface-subtle" />
              <Skeleton className="h-8 w-8 rounded-md bg-surface-subtle" />
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
      <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-36 rounded bg-surface-muted dark:bg-border" />
            <Skeleton className="h-2.5 w-28 rounded bg-surface-subtle dark:bg-surface-muted" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full bg-surface-subtle" />
        </div>
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <Skeleton className="h-3.5 w-28 rounded bg-surface-subtle dark:bg-surface-muted" />
              <Skeleton className="h-3.5 w-24 rounded bg-surface-muted dark:bg-border" />
            </div>
          ))}
        </div>
        <div className="border-t border-border pt-3 flex items-center justify-between">
          <Skeleton className="h-3.5 w-20 rounded bg-surface-subtle dark:bg-surface-muted" />
          <Skeleton className="h-6 w-28 rounded bg-surface-muted dark:bg-border" />
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-4 flex flex-col gap-3">
        <Skeleton className="h-4 w-32 rounded bg-surface-muted dark:bg-border" />
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-b-0">
            <div className="flex items-center gap-2 min-w-0">
              <Skeleton className="w-8 h-8 rounded-full bg-surface-subtle" />
              <Skeleton className="h-3.5 w-24 rounded bg-surface-muted dark:bg-border" />
            </div>
            <Skeleton className="h-4 w-20 rounded bg-surface-muted dark:bg-border" />
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
