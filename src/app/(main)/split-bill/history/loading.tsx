import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function SplitBillHistoryLoading() {
  return (
    <div
      className="max-w-3xl mx-auto flex flex-col gap-4 animate-in fade-in-50 duration-150"
      aria-busy="true"
      aria-live="polite"
    >
      {/* Header: back + judul */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Skeleton className="w-10 h-10 shrink-0 rounded-full bg-surface-subtle" />
          <div className="min-w-0 flex flex-col gap-1.5">
            <Skeleton className="h-4 w-28 rounded-md bg-surface-muted" />
            <Skeleton className="h-2.5 w-20 rounded-md bg-surface-subtle" />
          </div>
        </div>
      </div>

      {/* Filter status */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((i) => (
          <Skeleton
            key={i}
            className="h-8 w-20 shrink-0 rounded-full bg-surface-subtle"
          />
        ))}
      </div>

      {/* List patungan */}
      <div className="flex flex-col gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3.5 rounded-2xl border border-border bg-surface"
          >
            <Skeleton className="w-10 h-10 shrink-0 rounded-xl bg-surface-subtle" />
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-3.5 w-28 sm:w-36 rounded-md bg-surface-muted" />
                <Skeleton className="h-4 w-12 shrink-0 rounded-full bg-surface-subtle" />
              </div>
              <Skeleton className="h-2.5 w-32 sm:w-40 rounded-md bg-surface-subtle" />
            </div>
            <Skeleton className="w-8 h-8 shrink-0 rounded-lg bg-surface-subtle" />
          </div>
        ))}
      </div>
    </div>
  );
}
