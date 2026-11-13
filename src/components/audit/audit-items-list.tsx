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
            className="flex items-center justify-between gap-2 rounded border border-border bg-surface p-2 text-xs"
          >
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-foreground">
                {item.name}
              </span>
              <span className="font-mono text-[11px] text-foreground-secondary">
                {`${qty} × ${formatCurrency(unit, currency)}`}
              </span>
              {isShared && (
                <span className="text-[10px] text-success">
                  {!isNaN(shares) && shares >= 2 ? `÷${shares}` : "split"} · my {formatCurrency(mySubtotal, currency)}
                </span>
              )}
            </div>
            <div className="shrink-0 flex flex-col items-end">
              <span className="font-mono text-xs font-semibold text-foreground">
                {formatCurrency(subtotal, currency)}
              </span>
              {isShared && (
                <span className="font-mono text-[10px] text-success">
                  {formatCurrency(mySubtotal, currency)}
                </span>
              )}
            </div>
          </div>
        );
      })}
      {!muted && (
        <div className="flex flex-col gap-0.5 border-t border-border pt-1 font-mono text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-foreground-secondary">Total</span>
            <span className="font-bold text-foreground">
              {formatCurrency(total, currency)}
            </span>
          </div>
          {hasSplit && (
            <div className="flex items-center justify-between">
              <span className="text-foreground-secondary">My portion</span>
              <span className="font-bold text-success">
                {formatCurrency(myTotal, currency)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
