"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Size = { w: number; h: number };

/**
 * Scan effect bound to the *actual* rendered receipt bounds.
 * The sweep travels the full height of the receipt (top -> bottom, one direction)
 * and the viewfinder corners hug the receipt edges.
 */
function ScanEffect({ showCorners }: { showCorners: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {showCorners && (
        <>
          <span className="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 border-white/90 rounded-tl-lg" />
          <span className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-white/90 rounded-tr-lg" />
          <span className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-white/90 rounded-bl-lg" />
          <span className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-white/90 rounded-br-lg" />
        </>
      )}

      {/* Beam: glow trail above a bright scan line, travels top -> bottom of the receipt */}
      <div className="receipt-scan-trail absolute left-0 right-0 h-20 bg-gradient-to-b from-transparent via-indigo-500/25 to-indigo-300/70">
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-white to-transparent shadow-[0_0_14px_3px_rgba(129,140,248,0.55),0_0_34px_8px_rgba(99,102,241,0.25)]" />
      </div>
    </div>
  );
}

export function ReceiptScanOverlay({
  imageUrl,
  scanning,
  progress,
  status,
  error,
  onClose,
  onRetry,
  retryLabel,
  closeLabel,
  className,
  contained = false,
  backdrop = true,
  padding = "p-0",
  imageClassName,
  showStatus = true,
  showCorners = true,
}: {
  imageUrl?: string | null;
  scanning?: boolean;
  progress?: number;
  status?: string;
  error?: string | null;
  onClose?: () => void;
  onRetry?: () => void;
  retryLabel?: string;
  closeLabel?: string;
  className?: string;
  /** Render as a contained block instead of fixed full-screen overlay */
  contained?: boolean;
  /** Dark backdrop behind the receipt (full-screen mode only) */
  backdrop?: boolean;
  /** Padding around the receipt inside the overlay */
  padding?: string;
  /** Extra classes for the receipt image (e.g. rounding) */
  imageClassName?: string;
  /** Render the status/progress/error bar */
  showStatus?: boolean;
  /** Render viewfinder corner brackets */
  showCorners?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Size | null>(null);
  const [natural, setNatural] = useState<{ url: string; w: number; h: number } | null>(null);

  // Probe the receipt's natural size so the effect can bind to the real image bounds.
  useEffect(() => {
    if (!imageUrl) return;
    let cancelled = false;
    const probe = new window.Image();
    probe.onload = () => {
      if (cancelled) return;
      setNatural({ url: imageUrl, w: probe.naturalWidth, h: probe.naturalHeight });
    };
    probe.onerror = () => {
      if (cancelled) return;
      setNatural((prev) => (prev && prev.url === imageUrl ? null : prev));
    };
    probe.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  // Track the space available for the receipt.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setBox((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Exact rendered size of the receipt (object-contain math).
  const frame = useMemo<Size | null>(() => {
    if (!natural || !box) return null;
    if (!imageUrl || natural.url !== imageUrl) return null;
    if (!natural.w || !natural.h || !box.w || !box.h) return null;
    const scale = Math.min(box.w / natural.w, box.h / natural.h);
    if (!Number.isFinite(scale) || scale <= 0) return null;
    return { w: Math.max(1, Math.round(natural.w * scale)), h: Math.max(1, Math.round(natural.h * scale)) };
  }, [natural, box, imageUrl]);

  const showScan = !!scanning && !error;

  return (
    <div
      className={cn(
        contained ? "absolute inset-0 z-10" : "fixed inset-0 z-[80]",
        "flex items-center justify-center overflow-hidden",
        className,
      )}
    >
      {backdrop && !contained && <div className="absolute inset-0 bg-[#09090B]" />}

      {/* Receipt area */}
      <div ref={boxRef} className={cn("relative flex items-center justify-center w-full h-full", padding)}>
        {imageUrl ? (
          <div
            className="relative shrink-0 overflow-hidden"
            style={frame ? { width: frame.w, height: frame.h } : { maxWidth: "100%", maxHeight: "100%" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Receipt preview"
              className={cn(
                "block",
                frame ? "h-full w-full object-contain" : "max-h-full max-w-full object-contain",
                imageClassName,
              )}
            />
            {showScan && frame && <ScanEffect showCorners={showCorners} />}
          </div>
        ) : null}
      </div>

      {/* Close */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel || "Close"}
          className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] w-10 h-10 rounded-full bg-black/35 backdrop-blur-md border border-white/40 text-white flex items-center justify-center z-10"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      {/* Status / progress / error */}
      {showStatus && (showScan || error) && (
        <div className="absolute inset-x-0 bottom-0 px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/80 via-black/45 to-transparent z-10">
          {showScan && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">{status}</p>
                {typeof progress === "number" && (
                  <span className="text-xs font-mono font-bold text-white/90 bg-white/15 px-2 py-1 rounded-md shrink-0">
                    {Math.round(progress)}%
                  </span>
                )}
              </div>
              {typeof progress === "number" && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/25">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-300"
                    style={{ width: `${Math.max(8, Math.round(progress))}%` }}
                  />
                </div>
              )}
            </div>
          )}
          {error && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-white">{status || "Error"}</p>
              {error && <p className="text-[11px] text-white/80 break-words">{error}</p>}
              {(onRetry || onClose) && (
                <div className="flex items-center gap-2 mt-1">
                  {onRetry && (
                    <button type="button" onClick={onRetry} className="flex-1 h-11 rounded-xl bg-white text-black text-xs font-bold">
                      {retryLabel || "Retry"}
                    </button>
                  )}
                  {onClose && (
                    <button type="button" onClick={onClose} className="h-11 px-4 rounded-xl border border-white/50 text-white text-xs font-semibold bg-black/20">
                      {closeLabel || "Close"}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
