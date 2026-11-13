"use client";

import { Delete, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useState } from "react";

interface NumberKeypadProps {
  value: string;
  onChange: (value: string) => void;
  onDone?: () => void;
  allowDecimal?: boolean;
  decimalScale?: number;
  minorUnitMode?: boolean;
  maxDigits?: number;
  showThousandsShortcuts?: boolean;
  doneLabel?: string;
  compact?: boolean;
  className?: string;
}

function haptic(duration = 15) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(duration);
    } catch {
      // Haptics are optional.
    }
  }
}

export function NumberKeypad({
  value,
  onChange,
  onDone,
  allowDecimal = true,
  decimalScale,
  minorUnitMode = false,
  maxDigits = 24,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  showThousandsShortcuts = true,
  doneLabel = "Selesai",
  compact = false,
  className,
}: NumberKeypadProps) {
  const [explicitDecimalMode, setExplicitDecimalMode] = useState(false);
  const press = (token: string) => {
    const current = value || "0";
    if (current === "0" && token !== ".") {
      if (token === "00" || token === "000") return;
      onChange(minorUnitMode ? `0.0${token}` : token);
      haptic();
      return;
    }
    if (token === ".") {
      if (!allowDecimal) return;
      if (minorUnitMode && !explicitDecimalMode) {
        const [whole = "0", fraction = ""] = current.split(".");
        const digits = `${whole}${fraction}`.replace(/^0+(?=\d)/, "") || "0";
        const numericValue = Number(current) || 0;
        const wholeValue =
          fraction.length > 0 ? Math.round(numericValue * 100) : Number(digits);
        onChange(`${wholeValue}.`);
        setExplicitDecimalMode(true);
        haptic();
        return;
      }
      if (current.includes(".")) return;
      onChange(current === "0" ? "0." : `${current}.`);
      haptic();
      return;
    }

    const [, fraction] = current.split(".");
    if (
      (explicitDecimalMode || !minorUnitMode) &&
      decimalScale !== undefined &&
      fraction &&
      fraction.length >= decimalScale
    ) {
      return;
    }

    const next =
      minorUnitMode && !explicitDecimalMode
        ? (() => {
            const digits = `${current.replace(".", "")}${token}`.replace(
              /^0+/,
              "",
            );
            const normalizedDigits = digits || "0";
            if (normalizedDigits.length <= 2) {
              return `0.${normalizedDigits.padStart(2, "0")}`;
            }
            return `${normalizedDigits.slice(0, -2)}.${normalizedDigits.slice(-2)}`;
          })()
        : current === "0"
          ? token
          : `${current}${token}`;
    const digits = next.replace(".", "");
    if (digits.length > maxDigits) {
      haptic(20);
      return;
    }

    onChange(next);
    haptic();
  };

  const backspace = () => {
    const next = value.length <= 1 ? "0" : value.slice(0, -1);
    onChange(next);
    haptic();
  };

  const clear = () => {
    onChange("0");
    setExplicitDecimalMode(false);
    haptic();
  };

  const buttonClass =
    "min-h-16 rounded-xl border border-border bg-secondary font-mono font-bold text-foreground transition-all hover:bg-surface-muted active:scale-95 dark:hover:bg-surface-muted sm:min-h-19";
  const numberClass = cn(
    buttonClass,
    compact ? "text-xl" : "text-2xl sm:text-3xl",
  );
  const clearClass =
    "min-h-16 rounded-xl border border-destructive/30 bg-destructive-muted font-mono text-lg font-bold text-destructive transition-all hover:bg-destructive/10 active:scale-95 sm:min-h-19";
  const doneClass =
    "flex min-h-16 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-md transition-all hover:bg-primary-hover active:scale-95 sm:min-h-19";
  const key = (value: string) => (
    <button
      key={value}
      type="button"
      onClick={() => press(value)}
      className={numberClass}
    >
      {value}
    </button>
  );
  const backspaceButton = (
    <button
      type="button"
      onClick={backspace}
      aria-label="Backspace"
      className={cn(buttonClass, "text-muted-foreground")}
    >
      <Delete className="mx-auto h-5 w-5" />
    </button>
  );
  const clearButton = (
    <button type="button" onClick={clear} className={clearClass}>
      C
    </button>
  );
  const doneButton = onDone ? (
    <button
      type="button"
      onClick={onDone}
      className={cn(doneClass, allowDecimal ? "col-span-3" : "col-span-2")}
    >
      <Check className="h-4 w-4 stroke-3" />
      {doneLabel}
    </button>
  ) : null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="grid grid-cols-4 gap-2">
        {["1", "2", "3"].map(key)}
        {backspaceButton}
        {["4", "5", "6"].map(key)}
        {allowDecimal ? (
          <button type="button" onClick={() => press(".")} className={numberClass}>
            .
          </button>
        ) : (
          <button
            type="button"
            onClick={() => press("000")}
            className={cn(buttonClass, "text-sm sm:text-base")}
          >
            000
          </button>
        )}
        {["7", "8", "9"].map(key)}
        {clearButton}
        {!allowDecimal && (
          <button
            type="button"
            onClick={() => press("00")}
            className={cn(buttonClass, "text-sm sm:text-base")}
          >
            00
          </button>
        )}
        {key("0")}
        {doneButton}
      </div>
    </div>
  );
}
