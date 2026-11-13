"use client";

import React from "react";
import { formatCurrency } from "@/lib/utils/currency";
import {
  getItemMyTotal,
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
  const total = items.reduce((s, i) => s + getItemTotal(i, currency), 0);
  const myTotal = items.reduce((s, i) => s + getItemMyTotal(i, currency), 0);
  const hasSplit = items.some((i) => {
    const shares = parseFloat(i.shareCount ?? "");
    return (!isNaN(shares) && shares >= 2) || (i.mySubtotal != null && getItemMyTotal(i, currency) !== getItemTotal(i, currency));
  });
  return (
    <div
      className={
        muted
          ? "flex flex-col gap-1 opacity-60 max-h-36 overflow-y-auto pr-0.5"
          : "flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-0.5"
      }
    >
      {items.map((item, idx) => {
        const qRaw = parseFloat(item.quantity);
        const qty = Number.isFinite(qRaw) && qRaw > 0 ? qRaw : 1;
        const unit = parseFloat(item.price) || 0;
        const subtotal = getItemTotal(item, currency);
        const mySubtotal = getItemMyTotal(item, currency);
        const shares = parseFloat(item.shareCount ?? "");
        const isShared =
          (!isNaN(shares) && shares >= 2) || (item.mySubtotal != null && mySubtotal !== subtotal);
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
              {isShared && (
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                  {!isNaN(shares) && shares >= 2 ? `÷${shares}` : "split"} · my {formatCurrency(mySubtotal, currency)}
                </span>
              )}
            </div>
            <div className="shrink-0 flex flex-col items-end">
              <span className="font-mono text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                {formatCurrency(subtotal, currency)}
              </span>
              {isShared && (
                <span className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(mySubtotal, currency)}
                </span>
              )}
            </div>
          </div>
        );
      })}
      {!muted && (
        <div className="flex flex-col gap-0.5 border-t border-[#E5E7EB] pt-1 font-mono text-[11px] dark:border-[#27272A]">
          <div className="flex items-center justify-between">
            <span className="text-[#64748B] dark:text-[#94A3B8]">Total</span>
            <span className="font-bold text-[#0F172A] dark:text-[#FAFAFA]">
              {formatCurrency(total, currency)}
            </span>
          </div>
          {hasSplit && (
            <div className="flex items-center justify-between">
              <span className="text-[#64748B] dark:text-[#94A3B8]">My portion</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                {formatCurrency(myTotal, currency)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
