"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { DynamicIcon } from "@/components/ui/dynamic-icon";
import { cn } from "@/lib/utils/cn";

export interface SearchableSelectOption {
  value: string;
  label: string;
  icon?: string;
  iconColor?: string;
  badge?: string;
  description?: string;
  disabled?: boolean;
}

export interface SearchableSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  align?: "start" | "center" | "end";
  sideOffset?: number;
  showSearch?: boolean;
  minSearchItems?: number;
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Pilih...",
  searchPlaceholder = "Cari...",
  emptyText = "Tidak ditemukan",
  disabled = false,
  className,
  triggerClassName,
  contentClassName,
  align = "start",
  sideOffset = 4,
  showSearch = true,
  minSearchItems = 5,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  // Reset search query when popover closes
  React.useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  const selectedOption = options.find((opt) => opt.value === value);

  // Filter options based on search query
  const filteredOptions = React.useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.badge && opt.badge.toLowerCase().includes(q)) ||
        (opt.description && opt.description.toLowerCase().includes(q)),
    );
  }, [options, search]);

  const shouldRenderSearch =
    showSearch && options.length >= minSearchItems;

  return (
    <div className={cn("relative w-full", className)}>
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Trigger asChild disabled={disabled}>
          <button
            type="button"
            className={cn(
              "flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20] focus:outline-none focus:border-[#0F172A] dark:focus:border-white transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 w-full min-w-0 overflow-hidden text-left",
              triggerClassName,
            )}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
              {selectedOption?.icon && (
                <DynamicIcon
                  name={selectedOption.icon}
                  className={cn(
                    "w-3.5 h-3.5 shrink-0",
                    selectedOption.iconColor || "text-[#0F172A] dark:text-[#FAFAFA]",
                  )}
                />
              )}
              <span className="truncate">
                {selectedOption ? selectedOption.label : placeholder}
              </span>
              {selectedOption?.badge && (
                <span className="text-[10px] font-mono text-[#94A3B8] shrink-0">
                  {selectedOption.badge}
                </span>
              )}
            </div>

            <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
          </button>
        </PopoverPrimitive.Trigger>

        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align={align}
            sideOffset={sideOffset}
            // CRITICAL: onOpenAutoFocus prevents autofocusing search bar so keyboard doesn't pop up immediately
            onOpenAutoFocus={(e) => e.preventDefault()}
            className={cn(
              "z-50 w-[var(--radix-popover-trigger-width)] min-w-[13rem] max-w-sm rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] shadow-xl p-1 overflow-hidden animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
              contentClassName,
            )}
          >
            {/* Optional Non-autofocused Search Input */}
            {shouldRenderSearch && (
              <div className="p-1 pb-1.5 mb-1 border-b border-[#E5E7EB] dark:border-[#27272A]">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 text-[#94A3B8] pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full pl-8 pr-7 py-1 rounded-md text-xs bg-[#F8F9FA] dark:bg-[#1A1A20] border border-transparent focus:border-[#0F172A] dark:focus:border-white text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none transition-all"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-2 p-0.5 text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] rounded cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Options List */}
            <div className="max-h-60 overflow-y-auto flex flex-col gap-0.5 p-0.5">
              {filteredOptions.length === 0 ? (
                <div className="py-4 text-center text-xs text-[#94A3B8]">
                  {emptyText}
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => {
                        onValueChange(opt.value);
                        setOpen(false);
                      }}
                      className={cn(
                        "relative flex w-full cursor-pointer select-none items-center rounded-md py-1.5 pl-7 pr-2.5 text-xs outline-none transition-colors text-left disabled:pointer-events-none disabled:opacity-50",
                        isSelected
                          ? "bg-[#F1F3F5] dark:bg-[#1A1A20] font-semibold text-[#0F172A] dark:text-[#FAFAFA]"
                          : "text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20]",
                      )}
                    >
                      {/* Checkmark Indicator */}
                      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 text-[#0D9488]" />
                        )}
                      </span>

                      {/* Icon */}
                      {opt.icon && (
                        <DynamicIcon
                          name={opt.icon}
                          className={cn(
                            "w-3.5 h-3.5 mr-2 shrink-0",
                            opt.iconColor || "text-[#94A3B8]",
                          )}
                        />
                      )}

                      {/* Label and Badge */}
                      <div className="flex items-center justify-between gap-2 min-w-0 flex-1">
                        <span className="truncate">{opt.label}</span>
                        {opt.badge && (
                          <span className="text-[10px] font-mono text-[#94A3B8] shrink-0">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  );
}
