'use client';

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { parseSplitBillUiCookie } from "@/lib/utils/split-bill";
import { DetailHeaderSkeleton, DetailStepperSkeleton, SplitBillDetailStepSkeleton } from "@/components/split-bill/split-bill-step-skeleton";

function getUiFromPath(pathname: string | null): { step: 1 | 2 | 3 | 4; editing: boolean } {
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

export default function SplitBillDetailLoading() {
  const pathname = usePathname();
  const [ui, setUi] = useState<{ step: 1 | 2 | 3 | 4; editing: boolean }>({ step: 1, editing: false });
  React.useEffect(() => {
    setUi(getUiFromPath(pathname));
  }, [pathname]);

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
