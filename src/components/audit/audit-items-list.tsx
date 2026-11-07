"use client";

import React from "react";
import { formatCurrency } from "@/lib/utils/currency";
import {
  getItemTotal,
  type TransactionItem,
} from "@/lib/utils/transaction-items";

interface AuditItemsListProps {
  items: TransactionItem[];
  currency: string;
  muted?: boolean;
}

/** Structured per-item list for audit logs — same row layout as detail view. */
export function AuditItemsList({
  items,
  currency,
  muted = false,
}: AuditItemsListProps) {
  if (items.length === 0) return null;
  const total = items.reduce(
    (s, i) => s + getItemTotal(i, currency),
    0,
  );
  return (
    <div
      className={
        muted
          ? "flex flex-col gap-1 opacity-60 max-h-36 overflow-y-auto pr-0.5"
          : "flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-0.5"
      }
    >
      {items.map((item, idx) => {
        const qty = parseFloat(item.quantity) || 1;
        const unit = parseFloat(item.price) || 0;
        const subtotal = getItemTotal(item, currency);
        return (
          <div
            key={idx}
            className="flex items-center justify-between gap-2 rounded bg-white p-2 text-xs dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A]"
          >
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-[#0F172A] dark:text-[#FAFAFA]">
                {item.name}
              </span>
              <span className="font-mono text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                {`${qty} × ${formatCurrency(unit, currency)}`}
              </span>
            </div>
            <span className="shrink-0 font-mono text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
              {formatCurrency(subtotal, currency)}
            </span>
          </div>
        );
      })}
      {!muted && (
        <div className="flex items-center justify-between border-t border-[#E5E7EB] pt-1 font-mono text-[11px] dark:border-[#27272A]">
          <span className="text-[#64748B] dark:text-[#94A3B8]">Total</span>
          <span className="font-bold text-[#0F172A] dark:text-[#FAFAFA]">
            {formatCurrency(total, currency)}
          </span>
        </div>
      )}
    </div>
  );
}
