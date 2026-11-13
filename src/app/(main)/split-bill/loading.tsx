'use client';

import React, { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { parseSplitBillUiCookie } from "@/lib/utils/split-bill";
import { DetailHeaderSkeleton, DetailStepperSkeleton, SplitBillDetailStepSkeleton } from "@/components/split-bill/split-bill-step-skeleton";

function getDetailUi(pathname: string | null, isManual: boolean): { step: 1 | 2 | 3 | 4; editing: boolean } {
  const fallback = isManual ? { step: 1 as const, editing: true } : { step: 1 as const, editing: false };
  if (typeof document === "undefined") return fallback;
  const id = pathname?.match(/\/split-bill\/([^/]+)/)?.[1];
  if (!id || id === "history") return fallback;
  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|;\\s*)split-bill-ui-${id.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}=([^;]*)`),
    );
    const ui = parseSplitBillUiCookie(match?.[1] ? decodeURIComponent(match[1]) : match?.[1]);
    if (ui?.step) return { step: ui.step, editing: !!ui.editing };
  } catch {
    // ignore
  }
  if (isManual) return { step: 1, editing: true };
  return fallback;
}

export default function SplitBillLoading() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDetailRoute = /\/split-bill\/(?!history(?:\/|$))[^/]+/.test(pathname || "");
  const isManualStart =
    !isDetailRoute && pathname === "/split-bill" && searchParams.get("mode") === "manual";
  const ui = useMemo(() => {
    if (isDetailRoute || isManualStart) return getDetailUi(pathname, searchParams.get("manual") === "1" || isManualStart);
    return { step: 1 as const, editing: false };
  }, [pathname, isDetailRoute, isManualStart, searchParams]);

  if (isDetailRoute || isManualStart) {
    return (
      <div className="max-w-3xl mx-auto flex flex-col gap-3 animate-in fade-in-50 duration-150" aria-busy="true" aria-live="polite">
        <DetailHeaderSkeleton />
        <DetailStepperSkeleton active={ui.step} />
        <div className="px-1 py-2">
          <SplitBillDetailStepSkeleton step={ui.step} editing={ui.editing} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="max-w-3xl mx-auto flex flex-col gap-5 animate-in fade-in-50 duration-150"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex flex-col gap-2">
          <Skeleton className="h-7 w-40 sm:w-48 rounded-lg bg-surface-muted" />
          <Skeleton className="h-3.5 w-56 sm:w-72 rounded-md bg-surface-subtle" />
        </div>
        <Skeleton className="w-11 h-11 shrink-0 rounded-full bg-surface-subtle" />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-foreground bg-surface-inverse p-5 flex flex-col gap-3">
          <Skeleton className="w-11 h-11 rounded-xl bg-foreground-inverse/15" />
          <Skeleton className="h-4 w-28 rounded-md bg-foreground-inverse/25" />
          <Skeleton className="h-3 w-full max-w-[220px] rounded-md bg-foreground-inverse/10" />
          <Skeleton className="h-2.5 w-12 rounded-md bg-foreground-inverse/15" />
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5 flex flex-col gap-3">
          <Skeleton className="w-11 h-11 rounded-xl bg-surface-subtle" />
          <Skeleton className="h-4 w-32 rounded-md bg-surface-muted" />
          <Skeleton className="h-3 w-full max-w-[220px] rounded-md bg-surface-subtle" />
          <Skeleton className="h-2.5 w-12 rounded-md bg-surface-subtle" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-2.5 w-28 rounded-md bg-surface-subtle" />
          <Skeleton className="h-2.5 w-16 rounded-md bg-surface-subtle" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5">
            <div className="min-w-0 flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-32 sm:w-40 rounded-md bg-surface-muted" />
              <Skeleton className="h-2.5 w-24 sm:w-32 rounded-md bg-surface-subtle" />
            </div>
            <Skeleton className="h-4 w-16 shrink-0 rounded-full bg-surface-subtle" />
          </div>
        ))}
      </div>
    </div>
  );
}
