'use client';

import React, { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { parseSplitBillUiCookie } from "@/lib/utils/split-bill";
import { DetailHeaderSkeleton, DetailStepperSkeleton, SplitBillDetailStepSkeleton } from "@/components/split-bill/split-bill-step-skeleton";

function getUiFromPath(pathname: string | null, isManual: boolean): { step: 1 | 2 | 3 | 4; editing: boolean } {
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

export default function SplitBillDetailLoading() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isManual = searchParams.get("manual") === "1";
  const ui = useMemo(() => getUiFromPath(pathname, isManual), [pathname, isManual]);

  return (
    <div
      className="max-w-3xl mx-auto flex flex-col gap-3 animate-in fade-in-50 duration-150"
      aria-busy="true"
      aria-live="polite"
    >
      <DetailHeaderSkeleton />
      <DetailStepperSkeleton active={ui.step} />
      <div className="px-1 py-2">
        <SplitBillDetailStepSkeleton step={ui.step} editing={ui.editing} />
      </div>
    </div>
  );
}
