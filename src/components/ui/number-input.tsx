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
  const displayValue = value || placeholder;
  const formattedValue = currency
    ? formatCurrency(Number(value) || 0, currency)
    : value || placeholder;
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
      maxDigits={maxDigits}
      showThousandsShortcuts={showThousandsShortcuts}
      doneLabel={doneLabel}
      compact={false}
    />
  );
  const display = (
    <>
      {currency && (
        <span className="shrink-0 font-bold text-[#0F172A] dark:text-[#F8FAFC]">
          {currency}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate font-mono font-bold tracking-tight">
        {currency ? formattedValue : displayValue}
      </span>
      {suffix && <span className="ml-2 shrink-0">{suffix}</span>}
    </>
  );

  if (variant === "card") {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border bg-white shadow-2xs transition-all dark:bg-[#121215]",
          isOpen
            ? "border-[#0F172A] ring-2 ring-[#0F172A]/10 dark:border-[#FAFAFA] dark:ring-[#FAFAFA]/10"
            : "border-[#E5E7EB] dark:border-[#27272A]",
          className,
        )}
      >
        <button
          type="button"
          disabled={disabled}
          data-required={required || undefined}
          onClick={() => setOpen(!isOpen)}
          className="group w-full cursor-pointer p-4 text-left transition-all hover:bg-[#F8F9FA] dark:hover:bg-[#16161A]"
        >
          <div className="flex items-center justify-between pr-8">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {label}
            </span>
            <Calculator className="h-4 w-4 text-[#94A3B8] group-hover:text-blue-500" />
          </div>
          <div className="mt-1 overflow-x-auto whitespace-nowrap text-right text-xs font-mono font-semibold tracking-wide text-[#64748B] dark:text-[#94A3B8] no-scrollbar">
            {displayValue}
          </div>
          <div className="flex items-baseline gap-2 pt-1 text-4xl">{display}</div>
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label className="text-[11px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8]">
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
          "flex min-h-10 w-full items-center justify-between rounded-lg border bg-[#F8F9FA] px-3.5 py-2.5 text-left text-sm text-[#0F172A] transition-colors dark:border-[#27272A] dark:bg-[#1A1A20] dark:text-[#F8FAFC]",
          isOpen
            ? "border-[#0F172A] ring-1 ring-[#0F172A]/10 dark:border-[#FAFAFA]"
            : "border-[#E5E7EB]",
          error && "border-[#E11D48]",
        )}
      >
        <span className="flex min-w-0 flex-1 items-baseline gap-2 text-base">
          {leftIcon}
          <span className={cn("flex min-w-0 flex-1 items-baseline gap-2 truncate", !value && "text-[#94A3B8]")}>
            {display}
          </span>
        </span>
      </button>
      {error && <p className="mt-0.5 text-xs font-semibold text-[#E11D48]">{error}</p>}
      <BottomSheet
        isOpen={isOpen}
        onClose={() => setOpen(false)}
        title={label}
        className="max-w-lg"
      >
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 dark:border-[#27272A] dark:bg-[#121215]">
            <div className="overflow-x-auto whitespace-nowrap text-right text-xs font-mono font-semibold tracking-wide text-[#64748B] dark:text-[#94A3B8] no-scrollbar">
              {displayValue}
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
