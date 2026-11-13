"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Calculator } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/currency";
import { NumberKeypad } from "@/components/ui/number-keypad";
import { BottomSheet } from "@/components/ui/bottom-sheet";

const NUMBER_INPUT_OPEN_EVENT = "pocketly:number-input-open";

interface NumberInputProps {
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
  currency?: string;
  suffix?: ReactNode;
  leftIcon?: ReactNode;
  error?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  allowDecimal?: boolean;
  decimalScale?: number;
  maxDigits?: number;
  mode?: "currency" | "decimal";
  showThousandsShortcuts?: boolean;
  doneLabel?: string;
  max?: number | string;
  autoFocus?: boolean;
  className?: string;
  compact?: boolean;
  showCurrency?: boolean;
  /** Borderless plain-text look (no box/outline), still opens the keypad on tap. */
  bare?: boolean;
  variant?: "input" | "card";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function NumberInput({
  label,
  value,
  onValueChange,
  currency,
  suffix,
  leftIcon,
  error,
  placeholder = "0",
  required,
  disabled,
  allowDecimal = true,
  decimalScale,
  maxDigits,
  mode = "currency",
  showThousandsShortcuts = mode === "currency",
  doneLabel,
  max,
  autoFocus,
  className,
  compact = false,
  showCurrency = true,
  bare = false,
  variant = "input",
  open: controlledOpen,
  onOpenChange,
}: NumberInputProps) {
  const instanceId = useRef(Symbol("number-input"));
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = controlledOpen ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
    if (next) {
      window.dispatchEvent(
        new CustomEvent(NUMBER_INPUT_OPEN_EVENT, {
          detail: instanceId.current,
        }),
      );
    }
  };
  useEffect(() => {
    if (controlledOpen !== undefined) return;
    const closeOtherInputs = (event: Event) => {
      const customEvent = event as CustomEvent<symbol>;
      if (customEvent.detail !== instanceId.current) {
        setUncontrolledOpen(false);
      }
    };
    window.addEventListener(NUMBER_INPUT_OPEN_EVENT, closeOtherInputs);
    return () =>
      window.removeEventListener(NUMBER_INPUT_OPEN_EVENT, closeOtherInputs);
  }, [controlledOpen]);
  const formattedValue = value
    ? value.endsWith(".")
      ? value
      : mode === "decimal" && !currency
        ? value
        : formatCurrency(Number(value) || 0, currency || "IDR").replace(
            /^-?(?:Rp |\$|S\$)/,
            (prefix) => (prefix.startsWith("-") ? "-" : ""),
          )
    : placeholder;
  const mainDisplayValue =
    variant === "card" && !value ? "0" : formattedValue;
  const handleValueChange = (nextValue: string) => {
    if (
      max !== undefined &&
      nextValue !== "" &&
      Number(nextValue) > Number(max)
    ) {
      return;
    }
    onValueChange(nextValue);
  };

  const keypad = (
    <NumberKeypad
      value={value || "0"}
      onChange={handleValueChange}
      onDone={() => setOpen(false)}
      allowDecimal={allowDecimal}
      decimalScale={decimalScale}
      minorUnitMode={currency === "USD" || currency === "SGD"}
      maxDigits={maxDigits}
      showThousandsShortcuts={showThousandsShortcuts}
      doneLabel={doneLabel}
      compact={false}
    />
  );
  const display = (
    <>
      {currency && showCurrency && (
        <span className="shrink-0 font-bold text-foreground">
          {currency}
        </span>
      )}
      <span className={cn("min-w-0 flex-1 truncate font-mono font-bold tracking-tight text-right")}>
        {mainDisplayValue}
      </span>
      {suffix && <span className="ml-2 shrink-0">{suffix}</span>}
    </>
  );

  if (variant === "card") {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border bg-surface shadow-2xs transition-all",
          isOpen
            ? "border-border-strong ring-2 ring-ring/10"
            : "border-border",
          className,
        )}
      >
        <button
          type="button"
          disabled={disabled}
          data-required={required || undefined}
          onClick={() => setOpen(!isOpen)}
          className="group w-full cursor-pointer p-4 text-left transition-all hover:bg-canvas dark:hover:bg-surface-subtle"
        >
          <div className="flex items-center justify-between pr-8">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
            <Calculator className="h-4 w-4 text-foreground-muted group-hover:text-info" />
          </div>
          <div className="mt-1 overflow-x-auto whitespace-nowrap text-right text-xs font-mono font-semibold tracking-wide text-muted-foreground no-scrollbar">
            {formattedValue}
          </div>
          <div className="flex items-baseline gap-2 pt-1 text-4xl">{display}</div>
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label className="text-[11px] font-bold uppercase tracking-wider text-foreground-secondary">
          {label}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        data-required={required || undefined}
        autoFocus={autoFocus}
        onClick={() => setOpen(!isOpen)}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border border-border bg-canvas dark:bg-surface-subtle text-left text-sm text-foreground transition-colors",
          compact ? "min-h-8 px-2 py-1.5" : "min-h-10 px-3.5 py-2.5",
          isOpen
            ? "border-border-strong ring-1 ring-ring/10"
            : "",
          error && "border-destructive",
          bare &&
            "justify-end border-0 bg-transparent p-0 min-h-0 ring-0 hover:bg-transparent dark:bg-transparent dark:border-0",
        )}
      >
        <span className={cn("flex min-w-0 flex-1 items-baseline gap-2 text-base", bare && "justify-end")}>
          {leftIcon}
          <span className={cn("flex min-w-0 flex-1 items-baseline gap-2 truncate", !value && "text-foreground-muted", compact ? "text-sm" : "text-base", bare && "justify-end text-right")}>
            {display}
          </span>
        </span>
      </button>
      {error && <p className="mt-0.5 text-xs font-semibold text-destructive">{error}</p>}
      <BottomSheet
        isOpen={isOpen}
        onClose={() => setOpen(false)}
        title={label}
        className="max-w-lg"
      >
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="overflow-x-auto whitespace-nowrap text-right text-xs font-mono font-semibold tracking-wide text-muted-foreground no-scrollbar">
              {formattedValue}
            </div>
            <div className="flex items-baseline gap-2 pt-1 text-4xl sm:text-5xl">
              {display}
            </div>
          </div>
          {keypad}
        </div>
      </BottomSheet>
    </div>
  );
}
