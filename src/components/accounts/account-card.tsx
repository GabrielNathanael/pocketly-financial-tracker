"use client";

import React from "react";
import Link from "next/link";
import { Account } from "@/types/database";
import { DynamicIcon } from "@/components/ui/dynamic-icon";
import { formatCurrency } from "@/lib/utils/currency";
import { usePrivacyMode, maskCurrency } from "@/lib/storage/privacy-mode";
import { useLanguage } from "@/lib/i18n/language-context";
import { ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface AccountCardProps {
  account: Account;
}

export function AccountCard({ account }: AccountCardProps) {
  const { t } = useLanguage();
  const isPrivate = usePrivacyMode();
  const isDefault = account.is_default;

  return (
    <Link
      href={`/accounts/${account.id}`}
      className="flex items-center justify-between p-4 rounded-xl bg-surface border border-border hover:border-border-strong transition-colors cursor-pointer group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-surface-subtle border border-border text-foreground flex items-center justify-center shrink-0">
          <DynamicIcon name={account.icon || "Wallet"} className="w-4 h-4" />
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs sm:text-sm font-bold text-foreground truncate">
              {account.name}
            </span>
            {isDefault && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-warning-muted text-warning border border-warning/20 shrink-0">
                <Star className="w-2.5 h-2.5 fill-current" />
                {t.common.defaultBadge}
              </span>
            )}
          </div>
          <span className="text-[11px] text-foreground-secondary truncate">
            {t.accounts.types[account.type] || account.type} •{" "}
            {account.currency}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-3">
        <span
          className={cn(
            "text-xs sm:text-sm font-mono font-bold tracking-tight tnum",
            Number(account.current_balance) < 0
              ? "text-destructive"
              : "text-foreground",
          )}
        >
          {maskCurrency(
            formatCurrency(account.current_balance, account.currency),
            isPrivate,
          )}
        </span>
        <ChevronRight className="w-4 h-4 text-foreground-muted group-hover:text-foreground transition-colors" />
      </div>
    </Link>
  );
}
