"use client";

import React, { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createManualSplitBillDraft } from "@/actions/split-bills";
import { DetailHeaderSkeleton, DetailStepperSkeleton, SplitBillDetailStepSkeleton } from "@/components/split-bill/split-bill-step-skeleton";

function Step1Skeleton() {
  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-3 animate-in fade-in-50 duration-150" aria-busy="true" aria-live="polite">
      <DetailHeaderSkeleton />
      <DetailStepperSkeleton active={1} />
      <div className="px-1 py-2">
        <SplitBillDetailStepSkeleton step={1} editing={true} />
      </div>
    </div>
  );
}

export function ManualDraftLoading() {
  const router = useRouter();
  const startedRef = useRef(false);

  useEffect(() => {
    // React StrictMode (dev) unmount/remounts effects; allow the effective run to proceed.
    if (startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const res = await createManualSplitBillDraft();
        if (cancelled) return;
        if (res?.error || !res?.id) {
          toast.error(res?.error || "Gagal memulai patungan manual.");
          router.replace("/split-bill");
          return;
        }
        router.replace(`/split-bill/${res.id}?manual=1`);
      } catch {
        if (cancelled) return;
        toast.error("Gagal memulai patungan manual.");
        router.replace("/split-bill");
      }
    })();
    return () => {
      cancelled = true;
      // Reset so the StrictMode remount (or a real remount) can start again.
      startedRef.current = false;
    };
  }, [router]);

  return <Step1Skeleton />;
}
