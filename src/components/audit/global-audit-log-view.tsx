"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuditLog } from "@/types/database";
import { formatDate } from "@/lib/utils/date";
import { humanizeAuditLog } from "@/lib/utils/audit-humanizer";
import { AuditItemsList } from "@/components/audit/audit-items-list";
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
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface GlobalAuditLogViewProps {
  initialLogs: AuditLog[];
  total: number;
  page: number;
  totalPages: number;
  initialStart?: string;
  initialEnd?: string;
  initialModule?: string;
  initialAction?: string;
  initialSearch?: string;
}

type ModuleFilter =
  | "all"
  | "transactions"
  | "transfers"
  | "stock_trades"
  | "crypto_trades"
  | "etf_trades"
  | "recurring_transactions"
  | "savings_goals"
  | "savings_goal_deposits"
  | "debts"
  | "debt_payments"
  | "accounts"
  | "categories"
  | "budgets";
type ActionFilter = "all" | "INSERT" | "UPDATE" | "DELETE";

const PAGE_SIZE = 50;

export function GlobalAuditLogView({
  initialLogs,
  total,
  page,
  totalPages,
  initialStart,
  initialEnd,
  initialModule,
  initialAction,
  initialSearch,
}: GlobalAuditLogViewProps) {
  const { language, t } = useLanguage();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>(
    (initialModule as ModuleFilter) || "all",
  );
  const [actionFilter, setActionFilter] = useState<ActionFilter>(
    (initialAction as ActionFilter) || "all",
  );
  const [startDate, setStartDateLocal] = useState(initialStart || "");
  const [endDate, setEndDateLocal] = useState(initialEnd || "");
  const [search, setSearch] = useState(initialSearch || "");

  const pushParams = (overrides: Record<string, string>) => {
    const params = new URLSearchParams();
    const next = {
      start: startDate,
      end: endDate,
      module: moduleFilter,
      action: actionFilter,
      search,
      page: String(page),
      ...overrides,
    };
    if (next.start) params.set("start", next.start);
    if (next.end) params.set("end", next.end);
    if (next.module && next.module !== "all") params.set("module", next.module);
    if (next.action && next.action !== "all") params.set("action", next.action);
    if (next.search) params.set("search", next.search);
    if (next.page && next.page !== "1") params.set("page", next.page);
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  // Debounced server search
  useEffect(() => {
    if (search === (initialSearch || "")) return;
    const timer = setTimeout(() => {
      pushParams({ search, page: "1" });
    }, 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const moduleOptions: Array<{ label: string; value: ModuleFilter }> = [
    { label: t.auditLog.modules.all, value: "all" },
    { label: t.auditLog.modules.transactions, value: "transactions" },
    { label: t.auditLog.modules.transfers, value: "transfers" },
    { label: t.auditLog.modules.stockTrades, value: "stock_trades" },
    { label: t.auditLog.modules.cryptoTrades, value: "crypto_trades" },
    { label: "ETF Trades", value: "etf_trades" },
    {
      label: t.auditLog.modules.recurringTransactions,
      value: "recurring_transactions",
    },
    { label: t.auditLog.modules.savingsGoals, value: "savings_goals" },
    { label: t.auditLog.modules.goalDeposits, value: "savings_goal_deposits" },
    { label: t.auditLog.modules.debts, value: "debts" },
    { label: t.auditLog.modules.debtPayments, value: "debt_payments" },
    { label: t.auditLog.modules.accounts, value: "accounts" },
    { label: t.auditLog.modules.categories, value: "categories" },
    { label: t.auditLog.modules.budgets, value: "budgets" },
  ];

  const actionOptions: Array<{ label: string; value: ActionFilter }> = [
    { label: t.auditLog.actions.all, value: "all" },
    { label: t.auditLog.actions.created, value: "INSERT" },
    { label: t.auditLog.actions.updated, value: "UPDATE" },
    { label: t.auditLog.actions.deleted, value: "DELETE" },
  ];

  const hasActiveFilters =
    moduleFilter !== "all" ||
    actionFilter !== "all" ||
    startDate !== "" ||
    endDate !== "" ||
    search !== "";

  const handleResetFilters = () => {
    setModuleFilter("all");
    setActionFilter("all");
    setStartDateLocal("");
    setEndDateLocal("");
    setSearch("");
    startTransition(() => {
      router.push("?");
    });
  };

  return (
    <div className="flex flex-col gap-5 max-w-4xl mx-auto">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-secondary hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.auditLog.backToSettings}</span>
        </Link>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-surface-subtle text-foreground-secondary border border-border">
          {t.auditLog.title}
        </span>
      </div>

      {/* Page Title */}
      <div className="p-4 sm:p-5 rounded-xl bg-surface border border-border flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
          <History className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
            {t.auditLog.title}
          </h1>
          <p className="text-xs text-foreground-secondary mt-0.5 leading-relaxed">
            {t.auditLog.subtitle}
          </p>
        </div>
      </div>

      {/* Advanced Filter Panel */}
      <div
        className={cn(
          "p-4 rounded-xl bg-surface border border-border flex flex-col gap-3 transition-opacity",
          isPending && "opacity-60 pointer-events-none",
        )}
      >
        {/* Row 1: Search & Date Range */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="relative sm:col-span-2">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
            <input
              type="text"
              placeholder={
                t.auditLog.searchPlaceholder ||
                "Cari riwayat, akun, kategori, nominal..."
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8.5 pr-3 py-2 text-xs bg-canvas dark:bg-surface-subtle border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-border-strong transition-colors"
            />
          </div>

          <div>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={(s, e) => {
                // Single push with both dates — calling setStartDate +
                // setEndDate separately pushed twice and the second push
                // used stale state, dropping the start date.
                setStartDateLocal(s);
                setEndDateLocal(e);
                pushParams({ start: s, end: e, page: "1" });
              }}
              placeholder={t.auditLog.dateRange}
            />
          </div>
        </div>

        {/* Row 2: Module Chips */}
        <div className="flex flex-col gap-1 pt-1 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-secondary">
              {t.auditLog.moduleLabel}
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-destructive hover:underline flex items-center gap-1 cursor-pointer font-semibold"
              >
                <X className="w-3.5 h-3.5" />
                <span>{t.auditLog.resetFilters}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {moduleOptions.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  setModuleFilter(item.value);
                  pushParams({ module: item.value, page: "1" });
                }}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors shrink-0 whitespace-nowrap cursor-pointer border",
                  moduleFilter === item.value
                    ? "bg-primary text-primary-foreground border-transparent shadow-2xs"
                    : "bg-surface text-foreground-secondary border-border hover:bg-surface-subtle",
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
              onClick={() => {
                setActionFilter(item.value);
                pushParams({ action: item.value, page: "1" });
              }}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors shrink-0 whitespace-nowrap cursor-pointer border",
                actionFilter === item.value
                  ? "bg-primary text-primary-foreground border-transparent shadow-2xs"
                  : "bg-canvas dark:bg-surface-subtle text-foreground-secondary border-border hover:bg-surface-subtle dark:hover:bg-surface-muted",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading indicator */}
      {isPending && (
        <div className="text-center text-xs text-foreground-muted py-2 animate-pulse">
          {t.auditLog.loadingData}
        </div>
      )}

      {/* Logs Timeline List */}
      {initialLogs.length === 0 ? (
        <div className="p-8 text-center bg-surface rounded-xl border border-border text-xs text-foreground-muted">
          {t.auditLog.emptySearch ||
            "Tidak ada catatan audit yang cocok dengan kriteria filter."}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {initialLogs.map((log) => {
            const h = humanizeAuditLog(log, language);

            return (
              <div
                key={log.id}
                className="p-4 sm:p-5 rounded-xl bg-surface border border-border flex flex-col gap-3 transition-colors hover:border-border-strong"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-surface-subtle text-foreground-secondary border border-border shrink-0">
                      {h.moduleName}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border shrink-0",
                        h.badgeType === "create"
                          ? "bg-success-muted text-success border-success/30"
                          : h.badgeType === "update"
                            ? "bg-info-muted text-info border-info/30"
                            : "bg-destructive-muted text-destructive border-destructive/30",
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
                    <h3 className="text-xs sm:text-sm font-bold text-foreground truncate">
                      {h.title}
                    </h3>
                  </div>

                  <span className="text-[11px] font-mono text-foreground-secondary shrink-0">
                    {formatDate(
                      log.changed_at,
                      "EEEE, d MMM yyyy - HH:mm",
                      language,
                    )}
                  </span>
                </div>

                {/* Friendly Summary Text */}
                <p className="text-xs text-foreground-secondary dark:text-foreground-secondary leading-relaxed">
                  {h.summary}
                </p>

                {/* Humanized Change Diff List */}
                {h.changes.length > 0 && (
                  <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-canvas dark:bg-surface-subtle border border-border text-xs">
                    {h.changes.map((c, cIdx) =>
                      c.items ? (
                        <div key={cIdx} className="flex flex-col gap-1.5 text-[11px]">
                          <span className="font-semibold text-foreground-secondary">
                            {c.field}:
                          </span>
                          {c.itemsFrom && c.itemsFrom.length > 0 && (
                            <>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
                                {t.transactions.fromLabel}
                              </span>
                              <AuditItemsList
                                items={c.itemsFrom}
                                currency={c.currency || "IDR"}
                                muted
                              />
                              {c.items.length > 0 && (
                                <span className="mt-2 border-t border-border pt-2 text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
                                  {t.transactions.toLabel}
                                </span>
                              )}
                            </>
                          )}
                          {c.items.length > 0 ? (
                            <AuditItemsList
                              items={c.items}
                              currency={c.currency || "IDR"}
                            />
                          ) : (
                            <span className="font-mono text-foreground-secondary">
                              {c.to}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div
                          key={cIdx}
                          className="flex items-start justify-between gap-2 flex-wrap text-[11px]"
                        >
                          <span className="font-semibold text-foreground-secondary shrink-0">
                            {c.field}:
                          </span>
                          <div className="flex items-center gap-2 font-mono flex-wrap justify-end">
                            {c.from && (
                              <span className="px-1.5 py-0.5 rounded bg-destructive-muted text-destructive line-through">
                                {c.from}
                              </span>
                            )}
                            {c.from && c.to && (
                              <ArrowRight className="w-3 h-3 text-foreground-muted shrink-0" />
                            )}
                            {c.to && (
                              <span className="px-1.5 py-0.5 rounded bg-success-muted font-bold text-success">
                                {c.to}
                              </span>
                            )}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination Controls (server-side) */}
          {totalPages > 1 && (
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl bg-surface border border-border text-xs">
              <span className="text-foreground-secondary font-medium text-center sm:text-left">
                {t.common.showing}{" "}
                <span className="font-bold text-foreground">
                  {initialLogs.length === 0
                    ? 0
                    : (page - 1) * PAGE_SIZE + 1}
                </span>{" "}
                - {(page - 1) * PAGE_SIZE + initialLogs.length} / {total}
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => pushParams({ page: String(page - 1) })}
                  className="flex-1 sm:flex-initial text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {t.auditLog.previousPage}
                </Button>
                <span className="font-mono text-foreground-secondary shrink-0">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => pushParams({ page: String(page + 1) })}
                  className="flex-1 sm:flex-initial text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {t.auditLog.nextPage}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
