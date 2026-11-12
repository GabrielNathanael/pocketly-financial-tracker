"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils/cn";
import { defaultAvatarFor, renderAvatarSvg } from "@/lib/utils/avatar";

const SIZE_CLASS = {
  xs: "w-6 h-6",
  sm: "w-7 h-7",
  md: "w-9 h-9",
  lg: "w-11 h-11",
  xl: "w-16 h-16",
};

/**
 * Avatar ilustrasi (DiceBear).
 * Kalau peserta belum memilih avatar, dipakai avatar default dari namanya.
 */
export function DiceAvatar({
  name,
  style,
  seed,
  size = "md",
  className,
  ring,
}: {
  name?: string | null;
  style?: string | null;
  seed?: string | null;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
  ring?: boolean;
}) {
  const ref = useMemo(() => {
    if (style && seed) return { style, seed };
    return defaultAvatarFor(name || "");
  }, [style, seed, name]);

  const svg = useMemo(() => renderAvatarSvg(ref.style, ref.seed), [ref.style, ref.seed]);

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F1F3F5] dark:bg-[#1A1A20]",
        SIZE_CLASS[size],
        ring && "ring-2 ring-offset-1 ring-offset-white dark:ring-offset-[#121215]",
        className,
      )}
      aria-hidden
    >
      {svg ? (
        // SVG dihasilkan DiceBear dari style + seed (tanpa input pengguna di dalamnya).
        <span className="h-full w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <span className="text-[10px] font-bold text-[#64748B]">
          {(name || "?").trim().slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}
