"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  exportAllFinancialData,
  type ExportFormat,
  type ExportSection,
} from "@/actions/export";
import { useLanguage } from "@/lib/i18n/language-context";
import {
  Download,
  FileSpreadsheet,
  FileCode,
  Check,
  CalendarDays,
} from "lucide-react";
import {
  addDays,
  startOfDay,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  parseISO,
  format,
} from "date-fns";
import JSZip from "jszip";

type DatePreset = "all" | "thisMonth" | "lastMonth" | "thisYear" | "custom";

interface DateRange {
  rangeStart?: string;
  rangeEnd?: string;
}

/** Data yang bisa dipilih untuk tiap format. */
const SECTIONS_BY_FORMAT: Record<ExportFormat, ExportSection[]> = {
  csv: [
    "transactions",
    "accounts",
    "debts",
    "transfers",
    "stockHoldings",
    "stockTrades",
    "cryptoHoldings",
    "cryptoTrades",
    "etfHoldings",
    "etfTrades",
  ],
  json: [
    "transactions",
    "accounts",
    "debts",
    "budgets",
    "categories",
    "transfers",
    "stockHoldings",
    "stockTrades",
    "cryptoHoldings",
    "cryptoTrades",
    "etfHoldings",
    "etfTrades",
  ],
};

function toDateStr(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Rentang tanggal (inklusif) -> [awal hari `from`, awal hari setelah `to`)
 * di zona waktu browser. Server memakai .gte() dan .lt(), jadi transaksi di
 * hari terakhir (mis. 30 September) tidak lagi terpotong.
 */
function toRange(from: Date, to: Date): DateRange {
  return {
    rangeStart: startOfDay(from).toISOString(),
    rangeEnd: addDays(startOfDay(to), 1).toISOString(),
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function allSelected(format: ExportFormat): ExportSection[] {
  return [...SECTIONS_BY_FORMAT[format]];
}

export function ExportDataCard() {
  const { t } = useLanguage();
  const [isExporting, setIsExporting] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [preset, setPreset] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Format yang panel pilihannya sedang terbuka (null = tertutup).
  const [openFormat, setOpenFormat] = useState<ExportFormat | null>(null);
  const [selection, setSelection] = useState<
    Record<ExportFormat, ExportSection[]>
  >({
    csv: allSelected("csv"),
    json: allSelected("json"),
  });

  const now = new Date();

  const getDateRange = (): DateRange => {
    switch (preset) {
      case "all":
        return {};
      case "thisMonth":
        return toRange(startOfMonth(now), endOfMonth(now));
      case "lastMonth": {
        const last = subMonths(now, 1);
        return toRange(startOfMonth(last), endOfMonth(last));
      }
      case "thisYear":
        return toRange(startOfYear(now), endOfYear(now));
      case "custom":
        return toRange(parseISO(customFrom), parseISO(customTo));
    }
  };

  const sectionLabels: Record<ExportSection, string> = {
    transactions: t.settings.exportSectionTransactions,
    accounts: t.settings.exportSectionAccounts,
    debts: t.settings.exportSectionDebts,
    budgets: t.settings.exportSectionBudgets,
    categories: t.settings.exportSectionCategories,
    transfers: t.settings.exportSectionTransfers,
    stockHoldings: t.settings.exportSectionStockHoldings,
    stockTrades: t.settings.exportSectionStockTrades,
    cryptoHoldings: t.settings.exportSectionCryptoHoldings,
    cryptoTrades: t.settings.exportSectionCryptoTrades,
    etfHoldings: t.settings.exportSectionEtfHoldings,
    etfTrades: t.settings.exportSectionEtfTrades,
  };

  const toggleSection = (fmt: ExportFormat, key: ExportSection) =>
    setSelection((prev) => ({
      ...prev,
      [fmt]: prev[fmt].includes(key)
        ? prev[fmt].filter((s) => s !== key)
        : [...prev[fmt], key],
    }));

  const toggleFormat = (fmt: ExportFormat) =>
    setOpenFormat((current) => (current === fmt ? null : fmt));

  const runExport = async (exportFormat: ExportFormat) => {
    setIsExporting(true);
    setDownloadSuccess(false);
    try {
      const data = await exportAllFinancialData({
        format: exportFormat,
        sections: selection[exportFormat],
        ...getDateRange(),
      });
      const timestamp = toDateStr(new Date());

      if (exportFormat === "json") {
        downloadBlob(
          new Blob([data.jsonData ?? ""], { type: "application/json" }),
          `pocketly-backup-${timestamp}.json`,
        );
      } else {
        const files: { name: string; content: string }[] = [];
        if (data.csvTransactions !== null) {
          files.push({
            name: `pocketly-transactions-${timestamp}.csv`,
            content: data.csvTransactions,
          });
        }
        if (data.csvAccounts !== null) {
          files.push({
            name: `pocketly-accounts-${timestamp}.csv`,
            content: data.csvAccounts,
          });
        }
        if (data.csvDebts !== null) {
          files.push({
            name: `pocketly-debts-${timestamp}.csv`,
            content: data.csvDebts,
          });
        }
        const csvFiles = [
          ["transfers", data.csvTransfers],
          ["stock-holdings", data.csvStockHoldings],
          ["stock-trades", data.csvStockTrades],
          ["crypto-holdings", data.csvCryptoHoldings],
          ["crypto-trades", data.csvCryptoTrades],
          ["etf-holdings", data.csvEtfHoldings],
          ["etf-trades", data.csvEtfTrades],
        ] as const;
        for (const [name, content] of csvFiles) {
          if (content !== null) {
            files.push({
              name: `pocketly-${name}-${timestamp}.csv`,
              content,
            });
          }
        }

        if (files.length === 1) {
          // Satu file saja: unduh langsung sebagai CSV, tanpa ZIP.
          downloadBlob(
            new Blob([files[0].content], { type: "text/csv;charset=utf-8" }),
            files[0].name,
          );
        } else {
          const zip = new JSZip();
          for (const f of files) zip.file(f.name, f.content);
          const blob = await zip.generateAsync({ type: "blob" });
          downloadBlob(blob, `pocketly-export-${timestamp}.zip`);
        }
      }

      setDownloadSuccess(true);
      setOpenFormat(null);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const presets: { key: DatePreset; label: string }[] = [
    { key: "all", label: t.settings.exportPresetAll },
    { key: "thisMonth", label: t.settings.exportPresetThisMonth },
    { key: "lastMonth", label: t.settings.exportPresetLastMonth },
    { key: "thisYear", label: t.settings.exportPresetThisYear },
    { key: "custom", label: t.settings.exportPresetCustom },
  ];

  const isCustomInvalid =
    preset === "custom" && (!customFrom || !customTo || customFrom > customTo);

  const openSelection = openFormat ? selection[openFormat] : [];
  const noSectionSelected = openFormat !== null && openSelection.length === 0;

  const openButtonClass = (fmt: ExportFormat) =>
    `gap-1.5 flex-1 sm:flex-none justify-center ${
      openFormat === fmt ? "border-border-strong" : ""
    }`;

  return (
    <div className="p-4 sm:p-5 rounded-xl bg-surface border border-border flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 shrink-0 rounded-lg bg-surface-subtle border border-border text-foreground flex items-center justify-center">
          <Download className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            {t.settings.exportTitle}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t.settings.exportDesc}
          </p>
        </div>
      </div>

      {/* Date Filter + Export Buttons */}
      <div className="flex flex-col gap-3 pt-3.5 border-t border-border">
        {/* Section label */}
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <CalendarDays className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-wider">
            {t.settings.exportFilterLabel}
          </span>
        </div>

        {/* Preset pills */}
        <div className="flex flex-wrap gap-1.5">
          {presets.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setPreset(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                preset === key
                  ? "bg-primary text-primary-foreground font-bold"
                  : "bg-surface-subtle text-muted-foreground border border-border hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Custom date pickers — only mounted when needed, no leftover space */}
        {preset === "custom" && (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
                  {t.settings.exportCustomFrom}
                </label>
                <DatePicker
                  value={customFrom}
                  onChange={setCustomFrom}
                  placeholder={t.settings.exportCustomFrom}
                  clearable={false}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
                  {t.settings.exportCustomTo}
                </label>
                <DatePicker
                  value={customTo}
                  onChange={setCustomTo}
                  placeholder={t.settings.exportCustomTo}
                  clearable={false}
                />
              </div>
            </div>
            {isCustomInvalid && (
              <p className="text-[11px] text-destructive">
                {t.settings.exportCustomError}
              </p>
            )}
          </div>
        )}

        {/* Format buttons: klik untuk memilih data yang mau diexport */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => toggleFormat("csv")}
            disabled={isCustomInvalid || isExporting}
            aria-expanded={openFormat === "csv"}
            className={openButtonClass("csv")}
          >
            {downloadSuccess && openFormat === null ? (
              <Check className="w-3.5 h-3.5 text-success" />
            ) : (
              <FileSpreadsheet className="w-3.5 h-3.5" />
            )}
            <span>{t.settings.exportCSV}</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => toggleFormat("json")}
            disabled={isCustomInvalid || isExporting}
            aria-expanded={openFormat === "json"}
            className={openButtonClass("json")}
          >
            {downloadSuccess && openFormat === null ? (
              <Check className="w-3.5 h-3.5 text-success" />
            ) : (
              <FileCode className="w-3.5 h-3.5" />
            )}
            <span>{t.settings.exportJSON}</span>
          </Button>
        </div>

        {/* Panel pilihan data — hanya muncul setelah CSV/JSON diklik */}
        {openFormat && (
          <div className="flex flex-col gap-3 p-3 rounded-lg bg-canvas dark:bg-surface-subtle border border-border">
            <p className="text-xs font-bold text-foreground">
              {openFormat === "csv"
                ? t.settings.exportChooseCSV
                : t.settings.exportChooseJSON}
            </p>

            <div className="flex flex-col gap-1" role="group">
              {SECTIONS_BY_FORMAT[openFormat].map((key) => {
                const checked = openSelection.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggleSection(openFormat, key)}
                    className="flex items-center gap-2.5 px-2 py-1.5 -mx-2 rounded-md text-left text-xs text-foreground hover:bg-surface-subtle transition-colors cursor-pointer"
                  >
                    <span
                      className={`w-4 h-4 shrink-0 rounded flex items-center justify-center border transition-colors ${
                        checked
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-border"
                      }`}
                    >
                      {checked && <Check className="w-3 h-3" />}
                    </span>
                    {sectionLabels[key]}
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {t.settings.exportDateHint}
            </p>

            {noSectionSelected && (
              <p className="text-[11px] text-destructive">
                {t.settings.exportSectionsError}
              </p>
            )}

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => runExport(openFormat)}
                isLoading={isExporting}
                disabled={noSectionSelected}
                className="gap-1.5 flex-1 sm:flex-none justify-center"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t.settings.exportConfirm}</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOpenFormat(null)}
                disabled={isExporting}
                className="flex-1 sm:flex-none justify-center"
              >
                {t.settings.exportCancel}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
