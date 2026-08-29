"use client";

import React, { useState } from "react";
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
  Sparkles,
  CheckCircle2,
  Trash2,
  Edit2,
  AlertCircle,
  Clock,
  Coins,
  Layers,
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

  // Modals state
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [selectedHoldingForSell, setSelectedHoldingForSell] =
    useState<EnrichedStockHolding | null>(null);
  const [selectedTradeForDetail, setSelectedTradeForDetail] =
    useState<EnrichedStockTrade | null>(null);
  const [tradesDisplayLimit, setTradesDisplayLimit] = useState(30);

  // Buy Form State
  const [buyAccountId, setBuyAccountId] = useState<string>(
    rdnAccounts[0]?.id || "",
  );
  const [buyTicker, setBuyTicker] = useState("");
  const [buyNetAmount, setBuyNetAmount] = useState("");
  const [buyNotes, setBuyNotes] = useState("");
  const [buyDate, setBuyDate] = useState(useState(getLocalDateString()));
  const [isSubmittingBuy, setIsSubmittingBuy] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);

  // Sell Form State
  const [sellHoldingId, setSellHoldingId] = useState<string>("");
  const [sellNetAmount, setSellNetAmount] = useState("");
  const [sellNotes, setSellNotes] = useState("");
  const [sellDate, setSellDate] = useState(useState(getLocalDateString()));
  const [isSubmittingSell, setIsSubmittingSell] = useState(false);
  const [sellError, setSellError] = useState<string | null>(null);

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
    totalRdnCash += convertAmount(
      Number(acc.current_balance),
      acc.currency,
      displayCurrency,
      exchangeRate,
    );
  });

  let totalRealizedProfit = 0;
  let totalRealizedLoss = 0;
  trades.forEach((trade) => {
    if (trade.type === "sell") {
      const pnl = Number(trade.realized_pnl) || 0;
      const acc = trade.account;
      const pnlConverted = convertAmount(
        pnl,
        acc?.currency || "IDR",
        displayCurrency,
        exchangeRate,
      );
      if (pnlConverted > 0) {
        totalRealizedProfit += pnlConverted;
      } else {
        totalRealizedLoss += Math.abs(pnlConverted);
      }
    }
  });

  const netTradingPnl = totalRealizedProfit - totalRealizedLoss;
  const totalPortfolioValue = totalStockCost + totalRdnCash;

  // Handle Buy Submit
  const handleBuySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBuyError(null);

    if (!buyAccountId) {
      setBuyError(
        language === "en"
          ? "Please select an account"
          : "Pilih akun pembayaran",
      );
      return;
    }
    if (!buyTicker.trim()) {
      setBuyError(
        language === "en"
          ? "Stock ticker is required"
          : "Kode saham wajib diisi",
      );
      return;
    }
    const numAmount = parseFloat(buyNetAmount) || 0;
    if (numAmount <= 0) {
      setBuyError(
        language === "en"
          ? "Valid amount is required"
          : "Nominal pembelian harus lebih dari 0",
      );
      return;
    }

    setIsSubmittingBuy(true);
    try {
      const res = await recordStockBuy({
        accountId: buyAccountId,
        ticker: buyTicker,
        netAmount: numAmount,
        notes: buyNotes.trim() || null,
        tradeDate: buyDate,
      });

      if (res.error) {
        setBuyError(res.error);
        toast.error("Gagal Mencatat Pembelian", { description: res.error });
      } else {
        toast.success(t.investments.saveSuccess);
        setIsBuyModalOpen(false);
        setBuyTicker("");
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

  // Handle Open Sell Modal
  const handleOpenSell = (holding: EnrichedStockHolding) => {
    setSelectedHoldingForSell(holding);
    setSellHoldingId(holding.id);
    setSellNetAmount("");
    setSellNotes("");
    setSellError(null);
    setIsSellModalOpen(true);
  };

  // Handle Sell Submit
  const handleSellSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSellError(null);

    const holding =
      holdings.find((h) => h.id === sellHoldingId) || selectedHoldingForSell;
    if (!holding) {
      setSellError("Pilih saham yang ingin dijual");
      return;
    }

    const numAmount = parseFloat(sellNetAmount) || 0;
    if (numAmount <= 0) {
      setSellError(
        language === "en"
          ? "Valid proceeds amount is required"
          : "Nominal penjualan bersih harus lebih dari 0",
      );
      return;
    }

    setIsSubmittingSell(true);
    try {
      const res = await recordStockSell({
        holdingId: holding.id,
        netAmount: numAmount,
        notes: sellNotes.trim() || null,
        tradeDate: sellDate,
      });

      if (res.error) {
        setSellError(res.error);
        toast.error("Gagal Mencatat Penjualan", { description: res.error });
      } else {
        const pnl = res.realizedPnl || 0;
        const isProfit = pnl >= 0;
        toast.success(t.investments.sellSuccess, {
          description: isProfit
            ? `Cuan Realized: +${formatCurrency(pnl, holding.account?.currency || "IDR")}`
            : `Cut Loss: ${formatCurrency(pnl, holding.account?.currency || "IDR")}`,
        });
        setIsSellModalOpen(false);
        setSelectedHoldingForSell(null);
        setSellHoldingId("");
        setSellNetAmount("");
        router.refresh();
      }
    } catch (err: any) {
      setSellError(err.message);
    } finally {
      setIsSubmittingSell(false);
    }
  };

  // Handle Delete Trade
  const handleDeleteTrade = async (tradeId: string) => {
    if (!confirm(t.investments.deleteConfirm)) return;
    try {
      const res = await deleteStockTrade(tradeId);
      if (res.error) {
        toast.error("Gagal Menghapus Transaksi", { description: res.error });
      } else {
        toast.success(t.investments.deleteSuccess);
        router.refresh();
      }
    } catch (err: any) {
      toast.error("Terjadi Kesalahan", { description: err.message });
    }
  };

  // Handle Edit Trade Modal
  const [isEditTradeModalOpen, setIsEditTradeModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<EnrichedStockTrade | null>(
    null,
  );
  const [editTicker, setEditTicker] = useState("");
  const [editNetAmount, setEditNetAmount] = useState("");
  const [editTradeDate, setEditTradeDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [isSubmittingEditTrade, setIsSubmittingEditTrade] = useState(false);
  const [editTradeError, setEditTradeError] = useState<string | null>(null);

  const handleOpenEditTrade = (trade: EnrichedStockTrade) => {
    setEditingTrade(trade);
    setEditTicker(trade.ticker);
    setEditNetAmount(String(trade.net_amount));
    setEditTradeDate(getLocalDateString(trade.trade_date));
    setEditNotes(trade.notes || "");
    setEditTradeError(null);
    setIsEditTradeModalOpen(true);
  };

  const handleEditTradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrade) return;
    const numAmount = parseFloat(editNetAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setEditTradeError("Nominal transaksi harus lebih besar dari 0");
      return;
    }

    setIsSubmittingEditTrade(true);
    setEditTradeError(null);
    try {
      const res = await updateStockTrade({
        id: editingTrade.id,
        ticker: editTicker,
        netAmount: numAmount,
        notes: editNotes.trim() || null,
        tradeDate: editTradeDate,
      });

      if (res.error) {
        setEditTradeError(res.error);
        toast.error("Gagal Mengupdate Transaksi", { description: res.error });
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

  // Estimate sell PnL in modal
  const activeSellHolding =
    holdings.find((h) => h.id === sellHoldingId) || selectedHoldingForSell;
  const estSellNum = parseFloat(sellNetAmount) || 0;
  const estBuyCost = Number(activeSellHolding?.total_cost) || 0;
  const estPnl = estSellNum > 0 ? estSellNum - estBuyCost : 0;
  const estPnlPct =
    estBuyCost > 0 && estSellNum > 0
      ? ((estSellNum - estBuyCost) / estBuyCost) * 100
      : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span>{t.investments.title}</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] mt-1">
            {t.investments.subtitle}
          </p>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={() => {
            setBuyError(null);
            setIsBuyModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#0F172A] dark:bg-[#FAFAFA] text-white dark:text-[#0F172A] text-xs font-bold hover:opacity-90 active:scale-95 transition-all shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t.investments.buyBtn}</span>
        </button>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Total Stock Capital */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5 min-h-[22px]">
            <span className="text-[10px] font-bold uppercase text-[#64748B] dark:text-[#94A3B8]">
              {t.investments.totalInvested}
            </span>
            <div className="w-5.5 h-5.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Briefcase className="w-3 h-3" />
            </div>
          </div>
          <div className="font-mono font-bold text-sm sm:text-base text-[#0F172A] dark:text-[#F8FAFC] mt-1">
            {formatCurrency(totalStockCost, displayCurrency)}
          </div>
        </div>

        {/* RDN Cash Balance */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5 min-h-[22px]">
            <span className="text-[10px] font-bold uppercase text-[#64748B] dark:text-[#94A3B8]">
              {t.investments.rdnCash}
            </span>
            <div className="w-5.5 h-5.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Wallet className="w-3 h-3" />
            </div>
          </div>
          <div className="font-mono font-bold text-sm sm:text-base text-[#0F172A] dark:text-[#F8FAFC] mt-1">
            {formatCurrency(totalRdnCash, displayCurrency)}
          </div>
        </div>

        {/* Total Portfolio */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5 min-h-[22px]">
            <span className="text-[10px] font-bold uppercase text-[#64748B] dark:text-[#94A3B8]">
              {t.investments.totalPortfolio}
            </span>
            <div className="w-5.5 h-5.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Coins className="w-3 h-3" />
            </div>
          </div>
          <div className="font-mono font-bold text-sm sm:text-base text-[#0F172A] dark:text-[#F8FAFC] mt-1">
            {formatCurrency(totalPortfolioValue, displayCurrency)}
          </div>
        </div>

        {/* Net Realized Trading PnL */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5 min-h-[22px]">
            <span className="text-[10px] font-bold uppercase text-[#64748B] dark:text-[#94A3B8]">
              {t.investments.netPnl}
            </span>
            <div
              className={cn(
                "w-5.5 h-5.5 rounded-lg flex items-center justify-center",
                netTradingPnl >= 0
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
              )}
            >
              {netTradingPnl >= 0 ? (
                <ArrowUpRight className="w-3 h-3" />
              ) : (
                <ArrowDownRight className="w-3 h-3" />
              )}
            </div>
          </div>
          <div
            className={cn(
              "font-mono font-bold text-sm sm:text-base mt-1",
              netTradingPnl >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400",
            )}
          >
            {netTradingPnl >= 0 ? "+" : ""}
            {formatCurrency(netTradingPnl, displayCurrency)}
          </div>
        </div>
      </div>

      {/* Section 1: Active Stock Holdings */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#64748B]" />
            <span>{t.investments.holdingsTitle}</span>
            <span className="text-xs text-[#94A3B8] font-mono">
              ({holdings.length})
            </span>
          </h2>
        </div>

        {holdings.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-center flex flex-col items-center justify-center gap-3">
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
            <div className="flex items-center gap-2 flex-wrap justify-center mt-1">
              <Button
                size="sm"
                onClick={() => {
                  setBuyError(null);
                  setIsBuyModalOpen(true);
                }}
                className="gap-1.5 text-xs font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.investments.buyBtn}</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {holdings.map((h) => (
              <div
                key={h.id}
                className="p-4 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A] font-mono font-black text-xs tracking-wider">
                      {h.ticker}
                    </span>
                    <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
                      {h.account?.name || "RDN"}
                    </span>
                  </div>

                  <div className="mt-3">
                    <span className="text-[10px] uppercase font-bold text-[#94A3B8] block">
                      {language === "en"
                        ? "Invested Capital"
                        : "Modal Tertanam"}
                    </span>
                    <span className="font-mono font-black text-base sm:text-lg text-[#0F172A] dark:text-[#F8FAFC] mt-0.5 block">
                      {formatCurrency(
                        Number(h.total_cost),
                        h.account?.currency || "IDR",
                      )}
                    </span>
                  </div>

                  {h.notes && (
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-2 truncate">
                      "{h.notes}"
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenSell(h)}
                  className="w-full py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-700 hover:text-white dark:bg-emerald-500/20 dark:hover:bg-emerald-500 dark:text-emerald-300 dark:hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>{t.investments.sellBtn}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Trade Execution History */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm sm:text-base font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#64748B]" />
          <span>{t.investments.tradesTitle}</span>
          <span className="text-xs text-[#94A3B8] font-mono">
            ({trades.length})
          </span>
        </h2>

        {trades.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-center flex flex-col items-center justify-center gap-2">
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              {t.investments.emptyTradesDesc}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-xs overflow-hidden">
              <div className="divide-y divide-[#E5E7EB] dark:divide-[#27272A]">
                {trades.slice(0, tradesDisplayLimit).map((tItem) => {
                  const isBuy = tItem.type === "buy";
                  const pnl = Number(tItem.realized_pnl) || 0;
                  const isProfit = pnl >= 0;

                  return (
                    <div
                      key={tItem.id}
                      onClick={() => setSelectedTradeForDetail(tItem)}
                      className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20] transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
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
                            <Plus className="w-4 h-4" />
                          ) : isProfit ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4" />
                          )}
                        </div>

                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-xs text-[#0F172A] dark:text-[#F8FAFC]">
                              {tItem.ticker}
                            </span>
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                isBuy
                                  ? "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                                  : "bg-gray-100 dark:bg-[#27272A] text-[#64748B]",
                              )}
                            >
                              {isBuy ? "BELI" : "JUAL"}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate mt-0.5">
                            {format(parseISO(tItem.trade_date), "dd MMM yyyy")}{" "}
                            • {tItem.account?.name || "RDN"}
                          </span>
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-2 sm:gap-3 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="text-right">
                          <span className="font-mono font-bold text-xs sm:text-sm text-[#0F172A] dark:text-[#F8FAFC] block">
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
                              )}{" "}
                              PnL
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
                          title={t.common.edit}
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
                          title={t.common.delete}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pagination Load More Controls */}
            {tradesDisplayLimit < trades.length && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs">
                <span className="text-[#64748B] dark:text-[#94A3B8] font-medium text-center sm:text-left">
                  {t.common.showing}{" "}
                  <span className="font-bold text-[#0F172A] dark:text-[#FAFAFA]">
                    {Math.min(tradesDisplayLimit, trades.length)}
                  </span>{" "}
                  / {trades.length}
                </span>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTradesDisplayLimit((prev) => prev + 30)}
                    className="flex-1 sm:flex-initial text-xs font-bold cursor-pointer"
                  >
                    {t.common.loadMore} (+
                    {Math.min(30, trades.length - tradesDisplayLimit)})
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTradesDisplayLimit(trades.length)}
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

      {/* MODAL 1: CATAT BELI SAHAM */}
      <Modal
        isOpen={isBuyModalOpen}
        onClose={() => setIsBuyModalOpen(false)}
        title={t.investments.modalBuyTitle}
      >
        {rdnAccounts.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-center flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#0F172A] dark:text-[#FAFAFA]">
                {language === "en"
                  ? "No Investment Account Found"
                  : "Belum Ada Akun Investasi / RDN"}
              </h4>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1 max-w-sm leading-relaxed">
                {language === "en"
                  ? 'Stock trades must be funded through an Investment (RDN) account. Please create an account with type "Investment" in Accounts first.'
                  : 'Transaksi pembelian saham harus menggunakan Rekening Dana Nasabah (RDN / Akun Investasi). Silakan buat akun dengan tipe "Investasi" terlebih dahulu di menu Akun.'}
              </p>
            </div>
            <Button
              onClick={() => {
                setIsBuyModalOpen(false);
                router.push("/accounts");
              }}
              className="gap-1.5 text-xs font-bold mt-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                {language === "en"
                  ? "Create Investment Account"
                  : "Buat Akun Investasi"}
              </span>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleBuySubmit} className="flex flex-col gap-4">
            {buyError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{buyError}</span>
              </div>
            )}

            {/* Account Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                {language === "en"
                  ? "Payment Account (RDN)"
                  : "Akun Pembayaran (RDN)"}
              </label>
              <Select
                value={buyAccountId || rdnAccounts[0]?.id}
                onValueChange={setBuyAccountId}
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder="Pilih Akun RDN">
                    {(() => {
                      const cur = rdnAccounts.find(
                        (a) => a.id === (buyAccountId || rdnAccounts[0]?.id),
                      );
                      return cur
                        ? `${cur.name} (${cur.currency})`
                        : "Pilih Akun RDN";
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {rdnAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      <div className="flex items-center justify-between w-full gap-2">
                        <span className="truncate">
                          {acc.name} ({acc.currency})
                        </span>
                        <span className="text-[10px] font-mono text-[#94A3B8] shrink-0 font-bold">
                          (
                          {formatCurrency(
                            Number(acc.current_balance),
                            acc.currency,
                          )}
                          )
                        </span>
                      </div>
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

            {/* Net Buy Amount */}
            <Input
              label={t.investments.netBuyAmountLabel}
              type="number"
              placeholder={t.investments.netBuyPlaceholder}
              value={buyNetAmount}
              onChange={(e) => setBuyNetAmount(e.target.value)}
              required
            />

            {/* Transaction Date */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-[#64748B]" />
                  <span>{t.investments.tradeDateLabel}</span>
                </label>
                {buyDate && (
                  <span className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
                    {format(parseISO(buyDate), "dd MMMM yyyy")}
                  </span>
                )}
              </div>
              <Input
                type="date"
                value={buyDate}
                onChange={(e) => setBuyDate(e.target.value)}
                required
              />
            </div>

            {/* Expandable Free-Text Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                {t.investments.notesLabel}
              </label>
              <textarea
                rows={3}
                placeholder={t.investments.notesPlaceholder}
                value={buyNotes}
                onChange={(e) => setBuyNotes(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F172A] dark:focus:border-[#FAFAFA] resize-y min-h-[70px]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBuyModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#64748B] hover:bg-gray-100 dark:hover:bg-[#27272A] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingBuy}
                className="px-4 py-2 rounded-xl bg-[#0F172A] dark:bg-[#FAFAFA] text-white dark:text-[#0F172A] text-xs font-bold hover:opacity-90 active:scale-95 transition-all cursor-pointer"
              >
                {isSubmittingBuy ? "Menyimpan..." : "Simpan Pembelian"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL 2: CATAT JUAL SAHAM (TP / CUT LOSS) */}
      <Modal
        isOpen={isSellModalOpen}
        onClose={() => setIsSellModalOpen(false)}
        title={t.investments.modalSellTitle}
      >
        <form onSubmit={handleSellSubmit} className="flex flex-col gap-4">
          {sellError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{sellError}</span>
            </div>
          )}

          {/* Holding Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {t.investments.selectHoldingLabel}
            </label>
            <Select
              value={sellHoldingId}
              onValueChange={(id) => {
                setSellHoldingId(id);
                const hold = holdings.find((h) => h.id === id);
                setSelectedHoldingForSell(hold || null);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih Saham" />
              </SelectTrigger>
              <SelectContent>
                {holdings.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.ticker} • Modal:{" "}
                    {formatCurrency(
                      Number(h.total_cost),
                      h.account?.currency || "IDR",
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Net Sell Proceeds Amount */}
          <Input
            label={t.investments.netSellAmountLabel}
            type="number"
            placeholder={t.investments.netSellPlaceholder}
            value={sellNetAmount}
            onChange={(e) => setSellNetAmount(e.target.value)}
            required
          />

          {/* Live Outcome Indicator */}
          {estSellNum > 0 && activeSellHolding && (
            <div
              className={cn(
                "p-3.5 rounded-xl border flex items-center justify-between gap-3",
                estPnl >= 0
                  ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                  : "bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300",
              )}
            >
              <div className="flex items-center gap-2">
                {estPnl >= 0 ? (
                  <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                )}
                <div>
                  <span className="text-[10px] uppercase font-bold block">
                    {estPnl >= 0
                      ? t.investments.gainLabel
                      : t.investments.lossLabel}
                  </span>
                  <span className="font-mono font-bold text-xs sm:text-sm">
                    {estPnl >= 0 ? "+" : ""}
                    {formatCurrency(
                      estPnl,
                      activeSellHolding.account?.currency || "IDR",
                    )}{" "}
                    ({estPnlPct >= 0 ? "+" : ""}
                    {estPnlPct.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Transaction Date */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1.5">
                <Calendar className="w-3 h-3 text-[#64748B]" />
                <span>{t.investments.tradeDateLabel}</span>
              </label>
              {sellDate && (
                <span className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
                  {format(parseISO(sellDate), "dd MMMM yyyy")}
                </span>
              )}
            </div>
            <Input
              type="date"
              value={sellDate}
              onChange={(e) => setSellDate(e.target.value)}
              required
            />
          </div>

          {/* Expandable Free-Text Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {t.investments.notesLabel}
            </label>
            <textarea
              rows={3}
              placeholder={t.investments.notesPlaceholder}
              value={sellNotes}
              onChange={(e) => setSellNotes(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F172A] dark:focus:border-[#FAFAFA] resize-y min-h-[70px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsSellModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#64748B] hover:bg-gray-100 dark:hover:bg-[#27272A] cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmittingSell}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer"
            >
              {isSubmittingSell ? "Menyimpan..." : "Simpan Penjualan"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: EDIT RIWAYAT TRANSAKSI SAHAM */}
      <Modal
        isOpen={isEditTradeModalOpen}
        onClose={() => {
          setIsEditTradeModalOpen(false);
          setEditingTrade(null);
        }}
        title={t.investments.modalEditTradeTitle}
      >
        <form onSubmit={handleEditTradeSubmit} className="flex flex-col gap-4">
          {editTradeError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{editTradeError}</span>
            </div>
          )}

          {/* Trade Type Banner */}
          {editingTrade && (
            <div className="p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between text-xs">
              <span className="text-[#64748B] dark:text-[#94A3B8] font-bold">
                {language === "en" ? "Transaction Type" : "Tipe Transaksi"}
              </span>
              <span
                className={cn(
                  "px-2.5 py-0.5 rounded-md font-bold uppercase text-[11px]",
                  editingTrade.type === "buy"
                    ? "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                    : "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
                )}
              >
                {editingTrade.type === "buy"
                  ? language === "en"
                    ? "BUY"
                    : "BELI"
                  : language === "en"
                    ? "SELL"
                    : "JUAL"}
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

          {/* Net Amount */}
          <Input
            label={
              editingTrade?.type === "buy"
                ? t.investments.netBuyAmountLabel
                : t.investments.netSellAmountLabel
            }
            type="number"
            placeholder="Nominal transaksi"
            value={editNetAmount}
            onChange={(e) => setEditNetAmount(e.target.value)}
            required
          />

          {/* Transaction Date */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1.5">
                <Calendar className="w-3 h-3 text-[#64748B]" />
                <span>{t.investments.tradeDateLabel}</span>
              </label>
              {editTradeDate && (
                <span className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
                  {format(parseISO(editTradeDate), "dd MMMM yyyy")}
                </span>
              )}
            </div>
            <Input
              type="date"
              value={editTradeDate}
              onChange={(e) => setEditTradeDate(e.target.value)}
              required
            />
          </div>

          {/* Expandable Free-Text Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {t.investments.notesLabel}
            </label>
            <textarea
              rows={3}
              placeholder={t.investments.notesPlaceholder}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F172A] dark:focus:border-[#FAFAFA] resize-y min-h-[70px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsEditTradeModalOpen(false);
                setEditingTrade(null);
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#64748B] hover:bg-gray-100 dark:hover:bg-[#27272A] cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmittingEditTrade}
              className="px-4 py-2 rounded-xl bg-[#0F172A] dark:bg-[#FAFAFA] text-white dark:text-[#0F172A] text-xs font-bold hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            >
              {isSubmittingEditTrade
                ? "Menyimpan..."
                : t.investments.updateTradeBtn}
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

            return (
              <div className="flex flex-col gap-4">
                {/* Header Hero */}
                <div className="p-4 rounded-2xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A] font-mono font-black text-sm tracking-wider">
                        {dt.ticker}
                      </span>
                      <span
                        className={cn(
                          "px-2.5 py-0.5 rounded-md font-bold uppercase text-[11px]",
                          isBuy
                            ? "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                            : "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
                        )}
                      >
                        {isBuy
                          ? language === "en"
                            ? "BUY"
                            : "BELI"
                          : language === "en"
                            ? "SELL"
                            : "JUAL"}
                      </span>
                    </div>
                    <span className="text-xs text-[#64748B] dark:text-[#94A3B8] font-medium">
                      {format(parseISO(dt.trade_date), "dd MMMM yyyy")}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                      {language === "en"
                        ? "Net Trade Amount"
                        : "Total Transaksi Bersih"}
                    </span>
                    <div className="font-mono font-black text-2xl text-[#0F172A] dark:text-[#F8FAFC]">
                      {formatCurrency(
                        Number(dt.net_amount),
                        dt.account?.currency || "IDR",
                      )}
                    </div>
                  </div>

                  {!isBuy && (
                    <div className="pt-2 border-t border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between">
                      <span className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                        {language === "en"
                          ? "Realized Profit/Loss"
                          : "Hasil Realized (PnL)"}
                        :
                      </span>
                      <span
                        className={cn(
                          "font-mono font-bold text-sm",
                          isProfit
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400",
                        )}
                      >
                        {isProfit ? "+" : ""}
                        {formatCurrency(pnl, dt.account?.currency || "IDR")} (
                        {isProfit
                          ? t.investments.gainLabel
                          : t.investments.lossLabel}
                        )
                      </span>
                    </div>
                  )}
                </div>

                {/* Detail Info List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A]">
                    <span className="text-[10px] font-bold uppercase text-[#94A3B8] block mb-1">
                      {language === "en" ? "RDN Account" : "Akun RDN"}
                    </span>
                    <span className="font-bold text-[#0F172A] dark:text-[#FAFAFA]">
                      {dt.account?.name || "RDN"} (
                      {dt.account?.currency || "IDR"})
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A]">
                    <span className="text-[10px] font-bold uppercase text-[#94A3B8] block mb-1">
                      {language === "en" ? "Trade Date" : "Tanggal Transaksi"}
                    </span>
                    <span className="font-bold text-[#0F172A] dark:text-[#FAFAFA]">
                      {format(parseISO(dt.trade_date), "EEEE, dd MMMM yyyy")}
                    </span>
                  </div>
                </div>

                {/* Notes */}
                {dt.notes && (
                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs">
                    <span className="text-[10px] font-bold uppercase text-[#94A3B8] block mb-1">
                      {t.common.note}
                    </span>
                    <p className="text-[#0F172A] dark:text-[#FAFAFA] whitespace-pre-wrap leading-relaxed">
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
                    className="gap-1.5 flex-1 cursor-pointer"
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
                    className="gap-1.5 px-3 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedTradeForDetail(null)}
                    className="cursor-pointer"
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
