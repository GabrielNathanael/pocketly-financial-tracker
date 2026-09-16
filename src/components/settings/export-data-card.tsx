"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { exportAllFinancialData } from "@/actions/export";
import { useLanguage } from "@/lib/i18n/language-context";
import {
  Download,
  FileSpreadsheet,
  FileCode,
  Check,
  CalendarDays,
} from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  format,
} from "date-fns";
import JSZip from "jszip";

type DatePreset = "all" | "thisMonth" | "lastMonth" | "thisYear" | "custom";

function toDateStr(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function ExportDataCard() {
  const { t } = useLanguage();
  const [isExporting, setIsExporting] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [preset, setPreset] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const now = new Date();

  const getDateRange = (): { from?: string; to?: string } => {
    switch (preset) {
      case "all":
        return {};
      case "thisMonth":
        return {
          from: toDateStr(startOfMonth(now)),
          to: toDateStr(endOfMonth(now)),
        };
      case "lastMonth": {
        const last = subMonths(now, 1);
        return {
          from: toDateStr(startOfMonth(last)),
          to: toDateStr(endOfMonth(last)),
        };
      }
      case "thisYear":
        return {
          from: toDateStr(startOfYear(now)),
          to: toDateStr(endOfYear(now)),
        };
      case "custom":
        return { from: customFrom, to: customTo };
    }
  };

  const buildZip = async (exportFormat: "csv" | "json") => {
    setIsExporting(true);
    setDownloadSuccess(false);
    try {
      const { from, to } = getDateRange();
      const data = await exportAllFinancialData(from, to);
      const timestamp = new Date().toISOString().split("T")[0];
      const zip = new JSZip();

      if (exportFormat === "csv") {
        zip.file(
          `pocketly-transactions-${timestamp}.csv`,
          data.csvTransactions,
        );
        zip.file(`pocketly-accounts-${timestamp}.csv`, data.csvAccounts);
        zip.file(`pocketly-debts-${timestamp}.csv`, data.csvDebts);
      } else {
        zip.file(`pocketly-backup-${timestamp}.json`, data.jsonData);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pocketly-export-${timestamp}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
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

  return (
    <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 shrink-0 rounded-lg bg-[#F1F3F5] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] flex items-center justify-center">
          <Download className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
            {t.settings.exportTitle}
          </h3>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
            {t.settings.exportDesc}
          </p>
        </div>
      </div>

      {/* Date Filter + Export Buttons — no gap when custom is hidden */}
      <div className="flex flex-col gap-3 pt-3.5 border-t border-[#E5E7EB] dark:border-[#27272A]">
        {/* Section label */}
        <div className="flex items-center gap-1.5 text-[#64748B] dark:text-[#94A3B8]">
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
                  ? "bg-[#0F172A] dark:bg-[#FAFAFA] text-white dark:text-[#0F172A] font-bold"
                  : "bg-[#F1F3F5] dark:bg-[#1A1A20] text-[#64748B] dark:text-[#94A3B8] border border-[#E5E7EB] dark:border-[#27272A] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]"
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
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
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
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
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
              <p className="text-[11px] text-red-500 dark:text-red-400">
                {t.settings.exportCustomError}
              </p>
            )}
          </div>
        )}

        {/* Export Buttons — directly after presets/custom, no extra border/gap */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => buildZip("csv")}
            isLoading={isExporting}
            disabled={isCustomInvalid}
            className="gap-1.5 flex-1 sm:flex-none justify-center"
          >
            {downloadSuccess ? (
              <Check className="w-3.5 h-3.5 text-[#0D9488]" />
            ) : (
              <FileSpreadsheet className="w-3.5 h-3.5" />
            )}
            <span>{t.settings.exportCSV}</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => buildZip("json")}
            isLoading={isExporting}
            disabled={isCustomInvalid}
            className="gap-1.5 flex-1 sm:flex-none justify-center"
          >
            {downloadSuccess ? (
              <Check className="w-3.5 h-3.5 text-[#0D9488]" />
            ) : (
              <FileCode className="w-3.5 h-3.5" />
            )}
            <span>{t.settings.exportJSON}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
