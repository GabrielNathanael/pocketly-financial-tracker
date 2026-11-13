"use client";

import React from "react";
import { Category, EnrichedTransaction } from "@/types/database";
import { formatCurrency } from "@/lib/utils/currency";
import { getCleanDescription } from "@/lib/utils/description";
import { useLanguage } from "@/lib/i18n/language-context";
import { cn } from "@/lib/utils/cn";
import { format, parseISO } from "date-fns";
import { Locale } from "date-fns";

interface CategorySummary {
  category: Category | null;
  total: number;
  count: number;
  percentage: number;
}

interface TopExpense extends EnrichedTransaction {
  convertedAmount: number;
}

export interface ReportPrintInsight {
  id: string;
  title: string;
  badge: string;
  description: string;
}

interface ReportsPrintViewProps {
  intervalStart: Date;
  intervalEnd: Date;
  dateFnsLocale: Locale;
  displayCurrency: string;
  currentPeriodLabel: string;
  priorPeriodLabel: string;
  currentPeriodTx: EnrichedTransaction[];
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  savingsRate: number;
  dailyBurnRate: number;
  elapsedDays: number;
  smartInsights: ReportPrintInsight[];
  priorTotalIncome: number;
  priorTotalExpense: number;
  priorNetSavings: number;
  priorSavingsRate: number;
  incomeGrowthPct: number;
  expenseGrowthPct: number;
  allExpenseCategories: CategorySummary[];
  allIncomeCategories: CategorySummary[];
  topExpenses: TopExpense[];
  excludedCategoryIds: string[];
  excludedCategoryNames: string[];
}

export function ReportsPrintView({
  intervalStart,
  intervalEnd,
  dateFnsLocale,
  displayCurrency,
  currentPeriodLabel,
  priorPeriodLabel,
  currentPeriodTx,
  totalIncome,
  totalExpense,
  netSavings,
  savingsRate,
  dailyBurnRate,
  elapsedDays,
  smartInsights,
  priorTotalIncome,
  priorTotalExpense,
  priorNetSavings,
  priorSavingsRate,
  incomeGrowthPct,
  expenseGrowthPct,
  allExpenseCategories,
  allIncomeCategories,
  topExpenses,
  excludedCategoryIds,
  excludedCategoryNames,
}: ReportsPrintViewProps) {
  const { t } = useLanguage();

  return (
    <div className="hidden print:block print-only w-full">
      <div className="print-section border-b-2 border-slate-900 pb-4 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              POCKETLY
            </h1>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mt-0.5">
              {t.reports.statementHeader}
            </p>
          </div>
          <div className="text-right font-mono text-xs text-slate-600">
            <div>
              <strong>{t.reports.periodLabel}:</strong>{" "}
              {format(intervalStart, "dd MMMM yyyy", { locale: dateFnsLocale })}{" "}
              – {format(intervalEnd, "dd MMMM yyyy", { locale: dateFnsLocale })}
            </div>
            <div className="mt-0.5">
              <strong>{t.reports.generatedOn}:</strong>{" "}
              {format(new Date(), "dd MMM yyyy, HH:mm")}
            </div>
            <div className="mt-0.5">
              <strong>{t.common.currency}:</strong> {displayCurrency}
            </div>
          </div>
        </div>
      </div>

      <div className="print-section">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2 border-b pb-1">
          1. {t.reports.summarySection}
        </h2>
        <table className="text-xs">
          <thead>
            <tr className="bg-slate-100 font-bold text-slate-800">
              <th className="text-left">{t.reports.printHeaderMetric}</th>
              <th className="text-right">
                {t.reports.printHeaderAmount.replace("{currency}", displayCurrency)}
              </th>
              <th className="text-left">{t.reports.printHeaderStatus}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-semibold text-success">{t.reports.inflowLabel}</td>
              <td className="text-right font-mono font-bold text-success tnum">
                +{formatCurrency(totalIncome, displayCurrency)}
              </td>
              <td>
                {currentPeriodTx.filter((tx) => tx.type === "income").length}{" "}
                {t.reports.income} {t.reports.transactionCount} tercatat
              </td>
            </tr>
            <tr>
              <td className="font-semibold text-destructive">{t.reports.outflowLabel}</td>
              <td className="text-right font-mono font-bold text-destructive tnum">
                -{formatCurrency(totalExpense, displayCurrency)}
              </td>
              <td>
                {currentPeriodTx.filter((tx) => tx.type === "expense").length}{" "}
                {t.reports.expenses} {t.reports.transactionCount} tercatat
              </td>
            </tr>
            <tr className="bg-slate-50 font-bold">
              <td>{t.reports.netSavingsLabel}</td>
              <td className={cn("text-right font-mono tnum", netSavings >= 0 ? "text-success" : "text-destructive")}>
                {netSavings >= 0 ? "+" : ""}
                {formatCurrency(netSavings, displayCurrency)}
              </td>
              <td>{netSavings >= 0 ? t.reports.surplusStatus : t.reports.deficitStatus}</td>
            </tr>
            <tr>
              <td className="font-semibold">{t.reports.savingsRate}</td>
              <td className="text-right font-mono font-bold tnum">{savingsRate.toFixed(1)}%</td>
              <td>
                {savingsRate >= 30
                  ? t.reports.healthyStatus
                  : savingsRate >= 10
                    ? t.reports.warningStatus
                    : t.reports.deficitRateStatus}
              </td>
            </tr>
            <tr>
              <td className="font-semibold">{t.reports.dailyAverageExpense}</td>
              <td className="text-right font-mono tnum">
                {formatCurrency(dailyBurnRate, displayCurrency)} {t.reports.perDay}
              </td>
              <td>{t.reports.calculatedForDays.replace("{days}", String(elapsedDays))}</td>
            </tr>
            {excludedCategoryIds.length > 0 && (
              <tr className="bg-slate-50">
                <td colSpan={3} className="text-slate-600 text-[11px] italic">
                  {t.reports.noteExcluded
                    .replace("{count}", String(excludedCategoryIds.length))
                    .replace("{categories}", excludedCategoryNames.join(", "))}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {smartInsights.length > 0 && (
        <div className="print-section">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2 border-b pb-1">
            2. {t.reports.smartInsightsPrintTitle}
          </h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {smartInsights.map((insight) => (
              <div key={insight.id} className="p-2.5 border border-slate-300 rounded-lg bg-slate-50 flex flex-col justify-between gap-1">
                <div className="font-bold text-slate-900 flex justify-between items-center">
                  <span>{insight.title}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 border border-slate-400 rounded uppercase font-semibold">
                    {insight.badge}
                  </span>
                </div>
                <div className="text-slate-700 text-[11px] leading-relaxed">{insight.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="print-section">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2 border-b pb-1">
          3. {t.reports.periodComparison} ({currentPeriodLabel} vs {priorPeriodLabel})
        </h2>
        <table className="text-xs">
          <thead>
            <tr className="bg-slate-100 font-bold text-slate-800">
              <th className="text-left">{t.reports.financialPosition}</th>
              <th className="text-right">{currentPeriodLabel} ({t.reports.activePeriod})</th>
              <th className="text-right">{priorPeriodLabel} ({t.reports.previousPeriod})</th>
              <th className="text-right">{t.reports.growth}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{t.reports.totalIncome}</td>
              <td className="text-right font-mono font-bold text-success tnum">+{formatCurrency(totalIncome, displayCurrency)}</td>
              <td className="text-right font-mono tnum">+{formatCurrency(priorTotalIncome, displayCurrency)}</td>
              <td className="text-right font-mono font-bold tnum">{incomeGrowthPct >= 0 ? `+${incomeGrowthPct.toFixed(1)}%` : `${incomeGrowthPct.toFixed(1)}%`}</td>
            </tr>
            <tr>
              <td>{t.reports.totalExpense}</td>
              <td className="text-right font-mono font-bold text-destructive tnum">-{formatCurrency(totalExpense, displayCurrency)}</td>
              <td className="text-right font-mono tnum">-{formatCurrency(priorTotalExpense, displayCurrency)}</td>
              <td className="text-right font-mono font-bold tnum">{expenseGrowthPct >= 0 ? `+${expenseGrowthPct.toFixed(1)}%` : `${expenseGrowthPct.toFixed(1)}%`}</td>
            </tr>
            <tr className="bg-slate-50 font-bold">
              <td>{t.reports.netSavings}</td>
              <td className="text-right font-mono tnum">{formatCurrency(netSavings, displayCurrency)}</td>
              <td className="text-right font-mono tnum">{formatCurrency(priorNetSavings, displayCurrency)}</td>
              <td className="text-right font-mono tnum">-</td>
            </tr>
            <tr>
              <td>{t.reports.savingsRate}</td>
              <td className="text-right font-mono tnum">{savingsRate.toFixed(1)}%</td>
              <td className="text-right font-mono tnum">{priorSavingsRate.toFixed(1)}%</td>
              <td className="text-right font-mono tnum">{(savingsRate - priorSavingsRate).toFixed(1)}% pt</td>
            </tr>
          </tbody>
        </table>
      </div>

      <CategoryPrintTable
        number={4}
        title={t.reports.expenseCategoryBreakdownPrint}
        emptyText={t.reports.noExpenseData}
        categories={allExpenseCategories}
        displayCurrency={displayCurrency}
        amountLabel={t.reports.totalExpenseLabel}
        nameLabel={t.reports.categoryName}
        positive={false}
      />
      <CategoryPrintTable
        number={5}
        title={t.reports.incomeCategoryBreakdownPrint}
        emptyText={t.reports.noIncomeData}
        categories={allIncomeCategories}
        displayCurrency={displayCurrency}
        amountLabel={t.reports.totalIncomeLabel}
        nameLabel={t.reports.incomeSource}
        positive
      />

      <div className="print-section">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2 border-b pb-1">
          6. {t.reports.topOutflowsPrint}
        </h2>
        <table className="text-xs">
          <thead>
            <tr className="bg-slate-100 font-bold text-slate-800">
              <th className="text-left w-24">{t.reports.date}</th>
              <th className="text-left">{t.reports.descriptionPosition}</th>
              <th className="text-left">{t.common.category}</th>
              <th className="text-left">{t.reports.accountLabel}</th>
              <th className="text-right w-36">{t.reports.nominal}</th>
            </tr>
          </thead>
          <tbody>
            {topExpenses.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-slate-400 py-4">{t.reports.noTransactions}</td></tr>
            ) : (
              topExpenses.map((tx) => (
                <tr key={tx.id}>
                  <td className="font-mono text-slate-600">{format(parseISO(tx.transaction_date), "dd/MM/yyyy")}</td>
                  <td className="font-semibold">{getCleanDescription(tx.description) || tx.category?.name || "-"}</td>
                  <td>{tx.category?.name || "-"}</td>
                  <td className="text-slate-600">{tx.account?.name || "-"}</td>
                  <td className="text-right font-mono font-bold text-destructive tnum">-{formatCurrency(tx.convertedAmount, displayCurrency)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="print-section mt-8 pt-4 border-t text-center font-mono text-[9px] text-slate-400">
        {t.reports.footer}
      </div>
    </div>
  );
}

function CategoryPrintTable({
  number,
  title,
  emptyText,
  categories,
  displayCurrency,
  amountLabel,
  nameLabel,
  positive,
}: {
  number: number;
  title: string;
  emptyText: string;
  categories: CategorySummary[];
  displayCurrency: string;
  amountLabel: string;
  nameLabel: string;
  positive: boolean;
}) {
  const { t } = useLanguage();

  return (
    <div className="print-section">
      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2 border-b pb-1">
        {number}. {title} ({categories.length} {t.reports.categoryCount})
      </h2>
      <table className="text-xs">
        <thead>
          <tr className="bg-slate-100 font-bold text-slate-800">
            <th className="text-left w-8">{t.reports.number}</th>
            <th className="text-left">{nameLabel}</th>
            <th className="text-center w-24">{t.reports.transactionCountLabel}</th>
            <th className="text-right w-36">{amountLabel}</th>
            <th className="text-right w-24">{t.reports.share}</th>
          </tr>
        </thead>
        <tbody>
          {categories.length === 0 ? (
            <tr><td colSpan={5} className="text-center text-slate-400 py-4">{emptyText}</td></tr>
          ) : (
            categories.map((cat, idx) => (
              <tr key={idx}>
                <td>{idx + 1}</td>
                <td className="font-semibold">{cat.category?.name || "Lainnya"}</td>
                <td className="text-center font-mono">{cat.count}</td>
                <td className={cn("text-right font-mono font-bold tnum", positive && "text-success")}>
                  {positive ? "+" : "-"}{formatCurrency(cat.total, displayCurrency)}
                </td>
                <td className="text-right font-mono font-bold tnum">{cat.percentage.toFixed(1)}%</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
