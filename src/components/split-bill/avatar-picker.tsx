"use client";

import React, { useMemo } from "react";
import { Check } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { DiceAvatar } from "@/components/ui/dice-avatar";
import { buildAvatarOptions, type AvatarRef } from "@/lib/utils/avatar";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "@/lib/i18n/language-context";

/** Picker avatar: pilih salah satu dari 16 avatar ilustrasi (2 style x 8 seed). */
export function AvatarPicker({
  isOpen,
  onClose,
  value,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  value?: { style?: string | null; seed?: string | null } | null;
  onSelect: (ref: AvatarRef) => void;
}) {
  const { t } = useLanguage();
  const options = useMemo(() => buildAvatarOptions(), []);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={t.splitBill.chooseAvatar}>
      <div className="grid grid-cols-4 gap-3">
        {options.map((o) => {
          const selected = value?.style === o.style && value?.seed === o.seed;
          return (
            <button
              key={`${o.style}-${o.seed}`}
              type="button"
              onClick={() => {
                onSelect(o);
                onClose();
              }}
              className={cn(
                "relative rounded-2xl p-1 transition-colors",
                selected
                  ? "ring-2 ring-[#0F172A] dark:ring-[#FAFAFA]"
                  : "ring-1 ring-[#E5E7EB] dark:border-[#27272A] hover:ring-[#94A3B8]",
              )}
              aria-label={`${o.style}-${o.seed}`}
            >
              <DiceAvatar name="" style={o.style} seed={o.seed} size="xl" className="w-full h-auto aspect-square" />
              {selected && (
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#0F172A] dark:bg-[#FAFAFA] flex items-center justify-center">
                  <Check className="w-3 h-3 text-white dark:text-[#0F172A] stroke-[3]" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
