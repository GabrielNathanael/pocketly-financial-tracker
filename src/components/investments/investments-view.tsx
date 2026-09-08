"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  EnrichedStockHolding,
  EnrichedStockTrade,
  Account,
} from "@/types/database";
import {
  recordStockBuy,
  recordStockSell,
  updateStockTrade,
  deleteStockTrade,
} from "@/actions/investments";
import { useLanguage } from "@/lib/i18n/language-context";
import { formatCurrency, convertAmount } from "@/lib/utils/currency";
import {
  TrendingUp,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  Wallet,
  Calendar,
  Trash2,
  Edit2,
  AlertCircle,
  Clock,
  Coins,
  Layers,
  Search,
  FileCheck2,
  Info,
  Scale,
  LayoutGrid,
  Table as TableIcon,
  PieChart,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePreferredCurrency } from "@/lib/storage/preferred-currency";
import { getLocalDateString } from "@/lib/utils/date";

interface InvestmentsViewProps {
  holdings: EnrichedStockHolding[];
  trades: EnrichedStockTrade[];
  accounts: Account[];
  exchangeRate?: number;
}

const PALETTE = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-sky-500",
  "bg-purple-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-orange-500",
];

export function InvestmentsView({
  holdings,
  trades,
  accounts,
  exchangeRate = 15800,
}: InvestmentsViewProps) {
  const { t, language } = useLanguage();
  const router = useRouter();
  const displayCurrency = usePreferredCurrency();

  // Filter RDN accounts (strictly accounts with type === 'investment')
  const rdnAccounts = accounts.filter(
    (a) => a.type === "investment" && a.is_active,
  );

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<"holdings" | "trades" | "stamp_duty">("holdings");
  // Holdings View Mode: Grid Cards vs Pro Table
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  // Selected Account Filter
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");

  // Filter & Search states for Trades
  const [tradeFilter, setTradeFilter] = useState<"all" | "buy" | "sell" | "stamp_only">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [tradesDisplayLimit, setTradesDisplayLimit] = useState(25);

  // Modals state
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [selectedHoldingForSell, setSelectedHoldingForSell] =
    useState<EnrichedStockHolding | null>(null);
  const [selectedTradeForDetail, setSelectedTradeForDetail] =
    useState<EnrichedStockTrade | null>(null);

  // Buy Form State
  const [buyAccountId, setBuyAccountId] = useState<string>(
    rdnAccounts[0]?.id || "",
  );
  const [buyTicker, setBuyTicker] = useState("");
  const [buyLots, setBuyLots] = useState<string>("1");
  const [buyNetAmount, setBuyNetAmount] = useState("");
  const [buyNotes, setBuyNotes] = useState("");
  const [buyDate, setBuyDate] = useState(getLocalDateString());
  const [isSubmittingBuy, setIsSubmittingBuy] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);

  // Sell Form State
  const [sellHoldingId, setSellHoldingId] = useState<string>("");
  const [sellLots, setSellLots] = useState<string>("1");
  const [sellNetAmount, setSellNetAmount] = useState("");
  const [sellNotes, setSellNotes] = useState("");
  const [sellDate, setSellDate] = useState(getLocalDateString());
  const [isSubmittingSell, setIsSubmittingSell] = useState(false);
  const [sellError, setSellError] = useState<string | null>(null);

  // Edit Trade State
  const [isEditTradeModalOpen, setIsEditTradeModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<EnrichedStockTrade | null>(
    null,
  );
  const [editTicker, setEditTicker] = useState("");
  const [editLots, setEditLots] = useState("");
  const [editNetAmount, setEditNetAmount] = useState("");
  const [editTradeDate, setEditTradeDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [isSubmittingEditTrade, setIsSubmittingEditTrade] = useState(false);
  const [editTradeError, setEditTradeError] = useState<string | null>(null);

  // Filtered Holdings by Account
  const filteredHoldings = useMemo(() => {
    if (selectedAccountId === "all") return holdings;
    return holdings.filter((h) => h.account_id === selectedAccountId);
  }, [holdings, selectedAccountId]);

  // Calculations in displayCurrency
  let totalStockCost = 0;
  holdings.forEach((h) => {
    const acc = h.account;
    totalStockCost += convertAmount(
      Number(h.total_cost),
      acc?.currency || "IDR",
      displayCurrency,
      exchangeRate,
    );
  });

  let totalRdnCash = 0;
  rdnAccounts.forEach((acc) => {
    if (selectedAccountId === "all" || acc.id === selectedAccountId) {
      totalRdnCash += convertAmount(
        Number(acc.current_balance),
        acc.currency,
        displayCurrency,
        exchangeRate,
      );
    }
  });

  let totalRealizedProfit = 0;
  let totalRealizedLoss = 0;
  let totalStampDutyPaid = 0;
  let winningTradesCount = 0;
  let totalClosedTrades = 0;

  trades.forEach((trade) => {
    totalStampDutyPaid += Number(trade.stamp_duty) || 0;
    if (trade.type === "sell") {
      totalClosedTrades++;
      const pnl = Number(trade.realized_pnl) || 0;
      const acc = trade.account;
      const pnlConverted = convertAmount(
        pnl,
        acc?.currency || "IDR",
        displayCurrency,
        exchangeRate,
      );
      if (pnlConverted >= 0) {
        totalRealizedProfit += pnlConverted;
        winningTradesCount++;
      } else {
        totalRealizedLoss += Math.abs(pnlConverted);
      }
    }
  });

  const netTradingPnl = totalRealizedProfit - totalRealizedLoss;
  const totalPortfolioValue = totalStockCost + totalRdnCash;
  const winRate = totalClosedTrades > 0 ? (winningTradesCount / totalClosedTrades) * 100 : 0;

  // Daily Trading Volume & Stamp Duty (Bea Materai Rp 10.000) Tracker for Today
  const todayDateStr = getLocalDateString();
  const todayTrades = trades.filter((tItem) =>
    tItem.trade_date?.startsWith(todayDateStr),
  );
  const todayTradingVolume = todayTrades.reduce(
    (acc, tItem) => acc + (Number(tItem.net_amount) || 0),
    0,
  );
  const isTodayStampDutyTriggered = todayTradingVolume > 10_000_000;

  // Asset Allocation breakdown
  const allocationItems = useMemo(() => {
    if (totalPortfolioValue <= 0) return [];
    const items: { label: string; value: number; percent: number; color: string }[] = [];

    holdings.forEach((h, idx) => {
      const val = convertAmount(
        Number(h.total_cost),
        h.account?.currency || "IDR",
        displayCurrency,
        exchangeRate,
      );
      const pct = (val / totalPortfolioValue) * 100;
      if (pct > 0.1) {
        items.push({
          label: h.ticker,
          value: val,
          percent: pct,
          color: PALETTE[idx % PALETTE.length],
        });
      }
    });

    if (totalRdnCash > 0) {
      items.push({
        label: t.investments.rdnCash,
        value: totalRdnCash,
        percent: (totalRdnCash / totalPortfolioValue) * 100,
        color: "bg-slate-400 dark:bg-slate-600",
      });
    }

    return items;
  }, [holdings, totalPortfolioValue, totalRdnCash, displayCurrency, exchangeRate, t]);

  // Stamp Duty Audit Days
  const stampDutyDays = useMemo(() => {
    const daysMap = new Map<string, { date: string; volume: number; duty: number; count: number }>();
    trades.forEach((tr) => {
      const d = tr.trade_date ? tr.trade_date.split("T")[0] : "";
      if (!d) return;
      const prev = daysMap.get(d) || { date: d, volume: 0, duty: 0, count: 0 };
      prev.volume += Number(tr.net_amount) || 0;
      prev.duty += Number(tr.stamp_duty) || 0;
      prev.count += 1;
      daysMap.set(d, prev);
    });
    return Array.from(daysMap.values())
      .filter((item) => item.duty > 0 || item.volume > 10_000_000)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [trades]);

  // Helper for selected holding in sell modal
  const activeSellHolding =
    holdings.find((h) => h.id === sellHoldingId) || selectedHoldingForSell;

  const currentHoldingLots =
    activeSellHolding
      ? Number(activeSellHolding.lots) ||
        (Number(activeSellHolding.total_shares) / 100 ||
          (Number(activeSellHolding.total_cost) > 0 ? 1 : 0))
      : 0;

  const currentHoldingTotalCost = activeSellHolding
    ? Number(activeSellHolding.total_cost) || 0
    : 0;

  const currentHoldingAvgPrice =
    activeSellHolding && currentHoldingLots > 0
      ? Number(activeSellHolding.avg_buy_price) ||
        currentHoldingTotalCost / (currentHoldingLots * 100)
      : 0;

  // Real-time calculations for Sell Modal
  const numSellLots = parseFloat(sellLots) || 0;
  const numSellNetAmount = parseFloat(sellNetAmount) || 0;
  const isFullSell = numSellLots >= currentHoldingLots - 0.0001 && currentHoldingLots > 0;
  const estSellCostBasis =
    currentHoldingLots > 0
      ? (numSellLots / currentHoldingLots) * currentHoldingTotalCost
      : 0;
  const estRealizedPnl =
    numSellNetAmount > 0 && estSellCostBasis > 0
      ? numSellNetAmount - estSellCostBasis
      : 0;
  const estPnlPercent =
    estSellCostBasis > 0 && numSellNetAmount > 0
      ? ((numSellNetAmount - estSellCostBasis) / estSellCostBasis) * 100
      : 0;

  // Real-time calculations for Buy Modal
  const numBuyLots = parseFloat(buyLots) || 0;
  const numBuyNetAmount = parseFloat(buyNetAmount) || 0;
  const estBuyPricePerShare =
    numBuyLots > 0 && numBuyNetAmount > 0
      ? numBuyNetAmount / (numBuyLots * 100)
      : 0;

  // Quick lot percentage setter for Sell Modal
  const handleSetSellPercent = (pct: number) => {
    if (!currentHoldingLots) return;
    if (pct === 100) {
      setSellLots(String(currentHoldingLots));
    } else {
      const calculatedLots = Math.max(1, Math.floor((currentHoldingLots * pct) / 100));
      setSellLots(String(calculatedLots));
    }
  };

  // Open Buy modal for specific ticker
  const handleOpenBuyForTicker = (holding: EnrichedStockHolding) => {
    setBuyAccountId(holding.account_id || rdnAccounts[0]?.id || "");
    setBuyTicker(holding.ticker);
    setBuyLots("1");
    setBuyNetAmount("");
    setBuyNotes("");
    setBuyDate(getLocalDateString());
    setBuyError(null);
    setIsBuyModalOpen(true);
  };

  // Open Sell Modal
  const handleOpenSell = (holding: EnrichedStockHolding) => {
    setSelectedHoldingForSell(holding);
    setSellHoldingId(holding.id);
    const holdLots =
      Number(holding.lots) ||
      (Number(holding.total_shares) / 100 || 1);
    setSellLots(String(holdLots));
    setSellNetAmount("");
    setSellNotes("");
    setSellDate(getLocalDateString());
    setSellError(null);
    setIsSellModalOpen(true);
  };

  // Submit Buy
  const handleBuySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBuyError(null);

    if (!buyAccountId) {
      setBuyError(language === "en" ? "Please select a payment account (RDN)" : "Pilih akun pembayaran (RDN)");
      return;
    }
    if (!buyTicker.trim()) {
      setBuyError(language === "en" ? "Stock ticker is required" : "Kode saham wajib diisi");
      return;
    }
    if (numBuyLots <= 0) {
      setBuyError(language === "en" ? "Lot quantity must be greater than 0" : "Jumlah lot harus lebih besar dari 0");
      return;
    }
    if (numBuyNetAmount <= 0) {
      setBuyError(language === "en" ? "Total purchase amount must be greater than 0" : "Total nominal pembelian harus lebih besar dari 0");
      return;
    }

    setIsSubmittingBuy(true);
    try {
      const res = await recordStockBuy({
        accountId: buyAccountId,
        ticker: buyTicker,
        lots: numBuyLots,
        netAmount: numBuyNetAmount,
        notes: buyNotes.trim() || null,
        tradeDate: buyDate,
      });

      if (res.error) {
        setBuyError(res.error);
        toast.error(language === "en" ? "Failed to Record Purchase" : "Gagal Mencatat Pembelian", { description: res.error });
      } else {
        toast.success(
          res.stampDutyApplied
            ? language === "en"
              ? "Stock purchase recorded! (Including Rp 10,000 Stamp Duty)"
              : "Pembelian saham dicatat! (Termasuk Bea Materai Rp 10.000)"
            : t.investments.saveSuccess,
        );
        setIsBuyModalOpen(false);
        setBuyTicker("");
        setBuyLots("1");
        setBuyNetAmount("");
        setBuyNotes("");
        router.refresh();
      }
    } catch (err: any) {
      setBuyError(err.message);
    } finally {
      setIsSubmittingBuy(false);
    }
  };

  // Submit Sell
  const handleSellSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSellError(null);

    const holding =
      holdings.find((h) => h.id === sellHoldingId) || selectedHoldingForSell;
    if (!holding) {
      setSellError(language === "en" ? "Please select a stock to sell" : "Pilih saham yang ingin dijual");
      return;
    }
    if (numSellLots <= 0) {
      setSellError(language === "en" ? "Lots to sell must be greater than 0" : "Jumlah lot yang dijual harus lebih dari 0");
      return;
    }
    if (numSellNetAmount <= 0) {
      setSellError(language === "en" ? "Net proceeds must be greater than 0" : "Nominal penerimaan bersih harus lebih dari 0");
      return;
    }

    setIsSubmittingSell(true);
    try {
      const res = await recordStockSell({
        holdingId: holding.id,
        lots: numSellLots,
        netAmount: numSellNetAmount,
        notes: sellNotes.trim() || null,
        tradeDate: sellDate,
      });

      if (res.error) {
        setSellError(res.error);
        toast.error(language === "en" ? "Failed to Record Sale" : "Gagal Mencatat Penjualan", { description: res.error });
      } else {
        const pnl = res.realizedPnl || 0;
        const isProfit = pnl >= 0;
        toast.success(t.investments.sellSuccess, {
          description: isProfit
            ? `${language === "en" ? "Realized Gain" : "Cuan Realized"}: +${formatCurrency(pnl, holding.account?.currency || "IDR")}`
            : `${language === "en" ? "Cut Loss" : "Cut Loss"}: ${formatCurrency(pnl, holding.account?.currency || "IDR")}`,
        });
        setIsSellModalOpen(false);
        setSelectedHoldingForSell(null);
        setSellHoldingId("");
        setSellLots("1");
        setSellNetAmount("");
        router.refresh();
      }
    } catch (err: any) {
      setSellError(err.message);
    } finally {
      setIsSubmittingSell(false);
    }
  };

  // Delete Trade
  const handleDeleteTrade = async (tradeId: string) => {
    if (!confirm(t.investments.deleteConfirm)) return;
    try {
      const res = await deleteStockTrade(tradeId);
      if (res.error) {
        toast.error(language === "en" ? "Failed to Delete Transaction" : "Gagal Menghapus Transaksi", { description: res.error });
      } else {
        toast.success(t.investments.deleteSuccess);
        router.refresh();
      }
    } catch (err: any) {
      toast.error(language === "en" ? "An Error Occurred" : "Terjadi Kesalahan", { description: err.message });
    }
  };

  // Open Edit Trade Modal
  const handleOpenEditTrade = (trade: EnrichedStockTrade) => {
    setEditingTrade(trade);
    setEditTicker(trade.ticker);
    setEditLots(String(trade.lots || (Number(trade.shares) / 100 || 1)));
    setEditNetAmount(String(trade.net_amount));
    setEditTradeDate(getLocalDateString(trade.trade_date));
    setEditNotes(trade.notes || "");
    setEditTradeError(null);
    setIsEditTradeModalOpen(true);
  };

  // Submit Edit Trade
  const handleEditTradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrade) return;
    const numAmount = parseFloat(editNetAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setEditTradeError(language === "en" ? "Transaction amount must be greater than 0" : "Nominal transaksi harus lebih besar dari 0");
      return;
    }
    const numEditLots = parseFloat(editLots) || 0;

    setIsSubmittingEditTrade(true);
    setEditTradeError(null);
    try {
      const res = await updateStockTrade({
        id: editingTrade.id,
        ticker: editTicker,
        lots: numEditLots > 0 ? numEditLots : undefined,
        netAmount: numAmount,
        notes: editNotes.trim() || null,
        tradeDate: editTradeDate,
      });

      if (res.error) {
        setEditTradeError(res.error);
        toast.error(language === "en" ? "Failed to Update Transaction" : "Gagal Mengupdate Transaksi", { description: res.error });
      } else {
        toast.success(t.investments.editTradeSuccess);
        setIsEditTradeModalOpen(false);
        setEditingTrade(null);
        router.refresh();
      }
    } catch (err: any) {
      setEditTradeError(err.message);
    } finally {
      setIsSubmittingEditTrade(false);
    }
  };

  // Filtered trades list
  const filteredTrades = useMemo(() => {
    return trades.filter((tr) => {
      if (selectedAccountId !== "all" && tr.account_id !== selectedAccountId) return false;
      if (tradeFilter === "buy" && tr.type !== "buy") return false;
      if (tradeFilter === "sell" && tr.type !== "sell") return false;
      if (tradeFilter === "stamp_only" && (Number(tr.stamp_duty) || 0) === 0) return false;
      if (
        searchQuery &&
        !tr.ticker.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !tr.account?.name.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [trades, tradeFilter, searchQuery, selectedAccountId]);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-16 px-1 sm:px-2">
      {/* 1. HERO COMMAND CENTER */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-xs flex flex-col gap-5">
        {/* Top Bar: Title, Filters & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-4 border-b border-[#E5E7EB] dark:border-[#27272A]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
                {t.investments.title}
              </h1>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                {t.investments.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {/* Account Selector */}
            {rdnAccounts.length > 1 && (
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="w-full sm:w-44 h-8 text-xs">
                  <SelectValue placeholder={t.investments.allAccounts} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.investments.allAccounts}</SelectItem>
                  {rdnAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Main Buy Button (Full width on mobile, no DCA in parens) */}
            <button
              type="button"
              onClick={() => {
                setBuyError(null);
                setBuyTicker("");
                setBuyLots("1");
                setBuyNetAmount("");
                setBuyNotes("");
                setIsBuyModalOpen(true);
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 sm:py-1.5 rounded-xl bg-[#0F172A] dark:bg-[#FAFAFA] text-white dark:text-[#0F172A] text-xs font-bold hover:opacity-90 active:scale-95 transition-all shadow-2xs cursor-pointer"
            >
              <Plus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span>{t.investments.buyBtn}</span>
            </button>
          </div>
        </div>

        {/* Portfolio Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Total Portfolio Value */}
          <div className="p-3.5 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB]/70 dark:border-[#27272A]/70 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block">
              {t.investments.totalPortfolio}
            </span>
            <div className="tnum font-black text-base sm:text-lg text-[#0F172A] dark:text-[#F8FAFC] mt-1">
              {formatCurrency(totalPortfolioValue, displayCurrency)}
            </div>
            <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8] mt-1 flex items-center justify-between">
              <span>{formatCurrency(totalStockCost, displayCurrency)}</span>
              <span>Kas: {formatCurrency(totalRdnCash, displayCurrency)}</span>
            </div>
          </div>

          {/* Realized PnL */}
          <div className="p-3.5 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB]/70 dark:border-[#27272A]/70 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                {t.investments.netPnl}
              </span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded text-[9px] font-bold uppercase",
                  netTradingPnl >= 0
                    ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                    : "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300",
                )}
              >
                {t.investments.winRate}: {winRate.toFixed(0)}%
              </span>
            </div>
            <div
              className={cn(
                "tnum font-black text-base sm:text-lg mt-1",
                netTradingPnl >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400",
              )}
            >
              {netTradingPnl >= 0 ? "+" : ""}
              {formatCurrency(netTradingPnl, displayCurrency)}
            </div>
            <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] mt-1">
              {t.investments.fromSales} {totalClosedTrades} {t.investments.salesCount}
            </span>
          </div>

          {/* Kas Mengendap di RDN */}
          <div className="p-3.5 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB]/70 dark:border-[#27272A]/70 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block">
              {t.investments.readyToBuy}
            </span>
            <div className="tnum font-black text-base sm:text-lg text-teal-600 dark:text-teal-400 mt-1">
              {formatCurrency(totalRdnCash, displayCurrency)}
            </div>
            <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] mt-1">
              {t.investments.availableInAccounts} {rdnAccounts.length} {t.investments.accountsText}
            </span>
          </div>

          {/* Daily Stamp Duty Status */}
          <div className="p-3.5 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB]/70 dark:border-[#27272A]/70 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                {t.investments.dailyStampDuty}
              </span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded text-[9px] font-bold uppercase",
                  isTodayStampDutyTriggered
                    ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                    : "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
                )}
              >
                {isTodayStampDutyTriggered ? t.investments.stampCharged : t.investments.stampFree}
              </span>
            </div>
            <div className="tnum font-bold text-xs sm:text-sm text-[#0F172A] dark:text-[#F8FAFC] mt-1">
              {formatCurrency(todayTradingVolume, "IDR")}{" "}
              <span className="text-[10px] text-[#94A3B8] font-normal">/ 10 Jt</span>
            </div>
            <div className="w-full bg-[#E5E7EB] dark:bg-[#27272A] h-1.5 rounded-full overflow-hidden mt-1.5">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  isTodayStampDutyTriggered ? "bg-amber-500" : "bg-emerald-500",
                )}
                style={{
                  width: `${Math.min(100, (todayTradingVolume / 10_000_000) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Visual Asset Allocation Bar */}
        {allocationItems.length > 0 && (
          <div className="flex flex-col gap-2 pt-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8]">
              <span className="flex items-center gap-1.5">
                <PieChart className="w-3.5 h-3.5" />
                {t.investments.portfolioAllocation}
              </span>
              <span>{holdings.length} {t.investments.activeTickers}</span>
            </div>

            {/* Multi-segment Progress Bar */}
            <div className="w-full h-2.5 rounded-full bg-[#E5E7EB] dark:bg-[#27272A] flex overflow-hidden">
              {allocationItems.map((item, idx) => (
                <div
                  key={idx}
                  className={cn("h-full transition-all hover:opacity-80 cursor-pointer", item.color)}
                  style={{ width: `${item.percent}%` }}
                  title={`${item.label}: ${item.percent.toFixed(1)}% (${formatCurrency(item.value, displayCurrency)})`}
                />
              ))}
            </div>

            {/* Compact Legend Tags */}
            <div className="flex items-center gap-2.5 flex-wrap text-[10px]">
              {allocationItems.slice(0, 6).map((item, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <span className={cn("w-2 h-2 rounded-full", item.color)} />
                  <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                    {item.label}
                  </span>
                  <span className="text-[#94A3B8]">
                    {item.percent.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. TABBED NAVIGATION */}
      <div className="flex flex-col gap-4">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between border-b border-[#E5E7EB] dark:border-[#27272A] pb-1 gap-2 flex-wrap">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("holdings")}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                activeTab === "holdings"
                  ? "bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A] shadow-2xs"
                  : "text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]",
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{t.investments.holdingsTab} ({filteredHoldings.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("trades")}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                activeTab === "trades"
                  ? "bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A] shadow-2xs"
                  : "text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]",
              )}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{t.investments.tradesTab} ({trades.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("stamp_duty")}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                activeTab === "stamp_duty"
                  ? "bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A] shadow-2xs"
                  : "text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]",
              )}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>{t.investments.stampDutyTab}</span>
            </button>
          </div>

          {/* View Mode Toggle for Holdings Tab */}
          {activeTab === "holdings" && filteredHoldings.length > 0 && (
            <div className="hidden sm:flex items-center p-0.5 rounded-lg bg-[#F1F3F5] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A]">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-1.5 rounded-md transition-all cursor-pointer",
                  viewMode === "grid"
                    ? "bg-white dark:bg-[#121215] text-[#0F172A] dark:text-[#FAFAFA] shadow-2xs"
                    : "text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]",
                )}
                title="Grid Cards View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn(
                  "p-1.5 rounded-md transition-all cursor-pointer",
                  viewMode === "table"
                    ? "bg-white dark:bg-[#121215] text-[#0F172A] dark:text-[#FAFAFA] shadow-2xs"
                    : "text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]",
                )}
                title="Pro Table View"
              >
                <TableIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* TAB 1: PORTOFOLIO SAHAM */}
        {activeTab === "holdings" && (
          <div>
            {filteredHoldings.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-center flex flex-col items-center justify-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                    {t.investments.emptyHoldingsTitle}
                  </h3>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5 max-w-sm">
                    {t.investments.emptyHoldingsDesc}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setBuyError(null);
                    setBuyTicker("");
                    setBuyLots("1");
                    setBuyNetAmount("");
                    setBuyNotes("");
                    setIsBuyModalOpen(true);
                  }}
                  className="gap-1.5 text-xs font-bold cursor-pointer mt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.investments.buyBtn}</span>
                </Button>
              </div>
            ) : viewMode === "grid" ? (
              /* GRID CARDS VIEW */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {filteredHoldings.map((h) => {
                  const lots =
                    Number(h.lots) ||
                    (Number(h.total_shares) / 100 ||
                      (Number(h.total_cost) > 0 ? 1 : 0));
                  const shares = Number(h.total_shares) || Math.round(lots * 100);
                  const totalCost = Number(h.total_cost) || 0;
                  const avgBuyPrice =
                    Number(h.avg_buy_price) ||
                    (shares > 0 ? totalCost / shares : 0);
                  const allocationPct =
                    totalPortfolioValue > 0
                      ? (convertAmount(totalCost, h.account?.currency || "IDR", displayCurrency, exchangeRate) / totalPortfolioValue) * 100
                      : 0;

                  return (
                    <div
                      key={h.id}
                      className="p-4 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between gap-3.5"
                    >
                      <div>
                        {/* Top: Ticker & Allocation */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A] font-mono font-black text-xs tracking-wider">
                              {h.ticker}
                            </span>
                            <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                              {h.account?.name || "RDN"}
                            </span>
                          </div>

                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">
                            {allocationPct.toFixed(1)}% {t.investments.portfolioShares}
                          </span>
                        </div>

                        {/* Mid Info Box */}
                        <div className="grid grid-cols-2 gap-2 mt-3 p-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB]/60 dark:border-[#27272A]/60 text-xs">
                          <div>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8] block">
                              {t.investments.totalHoldings}
                            </span>
                            <span className="tnum font-bold text-xs sm:text-sm text-[#0F172A] dark:text-[#F8FAFC] mt-0.5 block">
                              {lots} <span className="text-[10px] font-normal text-[#94A3B8]">Lot</span>
                            </span>
                            <span className="text-[10px] text-[#94A3B8]">
                              ({shares.toLocaleString()} {t.investments.stockShares})
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8] block">
                              {t.investments.avgBuyPrice}
                            </span>
                            <span className="tnum font-bold text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 mt-0.5 block">
                              {formatCurrency(Math.round(avgBuyPrice), h.account?.currency || "IDR")}
                            </span>
                            <span className="text-[10px] text-[#94A3B8]">
                              {t.investments.costBasisLabel}: {formatCurrency(totalCost, h.account?.currency || "IDR")}
                            </span>
                          </div>
                        </div>

                        {h.notes && (
                          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-2 italic truncate">
                            "{h.notes}"
                          </p>
                        )}
                      </div>

                      {/* Action Buttons (Without DCA in label) */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#E5E7EB] dark:border-[#27272A]">
                        <button
                          type="button"
                          onClick={() => handleOpenBuyForTicker(h)}
                          className="py-1.5 px-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-600 text-indigo-700 hover:text-white dark:bg-indigo-500/20 dark:hover:bg-indigo-500 dark:text-indigo-300 dark:hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{t.investments.quickBuy}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenSell(h)}
                          className="py-1.5 px-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-600 text-emerald-700 hover:text-white dark:bg-emerald-500/20 dark:hover:bg-emerald-500 dark:text-emerald-300 dark:hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          <span>{t.investments.quickSell}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* PRO FINANCIAL TABLE VIEW */
              <div className="rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-xs overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] dark:border-[#27272A] text-[10px] uppercase font-bold text-[#94A3B8] bg-[#F8F9FA] dark:bg-[#1A1A20]">
                      <th className="py-3 px-4">{t.investments.colTicker}</th>
                      <th className="py-3 px-3">{t.investments.colAccount}</th>
                      <th className="py-3 px-3 text-right">{t.investments.colAllocation}</th>
                      <th className="py-3 px-3 text-right">{t.investments.colLots}</th>
                      <th className="py-3 px-3 text-right">{t.investments.colShares}</th>
                      <th className="py-3 px-3 text-right">{t.investments.colAvgPrice}</th>
                      <th className="py-3 px-3 text-right">{t.investments.colCapital}</th>
                      <th className="py-3 px-4 text-center">{t.investments.colActions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#27272A]">
                    {filteredHoldings.map((h) => {
                      const lots =
                        Number(h.lots) ||
                        (Number(h.total_shares) / 100 ||
                          (Number(h.total_cost) > 0 ? 1 : 0));
                      const shares = Number(h.total_shares) || Math.round(lots * 100);
                      const totalCost = Number(h.total_cost) || 0;
                      const avgBuyPrice =
                        Number(h.avg_buy_price) ||
                        (shares > 0 ? totalCost / shares : 0);
                      const allocationPct =
                        totalPortfolioValue > 0
                          ? (convertAmount(totalCost, h.account?.currency || "IDR", displayCurrency, exchangeRate) / totalPortfolioValue) * 100
                          : 0;

                      return (
                        <tr
                          key={h.id}
                          className="hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20] transition-colors"
                        >
                          <td className="py-3 px-4 font-mono font-black text-xs text-[#0F172A] dark:text-[#F8FAFC]">
                            <span className="px-2 py-0.5 rounded bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A]">
                              {h.ticker}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-[#64748B] dark:text-[#94A3B8] font-medium">
                            {h.account?.name || "RDN"}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400">
                            {allocationPct.toFixed(1)}%
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                            {lots}
                          </td>
                          <td className="py-3 px-3 text-right text-[#64748B] dark:text-[#94A3B8]">
                            {shares.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {formatCurrency(Math.round(avgBuyPrice), h.account?.currency || "IDR")}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                            {formatCurrency(totalCost, h.account?.currency || "IDR")}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenBuyForTicker(h)}
                                className="px-2 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-600 text-indigo-700 hover:text-white dark:bg-indigo-500/20 dark:hover:bg-indigo-500 dark:text-indigo-300 dark:hover:text-white text-[11px] font-bold transition-all cursor-pointer"
                              >
                                {t.investments.quickBuy}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenSell(h)}
                                className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-600 text-emerald-700 hover:text-white dark:bg-emerald-500/20 dark:hover:bg-emerald-500 dark:text-emerald-300 dark:hover:text-white text-[11px] font-bold transition-all cursor-pointer"
                              >
                                {t.investments.quickSell}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: BUKU RIWAYAT TRANSAKSI (TRADE LOG) */}
        {activeTab === "trades" && (
          <div className="flex flex-col gap-3">
            {/* Search & Filter Strip */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="relative flex-1 sm:w-60">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  type="text"
                  placeholder={t.investments.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F172A] dark:focus:border-[#FAFAFA]"
                />
              </div>

              <div className="flex items-center p-0.5 rounded-xl bg-[#F1F3F5] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-xs">
                <button
                  type="button"
                  onClick={() => setTradeFilter("all")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer",
                    tradeFilter === "all"
                      ? "bg-white dark:bg-[#121215] text-[#0F172A] dark:text-[#FAFAFA] shadow-2xs"
                      : "text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]",
                  )}
                >
                  {t.investments.filterAll}
                </button>
                <button
                  type="button"
                  onClick={() => setTradeFilter("buy")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer",
                    tradeFilter === "buy"
                      ? "bg-white dark:bg-[#121215] text-indigo-600 dark:text-indigo-400 shadow-2xs"
                      : "text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]",
                  )}
                >
                  {t.investments.filterBuy}
                </button>
                <button
                  type="button"
                  onClick={() => setTradeFilter("sell")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer",
                    tradeFilter === "sell"
                      ? "bg-white dark:bg-[#121215] text-emerald-600 dark:text-emerald-400 shadow-2xs"
                      : "text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]",
                  )}
                >
                  {t.investments.filterSell}
                </button>
                <button
                  type="button"
                  onClick={() => setTradeFilter("stamp_only")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer",
                    tradeFilter === "stamp_only"
                      ? "bg-white dark:bg-[#121215] text-amber-600 dark:text-amber-400 shadow-2xs"
                      : "text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]",
                  )}
                >
                  {t.investments.filterStampOnly}
                </button>
              </div>
            </div>

            {filteredTrades.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-center flex flex-col items-center justify-center gap-2">
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                  {t.investments.emptyTradesDesc}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-xs overflow-hidden">
                <div className="divide-y divide-[#E5E7EB] dark:divide-[#27272A]">
                  {filteredTrades.slice(0, tradesDisplayLimit).map((tItem) => {
                    const isBuy = tItem.type === "buy";
                    const pnl = Number(tItem.realized_pnl) || 0;
                    const isProfit = pnl >= 0;
                    const tradeLots =
                      Number(tItem.lots) ||
                      (Number(tItem.shares) / 100 || 1);
                    const pricePerShare =
                      Number(tItem.price_per_share) ||
                      (tradeLots > 0 ? Number(tItem.net_amount) / (tradeLots * 100) : 0);
                    const stampDuty = Number(tItem.stamp_duty) || 0;

                    return (
                      <div
                        key={tItem.id}
                        onClick={() => setSelectedTradeForDetail(tItem)}
                        className="p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20] transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={cn(
                              "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs",
                              isBuy
                                ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                                : isProfit
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                            )}
                          >
                            {isBuy ? (
                              <Plus className="w-3.5 h-3.5" />
                            ) : isProfit ? (
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowDownRight className="w-3.5 h-3.5" />
                            )}
                          </div>

                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-black text-xs text-[#0F172A] dark:text-[#F8FAFC]">
                                {tItem.ticker}
                              </span>
                              <span
                                className={cn(
                                  "px-1.5 py-0.2 rounded text-[9px] font-bold uppercase",
                                  isBuy
                                    ? "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                                    : "bg-gray-100 dark:bg-[#27272A] text-[#64748B]",
                                )}
                              >
                                {isBuy ? (language === "en" ? "BUY" : "BELI") : (language === "en" ? "SELL" : "JUAL")}
                              </span>
                              <span className="text-[10px] font-mono text-[#64748B] dark:text-[#94A3B8]">
                                {tradeLots} Lot @ {formatCurrency(Math.round(pricePerShare), "IDR")}
                              </span>
                              {stampDuty > 0 && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[9px] font-bold">
                                  +10k {t.investments.stampDutyFee}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] truncate mt-0.5">
                              {format(parseISO(tItem.trade_date), "dd MMM yyyy")} •{" "}
                              {tItem.account?.name || "RDN"}
                            </span>
                          </div>
                        </div>

                        <div
                          className="flex items-center gap-2 sm:gap-3 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="text-right">
                            <span className="tnum font-bold text-xs sm:text-sm text-[#0F172A] dark:text-[#F8FAFC] block">
                              {formatCurrency(
                                Number(tItem.net_amount),
                                tItem.account?.currency || "IDR",
                              )}
                            </span>
                            {!isBuy && (
                              <span
                                className={cn(
                                  "text-[10px] font-mono font-bold block mt-0.5",
                                  isProfit
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-rose-600 dark:text-rose-400",
                                )}
                              >
                                {isProfit ? "+" : ""}
                                {formatCurrency(
                                  pnl,
                                  tItem.account?.currency || "IDR",
                                )}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditTrade(tItem);
                            }}
                            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] hover:bg-gray-100 dark:hover:bg-[#27272A] transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTrade(tItem.id);
                            }}
                            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: AUDIT BEA MATERAI */}
        {activeTab === "stamp_duty" && (
          <div className="flex flex-col gap-4">
            {/* Stat Cards */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-[#94A3B8] font-bold uppercase block">
                    {t.investments.stampTotalPaid}
                  </span>
                  <span className="tnum font-bold text-sm sm:text-base text-[#0F172A] dark:text-[#F8FAFC] mt-0.5 block">
                    {formatCurrency(totalStampDutyPaid, "IDR")}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#94A3B8] font-bold uppercase block">
                    {t.investments.stampDaysOver10m}
                  </span>
                  <span className="tnum font-bold text-sm sm:text-base text-amber-600 dark:text-amber-400 mt-0.5 block">
                    {stampDutyDays.length} {language === "en" ? "Days" : "Hari"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#94A3B8] font-bold uppercase block">
                    {t.investments.stampTodayStatus}
                  </span>
                  <span className="tnum font-bold text-sm sm:text-base text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                    {isTodayStampDutyTriggered ? t.investments.stampCharged : t.investments.stampFree}
                  </span>
                </div>
              </div>
            </div>

            {/* Historical Days Table */}
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {t.investments.stampHistoryTitle}
              </h3>

              {stampDutyDays.length === 0 ? (
                <div className="p-6 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-center text-xs text-[#64748B]">
                  {t.investments.stampEmpty}
                </div>
              ) : (
                <div className="rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-xs overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] dark:border-[#27272A] text-[10px] uppercase font-bold text-[#94A3B8] bg-[#F8F9FA] dark:bg-[#1A1A20]">
                        <th className="py-2.5 px-4">{t.investments.stampExchangeDate}</th>
                        <th className="py-2.5 px-3">{t.investments.stampOrderCount}</th>
                        <th className="py-2.5 px-3 text-right">{t.investments.stampDailyVolume}</th>
                        <th className="py-2.5 px-4 text-right">{t.investments.stampDutyFee}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#27272A]">
                      {stampDutyDays.map((dayItem) => (
                        <tr key={dayItem.date} className="hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20]">
                          <td className="py-2.5 px-4 font-bold text-[#0F172A] dark:text-[#FAFAFA]">
                            {format(parseISO(dayItem.date), "dd MMMM yyyy")}
                          </td>
                          <td className="py-2.5 px-3 text-[#64748B] dark:text-[#94A3B8]">
                            {dayItem.count} {language === "en" ? "orders" : "order"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-[#0F172A] dark:text-[#FAFAFA]">
                            {formatCurrency(dayItem.volume, "IDR")}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                            {dayItem.duty > 0 ? formatCurrency(dayItem.duty, "IDR") : "Rp 10.000"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: CATAT BELI SAHAM (FULL VERTICAL STACK) */}
      <Modal
        isOpen={isBuyModalOpen}
        onClose={() => setIsBuyModalOpen(false)}
        title={t.investments.modalBuyTitle}
      >
        <form onSubmit={handleBuySubmit} className="flex flex-col gap-3.5">
          {buyError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{buyError}</span>
            </div>
          )}

          {/* Account Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {language === "en" ? "Payment Account (RDN)" : "Akun Pembayaran (RDN)"}
            </label>
            <Select
              value={buyAccountId || rdnAccounts[0]?.id}
              onValueChange={setBuyAccountId}
            >
              <SelectTrigger className="w-full text-xs">
                <SelectValue placeholder="Pilih Akun RDN">
                  {(() => {
                    const cur = rdnAccounts.find(
                      (a) => a.id === (buyAccountId || rdnAccounts[0]?.id),
                    );
                    return cur ? `${cur.name} (${cur.currency})` : "Pilih Akun RDN";
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {rdnAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name} ({acc.currency}) • Saldo:{" "}
                    {formatCurrency(Number(acc.current_balance), acc.currency)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stock Ticker */}
          <Input
            label={t.investments.tickerLabel}
            placeholder={t.investments.tickerPlaceholder}
            value={buyTicker}
            onChange={(e) => setBuyTicker(e.target.value.toUpperCase())}
            required
          />

          {/* Lots Input (Full Width) */}
          <Input
            label={t.investments.lotsLabel}
            type="number"
            min="0.01"
            step="any"
            placeholder={t.investments.lotsPlaceholder}
            value={buyLots}
            onChange={(e) => setBuyLots(e.target.value)}
            required
          />

          {/* Net Amount (Full Width) */}
          <Input
            label={t.investments.netBuyAmountLabel}
            type="number"
            placeholder={t.investments.netBuyPlaceholder}
            value={buyNetAmount}
            onChange={(e) => setBuyNetAmount(e.target.value)}
            required
          />

          {/* Real-time Calculated Price Preview */}
          {numBuyLots > 0 && numBuyNetAmount > 0 && (
            <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="text-[#64748B] dark:text-[#94A3B8]">
                  {t.investments.pricePerShare}:
                </span>
              </div>
              <span className="tnum font-bold text-xs sm:text-sm text-indigo-600 dark:text-indigo-400">
                {formatCurrency(Math.round(estBuyPricePerShare), "IDR")} / {t.investments.stockShares}
              </span>
            </div>
          )}

          {/* Stamp Duty Notice */}
          {numBuyNetAmount > 10_000_000 && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>{t.investments.stampDutyNotice}</span>
            </div>
          )}

          {/* Transaction Date */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-[#64748B]" />
              <span>{t.investments.tradeDateLabel}</span>
            </label>
            <Input
              type="date"
              value={buyDate}
              onChange={(e) => setBuyDate(e.target.value)}
              required
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {t.investments.notesLabel}
            </label>
            <textarea
              rows={2}
              placeholder={t.investments.notesPlaceholder}
              value={buyNotes}
              onChange={(e) => setBuyNotes(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F172A] dark:focus:border-[#FAFAFA] resize-y min-h-[50px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsBuyModalOpen(false)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#64748B] hover:bg-gray-100 dark:hover:bg-[#27272A] cursor-pointer"
            >
              {t.investments.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmittingBuy}
              className="px-4 py-2 rounded-xl bg-[#0F172A] dark:bg-[#FAFAFA] text-white dark:text-[#0F172A] text-xs font-bold hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            >
              {isSubmittingBuy ? t.investments.saving : t.investments.buyBtn}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: CATAT JUAL SEBAGIAN / SEMUA - FULL VERTICAL STACK */}
      <Modal
        isOpen={isSellModalOpen}
        onClose={() => setIsSellModalOpen(false)}
        title={t.investments.modalSellTitle}
      >
        <form onSubmit={handleSellSubmit} className="flex flex-col gap-3.5">
          {sellError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{sellError}</span>
            </div>
          )}

          {/* Holding Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {t.investments.selectHoldingLabel}
            </label>
            <Select
              value={sellHoldingId}
              onValueChange={(id) => {
                setSellHoldingId(id);
                const hold = holdings.find((h) => h.id === id);
                setSelectedHoldingForSell(hold || null);
                if (hold) {
                  const holdLots =
                    Number(hold.lots) ||
                    (Number(hold.total_shares) / 100 || 1);
                  setSellLots(String(holdLots));
                }
              }}
            >
              <SelectTrigger className="w-full text-xs">
                <SelectValue placeholder="Pilih Saham" />
              </SelectTrigger>
              <SelectContent>
                {holdings.map((h) => {
                  const hLots =
                    Number(h.lots) ||
                    (Number(h.total_shares) / 100 || 1);
                  return (
                    <SelectItem key={h.id} value={h.id}>
                      {h.ticker} ({hLots} Lot) • {t.investments.costBasisLabel}:{" "}
                      {formatCurrency(
                        Number(h.total_cost),
                        h.account?.currency || "IDR",
                      )}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Holding Overview Box */}
          {activeSellHolding && (
            <div className="p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#94A3B8]">{t.investments.totalHoldings}:</span>
                <span className="tnum font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  {currentHoldingLots} Lot ({(currentHoldingLots * 100).toLocaleString()} {t.investments.stockShares})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#94A3B8]">{t.investments.avgBuyPrice}:</span>
                <span className="tnum font-bold text-indigo-600 dark:text-indigo-400">
                  {formatCurrency(Math.round(currentHoldingAvgPrice), "IDR")} / {t.investments.stockShares}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-[#E5E7EB] dark:border-[#27272A] pt-1.5">
                <span className="text-[#94A3B8]">{t.investments.costBasisLabel}:</span>
                <span className="tnum font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  {formatCurrency(currentHoldingTotalCost, "IDR")}
                </span>
              </div>
            </div>
          )}

          {/* Quick Lot Selector Percentage */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                {t.investments.sellPortion}
              </label>
              <div className="flex items-center gap-1">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => handleSetSellPercent(pct)}
                    className="px-2 py-0.5 rounded-md bg-[#F1F3F5] dark:bg-[#27272A] hover:bg-emerald-500 hover:text-white text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] transition-all cursor-pointer"
                  >
                    {pct === 100 ? "MAX" : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Lot to Sell (Full Width) */}
            <Input
              label={t.investments.lotsToSellLabel}
              type="number"
              min="0.01"
              max={currentHoldingLots}
              step="any"
              placeholder="misal: 2"
              value={sellLots}
              onChange={(e) => setSellLots(e.target.value)}
              required
            />

            {/* Net Proceeds (Full Width) */}
            <Input
              label={t.investments.netSellAmountLabel}
              type="number"
              placeholder={t.investments.netSellPlaceholder}
              value={sellNetAmount}
              onChange={(e) => setSellNetAmount(e.target.value)}
              required
            />
          </div>

          {/* Real-Time Live Outcome Indicator */}
          {numSellNetAmount > 0 && activeSellHolding && (
            <div
              className={cn(
                "p-3 rounded-xl border flex flex-col gap-1.5",
                estRealizedPnl >= 0
                  ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                  : "bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {estRealizedPnl >= 0 ? (
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                  )}
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    {estRealizedPnl >= 0 ? t.investments.gainLabel : t.investments.lossLabel}
                  </span>
                </div>
                <span className="tnum font-mono font-bold text-xs sm:text-sm">
                  {estRealizedPnl >= 0 ? "+" : ""}
                  {formatCurrency(estRealizedPnl, "IDR")} ({estPnlPercent >= 0 ? "+" : ""}
                  {estPnlPercent.toFixed(2)}%)
                </span>
              </div>

              <div className="text-[11px] opacity-80 flex items-center justify-between border-t border-current/10 pt-1">
                <span>{t.investments.costBasisLabel}: {formatCurrency(Math.round(estSellCostBasis), "IDR")}</span>
                <span>
                  {isFullSell
                    ? t.investments.positionClosed
                    : `${t.investments.remainingShares}: ${Math.max(0, currentHoldingLots - numSellLots)} Lot`}
                </span>
              </div>
            </div>
          )}

          {/* Transaction Date */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-[#64748B]" />
              <span>{t.investments.tradeDateLabel}</span>
            </label>
            <Input
              type="date"
              value={sellDate}
              onChange={(e) => setSellDate(e.target.value)}
              required
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {t.investments.notesLabel}
            </label>
            <textarea
              rows={2}
              placeholder={t.investments.notesPlaceholder}
              value={sellNotes}
              onChange={(e) => setSellNotes(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F172A] dark:focus:border-[#FAFAFA] resize-y min-h-[50px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsSellModalOpen(false)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#64748B] hover:bg-gray-100 dark:hover:bg-[#27272A] cursor-pointer"
            >
              {t.investments.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmittingSell}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer"
            >
              {isSubmittingSell ? t.investments.saving : t.investments.sellBtn}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: EDIT RIWAYAT TRANSAKSI SAHAM - FULL VERTICAL STACK */}
      <Modal
        isOpen={isEditTradeModalOpen}
        onClose={() => {
          setIsEditTradeModalOpen(false);
          setEditingTrade(null);
        }}
        title={t.investments.modalEditTradeTitle}
      >
        <form onSubmit={handleEditTradeSubmit} className="flex flex-col gap-3.5">
          {editTradeError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{editTradeError}</span>
            </div>
          )}

          {editingTrade && (
            <div className="p-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between text-xs">
              <span className="text-[#64748B] dark:text-[#94A3B8] font-bold">
                {t.investments.tradeType}
              </span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-md font-bold uppercase text-[10px]",
                  editingTrade.type === "buy"
                    ? "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                    : "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
                )}
              >
                {editingTrade.type === "buy" ? (language === "en" ? "BUY" : "BELI") : (language === "en" ? "SELL" : "JUAL")}
              </span>
            </div>
          )}

          {/* Stock Ticker */}
          <Input
            label={t.investments.tickerLabel}
            placeholder={t.investments.tickerPlaceholder}
            value={editTicker}
            onChange={(e) => setEditTicker(e.target.value.toUpperCase())}
            required
          />

          {/* Lots (Full Width) */}
          <Input
            label={t.investments.lotsLabel}
            type="number"
            min="0.01"
            step="any"
            value={editLots}
            onChange={(e) => setEditLots(e.target.value)}
            required
          />

          {/* Net Amount (Full Width) */}
          <Input
            label={t.investments.netBuyAmountLabel}
            type="number"
            placeholder="Nominal transaksi"
            value={editNetAmount}
            onChange={(e) => setEditNetAmount(e.target.value)}
            required
          />

          {/* Transaction Date */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-[#64748B]" />
              <span>{t.investments.tradeDateLabel}</span>
            </label>
            <Input
              type="date"
              value={editTradeDate}
              onChange={(e) => setEditTradeDate(e.target.value)}
              required
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {t.investments.notesLabel}
            </label>
            <textarea
              rows={2}
              placeholder={t.investments.notesPlaceholder}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F172A] dark:focus:border-[#FAFAFA] resize-y min-h-[50px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsEditTradeModalOpen(false);
                setEditingTrade(null);
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#64748B] hover:bg-gray-100 dark:hover:bg-[#27272A] cursor-pointer"
            >
              {t.investments.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmittingEditTrade}
              className="px-4 py-2 rounded-xl bg-[#0F172A] dark:bg-[#FAFAFA] text-white dark:text-[#0F172A] text-xs font-bold hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            >
              {isSubmittingEditTrade ? t.investments.saving : t.investments.updateTradeBtn}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: DETAIL TRANSAKSI SAHAM */}
      <Modal
        isOpen={!!selectedTradeForDetail}
        onClose={() => setSelectedTradeForDetail(null)}
        title={t.investments.tradeDetailTitle}
      >
        {selectedTradeForDetail &&
          (() => {
            const dt = selectedTradeForDetail;
            const isBuy = dt.type === "buy";
            const pnl = Number(dt.realized_pnl) || 0;
            const isProfit = pnl >= 0;
            const lots =
              Number(dt.lots) ||
              (Number(dt.shares) / 100 || 1);
            const pricePerShare =
              Number(dt.price_per_share) ||
              (lots > 0 ? Number(dt.net_amount) / (lots * 100) : 0);
            const stampDuty = Number(dt.stamp_duty) || 0;

            return (
              <div className="flex flex-col gap-3.5 text-xs">
                {/* Header Hero */}
                <div className="p-3.5 rounded-2xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A] font-mono font-black text-xs tracking-wider">
                        {dt.ticker}
                      </span>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                          isBuy
                            ? "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                            : "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
                        )}
                      >
                        {isBuy ? (language === "en" ? "BUY" : "BELI") : (language === "en" ? "SELL" : "JUAL")}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      {format(parseISO(dt.trade_date), "dd MMMM yyyy")}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8]">
                      {t.investments.tradeAmount}
                    </span>
                    <div className="tnum font-mono font-black text-xl text-[#0F172A] dark:text-[#F8FAFC]">
                      {formatCurrency(
                        Number(dt.net_amount),
                        dt.account?.currency || "IDR",
                      )}
                    </div>
                  </div>

                  {!isBuy && (
                    <div className="pt-2 border-t border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between">
                      <span className="text-[#64748B] dark:text-[#94A3B8]">
                        {t.investments.estimatedPnlLabel}:
                      </span>
                      <span
                        className={cn(
                          "tnum font-mono font-bold text-xs sm:text-sm",
                          isProfit
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400",
                        )}
                      >
                        {isProfit ? "+" : ""}
                        {formatCurrency(pnl, dt.account?.currency || "IDR")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Detail Info List */}
                <div className="flex flex-col gap-2">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between">
                    <span className="text-[#94A3B8]">{t.investments.totalHoldings}:</span>
                    <span className="font-bold text-[#0F172A] dark:text-[#FAFAFA]">
                      {lots} Lot ({(lots * 100).toLocaleString()} {t.investments.stockShares})
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between">
                    <span className="text-[#94A3B8]">{t.investments.colAvgPrice}:</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(Math.round(pricePerShare), dt.account?.currency || "IDR")} / {t.investments.stockShares}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between">
                    <span className="text-[#94A3B8]">{t.investments.colAccount}:</span>
                    <span className="font-bold text-[#0F172A] dark:text-[#FAFAFA]">
                      {dt.account?.name || "RDN"} ({dt.account?.currency || "IDR"})
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between">
                    <span className="text-[#94A3B8]">{t.investments.stampDutyFee}:</span>
                    <span className="font-bold text-[#0F172A] dark:text-[#FAFAFA]">
                      {stampDuty > 0 ? formatCurrency(stampDuty, "IDR") : "Rp 0 (Bebas)"}
                    </span>
                  </div>
                </div>

                {dt.notes && (
                  <div className="p-3 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A]">
                    <span className="text-[9px] font-bold uppercase text-[#94A3B8] block mb-0.5">
                      {t.investments.notesLabel}
                    </span>
                    <p className="text-[#0F172A] dark:text-[#FAFAFA] whitespace-pre-wrap">
                      {dt.notes}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-[#E5E7EB] dark:border-[#27272A]">
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedTradeForDetail(null);
                      handleOpenEditTrade(dt);
                    }}
                    className="gap-1.5 flex-1 cursor-pointer py-2 text-xs font-bold"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>{t.common.edit}</span>
                  </Button>

                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setSelectedTradeForDetail(null);
                      handleDeleteTrade(dt.id);
                    }}
                    className="gap-1.5 px-3.5 cursor-pointer py-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedTradeForDetail(null)}
                    className="cursor-pointer py-2 text-xs"
                  >
                    {t.common.cancel}
                  </Button>
                </div>
              </div>
            );
          })()}
      </Modal>
    </div>
  );
}
