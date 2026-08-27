"use client";

import React from "react";
import Link from "next/link";
import {
  formatCurrency,
  ForexRatesMap,
  convertAmount,
} from "@/lib/utils/currency";
import { usePreferredCurrency } from "@/lib/storage/preferred-currency";
import { usePrivacyMode, maskCurrency } from "@/lib/storage/privacy-mode";
import { useLanguage } from "@/lib/i18n/language-context";
import {
  ArrowLeft,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Target,
} from "lucide-react";

interface NetWorthData {
  totalAccountsIdr: number;
  totalStockHoldingsIdr?: number;
  totalReceivablesIdr: number;
  totalSavingsGoalsIdr?: number;
  totalDebtsIdr: number;
  netWorthIdr: number;
  exchangeRate: number;
  rates?: ForexRatesMap;
}

interface NetWorthViewProps {
  data: NetWorthData;
}

export function NetWorthView({ data }: NetWorthViewProps) {
  const { t, language } = useLanguage();
  const isPrivate = usePrivacyMode();
  const displayCurrency = usePreferredCurrency();

  const convertedTotalAccounts = convertAmount(
    data.totalAccountsIdr,
    "IDR",
    displayCurrency,
    data.rates,
  );
  const convertedStockHoldings = convertAmount(
    data.totalStockHoldingsIdr || 0,
    "IDR",
    displayCurrency,
    data.rates,
  );
  const convertedReceivables = convertAmount(
    data.totalReceivablesIdr,
    "IDR",
    displayCurrency,
    data.rates,
  );
  const convertedSavingsGoals = convertAmount(
    data.totalSavingsGoalsIdr || 0,
    "IDR",
    displayCurrency,
    data.rates,
  );
  const convertedDebts = convertAmount(
    data.totalDebtsIdr,
    "IDR",
    displayCurrency,
    data.rates,
  );
  const totalAssets =
    convertedTotalAccounts +
    convertedStockHoldings +
    convertedReceivables +
    convertedSavingsGoals;
  const totalLiabilities = convertedDebts;
  const convertedNetWorth = totalAssets - totalLiabilities;
  const accountsPct = totalAssets > 0 ? (convertedTotalAccounts / totalAssets) * 100 : 100;
  const stocksPct = totalAssets > 0 ? (convertedStockHoldings / totalAssets) * 100 : 0;
  const receivablesPct = totalAssets > 0 ? (convertedReceivables / totalAssets) * 100 : 0;
  const goalsPct = totalAssets > 0 ? (convertedSavingsGoals / totalAssets) * 100 : 0;

  const [selectedSlice, setSelectedSlice] = React.useState<string | null>(null);

  const assetCategories = React.useMemo(() => {
    return [
      {
        id: "accounts",
        name: language === "en" ? "Cash & Bank" : "Kas & Bank",
        total: convertedTotalAccounts,
        percentage: accountsPct,
        color: "#3B82F6", // Blue
      },
      ...(convertedStockHoldings > 0
        ? [
            {
              id: "stocks",
              name: language === "en" ? "Investments" : "Investasi",
              total: convertedStockHoldings,
              percentage: stocksPct,
              color: "#6366F1", // Indigo
            },
          ]
        : []),
      ...(convertedSavingsGoals > 0
        ? [
            {
              id: "goals",
              name: language === "en" ? "Savings Goals" : "Target Tabungan",
              total: convertedSavingsGoals,
              percentage: goalsPct,
              color: "#0D9488", // Teal
            },
          ]
        : []),
      ...(convertedReceivables > 0
        ? [
            {
              id: "receivables",
              name: language === "en" ? "Receivables" : "Piutang",
              total: convertedReceivables,
              percentage: receivablesPct,
              color: "#10B981", // Emerald
            },
          ]
        : []),
    ];
  }, [
    convertedTotalAccounts,
    convertedStockHoldings,
    convertedSavingsGoals,
    convertedReceivables,
    accountsPct,
    stocksPct,
    goalsPct,
    receivablesPct,
    language,
  ]);

  // Half-Donut Math (180deg Arc from Left to Right)
  const donutSlices = React.useMemo(() => {
    let cumulative = 0;
    const center = 120;
    const centerY = 110;
    const outerR = 96;
    const innerR = 70;

    return assetCategories.map((cat) => {
      const startPct = cumulative;
      cumulative += cat.percentage;
      const endPct = cumulative;

      // Map 0% to 180deg (left), 100% to 0deg (right)
      const startDeg = 180 - (startPct / 100) * 180;
      const endDeg = 180 - (endPct / 100) * 180;

      const startRad = (startDeg * Math.PI) / 180;
      const endRad = (endDeg * Math.PI) / 180;

      const x1 = center + outerR * Math.cos(startRad);
      const y1 = centerY - outerR * Math.sin(startRad);
      const x2 = center + outerR * Math.cos(endRad);
      const y2 = centerY - outerR * Math.sin(endRad);

      const ix1 = center + innerR * Math.cos(startRad);
      const iy1 = centerY - innerR * Math.sin(startRad);
      const ix2 = center + innerR * Math.cos(endRad);
      const iy2 = centerY - innerR * Math.sin(endRad);

      const pathData = `M ${x1} ${y1} A ${outerR} ${outerR} 0 0 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 0 0 ${ix1} ${iy1} Z`;

      return {
        ...cat,
        pathData,
      };
    });
  }, [assetCategories]);

  const activeCategory = assetCategories.find((c) => c.id === selectedSlice);

  const formattedNetWorth = maskCurrency(
    formatCurrency(convertedNetWorth, displayCurrency),
    isPrivate,
  );

  const getNetWorthFontSize = (len: number) => {
    if (len > 22) return "text-xl sm:text-2xl md:text-3xl";
    if (len > 16) return "text-2xl sm:text-3xl md:text-4xl";
    if (len > 12) return "text-[1.7rem] sm:text-3xl md:text-4xl";
    return "text-3xl sm:text-4xl";
  };

  return (
    <div className="flex flex-col gap-5 max-w-xl mx-auto">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.netWorth.backToHome}</span>
        </Link>
      </div>

      {/* Main Net Worth Total Hero */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-4 shadow-2xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
            {t.netWorth.calculatedPosition} ({displayCurrency})
          </span>
        </div>

        {/* Net Worth Hero Number */}
        <div className="flex flex-col gap-1">
          <h1 className={`font-mono font-bold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight tnum leading-none break-words ${getNetWorthFontSize(formattedNetWorth.length)}`}>
            {formattedNetWorth}
          </h1>

          {/* Sub-label explaining where this Net Worth comes from */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs font-mono text-[#64748B] dark:text-[#94A3B8]">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              +{maskCurrency(formatCurrency(totalAssets, displayCurrency), isPrivate)} {language === "en" ? "Assets" : "Aset"}
            </span>
            {totalLiabilities > 0 && (
              <>
                <span>-</span>
                <span className="text-rose-600 dark:text-rose-400 font-bold">
                  {maskCurrency(formatCurrency(totalLiabilities, displayCurrency), isPrivate)} {language === "en" ? "Debts" : "Hutang"}
                </span>
              </>
            )}
            {displayCurrency !== "IDR" && (
              <span className="text-[#94A3B8] tnum">
                (≈ {maskCurrency(formatCurrency(data.netWorthIdr, "IDR"), isPrivate)})
              </span>
            )}
          </div>
        </div>

        {/* Interactive Half-Donut Wealth Allocation Chart */}
        <div className="flex flex-col items-center pt-4 border-t border-[#E5E7EB] dark:border-[#27272A] gap-1">
          <div className="flex items-center justify-between w-full gap-2 pb-1">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {language === "en" ? "Asset Allocation" : "Alokasi Aset"}
            </span>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#F1F3F5] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-[#64748B] dark:text-[#94A3B8] shrink-0">
              {selectedSlice
                ? language === "en" ? "Tap to reset" : "Ketuk untuk reset"
                : language === "en" ? "Tap segment" : "Ketuk segmen"}
            </span>
          </div>

          {/* Interactive SVG Half-Donut */}
          <div className="relative flex items-center justify-center pt-2">
            <svg
              width="240"
              height="115"
              viewBox="0 0 240 115"
              className="overflow-visible select-none"
            >
              {/* Background Guide Arc */}
              <path
                d="M 24 110 A 96 96 0 0 1 216 110 L 190 110 A 70 70 0 0 0 50 110 Z"
                fill="currentColor"
                className="text-[#F1F3F5] dark:text-[#1E1E24]"
              />

              {/* Slices */}
              {donutSlices.map((slice) => {
                const isSelected = selectedSlice === slice.id;
                return (
                  <path
                    key={slice.id}
                    d={slice.pathData}
                    fill={slice.color}
                    onClick={() =>
                      setSelectedSlice(selectedSlice === slice.id ? null : slice.id)
                    }
                    className={`cursor-pointer transition-all duration-200 hover:opacity-85 ${
                      isSelected
                        ? "stroke-2 stroke-[#0F172A] dark:stroke-white brightness-110 filter drop-shadow-md"
                        : "opacity-95"
                    }`}
                  />
                );
              })}
            </svg>

            {/* Dynamic Center Interactive Label inside Arch */}
            <div className="absolute bottom-2 flex flex-col items-center pointer-events-none text-center">
              <span className="text-[9px] uppercase font-bold text-[#64748B] dark:text-[#94A3B8] tracking-wider leading-tight">
                {activeCategory
                  ? activeCategory.name
                  : language === "en"
                    ? "Total Gross Assets"
                    : "Total Seluruh Aset"}
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-xs font-mono font-black text-amber-500">
                  {activeCategory ? `${activeCategory.percentage.toFixed(1)}%` : "100%"}
                </span>
              </div>
            </div>
          </div>

          {/* Dynamic Valuation Amount for Donut Selection */}
          <div className="flex flex-col items-center pt-2 pb-1 text-center">
            <span className="text-xl sm:text-2xl font-mono font-black text-[#0F172A] dark:text-[#FAFAFA] tnum leading-tight">
              {maskCurrency(
                formatCurrency(
                  activeCategory ? activeCategory.total : totalAssets,
                  displayCurrency,
                ),
                isPrivate,
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Structured Ledger Balance Sheet Breakdown (Vertical Stacked Cards) */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-4 shadow-2xs">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
          {t.netWorth.breakdownTitle}
        </h2>

        <div className="flex flex-col gap-3 font-mono tnum">
          {/* Liquid Accounts */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A]">
            <div className="flex items-center gap-2.5 font-sans">
              <div className="w-7 h-7 rounded-lg bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] flex items-center justify-center">
                <Wallet className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {t.netWorth.liquidAssets}
              </span>
            </div>
            <span className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              {maskCurrency(
                formatCurrency(convertedTotalAccounts, displayCurrency),
                isPrivate,
              )}
            </span>
          </div>

          {/* Investment & Stock Holdings */}
          {convertedStockHoldings > 0 && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A]">
              <div className="flex items-center gap-2.5 font-sans">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-200 dark:border-indigo-800/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  {language === 'en' ? 'Investment & Portfolio Assets' : 'Aset Investasi & Portofolio'}
                </span>
              </div>
              <span className="text-xs sm:text-sm font-bold text-indigo-600 dark:text-indigo-400">
                +
                {maskCurrency(
                  formatCurrency(convertedStockHoldings, displayCurrency),
                  isPrivate,
                )}
              </span>
            </div>
          )}

          {/* Savings Goals Capital */}
          {convertedSavingsGoals > 0 && (
            <Link
              href="/goals"
              className="flex items-center justify-between p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] hover:border-[#0D9488]/40 transition-colors group"
            >
              <div className="flex items-center gap-2.5 font-sans">
                <div className="w-7 h-7 rounded-lg bg-[#0D9488]/10 border border-[#0D9488]/20 text-[#0D9488] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Target className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] group-hover:text-[#0D9488] transition-colors">
                  {language === 'en' ? 'Savings Goals Capital' : 'Target Tabungan Terkumpul'}
                </span>
              </div>
              <span className="text-xs sm:text-sm font-bold text-[#0D9488]">
                +
                {maskCurrency(
                  formatCurrency(convertedSavingsGoals, displayCurrency),
                  isPrivate,
                )}
              </span>
            </Link>
          )}

          {/* Receivables */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A]">
            <div className="flex items-center gap-2.5 font-sans">
              <div className="w-7 h-7 rounded bg-[#ECFDF5] dark:bg-[#064E3B]/20 border border-[#A7F3D0] dark:border-[#065F46]/40 text-[#0D9488] flex items-center justify-center">
                <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {t.netWorth.activeReceivables}
              </span>
            </div>
            <span className="text-xs sm:text-sm font-bold text-[#0D9488]">
              +
              {maskCurrency(
                formatCurrency(convertedReceivables, displayCurrency),
                isPrivate,
              )}
            </span>
          </div>

          {/* Debts */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A]">
            <div className="flex items-center gap-2.5 font-sans">
              <div className="w-7 h-7 rounded bg-[#FFF1F2] dark:bg-[#881337]/20 border border-[#FECDD3] dark:border-[#9F1239]/40 text-[#E11D48] flex items-center justify-center">
                <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
              <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {t.netWorth.activeLiabilities}
              </span>
            </div>
            <span className="text-xs sm:text-sm font-bold text-[#E11D48]">
              -
              {maskCurrency(
                formatCurrency(convertedDebts, displayCurrency),
                isPrivate,
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-[#E5E7EB] dark:border-[#27272A] font-mono">
          <span className="font-sans text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
            {t.netWorth.netTotal}
          </span>
          <span className="text-base sm:text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC] tnum">
            {maskCurrency(
              formatCurrency(convertedNetWorth, displayCurrency),
              isPrivate,
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
