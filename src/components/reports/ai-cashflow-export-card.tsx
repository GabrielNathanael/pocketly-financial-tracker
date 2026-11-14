"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "@/lib/i18n/language-context";
import { usePreferredCurrency } from "@/lib/storage/preferred-currency";
import { exportAiCashflowData, type AiExportPreset } from "@/actions/ai-export";
import { toast } from "sonner";
import { format } from "date-fns";
import { Bot, CalendarDays, Check, ChevronDown, ChevronUp } from "lucide-react";

type DatePreset = "all" | "thisMonth" | "lastMonth" | "thisYear" | "custom";

function toDateStr(date: Date): string {
  return format(date, "yyyy-MM-dd");
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

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export function AiCashflowExportCard() {
  const { t, language } = useLanguage();
  const baseCurrency = usePreferredCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [preset, setPreset] = useState<DatePreset>("thisMonth");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [includeTransactionsCsv, setIncludeTransactionsCsv] = useState(false);
  const [includeTransfersCsv, setIncludeTransfersCsv] = useState(true);
  const [includeContextJson, setIncludeContextJson] = useState(false);
  const [compactMode, setCompactMode] = useState(false);

  const [metrics, setMetrics] = useState({
    comparePrevious: true,
    averagesMedian: true,
    noSpendDays: true,
    volatility: true,
    trend: true,
    breakdowns: true,
    topTransactions: true,
    highlights: true,
  });

  const isCustomInvalid =
    preset === "custom" && (!customFrom || !customTo || customFrom > customTo);

  const presets: { key: DatePreset; label: string }[] = [
    { key: "all", label: t.reports.aiExportPresetAll ?? t.settings.exportPresetAll },
    { key: "thisMonth", label: t.reports.aiExportPresetThisMonth ?? t.settings.exportPresetThisMonth },
    { key: "lastMonth", label: t.reports.aiExportPresetLastMonth ?? t.settings.exportPresetLastMonth },
    { key: "thisYear", label: t.reports.aiExportPresetThisYear ?? t.settings.exportPresetThisYear },
    { key: "custom", label: t.reports.aiExportPresetCustom ?? t.settings.exportPresetCustom },
  ];

  const toggleMetric = (key: keyof typeof metrics) => {
    setMetrics((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const runExport = async () => {
    if (isCustomInvalid) return;
    setIsExporting(true);
    try {
      const result = await exportAiCashflowData({
        preset: preset as AiExportPreset,
        // Presets (all/thisMonth/lastMonth/thisYear) are resolved server-side in the user's timezone for calendar intent.
        // For custom, send local calendar YYYY-MM-DD dates so server computes user-TZ half-open bounds.
        customStartDate: preset === "custom" ? customFrom : undefined,
        customEndDate: preset === "custom" ? customTo : undefined,
        baseCurrency,
        language: language === "en" ? "en" : "id",
        includeTransactionsCsv,
        includeTransfersCsv,
        includeContextJson,
        compactMode,
        metrics,
      });

      if (result.encoding === "utf-8") {
        downloadBlob(
          new Blob([result.content], { type: "text/markdown;charset=utf-8" }),
          result.filename || `cashflow-ai-summary-${toDateStr(new Date())}.md`,
        );
      } else {
        downloadBlob(
          base64ToBlob(result.content, result.mime || "application/zip"),
          result.filename || `pocketly-ai-cashflow-${toDateStr(new Date())}.zip`,
        );
      }

      toast.success(t.reports.aiExportSuccess || "Export ready");
      setIsOpen(false);
    } catch (error) {
      console.error("AI export failed:", error);
      toast.error(t.reports.aiExportError || "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const metricItems: { key: keyof typeof metrics; label: string }[] = [
    { key: "comparePrevious", label: t.reports.aiExportMetricCompare || "Compare previous period" },
    { key: "averagesMedian", label: t.reports.aiExportMetricAverages || "Averages & median" },
    { key: "noSpendDays", label: t.reports.aiExportMetricNoSpend || "No-spend days" },
    { key: "volatility", label: t.reports.aiExportMetricVolatility || "Volatility" },
    { key: "trend", label: t.reports.aiExportMetricTrend || "Trend" },
    { key: "breakdowns", label: t.reports.aiExportMetricBreakdowns || "Breakdowns" },
    { key: "topTransactions", label: t.reports.aiExportMetricTop || "Top transactions & highlights" },
  ];

  return (
    <div className="p-4 sm:p-5 rounded-xl bg-surface border border-border flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 shrink-0 rounded-lg bg-surface-subtle border border-border text-foreground flex items-center justify-center">
            <Bot className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              {t.reports.aiExportTitle || "AI Cashflow Export"}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t.reports.aiExportDesc ||
                "Generate a markdown summary and raw data files for AI analysis."}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsOpen((v) => !v)}
          className="shrink-0 gap-1.5"
          aria-expanded={isOpen}
        >
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{isOpen ? (t.reports.aiExportClose || "Close") : (t.reports.aiExportOpen || "Open")}</span>
        </Button>
      </div>

      {isOpen && (
        <div className="flex flex-col gap-4 pt-3.5 border-t border-border">
          {/* Period */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarDays className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {t.reports.aiExportPresetLabel || "Period"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {presets.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPreset(key)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap",
                    preset === key
                      ? "bg-primary text-primary-foreground font-bold"
                      : "bg-surface-subtle text-muted-foreground border border-border hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {preset === "custom" && (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
                      {t.reports.aiExportFrom || t.settings.exportCustomFrom}
                    </label>
                    <DatePicker
                      value={customFrom}
                      onChange={setCustomFrom}
                      placeholder={t.reports.aiExportFrom || t.settings.exportCustomFrom}
                      clearable={false}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
                      {t.reports.aiExportTo || t.settings.exportCustomTo}
                    </label>
                    <DatePicker
                      value={customTo}
                      onChange={setCustomTo}
                      placeholder={t.reports.aiExportTo || t.settings.exportCustomTo}
                      clearable={false}
                    />
                  </div>
                </div>
                {isCustomInvalid && (
                  <p className="text-[11px] text-destructive">
                    {t.reports.aiExportCustomError || t.settings.exportCustomError}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Files */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
              {t.reports.aiExportFiles || "Files"}
            </span>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2.5 px-2 py-1.5 -mx-2 text-xs text-foreground opacity-70">
                <span className="w-4 h-4 shrink-0 rounded flex items-center justify-center border bg-primary border-primary text-primary-foreground">
                  <Check className="w-3 h-3" />
                </span>
                {t.reports.aiExportFileSummary || "summary.md (required)"}
              </div>

              <button
                type="button"
                role="checkbox"
                aria-checked={includeTransactionsCsv}
                onClick={() => setIncludeTransactionsCsv((v) => !v)}
                className="flex items-center gap-2.5 px-2 py-1.5 -mx-2 rounded-md text-left text-xs text-foreground hover:bg-surface-subtle transition-colors cursor-pointer"
              >
                <span
                  className={cn(
                    "w-4 h-4 shrink-0 rounded flex items-center justify-center border transition-colors",
                    includeTransactionsCsv
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-border",
                  )}
                >
                  {includeTransactionsCsv && <Check className="w-3 h-3" />}
                </span>
                {t.reports.aiExportFileTransactions || "transactions.csv"}
              </button>

              <button
                type="button"
                role="checkbox"
                aria-checked={includeTransfersCsv}
                onClick={() => setIncludeTransfersCsv((v) => !v)}
                className="flex items-center gap-2.5 px-2 py-1.5 -mx-2 rounded-md text-left text-xs text-foreground hover:bg-surface-subtle transition-colors cursor-pointer"
              >
                <span
                  className={cn(
                    "w-4 h-4 shrink-0 rounded flex items-center justify-center border transition-colors",
                    includeTransfersCsv
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-border",
                  )}
                >
                  {includeTransfersCsv && <Check className="w-3 h-3" />}
                </span>
                {t.reports.aiExportFileTransfers || "transfers.csv"}
              </button>

              <button
                type="button"
                role="checkbox"
                aria-checked={includeContextJson}
                onClick={() => setIncludeContextJson((v) => !v)}
                className="flex items-center gap-2.5 px-2 py-1.5 -mx-2 rounded-md text-left text-xs text-foreground hover:bg-surface-subtle transition-colors cursor-pointer"
              >
                <span
                  className={cn(
                    "w-4 h-4 shrink-0 rounded flex items-center justify-center border transition-colors",
                    includeContextJson
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-border",
                  )}
                >
                  {includeContextJson && <Check className="w-3 h-3" />}
                </span>
                {t.reports.aiExportFileContext || "context.json (structured snapshots/meta/rates)"}
              </button>

              <button
                type="button"
                role="checkbox"
                aria-checked={compactMode}
                onClick={() => setCompactMode((v) => !v)}
                className="flex items-center gap-2.5 px-2 py-1.5 -mx-2 rounded-md text-left text-xs text-foreground hover:bg-surface-subtle transition-colors cursor-pointer"
              >
                <span
                  className={cn(
                    "w-4 h-4 shrink-0 rounded flex items-center justify-center border transition-colors",
                    compactMode
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-border",
                  )}
                >
                  {compactMode && <Check className="w-3 h-3" />}
                </span>
                {t.reports.aiExportCompactMode || "Compact summary (token-efficient)"}
              </button>
            </div>
          </div>

          {/* Metrics */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
              {t.reports.aiExportMetrics || "Content & Metrics"}
            </span>
            <div className="flex flex-col gap-1">
              {metricItems.map(({ key, label }) => {
                const checked = key === "topTransactions" ? (metrics.topTransactions && metrics.highlights) : metrics[key];
                return (
                  <button
                    key={key}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => {
                      if (key === "topTransactions") {
                        const next = !(metrics.topTransactions && metrics.highlights);
                        setMetrics((prev) => ({ ...prev, topTransactions: next, highlights: next }));
                      } else {
                        toggleMetric(key);
                      }
                    }}
                    className="flex items-center gap-2.5 px-2 py-1.5 -mx-2 rounded-md text-left text-xs text-foreground hover:bg-surface-subtle transition-colors cursor-pointer"
                  >
                    <span
                      className={cn(
                        "w-4 h-4 shrink-0 rounded flex items-center justify-center border transition-colors",
                        checked ? "bg-primary border-primary text-primary-foreground" : "border-border",
                      )}
                    >
                      {checked && <Check className="w-3 h-3" />}
                    </span>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {t.reports.aiExportNote ? (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {t.reports.aiExportNote}
            </p>
          ) : null}

          <div className="flex items-center gap-2 pt-0.5">
            <Button
              size="sm"
              onClick={runExport}
              isLoading={isExporting}
              disabled={isCustomInvalid || isExporting}
              className="gap-1.5 flex-1 sm:flex-none justify-center"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>{isExporting ? (t.reports.aiExportGenerating || "Generating...") : (t.reports.aiExportGenerate || "Generate & Download")}</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
