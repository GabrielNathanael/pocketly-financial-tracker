"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Account, Category, TransactionType } from "@/types/database";
import { useLanguage } from "@/lib/i18n/language-context";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Search, Filter, X, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface TransactionFiltersProps {
  accounts: Account[];
  categories: Category[];
}

export function TransactionFilters({
  accounts,
  categories,
}: TransactionFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useLanguage();

  const [isOpen, setIsOpen] = useState(false);

  // Current values
  const currentSearch = searchParams.get("search") || "";
  const currentType =
    (searchParams.get("type") as TransactionType | "all") || "all";
  const currentAccountId = searchParams.get("accountId") || "all";
  const currentCategoryId = searchParams.get("categoryId") || "all";
  const currentStartDate = searchParams.get("startDate") || "";
  const currentEndDate = searchParams.get("endDate") || "";
  const currentSort = searchParams.get("sort") || "date_desc";

  const updateFilters = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "" || value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  const hasAdvancedFilters =
    currentAccountId !== "all" ||
    currentCategoryId !== "all" ||
    currentStartDate !== "" ||
    currentEndDate !== "";

  const handleReset = () => {
    router.replace(pathname);
  };

  return (
    <div className="flex flex-col gap-2 p-3 sm:p-4 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-2xs">
      {/* Row 1: Search Bar & Advanced Filter Toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
          <input
            type="text"
            placeholder={t.common.search}
            defaultValue={currentSearch}
            onChange={(e) => {
              const val = e.target.value;
              const timer = setTimeout(() => {
                updateFilters({ search: val });
              }, 300);
              return () => clearTimeout(timer);
            }}
            className="w-full pl-8.5 pr-3 py-1.5 sm:py-2 text-xs bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] rounded-lg text-[#0F172A] dark:text-[#FAFAFA] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F172A] dark:focus:border-white transition-colors"
          />
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "p-1.5 sm:p-2 rounded-lg border transition-colors shrink-0 flex items-center justify-center cursor-pointer",
            hasAdvancedFilters || isOpen
              ? "bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A] border-transparent"
              : "bg-[#F8F9FA] dark:bg-[#1A1A20] text-[#64748B] dark:text-[#94A3B8] border-[#E5E7EB] dark:border-[#27272A] hover:bg-[#F1F3F5] dark:hover:bg-[#26262E]",
          )}
          title={t.common.filter}
        >
          <Filter className="w-4 h-4" />
        </button>
      </div>

      {/* Row 2: Compact Mobile Pills & Radix Select Sort */}
      <div className="flex items-center justify-between gap-1.5 pt-0.5">
        {/* Type Filter Pills (Compact with responsive text/icons) */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => updateFilters({ type: "all" })}
            className={cn(
              "px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md text-[11px] font-semibold transition-colors shrink-0 cursor-pointer border",
              currentType === "all"
                ? "bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A] border-transparent"
                : "bg-white dark:bg-[#121215] text-[#64748B] dark:text-[#94A3B8] border-[#E5E7EB] dark:border-[#27272A] hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20]",
            )}
          >
            {t.common.all}
          </button>

          <button
            type="button"
            onClick={() => updateFilters({ type: "expense" })}
            className={cn(
              "px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-md text-[11px] font-semibold transition-colors shrink-0 cursor-pointer border inline-flex items-center gap-1",
              currentType === "expense"
                ? "bg-[#E11D48] text-white border-transparent"
                : "bg-white dark:bg-[#121215] text-[#64748B] dark:text-[#94A3B8] border-[#E5E7EB] dark:border-[#27272A] hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20]",
            )}
          >
            <ArrowDownRight className="w-3 h-3 stroke-[2.5]" />
            <span className="hidden xs:inline sm:inline">
              {t.quickAdd.expense}
            </span>
          </button>

          <button
            type="button"
            onClick={() => updateFilters({ type: "income" })}
            className={cn(
              "px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-md text-[11px] font-semibold transition-colors shrink-0 cursor-pointer border inline-flex items-center gap-1",
              currentType === "income"
                ? "bg-[#0D9488] text-white border-transparent"
                : "bg-white dark:bg-[#121215] text-[#64748B] dark:text-[#94A3B8] border-[#E5E7EB] dark:border-[#27272A] hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20]",
            )}
          >
            <ArrowUpRight className="w-3 h-3 stroke-[2.5]" />
            <span className="hidden xs:inline sm:inline">
              {t.quickAdd.income}
            </span>
          </button>
        </div>

        {/* Radix UI Sort Selector */}
        <Select
          value={currentSort}
          onValueChange={(val) => updateFilters({ sort: val })}
        >
          <SelectTrigger className="h-7.5 sm:h-8 text-[11px] w-25 sm:w-31.25 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="date_desc">
              {t.transactions.sortNewest}
            </SelectItem>
            <SelectItem value="date_asc">
              {t.transactions.sortOldest}
            </SelectItem>
            <SelectItem value="amount_desc">
              {t.transactions.sortHighest}
            </SelectItem>
            <SelectItem value="amount_asc">
              {t.transactions.sortLowest}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Row 3: Collapsible Advanced Filters */}
      {isOpen && (
        <div className="pt-2.5 border-t border-[#E5E7EB] dark:border-[#27272A] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Account Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {t.common.account}
            </label>
            <Select
              value={currentAccountId}
              onValueChange={(val) => updateFilters({ accountId: val })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t.common.all} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.common.all}</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {t.common.category}
            </label>
            <Select
              value={currentCategoryId}
              onValueChange={(val) => updateFilters({ categoryId: val })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t.common.all} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.common.all}</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Start Date */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {t.transactions.startDate}
            </label>
            <DatePicker
              value={currentStartDate}
              onChange={(val) => updateFilters({ startDate: val })}
              placeholder={t.transactions.startDate}
            />
          </div>

          {/* End Date */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {t.transactions.endDate}
            </label>
            <DatePicker
              value={currentEndDate}
              onChange={(val) => updateFilters({ endDate: val })}
              placeholder={t.transactions.endDate}
            />
          </div>

          {hasAdvancedFilters && (
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end pt-1">
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-[#E11D48] hover:underline flex items-center gap-1 cursor-pointer font-semibold"
              >
                <X className="w-3.5 h-3.5" />
                <span>{t.common.resetFilter}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
