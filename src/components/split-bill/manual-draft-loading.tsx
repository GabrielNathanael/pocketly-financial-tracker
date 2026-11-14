"use client";

import React, { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createManualSplitBillDraft } from "@/actions/split-bills";
import { DetailHeaderSkeleton, DetailStepperSkeleton, SplitBillDetailStepSkeleton } from "@/components/split-bill/split-bill-step-skeleton";

const MANUAL_DRAFT_ATTEMPT_KEY = "split-bill:manual-draft-attempt-key";

function getOrCreateManualDraftAttemptKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.sessionStorage.getItem(MANUAL_DRAFT_ATTEMPT_KEY);
    if (existing) return existing;
    const key = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.sessionStorage.setItem(MANUAL_DRAFT_ATTEMPT_KEY, key);
    return key;
  } catch {
    return null;
  }
}

function clearManualDraftAttemptKey() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(MANUAL_DRAFT_ATTEMPT_KEY);
  } catch {
    // ignore storage errors
  }
}

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
    // React StrictMode (dev) runs setup->cleanup->setup; keep startedRef true so the
    // re-setup doesn't issue a second create while the first request may already be in-flight.
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      // Persist a per-attempt key so retries/remounts resolve to the same draft (idempotent server create).
      const attemptKey = getOrCreateManualDraftAttemptKey();
      try {
        const res = await createManualSplitBillDraft(attemptKey ? { attemptKey } : undefined);
        if (res?.error || !res?.id) {
          // Keep attempt key so a retry can reuse the same draft if it was created ambiguously.
          toast.error(res?.error || "Gagal memulai patungan manual.");
          router.replace("/split-bill");
          return;
        }
        clearManualDraftAttemptKey();
        router.replace(`/split-bill/${res.id}?manual=1`);
      } catch {
        // Keep attempt key for retry.
        toast.error("Gagal memulai patungan manual.");
        router.replace("/split-bill");
      }
    })();
  }, [router]);

  return <Step1Skeleton />;
}
