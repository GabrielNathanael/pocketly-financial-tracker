"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  Coins,
  Edit2,
  History,
  Layers,
  Percent,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  endOfDay,
  isWithinInterval,
} from "date-fns";
import {
  Account,
  EnrichedCryptoHolding,
  EnrichedCryptoTrade,
  EnrichedStockHolding,
  EnrichedStockTrade,
  EnrichedTransfer,
} from "@/types/database";
import {
  recordStockBuy,
  recordStockSell,
  updateStockTrade,
  deleteStockTrade,
} from "@/actions/investments";
import {
  recordCryptoBuy,
  recordCryptoSell,
  updateCryptoTrade,
  deleteCryptoTrade,
} from "@/actions/crypto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatCurrency } from "@/lib/utils/currency";
import { getLocalDateString } from "@/lib/utils/date";
import { useLanguage } from "@/lib/i18n/language-context";
import { cn } from "@/lib/utils/cn";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

type AssetKind = "stock" | "crypto";
type Activity = EnrichedStockTrade | EnrichedCryptoTrade;
type TabKey = "portfolio" | "activity" | "reporting";
type ReportPeriod = "all" | "this_month" | "this_year" | "custom";

interface PortfolioInvestmentViewProps {
  stocks: EnrichedStockHolding[];
  stockTrades: EnrichedStockTrade[];
  cryptos: EnrichedCryptoHolding[];
  cryptoTrades: EnrichedCryptoTrade[];
  accounts: Account[];
  transfers: EnrichedTransfer[];
}

export function PortfolioInvestmentView({
  stocks,
  stockTrades,
  cryptos,
  cryptoTrades,
  accounts,
  transfers,
}: PortfolioInvestmentViewProps) {
  const { t, language } = useLanguage();
  const router = useRouter();
  const i18n = t.investments;
  const cryptoI18n = i18n.crypto;
  const isEn = language === "en";

  const investmentAccounts = accounts.filter(
    (account) => account.type === "investment" && account.is_active,
  );
  const investmentAccountIds = useMemo(
    () => new Set(investmentAccounts.map((account) => account.id)),
    [investmentAccounts],
  );

  // Transfers strictly relevant to investment accounts (funding or withdrawals)
  const investmentTransfers = useMemo(
    () =>
      transfers.filter(
        (transfer) =>
          (transfer.from_account_id &&
            investmentAccountIds.has(transfer.from_account_id)) ||
          (transfer.to_account_id &&
            investmentAccountIds.has(transfer.to_account_id)) ||
          transfer.from_account?.type === "investment" ||
          transfer.to_account?.type === "investment",
      ),
    [transfers, investmentAccountIds],
  );

  const [tab, setTab] = useState<TabKey>("portfolio");
  const [modal, setModal] = useState<"buy" | "sell" | "edit" | null>(null);
  const [editTradeType, setEditTradeType] = useState<"buy" | "sell" | null>(
    null,
  );
  const [assetKind, setAssetKind] = useState<AssetKind>("crypto");
  const [accountId, setAccountId] = useState(() => {
    if (typeof window === "undefined") return investmentAccounts[0]?.id || "";
    const saved = localStorage.getItem("investment_last_account_id");
    const isValid = investmentAccounts.some((a) => a.id === saved);
    return isValid ? saved : investmentAccounts[0]?.id || "";
  });
  const [selectedId, setSelectedId] = useState("");
  const [ticker, setTicker] = useState("");
  const [symbol, setSymbol] = useState("BTC");
  const [lots, setLots] = useState("1");
  const [quantity, setQuantity] = useState("");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [fee, setFee] = useState("");
  const [date, setDate] = useState(getLocalDateString());
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Activity | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCashBreakdown, setShowCashBreakdown] = useState(false);
  // Percentage slider state for crypto trading
  const [cryptoPercent, setCryptoPercent] = useState<number>(0);

  // Filter states for Buku Transaksi (Activity Tab)
  const [activityKindFilter, setActivityKindFilter] = useState<
    "all" | "stock" | "crypto"
  >("all");
  const [activityActionFilter, setActivityActionFilter] = useState<
    "all" | "buy" | "sell"
  >("all");
  const [activitySearch, setActivitySearch] = useState("");

  // Period and Custom Range for Reporting Tab (Without "last_month")
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("all");
  const [customRange, setCustomRange] = useState<{
    start: string;
    end: string;
  }>({
    start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    end: format(endOfMonth(new Date()), "yyyy-MM-dd"),
  });

  // Portfolio overall valuations
  const stockValue = stocks.reduce(
    (total, holding) => total + Number(holding.total_cost),
    0,
  );
  const cryptoValue = cryptos.reduce(
    (total, holding) =>
      total + Number(holding.quantity) * Number(holding.manual_price),
    0,
  );
  const cashValue = investmentAccounts.reduce(
    (total, account) => total + Number(account.current_balance),
    0,
  );
  const totalPortfolioValue = stockValue + cryptoValue + cashValue;

  // Consolidated & sorted activity transactions
  const allActivities = useMemo<Activity[]>(
    () =>
      [...stockTrades, ...cryptoTrades].sort(
        (a, b) =>
          new Date(b.trade_date).getTime() - new Date(a.trade_date).getTime() ||
          new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime(),
      ),
    [stockTrades, cryptoTrades],
  );

  // Filtered activity for Buku Transaksi tab
  const filteredActivities = useMemo(() => {
    return allActivities.filter((activity) => {
      const isStock = "ticker" in activity;
      if (activityKindFilter === "stock" && !isStock) return false;
      if (activityKindFilter === "crypto" && isStock) return false;
      if (
        activityActionFilter !== "all" &&
        activity.type !== activityActionFilter
      )
        return false;
      if (activitySearch.trim()) {
        const query = activitySearch.trim().toLowerCase();
        const code = isStock
          ? (activity as EnrichedStockTrade).ticker.toLowerCase()
          : (activity as EnrichedCryptoTrade).symbol.toLowerCase();
        const note = (activity.notes || "").toLowerCase();
        const accName = (activity.account?.name || "").toLowerCase();
        if (
          !code.includes(query) &&
          !note.includes(query) &&
          !accName.includes(query)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [allActivities, activityKindFilter, activityActionFilter, activitySearch]);

  // Interval calculation for Reporting Tab
  const { intervalStart, intervalEnd } = useMemo(() => {
    const now = new Date();
    if (reportPeriod === "this_month") {
      return {
        intervalStart: startOfMonth(now),
        intervalEnd: endOfMonth(now),
      };
    }
    if (reportPeriod === "this_year") {
      return {
        intervalStart: startOfYear(now),
        intervalEnd: endOfYear(now),
      };
    }
    if (reportPeriod === "custom") {
      return {
        intervalStart: customRange.start
          ? parseISO(customRange.start)
          : startOfMonth(now),
        intervalEnd: customRange.end
          ? endOfDay(parseISO(customRange.end))
          : endOfMonth(now),
      };
    }
    return { intervalStart: null, intervalEnd: null };
  }, [reportPeriod, customRange]);

  const isDateInInterval = (dateStr: string) => {
    if (!intervalStart || !intervalEnd) return true;
    try {
      const d = parseISO(dateStr.slice(0, 10));
      return isWithinInterval(d, { start: intervalStart, end: intervalEnd });
    } catch {
      return true;
    }
  };

  const reportStockTrades = useMemo(
    () => stockTrades.filter((tr) => isDateInInterval(tr.trade_date)),
    [stockTrades, intervalStart, intervalEnd],
  );

  const reportCryptoTrades = useMemo(
    () => cryptoTrades.filter((tr) => isDateInInterval(tr.trade_date)),
    [cryptoTrades, intervalStart, intervalEnd],
  );

  const reportTransfers = useMemo(
    () =>
      investmentTransfers.filter((tr) => isDateInInterval(tr.transfer_date)),
    [investmentTransfers, intervalStart, intervalEnd],
  );

  // Reporting Analytics Calculations (Already exact net realized profit/loss):
  const reportingStats = useMemo(() => {
    const stockSales = reportStockTrades.filter((tr) => tr.type === "sell");
    const cryptoSales = reportCryptoTrades.filter((tr) => tr.type === "sell");
    const allSales = [...stockSales, ...cryptoSales];

    let totalGain = 0;
    let totalLoss = 0;
    let winningTradesCount = 0;
    let losingTradesCount = 0;

    for (const trade of allSales) {
      const pnl = Number(trade.realized_pnl) || 0;
      if (pnl > 0) {
        totalGain += pnl;
        winningTradesCount += 1;
      } else if (pnl < 0) {
        totalLoss += Math.abs(pnl);
        losingTradesCount += 1;
      }
    }

    // True Net Realized PnL is the exact net sum of gains and losses
    const netRealizedPnl = totalGain - totalLoss;

    const stockStampDuty = reportStockTrades.reduce(
      (sum, tr) => sum + (Number(tr.stamp_duty) || 0),
      0,
    );
    const cryptoFees = reportCryptoTrades.reduce(
      (sum, tr) => sum + (Number(tr.fee_amount) || 0),
      0,
    );
    const transferFees = reportTransfers.reduce(
      (sum, tr) => sum + (Number(tr.fee_amount) || 0),
      0,
    );
    const totalFees = stockStampDuty + cryptoFees + transferFees;
    const totalClosedCount = allSales.length;
    const winRate =
      totalClosedCount > 0
        ? Math.round((winningTradesCount / totalClosedCount) * 100)
        : 0;

    // Asset-by-asset breakdown: "Untung Disini, Rugi Disini"
    interface AssetPerf {
      kind: AssetKind;
      symbol: string;
      netPnl: number;
      gain: number;
      loss: number;
      tradesCount: number;
      winCount: number;
    }
    const assetMap = new Map<string, AssetPerf>();

    for (const trade of stockSales) {
      const sym = trade.ticker;
      const pnl = Number(trade.realized_pnl) || 0;
      const curr = assetMap.get(sym) || {
        kind: "stock",
        symbol: sym,
        netPnl: 0,
        gain: 0,
        loss: 0,
        tradesCount: 0,
        winCount: 0,
      };
      if (pnl > 0) {
        curr.gain += pnl;
        curr.winCount += 1;
      } else if (pnl < 0) {
        curr.loss += Math.abs(pnl);
      }
      curr.netPnl += pnl;
      curr.tradesCount += 1;
      assetMap.set(sym, curr);
    }

    for (const trade of cryptoSales) {
      const sym = trade.symbol;
      const pnl = Number(trade.realized_pnl) || 0;
      const curr = assetMap.get(sym) || {
        kind: "crypto",
        symbol: sym,
        netPnl: 0,
        gain: 0,
        loss: 0,
        tradesCount: 0,
        winCount: 0,
      };
      if (pnl > 0) {
        curr.gain += pnl;
        curr.winCount += 1;
      } else if (pnl < 0) {
        curr.loss += Math.abs(pnl);
      }
      curr.netPnl += pnl;
      curr.tradesCount += 1;
      assetMap.set(sym, curr);
    }

    // Sort descending: Top gainers first, top losers at the bottom
    const assetPerformance = Array.from(assetMap.values()).sort(
      (a, b) => b.netPnl - a.netPnl,
    );

    // Fee breakdown items
    const feeRecords = [
      ...reportStockTrades
        .filter((tr) => Number(tr.stamp_duty) > 0)
        .map((tr) => ({
          id: `stock-${tr.id}`,
          date: tr.trade_date,
          type: i18n.feesStock,
          reference: `${tr.ticker} · ${tr.type === "buy" ? i18n.buy : i18n.sell}`,
          amount: Number(tr.stamp_duty),
        })),
      ...reportCryptoTrades
        .filter((tr) => Number(tr.fee_amount) > 0)
        .map((tr) => ({
          id: `crypto-${tr.id}`,
          date: tr.trade_date,
          type: i18n.feesCrypto,
          reference: `${tr.symbol} · ${tr.type === "buy" ? i18n.buy : i18n.sell}`,
          amount: Number(tr.fee_amount),
        })),
      ...reportTransfers
        .filter((tr) => Number(tr.fee_amount) > 0)
        .map((tr) => ({
          id: `transfer-${tr.id}`,
          date: tr.transfer_date,
          type: i18n.feesTransfer,
          reference:
            tr.description ||
            `${tr.from_account?.name || "—"} → ${tr.to_account?.name || "—"}`,
          amount: Number(tr.fee_amount),
        })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      totalGain,
      totalLoss,
      netRealizedPnl,
      stockStampDuty,
      cryptoFees,
      transferFees,
      totalFees,
      totalClosedCount,
      winningTradesCount,
      losingTradesCount,
      winRate,
      assetPerformance,
      feeRecords,
    };
  }, [reportStockTrades, reportCryptoTrades, reportTransfers, i18n]);

  // Donut chart data
  const allocationData = useMemo(
    () =>
      [
        { name: isEn ? "Cash" : "Kas", value: cashValue },
        { name: isEn ? "Stocks" : "Saham", value: stockValue },
        { name: isEn ? "Crypto" : "Kripto", value: cryptoValue },
      ].filter((d) => d.value > 0),
    [cashValue, stockValue, cryptoValue, isEn],
  );

  const ALLOCATION_COLORS = ["#6366F1", "#10B981", "#F59E0B"];

  // Bar chart data — P&L per aset (dari reportingStats yang sudah ada)
  const pnlBarData = useMemo(
    () =>
      reportingStats.assetPerformance.map((a) => ({
        symbol: a.symbol,
        pnl: a.netPnl,
      })),
    [reportingStats.assetPerformance],
  );

  // Line chart — kumulatif P&L over time (ikut filter periode)
  const cumulativePnlData = useMemo(() => {
    const allSells = [
      ...reportStockTrades
        .filter((t) => t.type === "sell")
        .map((t) => ({
          date: t.trade_date.slice(0, 10),
          pnl: Number(t.realized_pnl) || 0,
        })),
      ...reportCryptoTrades
        .filter((t) => t.type === "sell")
        .map((t) => ({
          date: t.trade_date.slice(0, 10),
          pnl: Number(t.realized_pnl) || 0,
        })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    let cumulative = 0;
    return allSells.map((t) => {
      cumulative += t.pnl;
      return { date: t.date, cumulative };
    });
  }, [reportStockTrades, reportCryptoTrades]); // Real-time calculation helpers for modals
  const cryptoQuantity =
    Number(amount) > 0 && Number(price) > 0
      ? Math.floor((Number(amount) / Number(price)) * 100_000_000) / 100_000_000
      : 0;

  const cryptoSellGrossAmount =
    Number(quantity) > 0 && Number(price) > 0
      ? Number(quantity) * Number(price)
      : 0;

  const stockSellGrossAmount =
    Number(lots) > 0 && Number(price) > 0
      ? Number(lots) * 100 * Number(price)
      : 0;

  const selectedStock = stocks.find((holding) => holding.id === selectedId);
  const selectedCrypto = cryptos.find((holding) => holding.id === selectedId);
  const selectedAccount = accounts.find((account) => account.id === accountId);

  // Synchronize crypto percentage slider
  const handleCryptoBuyPercentChange = (pct: number) => {
    setCryptoPercent(pct);
    const balance = Number(selectedAccount?.current_balance || 0);
    if (balance > 0) {
      // ← kalau balance 0 atau account undefined, stop di sini
      const targetAmount = Math.max(0, Math.floor(balance * (pct / 100)));
      setAmount(String(targetAmount));
    }
  };

  const handleCryptoSellPercentChange = (pct: number) => {
    setCryptoPercent(pct);
    if (selectedCrypto) {
      const maxQty = Number(selectedCrypto.quantity || 0);
      if (maxQty > 0) {
        const targetQty = maxQty * (pct / 100);
        setQuantity(targetQty.toFixed(8).replace(/\.?0+$/, ""));
      }
    }
  };

  const handleAccountChange = (id: string) => {
    setAccountId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("investment_last_account_id", id);
    }
  };

  const closeModal = () => {
    setModal(null);
    setEditTradeType(null);
    setSelectedId("");
    setTicker("");
    setSymbol("BTC");
    setLots("1");
    setQuantity("");
    setAmount("");
    setPrice("");
    setFee("");
    setNotes("");
    setDate(getLocalDateString());
    setCryptoPercent(0);
  };

  const openBuy = (
    kind: AssetKind,
    holding?: EnrichedStockHolding | EnrichedCryptoHolding,
  ) => {
    setAssetKind(kind);
    setSelectedId(holding?.id || "");
    setCryptoPercent(0);
    if (holding) {
      if (kind === "stock") {
        setTicker((holding as EnrichedStockHolding).ticker);
        setLots(
          String(
            Number((holding as EnrichedStockHolding).lots) ||
              Number((holding as EnrichedStockHolding).total_shares) / 100 ||
              1,
          ),
        );
      } else {
        setSymbol((holding as EnrichedCryptoHolding).symbol);
        setPrice(
          String(
            (holding as EnrichedCryptoHolding).manual_price ||
              (holding as EnrichedCryptoHolding).average_buy_price ||
              "",
          ),
        );
      }
      setAccountId(holding.account_id);
    }
    setModal("buy");
  };

  const openSell = (
    kind: AssetKind,
    holding?: EnrichedStockHolding | EnrichedCryptoHolding,
  ) => {
    setAssetKind(kind);
    setSelectedId(holding?.id || "");
    setCryptoPercent(0);
    if (holding) {
      setAccountId(holding.account_id);
      if (kind === "stock") {
        const stock = holding as EnrichedStockHolding;
        setTicker(stock.ticker);
        setLots(
          String(Number(stock.lots) || Number(stock.total_shares) / 100 || 1),
        );
        setPrice("");
      } else {
        const crypto = holding as EnrichedCryptoHolding;
        setSymbol(crypto.symbol);
        setQuantity(String(crypto.quantity));
        setPrice("");
      }
    }
    setModal("sell");
  };

  const submitTransaction = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      let result: { error?: string } = {};
      if (assetKind === "stock" && modal === "buy") {
        result = !accountId
          ? {
              error: isEn
                ? "Select an account first"
                : "Pilih akun terlebih dahulu",
            }
          : await recordStockBuy({
              accountId,
              ticker,
              lots: Number(lots),
              netAmount: Number(amount),
              notes: notes || null,
              tradeDate: date,
              language,
            });
      } else if (assetKind === "stock" && modal === "sell") {
        result = selectedStock
          ? await recordStockSell({
              holdingId: selectedStock.id,
              lots: Number(lots),
              netAmount: stockSellGrossAmount,
              notes: notes || null,
              tradeDate: date,
              language,
            })
          : {
              error: isEn
                ? "Select a stock first"
                : "Pilih saham terlebih dahulu",
            };
      } else if (assetKind === "crypto" && modal === "buy") {
        result = !accountId
          ? {
              error: isEn
                ? "Select an account first"
                : "Pilih akun terlebih dahulu",
            }
          : await recordCryptoBuy({
              accountId,
              symbol,
              quantity: cryptoQuantity,
              grossAmount: Number(amount),
              feeAmount: Number(fee || 0),
              pricePerUnit: Number(price),
              notes: notes || null,
              tradeDate: date,
            });
      } else if (assetKind === "crypto" && modal === "sell") {
        result = selectedCrypto
          ? await recordCryptoSell({
              holdingId: selectedCrypto.id,
              quantity: Number(quantity),
              grossAmount: cryptoSellGrossAmount,
              feeAmount: Number(fee || 0),
              pricePerUnit: Number(price),
              notes: notes || null,
              tradeDate: date,
            })
          : {
              error: isEn
                ? "Select an asset first"
                : "Pilih aset terlebih dahulu",
            };
      } else if (assetKind === "crypto" && modal === "edit" && selectedId) {
        result = await updateCryptoTrade({
          id: selectedId,
          quantity: Number(editTradeType === "buy" ? cryptoQuantity : quantity),
          grossAmount:
            editTradeType === "buy" ? Number(amount) : cryptoSellGrossAmount,
          feeAmount: Number(fee || 0),
          pricePerUnit: Number(price),
          notes: notes || null,
          tradeDate: date,
        });
      } else if (modal === "edit" && selectedId) {
        result = await updateStockTrade({
          id: selectedId,
          ticker,
          lots: Number(lots),
          netAmount: Number(amount),
          notes: notes || null,
          tradeDate: date,
        });
      }
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        modal === "edit"
          ? i18n.editTradeSuccess
          : modal === "buy"
            ? i18n.saveSuccess
            : i18n.sellSuccess,
      );
      closeModal();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (trade: EnrichedStockTrade) => {
    setDeleteTarget(trade);
  };

  const handleDeleteCrypto = (trade: EnrichedCryptoTrade) => {
    setDeleteTarget(trade);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const isCrypto = "symbol" in deleteTarget;
    const result = isCrypto
      ? await deleteCryptoTrade(deleteTarget.id)
      : await deleteStockTrade(deleteTarget.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(isCrypto ? i18n.deleteCryptoSuccess : i18n.deleteSuccess);
      router.refresh();
    }
    setIsDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-3.5 px-1 pb-20 sm:gap-4 sm:px-2">
      {/* Sleek, Non-redundant Mobile-Optimized Header (Aligned heights, no jomplang) */}
      <header className="rounded-2xl border border-[#E5E7EB] bg-white p-3.5 shadow-2xs dark:border-[#27272A] dark:bg-[#121215] sm:p-5">
        <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-[#0F172A] dark:text-[#F8FAFC] sm:text-lg">
                {i18n.title}
              </h1>
              <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] sm:text-[11px]">
                {i18n.subtitle}
              </p>
            </div>
          </div>

          {/* Equal-height (h-11) Metric Box & Action Button */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2.5">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCashBreakdown((prev) => !prev)}
                className="flex h-11 flex-col justify-center rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-3 text-left transition-colors hover:bg-[#F1F3F5] dark:border-[#27272A] dark:bg-[#1A1A20] dark:hover:bg-[#222228]"
              >
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8] leading-none">
                  {i18n.totalPortfolio}
                </span>
                <span className="mt-1 truncate font-mono text-xs font-black leading-none text-[#0F172A] dark:text-[#F8FAFC] sm:text-sm">
                  {formatCurrency(totalPortfolioValue, "IDR")}
                </span>
              </button>

              {showCashBreakdown && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowCashBreakdown(false)}
                  />

                  {/* Popover */}
                  <div className="absolute left-0 top-full z-20 mt-2 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-lg dark:border-[#27272A] dark:bg-[#121215]">
                    {/* Kas per akun */}
                    <div className="border-b border-[#E5E7EB] px-4 py-3 dark:border-[#27272A]">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                        <Wallet className="h-3 w-3" />
                        {isEn ? "Liquid Cash" : "Kas Liquid"}
                      </div>
                      <div className="mt-2 flex flex-col gap-1.5">
                        {investmentAccounts.map((account) => (
                          <div
                            key={account.id}
                            className="flex items-center justify-between gap-3"
                          >
                            <span className="truncate text-xs text-[#64748B] dark:text-[#94A3B8]">
                              {account.name}
                            </span>
                            <span className="shrink-0 font-mono text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                              {formatCurrency(
                                Number(account.current_balance),
                                account.currency,
                              )}
                            </span>
                          </div>
                        ))}
                        <div className="mt-1 flex items-center justify-between gap-3 border-t border-[#E5E7EB] pt-1.5 dark:border-[#27272A]">
                          <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                            {isEn ? "Total Cash" : "Total Kas"}
                          </span>
                          <span className="font-mono text-xs font-black text-[#0F172A] dark:text-[#F8FAFC]">
                            {formatCurrency(cashValue, "IDR")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Saham & Kripto */}
                    <div className="flex flex-col gap-1.5 px-4 py-3">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                        <BarChart3 className="h-3 w-3" />
                        {isEn ? "Investments" : "Investasi"}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                          {i18n.stock}
                        </span>
                        <span className="font-mono text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                          {formatCurrency(stockValue, "IDR")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                          {i18n.cryptoAsset}
                        </span>
                        <span className="font-mono text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                          {formatCurrency(cryptoValue, "IDR")}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-3 border-t border-[#E5E7EB] pt-1.5 dark:border-[#27272A]">
                        <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                          {i18n.totalPortfolio}
                        </span>
                        <span className="font-mono text-xs font-black text-[#0F172A] dark:text-[#F8FAFC]">
                          {formatCurrency(totalPortfolioValue, "IDR")}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <Button
              onClick={() => openBuy("crypto")}
              className="h-11 min-h-[44px] gap-1.5 rounded-xl px-4 text-xs font-bold shadow-xs"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span className="truncate">{i18n.addTradeBtn}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Segmented Control 3-Tab Bar (Fits 100% Mobile Screen with Zero Cutoff) */}
      <div className="grid grid-cols-3 gap-1 rounded-2xl border border-[#E5E7EB] bg-[#F1F3F5] p-1 dark:border-[#27272A] dark:bg-[#1A1A20]">
        {(
          [
            ["portfolio", isEn ? "Portfolio" : "Portofolio", Layers],
            ["activity", isEn ? "Trade Book" : "Buku Transaksi", History],
            ["reporting", isEn ? "Reports" : "Laporan", BarChart3],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              "flex min-h-[42px] cursor-pointer items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-center text-xs font-bold transition-all sm:min-h-[44px]",
              tab === value
                ? "bg-white text-[#0F172A] shadow-xs dark:bg-[#121215] dark:text-[#FAFAFA]"
                : "text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#FAFAFA]",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: PORTFOLIO HOLDINGS */}
      {tab === "portfolio" && (
        <section className="flex flex-col gap-3 sm:gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {stocks.map((holding) => (
              <StockCard
                key={holding.id}
                holding={holding}
                onBuy={() => openBuy("stock", holding)}
                onSell={() => openSell("stock", holding)}
              />
            ))}
            {cryptos.map((holding) => (
              <CryptoCard
                key={holding.id}
                holding={holding}
                onBuy={() => openBuy("crypto", holding)}
                onSell={() => openSell("crypto", holding)}
              />
            ))}
          </div>
          {stocks.length + cryptos.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-white p-12 text-center text-xs text-[#64748B] dark:border-[#27272A] dark:bg-[#121215]">
              <Layers className="mx-auto mb-2 h-8 w-8 text-[#94A3B8]" />
              <p className="font-bold">{i18n.emptyHoldingsTitle}</p>
              <p className="mt-1 text-[11px] text-[#94A3B8]">
                {i18n.emptyHoldingsDesc}
              </p>
            </div>
          )}
        </section>
      )}

      {/* TAB 2: BUKU TRANSAKSI (RESTYLED TRADE BOOK) */}
      {tab === "activity" && (
        <section className="flex flex-col gap-3">
          {/* Filter Bar (100% full width on mobile, no empty spaces) */}
          <div className="flex flex-col gap-2 rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-2xs dark:border-[#27272A] dark:bg-[#121215] sm:p-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {/* Asset Kind Filter: Full-width 3-columns */}
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#F8F9FA] p-1 dark:bg-[#1A1A20]">
                {(
                  [
                    ["all", isEn ? "All Assets" : "Semua Aset"],
                    ["stock", i18n.stock],
                    ["crypto", i18n.cryptoAsset],
                  ] as const
                ).map(([kind, label]) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setActivityKindFilter(kind)}
                    className={cn(
                      "h-9 rounded-lg px-1 text-center text-xs font-bold transition-all truncate",
                      activityKindFilter === kind
                        ? "bg-white text-[#0F172A] shadow-xs dark:bg-[#27272A] dark:text-[#FAFAFA]"
                        : "text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8]",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Action Filter: Full-width 3-columns */}
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#F8F9FA] p-1 dark:bg-[#1A1A20]">
                {(
                  [
                    ["all", isEn ? "All Types" : "Semua Tipe"],
                    ["buy", i18n.buy],
                    ["sell", i18n.sell],
                  ] as const
                ).map(([act, label]) => (
                  <button
                    key={act}
                    type="button"
                    onClick={() => setActivityActionFilter(act)}
                    className={cn(
                      "h-9 rounded-lg px-1 text-center text-xs font-bold transition-all truncate",
                      activityActionFilter === act
                        ? "bg-white text-[#0F172A] shadow-xs dark:bg-[#27272A] dark:text-[#FAFAFA]"
                        : "text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8]",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
                placeholder={
                  isEn
                    ? "Search ticker, symbol, account, notes..."
                    : "Cari emiten, koin, akun, atau catatan..."
                }
                className="w-full rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] py-2 pl-9 pr-3 text-xs font-medium text-[#0F172A] placeholder:text-[#94A3B8] dark:border-[#27272A] dark:bg-[#1A1A20] dark:text-[#F8FAFC]"
              />
            </div>
          </div>

          {/* Trade Execution Cards */}
          <div className="flex flex-col gap-2.5">
            {filteredActivities.map((activity) => {
              const isStock = "ticker" in activity;
              const isBuy = activity.type === "buy";
              const symbolText = isStock
                ? (activity as EnrichedStockTrade).ticker
                : (activity as EnrichedCryptoTrade).symbol;
              const totalAmount = Number(
                isStock
                  ? (activity as EnrichedStockTrade).net_amount
                  : Number((activity as EnrichedCryptoTrade).quantity) *
                      Number((activity as EnrichedCryptoTrade).price_per_unit),
              );
              const pnl = Number(activity.realized_pnl) || 0;
              const hasPnl = !isBuy;

              return (
                <div
                  key={activity.id}
                  className="flex flex-col gap-2.5 rounded-2xl border border-[#E5E7EB] bg-white p-3.5 shadow-2xs transition-all hover:border-[#CBD5E1] dark:border-[#27272A] dark:bg-[#121215] dark:hover:border-[#3F3F46] sm:gap-3 sm:p-4"
                >
                  {/* Card Header Row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <AssetLogo
                        kind={isStock ? "stock" : "crypto"}
                        symbol={symbolText}
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-black text-sm tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
                            {symbolText}
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider",
                              isBuy
                                ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-300",
                            )}
                          >
                            {isBuy ? (
                              <ArrowDownRight className="h-3 w-3" />
                            ) : (
                              <ArrowUpRight className="h-3 w-3" />
                            )}
                            {isBuy
                              ? isStock
                                ? i18n.buyBtn
                                : cryptoI18n.buy
                              : isStock
                                ? i18n.sellBtn
                                : cryptoI18n.sell}
                          </span>
                          <span className="rounded-md border border-[#E5E7EB] bg-[#F8F9FA] px-1.5 py-0.5 text-[9px] font-bold text-[#64748B] dark:border-[#27272A] dark:bg-[#1A1A20] dark:text-[#94A3B8]">
                            {isStock ? i18n.stock : i18n.cryptoAsset}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                          {new Date(activity.trade_date).toLocaleDateString(
                            isEn ? "en-US" : "id-ID",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            },
                          )}{" "}
                          · {activity.account?.name || "Platform"}
                        </p>
                      </div>
                    </div>

                    {/* Actions: Edit & Delete */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (isStock) {
                            const trade = activity as EnrichedStockTrade;
                            setTicker(trade.ticker);
                            setLots(String(trade.lots || 1));
                            setAmount(String(trade.net_amount));
                            setDate(trade.trade_date.slice(0, 10));
                            setNotes(trade.notes || "");
                            setAssetKind("stock");
                          } else {
                            const trade = activity as EnrichedCryptoTrade;
                            setSymbol(trade.symbol);
                            setQuantity(String(trade.quantity));
                            setAmount(String(trade.gross_amount));
                            setPrice(String(trade.price_per_unit));
                            setFee(String(trade.fee_amount || 0));
                            setDate(trade.trade_date.slice(0, 10));
                            setNotes(trade.notes || "");
                            setAssetKind("crypto");
                          }
                          setSelectedId(activity.id);
                          setEditTradeType(activity.type);
                          setModal("edit");
                        }}
                        className="flex h-8 w-8 min-h-[36px] min-w-[36px] items-center justify-center rounded-xl text-[#94A3B8] transition-colors hover:bg-[#F1F3F5] hover:text-[#0F172A] dark:hover:bg-[#1A1A20] dark:hover:text-[#F8FAFC]"
                        title={i18n.editTradeSuccess || "Edit"}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          isStock
                            ? handleDelete(activity as EnrichedStockTrade)
                            : handleDeleteCrypto(
                                activity as EnrichedCryptoTrade,
                              )
                        }
                        className="flex h-8 w-8 min-h-[36px] min-w-[36px] items-center justify-center rounded-xl text-[#94A3B8] transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
                        title={i18n.deleteSuccess || "Hapus"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Execution Details Row */}
                  <div
                    className={cn(
                      "grid gap-2 rounded-xl bg-[#F8F9FA] p-2.5 text-xs dark:bg-[#1A1A20]",
                      hasPnl
                        ? "grid-cols-2 sm:grid-cols-4"
                        : "grid-cols-2 sm:grid-cols-3",
                    )}
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                        {isEn ? "Volume" : "Volume"}
                      </span>
                      <p className="font-mono text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                        {isStock
                          ? `${(activity as EnrichedStockTrade).lots || 0} Lot (${(activity as EnrichedStockTrade).shares || 0} lbr)`
                          : `${formatCryptoQuantity((activity as EnrichedCryptoTrade).quantity)} ${symbolText}`}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                        {isEn ? "Execution Price" : "Harga Eksekusi"}
                      </span>
                      <p className="font-mono text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                        {isStock
                          ? `${formatCurrency(Number((activity as EnrichedStockTrade).price_per_share || 0), "IDR")}/lbr`
                          : formatCurrency(
                              Number(
                                (activity as EnrichedCryptoTrade)
                                  .price_per_unit || 0,
                              ),
                              "IDR",
                            )}
                      </p>
                    </div>

                    <div className={cn(!hasPnl && "col-span-2 sm:col-span-1")}>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                        {isEn ? "Total Settlement" : "Total Eksekusi"}
                      </span>
                      <p className="font-mono text-xs font-black text-[#0F172A] dark:text-[#F8FAFC]">
                        {formatCurrency(
                          totalAmount,
                          activity.account?.currency || "IDR",
                        )}
                      </p>
                    </div>

                    {hasPnl && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                          Realized P&L
                        </span>
                        <p
                          className={cn(
                            "font-mono text-xs font-black",
                            pnl >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400",
                          )}
                        >
                          {pnl >= 0 ? "+" : ""}
                          {formatCurrency(
                            pnl,
                            activity.account?.currency || "IDR",
                          )}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Notes if any */}
                  {activity.notes && (
                    <p className="text-[11px] italic text-[#64748B] dark:text-[#94A3B8]">
                      &ldquo;{activity.notes}&rdquo;
                    </p>
                  )}
                </div>
              );
            })}

            {filteredActivities.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-white p-12 text-center text-xs text-[#64748B] dark:border-[#27272A] dark:bg-[#121215]">
                <History className="mx-auto mb-2 h-8 w-8 text-[#94A3B8]" />
                <p className="font-bold">
                  {isEn
                    ? "No transactions found"
                    : "Tidak ada transaksi yang cocok"}
                </p>
                <p className="mt-1 text-[11px] text-[#94A3B8]">
                  {isEn
                    ? "Try adjusting your filter or search query."
                    : "Ubah filter atau kata kunci pencarian."}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* TAB 3: REPORTING & ANALYTICS WITH CUSTOM DATE RANGE */}
      {tab === "reporting" && (
        <section className="flex flex-col gap-3.5 sm:gap-4">
          {/* Period Filter Card (Without "last_month", perfectly balanced 4-columns) */}
          <div className="flex flex-col gap-2.5 rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-2xs dark:border-[#27272A] dark:bg-[#121215] sm:p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#94A3B8]" />
              <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {isEn ? "Analysis Period" : "Periode Analisis"}
              </span>
            </div>

            {/* Segmented Controls (4 Equal Columns) */}
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-[#E5E7EB] bg-[#F1F3F5] p-1 dark:border-[#27272A] dark:bg-[#1A1A20] sm:grid-cols-4">
              {(
                [
                  ["all", isEn ? "All Time" : "Semua Waktu"],
                  ["this_month", isEn ? "This Month" : "Bulan Ini"],
                  ["this_year", isEn ? "This Year" : "Tahun Ini"],
                  ["custom", isEn ? "Custom" : "Kustom"],
                ] as const
              ).map(([periodKey, label]) => (
                <button
                  key={periodKey}
                  type="button"
                  onClick={() => setReportPeriod(periodKey)}
                  className={cn(
                    "cursor-pointer rounded-lg px-2.5 py-2 text-center text-xs font-bold transition-all",
                    reportPeriod === periodKey
                      ? "bg-white text-[#0F172A] shadow-xs dark:bg-[#121215] dark:text-[#FAFAFA]"
                      : "text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#FAFAFA]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Custom Date Range Picker Input */}
            {reportPeriod === "custom" && (
              <div className="flex flex-col gap-2 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-3 dark:border-[#27272A] dark:bg-[#1A1A20] sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {isEn ? "Custom Date Interval:" : "Rentang Tanggal:"}
                  </span>
                </span>
                <DateRangePicker
                  startDate={customRange.start}
                  endDate={customRange.end}
                  onChange={(s, e) => setCustomRange({ start: s, end: e })}
                  placeholder={
                    isEn ? "Select date range" : "Pilih rentang tanggal"
                  }
                />
              </div>
            )}
          </div>

          {/* Key Analytics Cards: True Net PnL (Already Net of Costs) */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
            <Summary
              label={isEn ? "Net Realized P&L" : "Laba/Rugi Bersih (P&L)"}
              value={`${reportingStats.netRealizedPnl >= 0 ? "+" : ""}${formatCurrency(reportingStats.netRealizedPnl, "IDR")}`}
              tone={
                reportingStats.netRealizedPnl >= 0 ? "positive" : "negative"
              }
            />

            <Summary
              label={isEn ? "Total Realized Profit" : "Total Cuan Bersih"}
              value={`+${formatCurrency(reportingStats.totalGain, "IDR")}`}
              tone="positive"
            />

            <Summary
              label={isEn ? "Total Cut Loss" : "Total Rugi Bersih"}
              value={`-${formatCurrency(reportingStats.totalLoss, "IDR")}`}
              tone={reportingStats.totalLoss > 0 ? "negative" : "neutral"}
            />

            <Summary
              label={isEn ? "Total Paid Fees" : "Total Biaya Terbayar"}
              value={formatCurrency(reportingStats.totalFees, "IDR")}
              tone="neutral"
            />
          </div>

          {/* Win Rate & Trading Efficiency Card */}
          <div className="flex flex-col gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-3.5 shadow-2xs dark:border-[#27272A] dark:bg-[#121215] sm:p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-emerald-600" />
                <h3 className="text-xs font-black uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
                  {isEn
                    ? "Trading Win Rate & Discipline"
                    : "Win Rate & Hasil Penjualan"}
                </h3>
              </div>
              <span className="font-mono text-sm font-black text-emerald-600 dark:text-emerald-400">
                {reportingStats.winRate}% Win Rate
              </span>
            </div>

            {/* Visual Win/Loss bar */}
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#E5E7EB] dark:bg-[#27272A]">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${reportingStats.winRate}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 text-center text-xs">
              <div className="rounded-xl bg-[#F8F9FA] p-2 dark:bg-[#1A1A20]">
                <span className="text-[10px] text-[#94A3B8]">
                  {isEn ? "Total Closed" : "Total Penjualan"}
                </span>
                <p className="font-mono font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  {reportingStats.totalClosedCount}
                </p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-2 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                <span className="text-[10px]">
                  {isEn ? "Profitable" : "Untung (Cuan)"}
                </span>
                <p className="font-mono font-bold">
                  {reportingStats.winningTradesCount}
                </p>
              </div>
              <div className="rounded-xl bg-rose-50 p-2 text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
                <span className="text-[10px]">
                  {isEn ? "Losses" : "Rugi (Cut Loss)"}
                </span>
                <p className="font-mono font-bold">
                  {reportingStats.losingTradesCount}
                </p>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Donut — Alokasi Portofolio */}
            <div className="flex flex-col gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-2xs dark:border-[#27272A] dark:bg-[#121215]">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
                {isEn ? "Portfolio Allocation" : "Alokasi Portofolio"}
              </h3>
              {allocationData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={allocationData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {allocationData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={
                              ALLOCATION_COLORS[i % ALLOCATION_COLORS.length]
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) =>
                          formatCurrency(Number(value ?? 0), "IDR")
                        }
                        contentStyle={{
                          fontSize: 11,
                          borderRadius: 12,
                          border: "1px solid #E5E7EB",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-1.5">
                    {allocationData.map((d, i) => (
                      <div
                        key={d.name}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-1.5">
                          <div
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{
                              backgroundColor:
                                ALLOCATION_COLORS[i % ALLOCATION_COLORS.length],
                            }}
                          />
                          <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                            {d.name}
                          </span>
                        </div>
                        <span className="font-mono text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                          {totalPortfolioValue > 0
                            ? `${Math.round((d.value / totalPortfolioValue) * 100)}%`
                            : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-center text-xs text-[#94A3B8] py-8">—</p>
              )}
            </div>

            {/* Bar Chart — P&L per Aset */}
            <div className="flex flex-col gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-2xs dark:border-[#27272A] dark:bg-[#121215]">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
                {isEn ? "P&L by Asset" : "P&L per Aset"}
              </h3>
              {pnlBarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={pnlBarData}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                  >
                    <XAxis
                      type="number"
                      domain={["auto", "auto"]}
                      tickFormatter={(v) => {
                        if (Math.abs(v) < 1000)
                          return `${v >= 0 ? "+" : ""}${Math.round(v)}`;
                        return `${v >= 0 ? "+" : ""}${(v / 1000).toFixed(1)}k`;
                      }}
                      tick={{ fontSize: 10, fill: "#94A3B8" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="symbol"
                      tick={{ fontSize: 10, fill: "#94A3B8" }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                    />
                    <Tooltip
                      formatter={(value) => [
                        `${Number(value ?? 0) >= 0 ? "+" : ""}${formatCurrency(Number(value ?? 0), "IDR")}`,
                        "P&L",
                      ]}
                      contentStyle={{
                        fontSize: 11,
                        borderRadius: 12,
                        border: "1px solid #E5E7EB",
                      }}
                    />
                    <Bar dataKey="pnl" radius={[0, 6, 6, 0]}>
                      {pnlBarData.map((d, i) => (
                        <Cell
                          key={i}
                          fill={d.pnl >= 0 ? "#10B981" : "#F43F5E"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-xs text-[#94A3B8] py-8">
                  {isEn ? "No closed trades yet" : "Belum ada transaksi jual"}
                </p>
              )}
            </div>
          </div>

          {/* Line Chart — Kumulatif P&L */}
          {cumulativePnlData.length > 0 && (
            <div className="flex flex-col gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-2xs dark:border-[#27272A] dark:bg-[#121215]">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
                {isEn ? "Cumulative P&L Over Time" : "Tren P&L Kumulatif"}
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={cumulativePnlData}
                  margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#94A3B8" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(d) =>
                      new Date(d).toLocaleDateString(isEn ? "en-US" : "id-ID", {
                        day: "numeric",
                        month: "short",
                      })
                    }
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94A3B8" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => {
                      if (Math.abs(v) < 1000)
                        return `${v >= 0 ? "+" : ""}${Math.round(v)}`;
                      return `${v >= 0 ? "+" : ""}${(v / 1000).toFixed(1)}k`;
                    }}
                  />
                  <Tooltip
                    formatter={(value) => [
                      `${Number(value ?? 0) >= 0 ? "+" : ""}${formatCurrency(Number(value ?? 0), "IDR")}`,
                      isEn ? "Cumulative P&L" : "P&L Kumulatif",
                    ]}
                    labelFormatter={(d) =>
                      new Date(String(d)).toLocaleDateString(
                        isEn ? "en-US" : "id-ID",
                        {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        },
                      )
                    }
                    contentStyle={{
                      fontSize: 11,
                      borderRadius: 12,
                      border: "1px solid #E5E7EB",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#6366F1"
                    strokeWidth={2}
                    dot={cumulativePnlData.length <= 10}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Breakdown Per Aset: "Tau Untung Disini, Rugi Disini" */}
          <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-2xs dark:border-[#27272A] dark:bg-[#121215]">
            <div className="border-b border-[#E5E7EB] px-4 py-3 dark:border-[#27272A]">
              <h2 className="text-sm font-black text-[#0F172A] dark:text-[#F8FAFC]">
                {isEn
                  ? "Asset Breakdown: Profit & Loss Tracker"
                  : "Rincian Per Aset: Pantau Untung & Rugi"}
              </h2>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                {isEn
                  ? "Ranked from your top performers down to assets that resulted in a cut loss."
                  : "Diurutkan dari aset yang menyumbang cuan bersih terbesar hingga aset yang mengalami kerugian."}
              </p>
            </div>

            {reportingStats.assetPerformance.length > 0 ? (
              <div className="divide-y divide-[#E5E7EB] dark:divide-[#27272A]">
                {reportingStats.assetPerformance.map((asset) => {
                  const isProfit = asset.netPnl > 0;
                  return (
                    <div
                      key={asset.symbol}
                      className="flex items-center justify-between gap-3 px-3.5 py-3 sm:px-5 sm:py-3.5"
                    >
                      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                        <AssetLogo kind={asset.kind} symbol={asset.symbol} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-xs text-[#0F172A] dark:text-[#F8FAFC]">
                              {asset.symbol}
                            </span>
                            <span
                              className={cn(
                                "rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider",
                                asset.netPnl > 0
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : asset.netPnl < 0
                                    ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                                    : "bg-[#F1F3F5] text-[#64748B] dark:bg-[#27272A] dark:text-[#94A3B8]",
                              )}
                            >
                              {asset.netPnl > 0
                                ? isEn
                                  ? "PROFIT"
                                  : "UNTUNG"
                                : asset.netPnl < 0
                                  ? isEn
                                    ? "LOSS"
                                    : "RUGI"
                                  : isEn
                                    ? "BREAK EVEN"
                                    : "IMPAS"}
                            </span>
                          </div>
                          <p className="truncate text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                            {asset.tradesCount} {isEn ? "sales" : "penjualan"} ·{" "}
                            {asset.winCount} {isEn ? "wins" : "cuan"}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p
                          className={cn(
                            "font-mono text-xs font-black whitespace-nowrap sm:text-sm",
                            isProfit
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400",
                          )}
                        >
                          {isProfit ? "+" : ""}
                          {formatCurrency(asset.netPnl, "IDR")}
                        </p>
                        <p className="font-mono text-[9px] text-[#94A3B8] whitespace-nowrap sm:text-[10px]">
                          +{formatCurrency(asset.gain, "IDR")} | -
                          {formatCurrency(asset.loss, "IDR")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
                {isEn
                  ? "No closed sales recorded in this period yet."
                  : "Belum ada transaksi penjualan di periode ini."}
              </div>
            )}
          </div>

          {/* Fee & Cost Transparency Breakdown (No squeezed numbers) */}
          <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-2xs dark:border-[#27272A] dark:bg-[#121215]">
            <div className="border-b border-[#E5E7EB] p-3.5 dark:border-[#27272A] sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black text-[#0F172A] dark:text-[#F8FAFC]">
                  {isEn
                    ? "Fee & Cost Transparency"
                    : "Transparansi Biaya Terbayar"}
                </h2>
                <span className="shrink-0 font-mono text-sm font-black text-rose-600 whitespace-nowrap dark:text-rose-400">
                  {formatCurrency(reportingStats.totalFees, "IDR")}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                {isEn
                  ? "All stamp duty, exchange fees, and platform funding costs (already reflected in net P&L)."
                  : "Total bea materai saham, biaya transaksi bursa kripto, dan transfer platform (sudah otomatis terhitung di laba/rugi bersih)."}
              </p>
            </div>

            {reportingStats.feeRecords.length > 0 ? (
              <div className="divide-y divide-[#E5E7EB] dark:divide-[#27272A]">
                {reportingStats.feeRecords.map((detail) => (
                  <div
                    key={detail.id}
                    className="grid gap-1.5 px-3.5 py-3 sm:grid-cols-[120px_1fr_auto] sm:items-center sm:px-4"
                  >
                    <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      {new Date(detail.date).toLocaleDateString(
                        isEn ? "en-US" : "id-ID",
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                        {detail.type}
                      </p>
                      <p className="truncate text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                        {detail.reference}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-bold text-rose-600 whitespace-nowrap dark:text-rose-400">
                      -{formatCurrency(detail.amount, "IDR")}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-6 text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
                {i18n.feesEmpty}
              </p>
            )}
          </div>
        </section>
      )}

      {/* MODAL BUY / SELL / EDIT */}
      <Modal
        isOpen={modal !== null}
        onClose={closeModal}
        title={
          modal === "edit"
            ? assetKind === "crypto"
              ? `${i18n.editCryptoTrade || "Edit Kripto"} · ${editTradeType === "buy" ? i18n.buy : i18n.sell}`
              : `${i18n.modalEditTradeTitle} · ${editTradeType === "buy" ? i18n.buy : i18n.sell}`
            : modal === "buy"
              ? assetKind === "stock"
                ? i18n.modalBuyTitle
                : cryptoI18n.buyTitle
              : assetKind === "stock"
                ? i18n.modalSellTitle
                : cryptoI18n.sellTitle
        }
      >
        <form onSubmit={submitTransaction} className="flex flex-col gap-3.5">
          {modal !== "edit" && !selectedId && (
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#F8F9FA] p-1.5 dark:bg-[#1A1A20]">
              <button
                type="button"
                onClick={() => setAssetKind("stock")}
                className={cn(
                  "min-h-[36px] rounded-lg px-3 py-2 text-xs font-bold transition-all",
                  assetKind === "stock"
                    ? "bg-white text-[#0F172A] shadow-xs dark:bg-[#27272A] dark:text-[#FAFAFA]"
                    : "text-[#64748B]",
                )}
              >
                {i18n.stock}
              </button>
              <button
                type="button"
                onClick={() => setAssetKind("crypto")}
                className={cn(
                  "min-h-[36px] rounded-lg px-3 py-2 text-xs font-bold transition-all",
                  assetKind === "crypto"
                    ? "bg-white text-[#0F172A] shadow-xs dark:bg-[#27272A] dark:text-[#FAFAFA]"
                    : "text-[#64748B]",
                )}
              >
                {i18n.cryptoAsset}
              </button>
            </div>
          )}

          {modal !== "edit" && selectedId && (
            <div className="rounded-xl bg-emerald-50 p-2.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
              {assetKind === "stock" ? ticker || i18n.stock : symbol || "BTC"} ·{" "}
              {modal === "buy" ? i18n.addPosition : i18n.sellPosition}
            </div>
          )}

          <Select
            value={accountId ?? undefined}
            onValueChange={handleAccountChange}
          >
            <SelectTrigger>
              <SelectValue placeholder={i18n.accountFallback} />
            </SelectTrigger>
            <SelectContent>
              {investmentAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name} ·{" "}
                  {formatCurrency(account.current_balance, account.currency)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* STOCK FORM */}
          {assetKind === "stock" ? (
            <>
              {selectedId ? (
                <div className="rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs font-bold dark:border-[#27272A]">
                  {ticker}
                </div>
              ) : (
                <Input
                  label={i18n.tickerLabel}
                  value={ticker}
                  onChange={(event) =>
                    setTicker(event.target.value.toUpperCase())
                  }
                  placeholder={i18n.tickerPlaceholder}
                  required
                />
              )}
              <Input
                label={i18n.lotsLabel}
                type="number"
                step="any"
                min="0.01"
                max={
                  modal === "sell" && selectedStock
                    ? String(
                        Number(selectedStock.lots) ||
                          Number(selectedStock.total_shares) / 100,
                      )
                    : undefined
                }
                value={lots}
                onChange={(event) => setLots(event.target.value)}
                required
              />
              {modal === "buy" ||
              (modal === "edit" && editTradeType === "buy") ? (
                <Input
                  label={i18n.netBuyAmountLabel}
                  type="number"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                />
              ) : modal === "sell" ||
                (modal === "edit" && editTradeType === "sell") ? (
                <>
                  <Input
                    label={
                      isEn ? "Sell price per share" : "Harga jual per saham"
                    }
                    type="number"
                    step="any"
                    min="0.01"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    required
                  />
                  <CalculatedAmount
                    label={isEn ? "Gross sale proceeds" : "Hasil jual bruto"}
                    value={stockSellGrossAmount}
                  />
                </>
              ) : null}
              {modal === "buy" && Number(amount) > 10_000_000 && (
                <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                  {i18n.stampDutyNotice}
                </p>
              )}
            </>
          ) : (
            /* CRYPTO FORM WITH CLEAN HORIZONTAL DOT-SLIDER & FLOATING TOOLTIP */
            <>
              {selectedId ? (
                <div className="rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs font-bold dark:border-[#27272A]">
                  {symbol}
                </div>
              ) : (
                <Input
                  label={cryptoI18n.symbol}
                  value={symbol}
                  onChange={(event) =>
                    setSymbol(event.target.value.toUpperCase())
                  }
                  required
                />
              )}

              {/* CLEAN HORIZONTAL SLIDER WITH GREY BACKGROUND, 25% DOTS, AND FLOATING TOOLTIP */}
              {(modal === "buy" || modal === "sell") && (
                <PercentageSlider
                  value={cryptoPercent}
                  disabled={
                    modal === "buy"
                      ? Number(selectedAccount?.current_balance || 0) <= 0
                      : Number(selectedCrypto?.quantity || 0) <= 0
                  }
                  hint={
                    modal === "buy"
                      ? isEn
                        ? "Account balance is empty"
                        : "Saldo akun kosong"
                      : isEn
                        ? "No asset available"
                        : "Tidak ada aset"
                  }
                  onChange={(val) => {
                    if (modal === "buy") {
                      handleCryptoBuyPercentChange(val);
                    } else {
                      handleCryptoSellPercentChange(val);
                    }
                  }}
                />
              )}

              {modal === "buy" ||
              (modal === "edit" && editTradeType === "buy") ? (
                <Input
                  label={isEn ? "Gross buy amount" : "Nominal bruto pembelian"}
                  type="number"
                  step="any"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    const bal = Number(selectedAccount?.current_balance || 0);
                    if (bal > 0) {
                      setCryptoPercent(
                        Math.min(
                          100,
                          Math.max(
                            0,
                            Math.round(
                              (Number(event.target.value) / bal) * 100,
                            ),
                          ),
                        ),
                      );
                    }
                  }}
                  placeholder="Contoh: 5000000"
                  required
                />
              ) : (
                <Input
                  label={`${cryptoI18n.quantity} (${symbol})`}
                  type="number"
                  step="any"
                  min="0.00000001"
                  value={quantity}
                  onChange={(event) => {
                    setQuantity(event.target.value);
                    if (selectedCrypto) {
                      const maxQty = Number(selectedCrypto.quantity || 0);
                      if (maxQty > 0) {
                        setCryptoPercent(
                          Math.min(
                            100,
                            Math.max(
                              0,
                              Math.round(
                                (Number(event.target.value) / maxQty) * 100,
                              ),
                            ),
                          ),
                        );
                      }
                    }
                  }}
                  required
                />
              )}

              <Input
                label={`${isEn ? "Price per" : "Harga per"} ${symbol || "asset"} (${
                  modal === "buy" ||
                  (modal === "edit" && editTradeType === "buy")
                    ? isEn
                      ? "buy"
                      : "beli"
                    : isEn
                      ? "sell"
                      : "jual"
                })`}
                type="number"
                step="any"
                min="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                required
              />

              {modal === "buy" ||
              (modal === "edit" && editTradeType === "buy") ? (
                <p className="rounded-xl bg-emerald-50 p-3 font-mono text-sm font-bold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                  {isEn
                    ? `Quantity ${symbol} calculated automatically`
                    : `Jumlah ${symbol} dihitung otomatis`}
                  :{" "}
                  {cryptoQuantity > 0
                    ? cryptoQuantity.toFixed(8).replace(/\.?0+$/, "")
                    : "—"}{" "}
                  {symbol}
                </p>
              ) : (
                <CalculatedAmount
                  label={
                    isEn
                      ? "Gross sale proceeds (calculated)"
                      : "Hasil jual bruto (dihitung otomatis)"
                  }
                  value={cryptoSellGrossAmount}
                />
              )}

              <Input
                label={cryptoI18n.fee}
                type="number"
                step="any"
                min="0"
                value={fee}
                onChange={(event) => setFee(event.target.value)}
                placeholder="0"
              />
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {i18n.tradeDateLabel}
            </label>
            <DatePicker value={date} onChange={setDate} clearable={false} />
          </div>

          <Input
            label={i18n.notesLabel}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={i18n.notesPlaceholder}
          />

          <Button type="submit" disabled={busy} className="min-h-[44px]">
            {busy
              ? i18n.saving
              : modal === "edit"
                ? i18n.updateTradeBtn
                : i18n.saveSuccess}
          </Button>
        </form>
      </Modal>

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        title={
          isEn ? "Delete investment transaction" : "Hapus transaksi investasi"
        }
        message={
          isEn
            ? "This will delete the record and recalculate the related balance and holding. Continue?"
            : "Catatan ini akan dihapus dan saldo serta kepemilikan terkait akan dihitung ulang. Lanjutkan?"
        }
      />
    </div>
  );
}

/**
 * Clean Horizontal Slider powered by Radix UI with 25% Interval Dots and Thumb-locked Floating Tooltip
 */
function PercentageSlider({
  value,
  onChange,
  disabled = false,
  hint,
}: {
  value: number;
  onChange: (val: number) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const dots = [0, 25, 50, 75, 100];
  const safeValue = Math.min(100, Math.max(0, value));

  return (
    <div
      className={cn(
        "w-full pt-6 pb-1",
        disabled && "opacity-40 pointer-events-none",
      )}
    >
      <div className="relative w-full">
        {/* Floating tooltip above thumb */}
        <div
          className="pointer-events-none absolute -top-7 whitespace-nowrap rounded-md bg-[#0F172A] px-1.5 py-0.5 font-mono text-[10px] font-black text-white shadow-xs dark:bg-[#FAFAFA] dark:text-[#0F172A]"
          style={{
            left: `${safeValue}%`,
            transform: `translateX(${safeValue === 0 ? "0%" : safeValue === 100 ? "-100%" : "-50%"})`,
          }}
        >
          {safeValue}%
        </div>

        {/* Track background */}
        <div className="relative h-1.5 w-full rounded-full bg-[#E5E7EB] dark:bg-[#27272A]">
          {/* Filled range */}
          <div
            className="absolute h-full rounded-full bg-emerald-600 dark:bg-emerald-500"
            style={{ width: `${safeValue}%` }}
          />
        </div>

        {/* Dot markers (decorative, clickable) */}
        {dots.map((dot) => (
          <button
            key={dot}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(dot);
            }}
            className={cn(
              "absolute top-0 -translate-y-1/4 h-2.5 w-2.5 rounded-full border-2 transition-all cursor-pointer z-10",
              safeValue >= dot
                ? "border-emerald-600 bg-white dark:border-emerald-400 dark:bg-[#121215]"
                : "border-[#D1D5DB] bg-white dark:border-[#3F3F46] dark:bg-[#1A1A20]",
            )}
            style={{
              left: `calc(${dot}% - ${dot === 0 ? "0px" : dot === 100 ? "10px" : "5px"})`,
            }}
            title={`${dot}%`}
          />
        ))}

        {/* Native range input — sits on top, invisible, handles drag */}
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={safeValue}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-grab active:cursor-grabbing z-20 h-full"
          style={{ margin: 0 }}
        />

        <div
          className="absolute top-0 -translate-y-1/4 z-10 h-4 w-4 rounded-full border-2 border-white bg-emerald-600 shadow-md pointer-events-none dark:border-[#121215] dark:bg-emerald-400"
          style={{
            left: `calc(${safeValue}% - ${safeValue === 0 ? "0px" : safeValue === 100 ? "16px" : "8px"})`,
          }}
        />
      </div>

      {/* Label row */}
      <div className="relative mt-2 h-4 text-[9px] font-bold text-[#94A3B8]">
        {disabled && hint ? (
          <span className="italic">{hint}</span>
        ) : (
          dots.map((dot) => (
            <button
              key={dot}
              type="button"
              onClick={() => onChange(dot)}
              className="absolute cursor-pointer transition-colors hover:text-[#0F172A] dark:hover:text-[#FAFAFA]"
              style={{
                left: `${dot}%`,
                transform: `translateX(${dot === 0 ? "0%" : dot === 100 ? "-100%" : "-50%"})`,
              }}
            >
              {dot}%
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function CalculatedAmount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30">
      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm font-bold text-emerald-800 dark:text-emerald-200">
        {value > 0 ? formatCurrency(value, "IDR") : "—"}
      </p>
    </div>
  );
}

function formatCryptoQuantity(value: number | string): string {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "—";
  return numericValue.toFixed(8).replace(/\.?0+$/, "");
}

function useAssetColor(src: string | null, fallback: string) {
  const [color, setColor] = useState(fallback);

  useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, img.width, img.height);

      let r = 0,
        g = 0,
        b = 0,
        count = 0;
      for (let i = 0; i < data.length; i += 16) {
        const alpha = data[i + 3];
        if (alpha < 128) continue;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }
      if (count === 0) return;
      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);

      const pastel = (c: number) => Math.round(c * 0.4 + 255 * 0.6);
      setColor(`rgb(${pastel(r)}, ${pastel(g)}, ${pastel(b)})`);
    };
  }, [src]);

  return color;
}

function Summary({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-2xs dark:border-[#27272A] dark:bg-[#121215] sm:p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
        {label}
      </p>
      <p
        title={value}
        className={cn(
          "mt-1 font-mono text-xs font-black leading-tight sm:text-base",
          tone === "positive"
            ? "text-emerald-600 dark:text-emerald-400"
            : tone === "negative"
              ? "text-rose-600 dark:text-rose-400"
              : "text-[#0F172A] dark:text-[#F8FAFC]",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function StockCard({
  holding,
  onBuy,
  onSell,
}: {
  holding: EnrichedStockHolding;
  onBuy: () => void;
  onSell: () => void;
}) {
  const { t, language } = useLanguage();
  const i18n = t.investments;
  const isEn = language === "en";
  const lots = Number(holding.lots) || Number(holding.total_shares) / 100;

  const publishableKey = process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY;
  const logoUrl = publishableKey
    ? `https://img.logo.dev/ticker/${holding.ticker.toLowerCase()}.jk?token=${publishableKey}`
    : null;
  const headerBg = useAssetColor(logoUrl, "rgb(224, 231, 255)");

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-2xs dark:border-[#27272A] dark:bg-[#121215]">
      <div
        className="flex items-center justify-between gap-3 px-5 py-4"
        style={{ backgroundColor: headerBg }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <AssetLogo kind="stock" symbol={holding.ticker} />
          <div className="min-w-0">
            <p className="font-black text-sm text-[#0F172A] dark:text-[#F8FAFC]">
              {holding.ticker}
            </p>
            <p className="truncate text-[10px] text-indigo-800/70 dark:text-indigo-200/70">
              {i18n.stock}
            </p>
          </div>
        </div>
        <span className="truncate text-right text-xs font-medium text-indigo-900 dark:text-indigo-100">
          {holding.account?.name || "RDN"}
        </span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-3">
          <AssetMetric label={i18n.quantityLabel} value={`${lots} lot`} />
          <AssetMetric
            label={i18n.capitalLabel}
            value={formatCurrency(
              Number(holding.total_cost),
              holding.account?.currency,
            )}
            align="right"
          />
          <div className="col-span-2 flex items-baseline justify-between border-t border-[#E5E7EB] pt-2.5 dark:border-[#27272A]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
              {isEn ? "Avg Price / Share" : "Harga Rata-rata / Lembar"}
            </p>
            <p className="font-mono text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              {Number(holding.avg_buy_price) > 0
                ? `${formatCurrency(Number(holding.avg_buy_price), holding.account?.currency)} / lbr`
                : "—"}
            </p>
          </div>
        </div>
        <AssetActions onBuy={onBuy} onSell={onSell} />
      </div>
    </div>
  );
}
function CryptoCard({
  holding,
  onBuy,
  onSell,
}: {
  holding: EnrichedCryptoHolding;
  onBuy: () => void;
  onSell: () => void;
}) {
  const { t, language } = useLanguage();
  const i18n = t.investments;
  const isEn = language === "en";

  const publishableKey = process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY;
  const logoUrl = publishableKey
    ? `https://img.logo.dev/crypto/${holding.symbol.toLowerCase()}?token=${publishableKey}`
    : null;
  const headerBg = useAssetColor(logoUrl, "rgb(253, 244, 208)");

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-2xs dark:border-[#27272A] dark:bg-[#121215]">
      <div
        className="flex items-center justify-between gap-3 px-5 py-4"
        style={{ backgroundColor: headerBg }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <AssetLogo kind="crypto" symbol={holding.symbol} />
          <div className="min-w-0">
            <p className="font-black text-sm text-[#0F172A] dark:text-[#F8FAFC]">
              {holding.symbol}
            </p>
            <p className="truncate text-[10px] text-[#704500]/75 dark:text-[#FFE9B0]/75">
              {i18n.cryptoAsset}
            </p>
          </div>
        </div>
        <span className="truncate text-right text-xs font-medium text-[#704500] dark:text-[#FFE9B0]">
          {holding.account?.name || i18n.accountFallback}
        </span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-3">
          <AssetMetric
            label={i18n.quantityLabel}
            value={`${formatCryptoQuantity(holding.quantity)} ${holding.symbol}`}
            valueClassName="break-all"
          />
          <AssetMetric
            label={i18n.capitalLabel}
            value={formatCurrency(
              Number(holding.cost_basis),
              holding.price_currency,
            )}
            align="right"
          />
          <div className="col-span-2 flex items-baseline justify-between border-t border-[#E5E7EB] pt-2.5 dark:border-[#27272A]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
              {isEn
                ? `Avg Buy Price / ${holding.symbol}`
                : `Harga Rata-rata / ${holding.symbol}`}
            </p>
            <p className="font-mono text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              {Number(holding.average_buy_price) > 0
                ? formatCurrency(
                    Number(holding.average_buy_price),
                    holding.price_currency,
                  )
                : "—"}
            </p>
          </div>
        </div>
        <AssetActions onBuy={onBuy} onSell={onSell} />
      </div>
    </div>
  );
}
function AssetLogo({
  kind,
  symbol,
}: {
  kind: "stock" | "crypto";
  symbol: string;
}) {
  const [hasError, setHasError] = useState(false);
  const normalizedSymbol = symbol.trim().toLowerCase();
  const publishableKey = process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY;
  const identifier =
    kind === "stock" ? `${normalizedSymbol}.jk` : normalizedSymbol;
  const logoUrl = publishableKey
    ? `https://img.logo.dev/${kind === "stock" ? "ticker" : "crypto"}/${encodeURIComponent(identifier)}?token=${encodeURIComponent(publishableKey)}`
    : null;

  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full shadow-2xs sm:h-9 sm:w-9",
        kind === "stock"
          ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
          : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
      )}
    >
      {!hasError && logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setHasError(true)}
        />
      ) : (
        <Coins className="h-4 w-4 sm:h-5 sm:w-5" />
      )}
    </div>
  );
}

function AssetMetric({
  label,
  value,
  valueClassName = "",
  align = "left",
}: {
  label: string;
  value: string;
  valueClassName?: string;
  align?: "left" | "right";
}) {
  return (
    <div
      className={cn("min-w-0", align === "right" ? "text-right" : "text-left")}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-mono text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]",
          valueClassName,
        )}
      >
        {value}
      </p>
    </div>
  );
}
function AssetActions({
  onBuy,
  onSell,
}: {
  onBuy: () => void;
  onSell: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="mt-3.5 flex gap-2 border-t border-[#E5E7EB] pt-3 dark:border-[#27272A] sm:mt-4">
      <button
        type="button"
        onClick={onBuy}
        className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-xs font-bold text-[#0F172A] transition-all hover:bg-[#F8F9FA] dark:border-[#3F3F46] dark:bg-[#121215] dark:text-[#F8FAFC] dark:hover:bg-[#1A1A20] sm:min-h-[44px]"
      >
        <Plus className="h-3.5 w-3.5" />
        {t.investments.buy}
      </button>
      <button
        type="button"
        onClick={onSell}
        className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-xs font-bold text-[#0F172A] transition-all hover:bg-[#F8F9FA] dark:border-[#3F3F46] dark:bg-[#121215] dark:text-[#F8FAFC] dark:hover:bg-[#1A1A20] sm:min-h-[44px]"
      >
        <ArrowUpRight className="h-3.5 w-3.5" />
        {t.investments.sell}
      </button>
    </div>
  );
}
