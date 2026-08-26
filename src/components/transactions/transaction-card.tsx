"use client";

import React from "react";
import Link from "next/link";
import { EnrichedTransaction } from "@/types/database";
import { DynamicIcon } from "@/components/ui/dynamic-icon";
import { formatCurrency } from "@/lib/utils/currency";
import { usePrivacyMode, maskCurrency } from "@/lib/storage/privacy-mode";
import { formatDate } from "@/lib/utils/date";
import { getCleanDescription } from "@/lib/utils/description";
import { formatCategoryName } from "@/lib/utils/category-i18n";
import { useLanguage } from "@/lib/i18n/language-context";
import { cn } from "@/lib/utils/cn";

interface TransactionCardProps {
  transaction: EnrichedTransaction;
}

export function TransactionCard({ transaction }: TransactionCardProps) {
  const { language } = useLanguage();
  const isPrivate = usePrivacyMode();
  const isIncome = transaction.type === "income";
  const cat = transaction.category;
  const acc = transaction.account;
  const cleanDesc = getCleanDescription(transaction.description);

  const allTags = Array.from(
    new Set([
      ...(transaction.tags || []),
      ...(transaction.description?.match(/#[a-zA-Z0-9_\-]+/g)?.map((t) => t.replace(/^#/, '').toLowerCase()) || []),
    ])
  )

  const formattedAmount = `${isIncome ? "+" : "-"}${formatCurrency(transaction.amount, transaction.currency)}`;

  return (
    <Link
      href={`/transactions/${transaction.id}`}
      className="flex items-center justify-between p-3 sm:p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] hover:border-[#0F172A] dark:hover:border-[#FAFAFA] transition-colors cursor-pointer group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-[#F1F3F5] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] flex items-center justify-center shrink-0">
          <DynamicIcon name={cat?.icon || "Tag"} className="w-4 h-4" />
        </div>

        <div className="flex flex-col min-w-0">
          <span className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] truncate">
            {formatCategoryName(cat?.name || "Uncategorized", language)}
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
            {cleanDesc && (
              <>
                <span className="truncate max-w-32.5 sm:max-w-55 text-[#475569] dark:text-[#CBD5E1]">
                  {cleanDesc}
                </span>
                <span>•</span>
              </>
            )}
            <span>{acc?.name || "Account"}</span>
          </div>

          {allTags.length > 0 && (
            <div className="flex items-center gap-1 mt-1 overflow-hidden">
              {allTags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-[#F1F3F5] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-[#64748B] dark:text-[#94A3B8]"
                >
                  #{tag}
                </span>
              ))}
              {allTags.length > 3 && (
                <span className="text-[9px] text-[#94A3B8]">
                  +{allTags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end shrink-0 ml-3">
        <span
          className={cn(
            "text-xs sm:text-sm font-mono font-bold tracking-tight tnum",
            isIncome ? "text-[#0D9488]" : "text-[#0F172A] dark:text-[#F8FAFC]",
          )}
        >
          {maskCurrency(formattedAmount, isPrivate)}
        </span>
        <span className="text-[10px] font-mono text-[#94A3B8]">
          {formatDate(transaction.transaction_date, "dd MMM")}
        </span>
      </div>
    </Link>
  );
}
