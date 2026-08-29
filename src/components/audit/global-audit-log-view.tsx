"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { AuditLog } from "@/types/database";
import { formatDate, getLocalDateString } from "@/lib/utils/date";
import { humanizeAuditLog } from "@/lib/utils/audit-humanizer";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/language-context";
import {
  Search,
  PlusCircle,
  Edit,
  Trash2,
  ArrowRight,
  ArrowLeft,
  History,
  Filter,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface GlobalAuditLogViewProps {
  initialLogs: AuditLog[];
}

type ModuleFilter =
  | "all"
  | "transactions"
  | "transfers"
  | "stock_trades"
  | "recurring_transactions"
  | "savings_goals"
  | "savings_goal_deposits"
  | "debts"
  | "debt_payments"
  | "accounts"
  | "categories"
  | "budgets";
type ActionFilter = "all" | "INSERT" | "UPDATE" | "DELETE";

const BATCH_SIZE = 50;

export function GlobalAuditLogView({ initialLogs }: GlobalAuditLogViewProps) {
  const { language, t } = useLanguage();
  const isId = language === "id";

  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>("all");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const [displayLimit, setDisplayLimit] = useState(BATCH_SIZE);

  const moduleOptions: Array<{ label: string; value: ModuleFilter }> = [
    { label: isId ? "Semua Modul" : "All Modules", value: "all" },
    { label: isId ? "Transaksi" : "Transactions", value: "transactions" },
    { label: isId ? "Transfer" : "Transfers", value: "transfers" },
    { label: isId ? "Investasi Saham" : "Stock Trades", value: "stock_trades" },
    {
      label: isId ? "Transaksi Rutin" : "Recurring Transactions",
      value: "recurring_transactions",
    },
    {
      label: isId ? "Target Tabungan" : "Savings Goals",
      value: "savings_goals",
    },
    {
      label: isId ? "Setoran Tabungan" : "Goal Deposits",
      value: "savings_goal_deposits",
    },
    { label: isId ? "Hutang & Piutang" : "Debts & Loans", value: "debts" },
    { label: isId ? "Cicilan" : "Payments", value: "debt_payments" },
    { label: isId ? "Rekening" : "Accounts", value: "accounts" },
    { label: isId ? "Kategori" : "Categories", value: "categories" },
    { label: isId ? "Anggaran" : "Budgets", value: "budgets" },
  ];

  const actionOptions: Array<{ label: string; value: ActionFilter }> = [
    { label: isId ? "Semua Aksi" : "All Actions", value: "all" },
    { label: isId ? "Dibuat (Baru)" : "Created", value: "INSERT" },
    { label: isId ? "Diubah" : "Updated", value: "UPDATE" },
    { label: isId ? "Dihapus" : "Deleted", value: "DELETE" },
  ];

  const filteredLogs = useMemo(() => {
    return initialLogs.filter((log) => {
      // 1. Module filter
      if (moduleFilter !== "all" && log.table_name !== moduleFilter)
        return false;

      // 2. Action filter
      if (actionFilter !== "all" && log.action !== actionFilter) return false;

      // 3. Date range filter
      if (startDate) {
        const logDate = getLocalDateString(log.changed_at);
        if (logDate < startDate) return false;
      }
      if (endDate) {
        const logDate = getLocalDateString(log.changed_at);
        if (logDate > endDate) return false;
      }

      // 4. Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTable = log.table_name.toLowerCase().includes(q);
        const matchRecord = log.record_id.toLowerCase().includes(q);
        const matchOld = JSON.stringify(log.old_values || {})
          .toLowerCase()
          .includes(q);
        const matchNew = JSON.stringify(log.new_values || {})
          .toLowerCase()
          .includes(q);
        return matchTable || matchRecord || matchOld || matchNew;
      }

      return true;
    });
  }, [initialLogs, moduleFilter, actionFilter, startDate, endDate, search]);

  const hasActiveFilters =
    moduleFilter !== "all" ||
    actionFilter !== "all" ||
    startDate !== "" ||
    endDate !== "" ||
    search !== "";

  const handleResetFilters = () => {
    setModuleFilter("all");
    setActionFilter("all");
    setStartDate("");
    setEndDate("");
    setSearch("");
  };

  return (
    <div className="flex flex-col gap-5 max-w-4xl mx-auto">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.auditLog.backToSettings}</span>
        </Link>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-[#F1F3F5] dark:bg-[#1A1A20] text-[#64748B] dark:text-[#94A3B8] border border-[#E5E7EB] dark:border-[#27272A]">
          {language === "en" ? "Activity Log" : "Riwayat Aktivitas"}
        </span>
      </div>

      {/* Page Title */}
      <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-lg bg-[#0F172A] dark:bg-[#FAFAFA] text-white dark:text-[#0F172A] flex items-center justify-center shrink-0">
          <History className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
            {t.auditLog.title}
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5 leading-relaxed">
            {t.auditLog.subtitle}
          </p>
        </div>
      </div>

      {/* Advanced Filter Panel */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3">
        {/* Row 1: Search & Date Range */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="relative sm:col-span-2">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
            <input
              type="text"
              placeholder={
                t.auditLog.searchPlaceholder ||
                "Cari riwayat, akun, kategori, nominal..."
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8.5 pr-3 py-2 text-xs bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] rounded-lg text-[#0F172A] dark:text-[#FAFAFA] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F172A] dark:focus:border-white transition-colors"
            />
          </div>

          <div>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={(s, e) => {
                setStartDate(s);
                setEndDate(e);
              }}
              placeholder={isId ? "Rentang Tanggal" : "Date Range"}
            />
          </div>
        </div>

        {/* Row 2: Module Chips */}
        <div className="flex flex-col gap-1 pt-1 border-t border-[#E5E7EB] dark:border-[#27272A]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {isId ? "Modul / Fitur" : "Module / Feature"}
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-[#E11D48] hover:underline flex items-center gap-1 cursor-pointer font-semibold"
              >
                <X className="w-3.5 h-3.5" />
                <span>{isId ? "Reset Filter" : "Reset Filters"}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {moduleOptions.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setModuleFilter(item.value)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors shrink-0 whitespace-nowrap cursor-pointer border",
                  moduleFilter === item.value
                    ? "bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A] border-transparent shadow-2xs"
                    : "bg-white dark:bg-[#121215] text-[#64748B] dark:text-[#94A3B8] border-[#E5E7EB] dark:border-[#27272A] hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20]",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 3: Action Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          {actionOptions.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setActionFilter(item.value)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors shrink-0 whitespace-nowrap cursor-pointer border",
                actionFilter === item.value
                  ? "bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A] border-transparent shadow-2xs"
                  : "bg-[#F8F9FA] dark:bg-[#1A1A20] text-[#64748B] dark:text-[#94A3B8] border-[#E5E7EB] dark:border-[#27272A] hover:bg-[#F1F3F5] dark:hover:bg-[#26262E]",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Timeline List */}
      {filteredLogs.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-[#121215] rounded-xl border border-[#E5E7EB] dark:border-[#27272A] text-xs text-[#94A3B8]">
          {t.auditLog.emptySearch ||
            "Tidak ada catatan audit yang cocok dengan kriteria filter."}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredLogs.slice(0, displayLimit).map((log) => {
            const h = humanizeAuditLog(log, language);

            return (
              <div
                key={log.id}
                className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3 transition-colors hover:border-[#0F172A] dark:hover:border-[#FAFAFA]"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#F1F3F5] dark:bg-[#1A1A20] text-[#64748B] dark:text-[#94A3B8] border border-[#E5E7EB] dark:border-[#27272A] shrink-0">
                      {h.moduleName}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border shrink-0",
                        h.badgeType === "create"
                          ? "bg-[#ECFDF5] dark:bg-[#064E3B]/20 text-[#0D9488] border-[#A7F3D0] dark:border-[#065F46]/40"
                          : h.badgeType === "update"
                            ? "bg-[#F0F9FF] dark:bg-[#0C4A6E]/20 text-[#0284C7] border-[#BAE6FD] dark:border-[#0369A1]/40"
                            : "bg-[#FFF1F2] dark:bg-[#881337]/20 text-[#E11D48] border-[#FECDD3] dark:border-[#9F1239]/40",
                      )}
                    >
                      {h.badgeType === "create" && (
                        <PlusCircle className="w-3 h-3" />
                      )}
                      {h.badgeType === "update" && <Edit className="w-3 h-3" />}
                      {h.badgeType === "delete" && (
                        <Trash2 className="w-3 h-3" />
                      )}
                      {h.badgeLabel}
                    </span>
                    <h3 className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                      {h.title}
                    </h3>
                  </div>

                  <span className="text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8] shrink-0">
                    {formatDate(
                      log.changed_at,
                      "EEEE, d MMM yyyy • HH:mm",
                      language,
                    )}
                  </span>
                </div>

                {/* Friendly Summary Text */}
                <p className="text-xs text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
                  {h.summary}
                </p>

                {/* Humanized Change Diff List */}
                {h.changes.length > 0 && (
                  <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-xs">
                    {h.changes.map((c, cIdx) => (
                      <div
                        key={cIdx}
                        className="flex items-center justify-between gap-2 flex-wrap text-[11px]"
                      >
                        <span className="font-semibold text-[#64748B] dark:text-[#94A3B8]">
                          {c.field}:
                        </span>
                        <div className="flex items-center gap-1.5 font-mono">
                          {c.from && (
                            <>
                              <span className="text-[#E11D48] line-through">
                                {c.from}
                              </span>
                              <ArrowRight className="w-3 h-3 text-[#94A3B8]" />
                            </>
                          )}
                          {c.to && (
                            <span className="font-bold text-[#0D9488]">
                              {c.to}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination Load More Controls */}
          {displayLimit < filteredLogs.length && (
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs">
              <span className="text-[#64748B] dark:text-[#94A3B8] font-medium text-center sm:text-left">
                {t.common.showing}{" "}
                <span className="font-bold text-[#0F172A] dark:text-[#FAFAFA]">
                  {Math.min(displayLimit, filteredLogs.length)}
                </span>{" "}
                / {filteredLogs.length}
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDisplayLimit((prev) => prev + BATCH_SIZE)}
                  className="flex-1 sm:flex-initial text-xs font-bold cursor-pointer"
                >
                  {t.common.loadMore} (+
                  {Math.min(BATCH_SIZE, filteredLogs.length - displayLimit)})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDisplayLimit(filteredLogs.length)}
                  className="flex-1 sm:flex-initial text-xs text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] cursor-pointer"
                >
                  {t.common.showAll}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
