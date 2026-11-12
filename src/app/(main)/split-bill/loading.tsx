'use client';

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { parseSplitBillUiCookie } from "@/lib/utils/split-bill";
import { DetailHeaderSkeleton, DetailStepperSkeleton, SplitBillDetailStepSkeleton } from "@/components/split-bill/split-bill-step-skeleton";

function getDetailUi(pathname: string | null): { step: 1 | 2 | 3 | 4; editing: boolean } {
  const isManual = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("manual") === "1";
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
  const isDetailRoute = /\/split-bill\/(?!history(?:\/|$))[^/]+/.test(pathname || "");
  const isManualStart =
    !isDetailRoute &&
    pathname === "/split-bill" &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("mode") === "manual";
  const [ui, setUi] = useState<{ step: 1 | 2 | 3 | 4; editing: boolean }>(
    isManualStart ? { step: 1, editing: true } : { step: 1, editing: false },
  );
  useEffect(() => {
    if (isDetailRoute || isManualStart) setUi(getDetailUi(pathname));
  }, [pathname, isDetailRoute, isManualStart]);

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
          <Skeleton className="h-7 w-40 sm:w-48 rounded-lg bg-slate-200 dark:bg-[#27272A]" />
          <Skeleton className="h-3.5 w-56 sm:w-72 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
        </div>
        <Skeleton className="w-11 h-11 shrink-0 rounded-full bg-slate-100 dark:bg-[#1A1A20]" />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-[#0F172A] dark:border-[#FAFAFA] bg-[#0F172A] dark:bg-[#FAFAFA] p-5 flex flex-col gap-3">
          <Skeleton className="w-11 h-11 rounded-xl bg-white/15 dark:bg-black/10" />
          <Skeleton className="h-4 w-28 rounded-md bg-white/25 dark:bg-black/10" />
          <Skeleton className="h-3 w-full max-w-[220px] rounded-md bg-white/10 dark:bg-black/10" />
          <Skeleton className="h-2.5 w-12 rounded-md bg-white/15 dark:bg-black/10" />
        </div>
        <div className="rounded-2xl border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] p-5 flex flex-col gap-3">
          <Skeleton className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-[#1A1A20]" />
          <Skeleton className="h-4 w-32 rounded-md bg-slate-200 dark:bg-[#27272A]" />
          <Skeleton className="h-3 w-full max-w-[220px] rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
          <Skeleton className="h-2.5 w-12 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-2.5 w-28 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
          <Skeleton className="h-2.5 w-16 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] px-3.5 py-2.5">
            <div className="min-w-0 flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-32 sm:w-40 rounded-md bg-slate-200 dark:bg-[#27272A]" />
              <Skeleton className="h-2.5 w-24 sm:w-32 rounded-md bg-slate-100 dark:bg-[#1E1E24]" />
            </div>
            <Skeleton className="h-4 w-16 shrink-0 rounded-full bg-slate-100 dark:bg-[#1A1A20]" />
          </div>
        ))}
      </div>
    </div>
  );
}
