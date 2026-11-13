"use client";

import { useCallback, useMemo, useState } from "react";
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
  RefreshCw,
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
  EnrichedEtfHolding,
  EnrichedEtfTrade,
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
import { recordEtfTrade, updateEtfTrade, deleteEtfTrade } from "@/actions/etf";
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
import { formatCurrency, convertAmount, type ForexRatesMap } from "@/lib/utils/currency";
import { usePreferredCurrency } from "@/lib/storage/preferred-currency";
import { usePrivacyMode, maskCurrency } from "@/lib/storage/privacy-mode";
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

type AssetKind = "stock" | "crypto" | "etf";
type Activity = EnrichedStockTrade | EnrichedCryptoTrade | EnrichedEtfTrade;

const getActivityKind = (a: Activity): AssetKind =>
  "lots" in a ? "stock" : "symbol" in a ? "crypto" : "etf";
const getActivityTicker = (a: Activity, kind: AssetKind): string =>
  kind === "stock"
    ? (a as EnrichedStockTrade).ticker || ""
    : kind === "etf"
      ? (a as EnrichedEtfTrade).ticker || ""
      : (a as EnrichedCryptoTrade).symbol || "";
const getActivityGross = (a: Activity, kind: AssetKind): number =>
  Number(
    kind === "stock"
      ? (a as EnrichedStockTrade).net_amount
      : (a as unknown as { gross_amount?: number }).gross_amount ?? 0,
  ) || 0;
type TabKey = "portfolio" | "activity" | "reporting";
type ReportPeriod = "all" | "this_month" | "this_year" | "custom";

interface PortfolioInvestmentViewProps {
  stocks: EnrichedStockHolding[];
  stockTrades: EnrichedStockTrade[];
  cryptos: EnrichedCryptoHolding[];
  cryptoTrades: EnrichedCryptoTrade[];
  etfs: EnrichedEtfHolding[];
  etfTrades: EnrichedEtfTrade[];
  accounts: Account[];
  transfers: EnrichedTransfer[];
  rates?: ForexRatesMap;
  prices?: Array<{ kind: string; symbol: string; price: number; currency: string; fetchedAt: string }>;
}

export function PortfolioInvestmentView({
  stocks,
  stockTrades,
  cryptos,
  cryptoTrades,
  etfs,
  etfTrades,
  accounts,
  transfers,
  rates,
  prices = [],
}: PortfolioInvestmentViewProps) {
  const { t, language } = useLanguage();
  const router = useRouter();
  const i18n = t.investments;
  const cryptoI18n = i18n.crypto;
  const isEn = language === "en";
  const isPrivate = usePrivacyMode();
  const displayCurrency = usePreferredCurrency();
  const fmt = (amount: number, currency: string = "IDR") =>
    maskCurrency(
      formatCurrency(
        convertAmount(amount, currency, displayCurrency, rates),
        displayCurrency,
      ),
      isPrivate,
    );

  const investmentAccounts = accounts.filter(
    (account) => account.type === "investment" && account.is_active,
  );
  const investmentAccountIds = useMemo(
    () => new Set(investmentAccounts.map((account) => account.id)),
    [investmentAccounts],
  );

  const latestPriceFetchedAt = prices.reduce<string | null>(
    (latest, p) => (!latest || p.fetchedAt > latest ? p.fetchedAt : latest),
    null,
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
  const [editSettlementCurrency, setEditSettlementCurrency] = useState<string | null>(null);
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
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);
  const [showCashBreakdown, setShowCashBreakdown] = useState(false);
  // Percentage slider state for crypto trading
  const [cryptoPercent, setCryptoPercent] = useState<number>(0);

  // Filter states for Buku Transaksi (Activity Tab)
  const [activityKindFilter, setActivityKindFilter] = useState<
    "all" | "stock" | "crypto" | "etf"
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

  const priceMap = useMemo(
    () => new Map(prices.map((p) => [`${p.kind}:${p.symbol.toUpperCase()}`, p])),
    [prices],
  );
  const toIdr = useCallback(
    (amount: number, currency: string) => convertAmount(amount, currency, "IDR", rates),
    [rates],
  );
  const marketValue = (
    kind: "stock" | "crypto" | "etf",
    symbol: string,
    quantity: number,
    cost: number,
    costCurrency: string,
  ): number => {
    const costIdr = toIdr(cost, costCurrency);
    const cached = priceMap.get(`${kind}:${symbol.toUpperCase()}`);
    if (!cached || cached.price <= 0 || quantity <= 0) return costIdr;
    return toIdr(quantity * cached.price, cached.currency);
  };

  const stockCost = stocks.reduce(
    (total, holding) =>
      total +
      toIdr(Number(holding.total_cost) || 0, holding.currency || holding.account?.currency || "IDR"),
    0,
  );
  const cryptoCost = cryptos.reduce(
    (total, holding) =>
      total +
      toIdr(Number(holding.cost_basis) || 0, holding.price_currency || "IDR"),
    0,
  );
  const etfCost = etfs.reduce(
    (total, holding) =>
      total +
      toIdr(Number(holding.total_cost) || 0, holding.currency || holding.account?.currency || "IDR"),
    0,
  );
  const stockValue = stocks.reduce((total, holding) => {
    const shares =
      Number((holding as { total_shares?: number }).total_shares) ||
      Number(holding.lots || 0) * 100 ||
      0;
    return (
      total +
      marketValue(
        "stock",
        holding.ticker || "",
        shares,
        Number(holding.total_cost) || 0,
        holding.currency || holding.account?.currency || "IDR",
      )
    );
  }, 0);
  const cryptoValue = cryptos.reduce(
    (total, holding) =>
      total +
      marketValue(
        "crypto",
        holding.symbol || "",
        Number(holding.quantity) || 0,
        Number(holding.cost_basis) || 0,
        holding.price_currency || "IDR",
      ),
    0,
  );
  const etfValue = etfs.reduce(
    (total, holding) =>
      total +
      marketValue(
        "etf",
        holding.ticker || "",
        Number(holding.quantity) || 0,
        Number(holding.total_cost) || 0,
        holding.currency || holding.account?.currency || "IDR",
      ),
    0,
  );
  const cashValue = investmentAccounts.reduce(
    (total, account) =>
      total + toIdr(Number(account.current_balance) || 0, account.currency || "IDR"),
    0,
  );
  const totalPortfolioValue = stockValue + cryptoValue + etfValue + cashValue;
  const totalCostValue = stockCost + cryptoCost + etfCost + cashValue;
  const unrealizedPnl = totalPortfolioValue - totalCostValue;

  // Consolidated & sorted activity transactions
  const allActivities = useMemo<Activity[]>(
    () =>
      [...stockTrades, ...cryptoTrades, ...etfTrades].sort(
        (a, b) =>
          new Date(b.trade_date).getTime() - new Date(a.trade_date).getTime() ||
          new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime(),
      ),
    [stockTrades, cryptoTrades, etfTrades],
  );

  // Filtered activity for Buku Transaksi tab
  const filteredActivities = useMemo(() => {
    return allActivities.filter((activity) => {
      const kind = getActivityKind(activity);
      const code = getActivityTicker(activity, kind).toLowerCase();
      const query = activitySearch.trim().toLowerCase();
      const note = (activity.notes || "").toLowerCase();
      const accName = (activity.account?.name || "").toLowerCase();
      if (activityKindFilter !== "all" && activityKindFilter !== kind) return false;
      if (activityActionFilter !== "all" && activity.type !== activityActionFilter) return false;
      if (query && !(code.includes(query) || note.includes(query) || accName.includes(query))) return false;
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

  const isDateInInterval = useCallback(
    (dateStr: string) => {
      if (!intervalStart || !intervalEnd) return true;
      try {
        const d = parseISO(dateStr.slice(0, 10));
        return isWithinInterval(d, { start: intervalStart, end: intervalEnd });
      } catch {
        return true;
      }
    },
    [intervalStart, intervalEnd],
  );

  const reportStockTrades = useMemo(
    () => stockTrades.filter((tr) => isDateInInterval(tr.trade_date)),
    [stockTrades, isDateInInterval],
  );

  const reportCryptoTrades = useMemo(
    () => cryptoTrades.filter((tr) => isDateInInterval(tr.trade_date)),
    [cryptoTrades, isDateInInterval],
  );

  const reportEtfTrades = useMemo(
    () => etfTrades.filter((tr) => isDateInInterval(tr.trade_date)),
    [etfTrades, isDateInInterval],
  );

  const reportTransfers = useMemo(
    () => investmentTransfers.filter((tr) => isDateInInterval(tr.transfer_date)),
    [investmentTransfers, isDateInInterval],
  );

  // Reporting Analytics Calculations (normalized to IDR for cross-currency correctness):
  const reportingStats = useMemo(() => {
    const tradeCurrency = (
      tr: {
        currency?: string | null;
        fee_currency?: string | null;
        price_currency?: string | null;
        from_currency?: string | null;
        account?: { currency?: string | null } | null;
      },
      kind: AssetKind,
    ) =>
      tr.currency ||
      (kind === "crypto" ? tr.fee_currency || tr.price_currency : null) ||
      tr.account?.currency ||
      "IDR";

    const stockSales = reportStockTrades.filter((tr) => tr.type === "sell");
    const cryptoSales = reportCryptoTrades.filter((tr) => tr.type === "sell");
    const etfSales = reportEtfTrades.filter((tr) => tr.type === "sell");
    const allSales = [...stockSales, ...cryptoSales, ...etfSales];

    let totalGain = 0;
    let totalLoss = 0;
    let winningTradesCount = 0;
    let losingTradesCount = 0;

    for (const trade of allSales) {
      const kind = "ticker" in trade && "lots" in trade ? "stock" : "symbol" in trade ? "crypto" : "etf";
      const pnl = toIdr(Number(trade.realized_pnl) || 0, tradeCurrency(trade, kind as AssetKind));
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
      (sum, tr) => sum + toIdr(Number(tr.stamp_duty) || 0, tradeCurrency(tr, "stock")),
      0,
    );
    const cryptoFees = reportCryptoTrades.reduce(
      (sum, tr) =>
        sum +
        toIdr(
          Number(tr.fee_amount) || 0,
          tr.fee_currency || tradeCurrency(tr, "crypto"),
        ),
      0,
    );
    const etfFees = reportEtfTrades.reduce(
      (sum, tr) => sum + toIdr(Number(tr.fee_amount) || 0, tradeCurrency(tr, "etf")),
      0,
    );
    const transferFees = reportTransfers.reduce(
      (sum, tr) =>
        sum +
        toIdr(
          Number(tr.fee_amount) || 0,
          (tr as { from_currency?: string | null; fee_currency?: string | null }).from_currency ||
            (tr as { from_currency?: string | null; fee_currency?: string | null }).fee_currency ||
            "IDR",
        ),
      0,
    );
    const totalFees = stockStampDuty + cryptoFees + etfFees + transferFees;
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
      const pnl = toIdr(Number(trade.realized_pnl) || 0, tradeCurrency(trade, "stock"));
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
      const pnl = toIdr(Number(trade.realized_pnl) || 0, tradeCurrency(trade, "crypto"));
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

    for (const trade of etfSales) {
      const sym = trade.ticker;
      const pnl = toIdr(Number(trade.realized_pnl) || 0, tradeCurrency(trade, "etf"));
      const curr = assetMap.get(sym) || {
        kind: "etf",
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

    // Fee breakdown items (normalized to IDR)
    const feeRecords = [
      ...reportStockTrades
        .filter((tr) => Number(tr.stamp_duty) > 0)
        .map((tr) => ({
          id: `stock-${tr.id}`,
          date: tr.trade_date,
          type: i18n.feesStock,
          reference: "",
          amount: toIdr(Number(tr.stamp_duty), tradeCurrency(tr, "stock")),
        })),
      ...reportCryptoTrades
        .filter((tr) => Number(tr.fee_amount) > 0)
        .map((tr) => ({
          id: `crypto-${tr.id}`,
          date: tr.trade_date,
          type: i18n.feesCrypto,
          reference: `${tr.symbol} Â· ${tr.type === "buy" ? i18n.buy : i18n.sell}`,
          amount: toIdr(
            Number(tr.fee_amount),
            tr.fee_currency || tradeCurrency(tr, "crypto"),
          ),
        })),
      ...reportEtfTrades
        .filter((tr) => Number(tr.fee_amount) > 0)
        .map((tr) => ({
          id: `etf-${tr.id}`,
          date: tr.trade_date,
          type: isEn ? "US ETF broker fee" : "Fee broker ETF AS",
          reference: `${tr.ticker} Â· ${tr.type === "buy" ? i18n.buy : i18n.sell}`,
          amount: toIdr(Number(tr.fee_amount), tradeCurrency(tr, "etf")),
        })),
      ...reportTransfers
        .filter((tr) => Number(tr.fee_amount) > 0)
        .map((tr) => ({
          id: `transfer-${tr.id}`,
          date: tr.transfer_date,
          type: i18n.feesTransfer,
          reference:
            tr.description ||
            `${tr.from_account?.name || "â€”"} â†’ ${tr.to_account?.name || "â€”"}`,
          amount: toIdr(
            Number(tr.fee_amount),
            (tr as { from_currency?: string | null; fee_currency?: string | null }).from_currency ||
              (tr as { from_currency?: string | null; fee_currency?: string | null }).fee_currency ||
              "IDR",
          ),
        })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      totalGain,
      totalLoss,
      netRealizedPnl,
      stockStampDuty,
      cryptoFees,
      etfFees,
      transferFees,
      totalFees,
      totalClosedCount,
      winningTradesCount,
      losingTradesCount,
      winRate,
      assetPerformance,
      feeRecords,
    };
  }, [reportStockTrades, reportCryptoTrades, reportEtfTrades, reportTransfers, i18n, isEn, toIdr]);

  // Donut chart data â€” warna paten per jenis aset (biar ETF & Kas beda,
  // dan nggak geser kalau salah satu nilainya 0)
  const allocationData = useMemo(
    () =>
      [
        { key: "cash", name: isEn ? "Cash" : "Kas", value: cashValue, color: "#94A3B8" },
        { key: "stock", name: isEn ? "Stocks" : "Saham", value: stockValue, color: "#10B981" },
        { key: "crypto", name: isEn ? "Crypto" : "Kripto", value: cryptoValue, color: "#F59E0B" },
        { key: "etf", name: isEn ? "US ETFs" : "ETF AS", value: etfValue, color: "#6366F1" },
      ].filter((d) => d.value > 0),
    [cashValue, stockValue, cryptoValue, etfValue, isEn],
  );

  // Bar chart data â€” P&L per aset (dari reportingStats yang sudah ada)
  const [showAllPnl, setShowAllPnl] = useState(false);
  const pnlBarDataFull = useMemo(
    () =>
      reportingStats.assetPerformance.map((a) => ({
        symbol: a.symbol,
        pnl: a.netPnl,
      })),
    [reportingStats.assetPerformance],
  );
  const pnlBarData = useMemo(
    () =>
      showAllPnl
        ? pnlBarDataFull
        : [...pnlBarDataFull]
            .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
            .slice(0, 5),
    [pnlBarDataFull, showAllPnl],
  );

  // Line chart â€” kumulatif P&L over time (ikut filter periode), normalized to IDR
  const cumulativePnlData = useMemo(() => {
    const dailyPnl = new Map<string, number>();
    const tradeCurrency = (
      tr: {
        currency?: string | null;
        fee_currency?: string | null;
        price_currency?: string | null;
        account?: { currency?: string | null } | null;
      },
      kind: AssetKind,
    ) =>
      tr.currency ||
      (kind === "crypto" ? tr.fee_currency || tr.price_currency : null) ||
      tr.account?.currency ||
      "IDR";
    const addSell = (date: string, pnl: number, currency: string) => {
      dailyPnl.set(date, (dailyPnl.get(date) || 0) + toIdr(pnl, currency));
    };
    for (const t of reportStockTrades) {
      if (t.type === "sell")
        addSell(t.trade_date.slice(0, 10), Number(t.realized_pnl) || 0, tradeCurrency(t, "stock"));
    }
    for (const t of reportCryptoTrades) {
      if (t.type === "sell")
        addSell(t.trade_date.slice(0, 10), Number(t.realized_pnl) || 0, tradeCurrency(t, "crypto"));
    }
    for (const t of reportEtfTrades) {
      if (t.type === "sell")
        addSell(t.trade_date.slice(0, 10), Number(t.realized_pnl) || 0, tradeCurrency(t, "etf"));
    }
    const sorted = Array.from(dailyPnl.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, pnl]) => ({ date, pnl }));

    return sorted.reduce<Array<{ date: string; cumulative: number }>>(
      (result, trade) => {
        const previous = result[result.length - 1]?.cumulative || 0;
        return [
          ...result,
          { date: trade.date, cumulative: previous + trade.pnl },
        ];
      },
      [],
    );
  }, [reportStockTrades, reportCryptoTrades, reportEtfTrades, toIdr]); // Real-time calculation helpers for modals
  const estimatedCryptoQuantity =
    Number(amount) > 0 && Number(price) > 0
      ? Math.round((Number(amount) / Number(price)) * 100_000_000) /
        100_000_000
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
  const selectedEtf = etfs.find((holding) => holding.id === selectedId);
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const formSettlementCurrency =
    editSettlementCurrency || selectedAccount?.currency || "IDR";

  // Synchronize crypto percentage slider
  const handleCryptoBuyPercentChange = (pct: number) => {
    setCryptoPercent(pct);
    const balance = Number(selectedAccount?.current_balance || 0);
    if (balance > 0) {
      const currentFee = Number(fee) || 0;
      const targetAmount = Math.max(
        0,
        Math.floor(balance * (pct / 100) - (pct === 100 ? currentFee : 0)),
      );
      setAmount(String(targetAmount));
      if (Number(price) > 0 && targetAmount > 0) {
        const targetQuantity =
          Math.round((targetAmount / Number(price)) * 100_000_000) /
          100_000_000;
        setQuantity(targetQuantity.toFixed(8));
      }
    }
  };

  const handleCryptoSellPercentChange = (pct: number) => {
    setCryptoPercent(pct);
    const target = assetKind === "etf" ? selectedEtf : selectedCrypto;
    if (target) {
      const maxQty = Number(target.quantity || 0);
      if (maxQty > 0) {
        const targetQty = maxQty * (pct / 100);
        setQuantity(targetQty.toFixed(8).replace(/\.?0+$/, ""));
        if (Number(price) > 0) {
          setAmount(String(Math.round(targetQty * Number(price))));
        }
      }
    }
  };

  const handleAccountChange = (id: string) => {
    setAccountId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("investment_last_account_id", id);
    }
  };

  // Switcher Saham/Kripto/ETF di form yang sama: jangan bawa symbol antar
  // jenis biar BTC gak nyangkut ke ETF (dan sebaliknya).
  const handleKindSwitch = (kind: AssetKind) => {
    if (kind === assetKind) return;
    setAssetKind(kind);
    setCryptoPercent(0);
    if (kind === "etf") setSymbol("");
    else if (kind === "crypto") setSymbol("BTC");
  };

  const closeModal = () => {
    setModal(null);
    setEditTradeType(null);
    setEditSettlementCurrency(null);
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

  // Satu form yang sama kayak crypto & saham INDO:
  // Record Trade (header) = beli doang, Jual = dari kartu aset.
  // Yang beda hanya field input per jenis aset.
  const openBuy = (
    kind: AssetKind,
    holding?: EnrichedStockHolding | EnrichedCryptoHolding | EnrichedEtfHolding,
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
      } else if (kind === "etf") {
        setSymbol((holding as EnrichedEtfHolding).ticker);
      } else {
        setSymbol((holding as EnrichedCryptoHolding).symbol);
      }
      setAccountId(holding.account_id);
    }
    setModal("buy");
  };

  const openSell = (
    kind: AssetKind,
    holding?: EnrichedStockHolding | EnrichedCryptoHolding | EnrichedEtfHolding,
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
      } else if (kind === "etf") {
        setSymbol((holding as EnrichedEtfHolding).ticker);
        setQuantity(String((holding as EnrichedEtfHolding).quantity));
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
              netAmount: Number(amount) || stockSellGrossAmount,
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
              quantity: Number(quantity),
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
              grossAmount: Number(amount) || cryptoSellGrossAmount,
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
          quantity: Number(quantity),
          grossAmount:
            editTradeType === "buy"
              ? Number(amount)
              : Number(amount) || cryptoSellGrossAmount,
          feeAmount: Number(fee || 0),
          pricePerUnit: Number(price),
          notes: notes || null,
          tradeDate: date,
        });
      } else if (assetKind === "etf" && modal === "buy") {
        result = !accountId
          ? {
              error: isEn
                ? "Select an account first"
                : "Pilih akun terlebih dahulu",
            }
          : await recordEtfTrade({
              accountId,
              ticker: symbol,
              type: "buy",
              quantity: Number(quantity),
              pricePerUnit: Number(price),
              feeAmount: Number(fee || 0),
              notes: notes || null,
              tradeDate: date,
            });
      } else if (assetKind === "etf" && modal === "sell") {
        const correctedGross = Number(amount) || cryptoSellGrossAmount;
        const qty = Number(quantity);
        const effectiveEtfPrice =
          correctedGross > 0 && qty > 0 ? correctedGross / qty : Number(price);
        result = selectedEtf && accountId
          ? await recordEtfTrade({
              accountId,
              ticker: selectedEtf.ticker,
              type: "sell",
              quantity: qty,
              pricePerUnit: effectiveEtfPrice,
              feeAmount: Number(fee || 0),
              notes: notes || null,
              tradeDate: date,
            })
          : {
              error: isEn
                ? "Select an ETF holding first"
                : "Pilih kepemilikan ETF terlebih dahulu",
            };
      } else if (assetKind === "etf" && modal === "edit" && selectedId) {
        const correctedGross = Number(amount) || cryptoSellGrossAmount;
        const qty = Number(quantity);
        const effectivePrice =
          correctedGross > 0 && qty > 0 ? correctedGross / qty : Number(price);
        result = await updateEtfTrade({
          id: selectedId,
          quantity: qty,
          pricePerUnit: effectivePrice,
          feeAmount: Number(fee || 0),
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
      const assetLabel = assetKind === "etf" ? i18n.etf.title : assetKind === "crypto" ? i18n.cryptoAsset : i18n.stock;
      toast.success(
        modal === "edit"
          ? assetKind === "etf"
            ? i18n.etf.updated
            : assetKind === "crypto"
              ? (isEn ? "Crypto trade updated successfully!" : "Transaksi kripto berhasil diperbarui!")
              : i18n.editTradeSuccess
          : modal === "buy"
            ? assetKind === "etf"
              ? i18n.etf.saved
              : isEn
                ? `${assetLabel} purchase recorded!`
                : `Transaksi beli ${assetLabel.toLowerCase()} berhasil dicatat!`
            : assetKind === "etf"
              ? i18n.etf.sellSaved
              : isEn
                ? `${assetLabel} sale recorded!`
                : `Transaksi jual ${assetLabel.toLowerCase()} berhasil dicatat!`,
      );
      closeModal();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (trade: Activity) => {
    setDeleteTarget(trade);
  };

  const handleDeleteCrypto = (trade: EnrichedCryptoTrade) => {
    setDeleteTarget(trade);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const kind = getActivityKind(deleteTarget);
    const result =
      kind === "etf"
        ? await deleteEtfTrade(deleteTarget.id)
        : kind === "crypto"
          ? await deleteCryptoTrade(deleteTarget.id)
          : await deleteStockTrade(deleteTarget.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(
        kind === "etf"
          ? i18n.etf.deleted
          : kind === "crypto"
            ? i18n.deleteCryptoSuccess
            : i18n.deleteSuccess,
      );
      router.refresh();
    }
    setIsDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-3.5 px-1 pb-20 sm:gap-4 sm:px-2">
      {/* Header: title row + total row, actions compact */}
      <header className="rounded-2xl border border-[#E5E7EB] bg-white p-3.5 shadow-2xs dark:border-[#27272A] dark:bg-[#121215] sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-black tracking-tight text-[#0F172A] dark:text-[#F8FAFC] sm:text-lg">
                {i18n.title}
              </h1>
              <p className="truncate text-[10px] text-[#64748B] dark:text-[#94A3B8] sm:text-[11px]">
                {i18n.subtitle}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={isRefreshingPrices}
              onClick={async () => {
                setIsRefreshingPrices(true);
                try {
                  const { refreshAssetPricesAction } = await import(
                    "@/actions/asset-prices"
                  );
                  const res = await refreshAssetPricesAction();
                  if (res?.error) {
                    toast.error(res.error);
                  } else {
                    toast.success(
                      isEn ? "Market prices updated" : "Harga pasar diperbarui",
                    );
                    router.refresh();
                  }
                } finally {
                  setIsRefreshingPrices(false);
                }
              }}
              title={isEn ? "Refresh Prices" : "Refresh Harga"}
              className="h-9 w-9 rounded-xl p-0"
            >
              <RefreshCw className={cn("h-4 w-4 shrink-0", isRefreshingPrices && "animate-spin")} />
            </Button>
            <Button
              variant="outline"
              onClick={() => openBuy("crypto")}
              title={i18n.addTradeBtn}
              className="h-9 gap-1.5 rounded-full px-3.5 text-xs font-bold shadow-xs"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span className="truncate hidden sm:inline">{i18n.addTradeBtn}</span>
            </Button>
          </div>
        </div>
        <div className="mt-3">
          <div className="relative">
              <button
                type="button"
                onClick={() => setShowCashBreakdown((prev) => !prev)}
                className="flex w-full items-end justify-between gap-3 rounded-xl bg-[#F8F9FA] px-4 py-3 text-left transition-colors hover:bg-[#F1F3F5] dark:bg-[#1A1A20] dark:hover:bg-[#222228]"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] leading-none">
                    {i18n.totalPortfolio}
                  </span>
                  <span className="mt-1 whitespace-nowrap font-mono text-lg font-black leading-none text-[#0F172A] dark:text-[#F8FAFC] sm:text-2xl">
                    {isRefreshingPrices ? (
                      <span className="inline-block h-6 w-32 animate-pulse rounded-md bg-slate-200 dark:bg-[#27272A] sm:h-8 sm:w-40" />
                    ) : (
                      fmt(totalPortfolioValue, "IDR")
                    )}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] leading-none">
                    {isEn ? "Unrealized P&L" : "Unrealized P&L"}
                  </span>
                  {isRefreshingPrices ? (
                    <>
                      <span className="mt-1 inline-block h-3.5 w-20 animate-pulse rounded bg-slate-200 dark:bg-[#27272A]" />
                      <span className="mt-0.5 inline-block h-2.5 w-14 animate-pulse rounded bg-slate-100 dark:bg-[#1E1E24]" />
                    </>
                  ) : (
                    <>
                      <span
                        className={cn(
                          "mt-1 truncate font-mono text-xs font-black leading-none",
                          unrealizedPnl >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400",
                        )}
                      >
                        {unrealizedPnl >= 0 ? "+" : ""}
                        {fmt(unrealizedPnl, "IDR")}
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 font-mono text-[10px] font-bold leading-none",
                          unrealizedPnl >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400",
                        )}
                      >
                        {(() => {
                          const base = totalCostValue - cashValue;
                          const pct = base > 0 ? (unrealizedPnl / base) * 100 : 0;
                          return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
                        })()}
                      </span>
                    </>
                  )}
                </span>
              </button>

              {latestPriceFetchedAt && (
                <p className="mt-1.5 px-1 text-[10px] text-[#94A3B8]">
                  {isEn ? "Prices as of " : "Harga per "}
                  {new Date(latestPriceFetchedAt).toLocaleString(
                    isEn ? "en-US" : "id-ID",
                    {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  )}
                </p>
              )}

              {showCashBreakdown && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowCashBreakdown(false)}
                  />

                  {/* Popover */}
                  <div className="absolute left-0 top-full z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-lg dark:border-[#27272A] dark:bg-[#121215]">
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
                            <span className="shrink-0 whitespace-nowrap font-mono text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                              {fmt(
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
                          <span className="whitespace-nowrap font-mono text-xs font-black text-[#0F172A] dark:text-[#F8FAFC]">
                            {fmt(cashValue, "IDR")}
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
                        {isRefreshingPrices ? (
                          <span className="inline-block h-3.5 w-20 animate-pulse rounded bg-slate-200 dark:bg-[#27272A]" />
                        ) : (
                          <span className="font-mono text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                            {fmt(stockValue, "IDR")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                          {i18n.cryptoAsset}
                        </span>
                        {isRefreshingPrices ? (
                          <span className="inline-block h-3.5 w-20 animate-pulse rounded bg-slate-200 dark:bg-[#27272A]" />
                        ) : (
                          <span className="font-mono text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                            {fmt(cryptoValue, "IDR")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                          {i18n.etf.title}
                        </span>
                        {isRefreshingPrices ? (
                          <span className="inline-block h-3.5 w-20 animate-pulse rounded bg-slate-200 dark:bg-[#27272A]" />
                        ) : (
                          <span className="font-mono text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                            {fmt(etfValue, "IDR")}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-3 border-t border-[#E5E7EB] pt-1.5 dark:border-[#27272A]">
                        <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                          {i18n.totalPortfolio}
                        </span>
                        {isRefreshingPrices ? (
                          <span className="inline-block h-3.5 w-24 animate-pulse rounded bg-slate-200 dark:bg-[#27272A]" />
                        ) : (
                          <span className="whitespace-nowrap font-mono text-xs font-black text-[#0F172A] dark:text-[#F8FAFC]">
                            {fmt(totalPortfolioValue, "IDR")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
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
              "flex min-h-10.5 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-center text-xs font-bold transition-all sm:min-h-11",
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
            {stocks.map((holding) => {
              const shares =
                Number((holding as { total_shares?: number }).total_shares) ||
                Number(holding.lots || 0) * 100 ||
                0;
              const quote = priceMap.get(`stock:${(holding.ticker || "").toUpperCase()}`);
              const market = marketValue(
                "stock",
                holding.ticker || "",
                shares,
                Number(holding.total_cost) || 0,
                holding.currency || holding.account?.currency || "IDR",
              );
              return (
                <StockCard
                  key={holding.id}
                  holding={holding}
                  quote={quote}
                  marketValue={market}
                  costIdr={toIdr(Number(holding.total_cost) || 0, holding.currency || holding.account?.currency || "IDR")}
                  rates={rates}
                  isRefreshing={isRefreshingPrices}
                  onBuy={() => openBuy("stock", holding)}
                  onSell={() => openSell("stock", holding)}
                />
              );
            })}
            {cryptos.map((holding) => {
              const quote = priceMap.get(`crypto:${(holding.symbol || "").toUpperCase()}`);
              const market = marketValue(
                "crypto",
                holding.symbol || "",
                Number(holding.quantity) || 0,
                Number(holding.cost_basis) || 0,
                holding.price_currency || "IDR",
              );
              return (
                <CryptoCard
                  key={holding.id}
                  holding={holding}
                  quote={quote}
                  marketValue={market}
                  costIdr={toIdr(Number(holding.cost_basis) || 0, holding.price_currency || "IDR")}
                  rates={rates}
                  isRefreshing={isRefreshingPrices}
                  onBuy={() => openBuy("crypto", holding)}
                  onSell={() => openSell("crypto", holding)}
                />
              );
            })}
            {etfs.map((holding) => {
              const quote = priceMap.get(`etf:${(holding.ticker || "").toUpperCase()}`);
              const market = marketValue(
                "etf",
                holding.ticker || "",
                Number(holding.quantity) || 0,
                Number(holding.total_cost) || 0,
                holding.currency || holding.account?.currency || "IDR",
              );
              return (
                <EtfCard
                  key={holding.id}
                  holding={holding}
                  quote={quote}
                  marketValue={market}
                  costIdr={toIdr(Number(holding.total_cost) || 0, holding.currency || holding.account?.currency || "IDR")}
                  rates={rates}
                  isRefreshing={isRefreshingPrices}
                  onBuy={() => openBuy("etf", holding)}
                  onSell={() => openSell("etf", holding)}
                />
              );
            })}
          </div>
          {stocks.length + cryptos.length + etfs.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-white p-12 text-center text-xs text-[#64748B] dark:border-[#27272A] dark:bg-[#121215]">
              <Layers className="mx-auto mb-2 h-8 w-8 text-[#94A3B8]" />
              <p className="font-bold">{i18n.emptyHoldingsTitle}</p>
              <p className="mt-1 text-[11px] text-[#94A3B8]">
                {i18n.emptyHoldingsDesc}
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Button onClick={() => openBuy("crypto")} className="min-h-10">
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {i18n.addTradeBtn}
                </Button>
              </div>
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
              {/* Asset Kind Filter: Full-width 4-columns */}
              <div className="grid grid-cols-4 gap-1 rounded-xl bg-[#F8F9FA] p-1 dark:bg-[#1A1A20]">
                {(
                  [
                    ["all", isEn ? "All" : "Semua"],
                    ["stock", i18n.stock],
                    ["crypto", i18n.cryptoAsset],
                    ["etf", i18n.etf.title],
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
              const kind = getActivityKind(activity);
              const isStock = kind === "stock";
              const isEtf = kind === "etf";
              const isBuy = activity.type === "buy";
              const symbolText = getActivityTicker(activity, kind);
              const totalAmount = getActivityGross(activity, kind);
              const pnl = Number(activity.realized_pnl) || 0;
              const hasPnl = !isBuy;
              const settlementCurrency =
                (activity as { currency?: string }).currency ||
                (kind === "crypto"
                  ? (activity as { price_currency?: string }).price_currency
                  : null) ||
                activity.account?.currency ||
                "IDR";

              return (
                <div
                  key={activity.id}
                  className="flex flex-col gap-2.5 rounded-2xl border border-[#E5E7EB] bg-white p-3.5 shadow-2xs transition-all hover:border-[#CBD5E1] dark:border-[#27272A] dark:bg-[#121215] dark:hover:border-[#3F3F46] sm:gap-3 sm:p-4"
                >
                  {/* Card Header Row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <AssetLogo
                        kind={kind}
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
                              ? isEtf
                                ? isEn
                                  ? "Buy"
                                  : "Beli"
                                : isStock
                                  ? i18n.buyBtn
                                  : cryptoI18n.buy
                              : isEtf
                                ? isEn
                                  ? "Sell"
                                  : "Jual"
                                : isStock
                                  ? i18n.sellBtn
                                  : cryptoI18n.sell}
                          </span>
                          <span className="rounded-md border border-[#E5E7EB] bg-[#F8F9FA] px-1.5 py-0.5 text-[9px] font-bold text-[#64748B] dark:border-[#27272A] dark:bg-[#1A1A20] dark:text-[#94A3B8]">
                            {isEtf ? i18n.etf.title : isStock ? i18n.stock : i18n.cryptoAsset}
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
                          {new Date(activity.trade_date).toLocaleTimeString(
                            isEn ? "en-US" : "id-ID",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                          <span className="block">
                            {activity.account?.name || "Platform"} Â· {settlementCurrency}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Actions: Edit & Delete */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (isEtf) {
                            const trade = activity as EnrichedEtfTrade;
                            setAccountId(trade.account_id);
                            setEditSettlementCurrency((trade as { currency?: string; account?: { currency?: string } }).currency || trade.account?.currency || "IDR");
                            setSymbol(trade.ticker);
                            setQuantity(String(trade.quantity));
                            setAmount(String(trade.gross_amount));
                            setPrice(String(trade.price_per_unit));
                            setFee(String(trade.fee_amount || 0));
                            setDate(trade.trade_date.slice(0, 10));
                            setNotes(trade.notes || "");
                            setAssetKind("etf");
                          } else if (isStock) {
                            const trade = activity as EnrichedStockTrade;
                            setAccountId(trade.account_id);
                            setEditSettlementCurrency((trade as { currency?: string; account?: { currency?: string } }).currency || trade.account?.currency || "IDR");
                            setTicker(trade.ticker);
                            setLots(String(trade.lots || 1));
                            setAmount(String(trade.net_amount));
                            setDate(trade.trade_date.slice(0, 10));
                            setNotes(trade.notes || "");
                            setAssetKind("stock");
                          } else {
                            const trade = activity as EnrichedCryptoTrade;
                            setAccountId(trade.account_id);
                            setEditSettlementCurrency((trade as { currency?: string; account?: { currency?: string } }).currency || trade.account?.currency || "IDR");
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
                        className="flex h-8 w-8 min-h-9 min-w-9 items-center justify-center rounded-xl text-[#94A3B8] transition-colors hover:bg-[#F1F3F5] hover:text-[#0F172A] dark:hover:bg-[#1A1A20] dark:hover:text-[#F8FAFC]"
                        title={i18n.editTradeSuccess || "Edit"}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          isEtf
                            ? handleDelete(activity as EnrichedEtfTrade)
                            : isStock
                              ? handleDelete(activity as EnrichedStockTrade)
                              : handleDeleteCrypto(
                                  activity as EnrichedCryptoTrade,
                                )
                        }
                        className="flex h-8 w-8 min-h-9 min-w-9 items-center justify-center rounded-xl text-[#94A3B8] transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
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
                          : isEtf
                            ? `${formatCryptoQuantity((activity as EnrichedEtfTrade).quantity)} unit`
                            : `${formatCryptoQuantity((activity as EnrichedCryptoTrade).quantity)} ${symbolText}`}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                        {isEn ? "Execution Price" : "Harga Eksekusi"}
                      </span>
                      <p className="font-mono text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                        {isStock
                          ? `${fmt(Number((activity as EnrichedStockTrade).price_per_share || 0), settlementCurrency)}/lbr`
                          : isEtf
                            ? fmt(
                                Number(
                                  (activity as EnrichedEtfTrade)
                                    .price_per_unit || 0,
                                ),
                                settlementCurrency,
                              )
                            : fmt(
                                Number(
                                  (activity as EnrichedCryptoTrade)
                                    .price_per_unit || 0,
                                ),
                                settlementCurrency,
                              )}
                      </p>
                    </div>

                    <div className={cn(!hasPnl && "col-span-2 sm:col-span-1")}>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                        {isEn ? "Total Settlement" : "Total Eksekusi"}
                      </span>
                      <p className="whitespace-nowrap font-mono text-xs font-black text-[#0F172A] dark:text-[#F8FAFC]">
                        {fmt(totalAmount, settlementCurrency)}
                        <span className="ml-1 text-[10px] font-semibold text-[#94A3B8]">({settlementCurrency})</span>
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
                          {fmt(pnl, settlementCurrency)}
                          <span className="ml-1 text-[10px] font-semibold text-[#94A3B8]">({settlementCurrency})</span>
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
              label={isEn ? "Net P&L" : "P&L Bersih"}
              value={`${reportingStats.netRealizedPnl >= 0 ? "+" : ""}${fmt(reportingStats.netRealizedPnl, "IDR")}`}
              tone={
                reportingStats.netRealizedPnl >= 0 ? "positive" : "negative"
              }
            />

            <Summary
              label={isEn ? "Total Realized Profit" : "Total Cuan Bersih"}
              value={`+${fmt(reportingStats.totalGain, "IDR")}`}
              tone="positive"
            />

            <Summary
              label={isEn ? "Total Cut Loss" : "Total Rugi Bersih"}
              value={`-${fmt(reportingStats.totalLoss, "IDR")}`}
              tone={reportingStats.totalLoss > 0 ? "negative" : "neutral"}
            />

            <Summary
              label={isEn ? "Total Paid Fees" : "Total Biaya Terbayar"}
              value={fmt(reportingStats.totalFees, "IDR")}
              tone="neutral"
            />
          </div>

          {/* Win Rate & Trading Efficiency Card */}
          <div className="flex flex-col gap-4 rounded-2xl border border-[#E5E7EB] bg-white p-3.5 shadow-2xs dark:border-[#27272A] dark:bg-[#121215] sm:p-5">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-emerald-600" />
              <h3 className="text-xs font-black uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
                {isEn
                  ? "Trading Win Rate & Discipline"
                  : "Win Rate & Hasil Penjualan"}
              </h3>
            </div>

            <div className="flex items-center gap-4 sm:gap-5">
              {(() => {
                const size = 120;
                const stroke = 10;
                const r = (size - stroke) / 2;
                const c = 2 * Math.PI * r;
                const win = Math.min(100, Math.max(0, reportingStats.winRate));
                const offset = c * (1 - win / 100);
                return (
                  <div className="relative shrink-0" style={{ width: size, height: size }}>
                    <svg width={size} height={size} className="-rotate-90">
                      <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={r}
                        fill="none"
                        strokeWidth={stroke}
                        className="stroke-[#E5E7EB] dark:stroke-[#27272A]"
                      />
                      <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={r}
                        fill="none"
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        className="stroke-emerald-500 transition-all duration-500"
                        strokeDasharray={c}
                        strokeDashoffset={offset}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-mono text-2xl font-black leading-none text-[#0F172A] dark:text-[#F8FAFC]">
                        {win}%
                      </span>
                      <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                        Win Rate
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex flex-1 flex-col divide-y divide-[#E5E7EB] text-xs dark:divide-[#27272A]">
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                    {isEn ? "Total Closed" : "Total Penjualan"}
                  </span>
                  <span className="font-mono text-sm font-black text-[#0F172A] dark:text-[#F8FAFC]">
                    {reportingStats.totalClosedCount}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                    {isEn ? "Profitable" : "Untung (Cuan)"}
                  </span>
                  <span className="font-mono text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {reportingStats.winningTradesCount}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                    {isEn ? "Losses" : "Rugi (Cut Loss)"}
                  </span>
                  <span className="font-mono text-sm font-black text-rose-600 dark:text-rose-400">
                    {reportingStats.losingTradesCount}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row â€” stretch aja biar tinggi sama,
              whitespace di P&L dipindah ke atas, chart nempel bawah */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Donut â€” Alokasi Portofolio */}
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
                        {allocationData.map((d) => (
                          <Cell key={d.key} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const entry = payload[0];
                          const name = String(entry.name ?? "");
                          const val = Number(entry.value ?? 0);
                          return (
                            <div style={{ fontSize: 11, borderRadius: 12, border: "1px solid #E5E7EB" }} className="bg-white px-2.5 py-1.5 shadow-lg dark:bg-[#121215]">
                              <span style={{ color: "#0F172A" }} className="font-bold dark:text-[#F8FAFC]">{name}</span>
                              <span style={{ color: "#0F172A" }} className="ml-2 font-mono font-bold dark:text-[#F8FAFC]">{fmt(val, "IDR")}</span>
                            </div>
                          );
                        }}
                        contentStyle={{
                          fontSize: 11,
                          borderRadius: 12,
                          border: "1px solid #E5E7EB",
                          color: "#0F172A",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-1.5">
                    {allocationData.map((d) => (
                      <div
                        key={d.key}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-1.5">
                          <div
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: d.color }}
                          />
                          <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                            {d.name}
                          </span>
                        </div>
                        <span className="font-mono text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                          {totalPortfolioValue > 0
                            ? `${Math.round((d.value / totalPortfolioValue) * 100)}%`
                            : "â€”"}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-center text-xs text-[#94A3B8] py-8">â€”</p>
              )}
            </div>

            {/* Bar Chart â€” P&L per Aset */}
            <div className="flex flex-col gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-2xs dark:border-[#27272A] dark:bg-[#121215]">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
                {isEn ? "P&L by Asset" : "P&L per Aset"}
              </h3>
              <div className="mt-auto mb-2 w-full">
              {pnlBarData.length > 0 ? (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(80, pnlBarData.length * 36 + 32)}
                >
                  <BarChart
                    data={pnlBarData}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                    barCategoryGap="25%"
                  >
                    <XAxis
                      type="number"
                      domain={[
                        (dataMin: number) => Math.min(0, dataMin),
                        (dataMax: number) =>
                          dataMax > 0 ? dataMax * 1.05 : dataMax,
                      ]}
                      allowDataOverflow={false}
                      tickFormatter={(v) => {
                        if (isPrivate) return "\u2022\u2022\u2022";
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
                      width={56}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const entry = payload[0];
                        const name = String(entry?.payload?.symbol ?? entry?.name ?? "");
                        const val = Number(entry?.value ?? 0);
                        return (
                          <div style={{ fontSize: 11, borderRadius: 12, border: "1px solid #E5E7EB" }} className="bg-white px-2.5 py-1.5 shadow-lg dark:bg-[#121215]">
                            <span style={{ color: "#0F172A" }} className="font-bold dark:text-[#F8FAFC]">{name}</span>
                            <span style={{ color: "#0F172A" }} className="ml-2 font-mono font-bold dark:text-[#F8FAFC]">{val >= 0 ? "+" : ""}{fmt(val, "IDR")}</span>
                          </div>
                        );
                      }}
                      contentStyle={{
                        fontSize: 11,
                        borderRadius: 12,
                        border: "1px solid #E5E7EB",
                        color: "#0F172A",
                      }}
                    />
                    <Bar dataKey="pnl" radius={[0, 6, 6, 0]} maxBarSize={22}>
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
              {pnlBarDataFull.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllPnl(!showAllPnl)}
                  className="mt-2 w-full rounded-lg border border-[#E5E7EB] py-2 text-[11px] font-bold text-[#64748B] hover:text-[#0F172A] dark:border-[#27272A] dark:text-[#94A3B8] dark:hover:text-[#FAFAFA]"
                >
                  {showAllPnl
                    ? (isEn ? "Show top 5" : "Tampilkan top 5")
                    : (isEn ? `Show all (${pnlBarDataFull.length})` : `Lihat semua (${pnlBarDataFull.length})`)}
                </button>
              )}
              </div>
            </div>
          </div>

          {/* Line Chart â€” Kumulatif P&L */}
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
                      if (isPrivate) return "\u2022\u2022\u2022";
                      if (Math.abs(v) < 1000)
                        return `${v >= 0 ? "+" : ""}${Math.round(v)}`;
                      return `${v >= 0 ? "+" : ""}${(v / 1000).toFixed(1)}k`;
                    }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const val = Number(payload[0].value ?? 0);
                      const isProfit = val >= 0;
                      return (
                        <div style={{ fontSize: 11, borderRadius: 12, border: "1px solid #E5E7EB" }} className="bg-white px-2.5 py-1.5 shadow-lg dark:bg-[#121215]">
                          <div style={{ color: "#0F172A" }} className="font-bold dark:text-[#F8FAFC]">{String(label ?? "")}</div>
                          <div style={{ color: isProfit ? "#059669" : "#E11D48" }} className="font-mono font-bold">
                            {isProfit ? "+" : ""}{fmt(val, "IDR")}
                          </div>
                        </div>
                      );
                    }}
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
                            {asset.tradesCount} {isEn ? "sales" : "penjualan"} Â·{" "}
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
                          {fmt(asset.netPnl, "IDR")}
                        </p>
                        <p className="font-mono text-[9px] text-[#94A3B8] whitespace-nowrap sm:text-[10px]">
                          +{fmt(asset.gain, "IDR")} | -
                          {fmt(asset.loss, "IDR")}
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
                  {fmt(reportingStats.totalFees, "IDR")}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                {isEn
                  ? "Indonesian stocks only: Indonesian stamp duty (bea materai), exchange fees, and platform funding costs (already reflected in net P&L). US ETFs/foreign assets have separate US fees and no Indonesian stamp duty."
                  : "Khusus saham Indonesia: bea materai saham, biaya transaksi bursa kripto, dan transfer platform (sudah otomatis terhitung di laba/rugi bersih). ETF AS/asset luar negeri fee-nya terpisah fee AS dan tanpa bea materai Indonesia."}
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
                      {detail.reference ? (
                        <p className="truncate text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                          {detail.reference}
                        </p>
                      ) : null}
                    </div>
                    <span className="font-mono text-xs font-bold text-rose-600 whitespace-nowrap dark:text-rose-400">
                      -{fmt(detail.amount, "IDR")}
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
              ? `${i18n.editCryptoTrade || "Edit Kripto"} Â· ${editTradeType === "buy" ? i18n.buy : i18n.sell}`
              : assetKind === "etf"
                ? `${i18n.etf.editTitle} Â· ${editTradeType === "buy" ? i18n.buy : i18n.sell}`
                : `${i18n.modalEditTradeTitle} Â· ${editTradeType === "buy" ? i18n.buy : i18n.sell}`
            : modal === "buy"
              ? assetKind === "stock"
                ? i18n.modalBuyTitle
                : assetKind === "etf"
                  ? i18n.etf.buyTitle
                  : cryptoI18n.buyTitle
              : assetKind === "stock"
                ? i18n.modalSellTitle
                : assetKind === "etf"
                  ? i18n.etf.sellTitle
                  : cryptoI18n.sellTitle
        }
      >
        <form onSubmit={submitTransaction} className="flex flex-col gap-3.5">
          {modal !== "edit" && !selectedId && (
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-[#F8F9FA] p-1.5 dark:bg-[#1A1A20]">
              <button
                type="button"
                onClick={() => handleKindSwitch("stock")}
                className={cn(
                  "min-h-9 rounded-lg px-3 py-2 text-xs font-bold transition-all",
                  assetKind === "stock"
                    ? "bg-white text-[#0F172A] shadow-xs dark:bg-[#27272A] dark:text-[#FAFAFA]"
                    : "text-[#64748B]",
                )}
              >
                {i18n.stock}
              </button>
              <button
                type="button"
                onClick={() => handleKindSwitch("crypto")}
                className={cn(
                  "min-h-9 rounded-lg px-3 py-2 text-xs font-bold transition-all",
                  assetKind === "crypto"
                    ? "bg-white text-[#0F172A] shadow-xs dark:bg-[#27272A] dark:text-[#FAFAFA]"
                    : "text-[#64748B]",
                )}
              >
                {i18n.cryptoAsset}
              </button>
              <button
                type="button"
                onClick={() => handleKindSwitch("etf")}
                className={cn(
                  "min-h-9 rounded-lg px-3 py-2 text-xs font-bold transition-all",
                  assetKind === "etf"
                    ? "bg-white text-[#0F172A] shadow-xs dark:bg-[#27272A] dark:text-[#FAFAFA]"
                    : "text-[#64748B]",
                )}
              >
                {i18n.etf.title}
              </button>
            </div>
          )}

          {modal === "buy" && selectedId && (
            <div className="rounded-xl bg-emerald-50 p-2.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
              {assetKind === "stock" ? ticker || i18n.stock : symbol || "BTC"} Â·{" "}
              {i18n.addPosition}
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
                  {account.name} ({account.currency}) Â·{" "}
                  {fmt(account.current_balance, account.currency)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
 

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
                numberMode="decimal"
                numberThousandsShortcuts={false}
                numberDecimalScale={2}
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
                onChange={(event) => {
                  const nextLots = event.target.value;
                  setLots(nextLots);
                  const l = Number(nextLots) || 0;
                  const p = Number(price) || 0;
                  if ((modal === "sell" || (modal === "edit" && editTradeType === "sell")) && l > 0 && p > 0) {
                    setAmount(String(Math.round(l * 100 * p)));
                  } else if ((modal === "sell" || (modal === "edit" && editTradeType === "sell")) && (!nextLots || !price)) {
                    setAmount("");
                  }
                }}
                required
              />
              {modal === "buy" ||
              (modal === "edit" && editTradeType === "buy") ? (
                <Input
                  label={`${i18n.netBuyAmountLabel} (${formSettlementCurrency})`}
                  type="number"
                  numberMode="currency"
                  currency={formSettlementCurrency}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                />
              ) : modal === "sell" ||
                (modal === "edit" && editTradeType === "sell") ? (
                <>
                  <Input
                    label={`${isEn ? "Sell price per share" : "Harga jual per lembar"} (${formSettlementCurrency})`}
                    type="number"
                    step="any"
                    numberMode="currency"
                    currency={formSettlementCurrency}
                    min="0.01"
                    value={price}
                    onChange={(event) => {
                      const nextPrice = event.target.value;
                      setPrice(nextPrice);
                      const l = Number(lots) || 0;
                      const p = Number(nextPrice) || 0;
                      if (l > 0 && p > 0) {
                        setAmount(String(Math.round(l * 100 * p)));
                      } else if (!nextPrice || !lots) {
                        setAmount("");
                      }
                    }}
                    required
                  />
                  <Input
                    label={`${isEn ? "Gross sale proceeds" : "Hasil jual bruto"} (${formSettlementCurrency})`}
                    type="number"
                    step="1"
                    numberMode="currency"
                    currency={formSettlementCurrency}
                    min="0"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder={stockSellGrossAmount > 0 ? String(stockSellGrossAmount) : "0"}
                    required
                  />
                </>
              ) : null}
              {modal === "buy" &&
                formSettlementCurrency === "IDR" &&
                Number(amount) > 10_000_000 && (
                  <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    {i18n.stampDutyNotice}
                  </p>
                )}
            </>
          ) : (
            <>
              {selectedId ? (
                <div className="rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs font-bold dark:border-[#27272A]">
                  {symbol}
                </div>
              ) : (
                <Input
                  label={assetKind === "etf" ? i18n.etf.ticker : cryptoI18n.symbol}
                  value={symbol}
                  onChange={(event) =>
                    setSymbol(event.target.value.toUpperCase())
                  }
                  placeholder={assetKind === "etf" ? i18n.etf.tickerPlaceholder : undefined}
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
                      : Number(
                          (assetKind === "etf" ? selectedEtf : selectedCrypto)
                            ?.quantity || 0,
                        ) <= 0
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
                <>
                  <Input
                    label={`${isEn ? "Price per" : "Harga per"} ${symbol || "asset"} (${isEn ? "buy" : "beli"}, ${formSettlementCurrency})`}
                    type="number"
                    step="any"
                    numberMode="currency"
                    currency={formSettlementCurrency}
                    min="0.01"
                    value={price}
                    onChange={(event) => {
                      const nextPrice = event.target.value;
                      setPrice(nextPrice);
                      const nextQuantity =
                        Number(amount) > 0 && Number(nextPrice) > 0
                          ? Math.round(
                              (Number(amount) / Number(nextPrice)) * 100_000_000,
                            ) / 100_000_000
                          : 0;
                      if (nextQuantity > 0) {
                        setQuantity(nextQuantity.toFixed(8));
                      }
                    }}
                    required
                  />
                  <Input
                    label={`${isEn ? "Actual settled buy amount" : "Nominal aktual yang tersettle"} (${formSettlementCurrency})`}
                    type="number"
                    step="1"
                    numberMode="currency"
                    currency={formSettlementCurrency}
                    value={amount}
                    onChange={(event) => {
                      const nextAmount = event.target.value;
                      setAmount(nextAmount);
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
                      const nextQuantity =
                        Number(nextAmount) > 0 && Number(price) > 0
                          ? Math.round(
                              (Number(nextAmount) / Number(price)) * 100_000_000,
                            ) / 100_000_000
                          : 0;
                      if (nextQuantity > 0) {
                        setQuantity(nextQuantity.toFixed(8));
                      }
                    }}
                    required
                  />
                  <Input
                    label={
                      isEn
                        ? `${symbol} quantity`
                        : `Jumlah ${symbol}`
                    }
                    type="number"
                    step="any"
                    numberMode="decimal"
                    numberThousandsShortcuts={false}
                    numberDecimalScale={8}
                    min="0.00000001"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    placeholder={
                      estimatedCryptoQuantity > 0
                        ? estimatedCryptoQuantity.toFixed(8)
                        : undefined
                    }
                    required
                  />
                </>
              ) : (
                <Input
                  label={
                    assetKind === "etf"
                      ? `${i18n.etf.sellQuantity} (${symbol})`
                      : `${cryptoI18n.quantity} (${symbol})`
                  }
                  type="number"
                  step="any"
                  numberMode="decimal"
                  numberDecimalScale={8}
                  numberThousandsShortcuts={false}
                  min="0.00000001"
                  max={
                    modal === "sell"
                      ? String(
                          Number(
                            (assetKind === "etf" ? selectedEtf : selectedCrypto)
                              ?.quantity || 0,
                          ) || undefined,
                        )
                      : undefined
                  }
                  value={quantity}
                  onChange={(event) => {
                    setQuantity(event.target.value);
                    const q = Number(event.target.value) || 0;
                    const p = Number(price) || 0;
                    if (q > 0 && p > 0) {
                      setAmount(String(Math.round(q * p)));
                    } else if (!event.target.value || !price) {
                      setAmount("");
                    }
                    const holding =
                      assetKind === "etf" ? selectedEtf : selectedCrypto;
                    if (holding) {
                      const maxQty = Number(holding.quantity || 0);
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

              {!(modal === "buy" ||
                (modal === "edit" && editTradeType === "buy")) && (
                <Input
                  label={`${isEn ? "Price per" : "Harga per"} ${symbol || "asset"} (${isEn ? "sell" : "jual"}, ${formSettlementCurrency})`}
                  type="number"
                  step="any"
                  numberMode="currency"
                  currency={formSettlementCurrency}
                  min="0.01"
                  value={price}
                  onChange={(event) => {
                    const nextPrice = event.target.value;
                    setPrice(nextPrice);
                    const q = Number(quantity) || 0;
                    const p = Number(nextPrice) || 0;
                    if (q > 0 && p > 0) {
                      setAmount(String(Math.round(q * p)));
                    } else if (!nextPrice || !quantity) {
                      setAmount("");
                    }
                  }}
                  required
                />
              )}

              {modal !== "buy" &&
              !(modal === "edit" && editTradeType === "buy") && (
                <Input
                  label={`${isEn ? "Gross sale proceeds" : "Hasil jual bruto"} (${formSettlementCurrency})`}
                  type="number"
                  step="1"
                  numberMode="currency"
                  currency={formSettlementCurrency}
                  min="0"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder={cryptoSellGrossAmount > 0 ? String(cryptoSellGrossAmount) : "0"}
                  required
                />
              )}

              <Input
                label={`${cryptoI18n.fee} (${formSettlementCurrency})`}
                type="number"
                step="any"
                numberMode="currency"
                currency={formSettlementCurrency}
                min="0"
                value={fee}
                onChange={(event) => {
                  const nextFee = event.target.value;
                  setFee(nextFee);
                  if (
                    modal === "buy" &&
                    cryptoPercent === 100 &&
                    selectedAccount
                  ) {
                    const targetAmount = Math.max(
                      0,
                      Math.floor(
                        Number(selectedAccount.current_balance || 0) -
                          (Number(nextFee) || 0),
                      ),
                    );
                    setAmount(String(targetAmount));
                    if (Number(price) > 0 && targetAmount > 0) {
                      const targetQuantity =
                        Math.round(
                          (targetAmount / Number(price)) * 100_000_000,
                        ) / 100_000_000;
                      setQuantity(targetQuantity.toFixed(8));
                    }
                  }
                }}
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

          <Button type="submit" disabled={busy} className="min-h-11">
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

        {/* Native range input â€” sits on top, invisible, handles drag */}
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

function formatCryptoQuantity(value: number | string): string {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "â€”";
  return numericValue.toFixed(8).replace(/\.?0+$/, "");
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

function EtfCard({
  holding,
  quote,
  marketValue: marketVal,
  costIdr,
  rates,
  isRefreshing,
  onBuy,
  onSell,
}: {
  holding: EnrichedEtfHolding;
  quote?: { price: number; currency: string; fetchedAt: string };
  marketValue?: number;
  costIdr: number;
  rates?: ForexRatesMap;
  isRefreshing?: boolean;
  onBuy: () => void;
  onSell: () => void;
}) {
  const { t, language } = useLanguage();
  const i18n = t.investments;
  const isEn = language === "en";
  const isPrivate = usePrivacyMode();
  const displayCurrency = usePreferredCurrency();
  const settlementCurrency = holding.currency || holding.account?.currency || "IDR";
  const fmt = (amount: number, currency: string = settlementCurrency) =>
    maskCurrency(formatCurrency(convertAmount(amount, currency, displayCurrency, rates), displayCurrency), isPrivate);
  const cost = Number(holding.total_cost) || 0;
  const pnl = marketVal !== undefined ? marketVal - costIdr : 0;
  const pnlPct = costIdr > 0 ? (pnl / costIdr) * 100 : 0;
  const marketDate = quote?.fetchedAt
    ? new Date(quote.fetchedAt).toLocaleString(isEn ? "en-US" : "id-ID", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-2xs dark:border-[#27272A] dark:bg-[#121215]">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <AssetLogo kind="etf" symbol={holding.ticker} />
          <div className="min-w-0">
            <p className="font-black text-sm text-[#0F172A] dark:text-[#F8FAFC]">{holding.ticker}</p>
            <p className="truncate text-[10px] text-[#64748B] dark:text-[#94A3B8]">{isEn ? "US ETF" : "ETF AS"}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="rounded-full border border-[#E5E7EB] px-2 py-0.5 text-[10px] font-semibold text-[#64748B] dark:border-[#27272A] dark:text-[#94A3B8]">{holding.account?.name || "Broker"} ({settlementCurrency})</span>
          {marketVal !== undefined && (
            <>
              <span className="font-mono text-sm font-black text-[#0F172A] dark:text-[#F8FAFC] tnum">{fmt(marketVal, "IDR")}</span>
              <span className={cn("font-mono text-[10px] font-bold", pnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                {pnl >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-col divide-y divide-[#F1F3F5] px-4 py-1 dark:divide-[#1E1E24]">
        <div className="flex items-center justify-between py-2">
          <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">{i18n.quantityLabel}</span>
          <span className="font-mono text-xs font-bold tnum">{holding.quantity} shares</span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">{i18n.capitalLabel}</span>
          <span className="font-mono text-xs font-bold tnum">{formatCurrency(cost, settlementCurrency)} ({settlementCurrency})</span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">{isEn ? "Avg Price / Share" : "Harga Rata-rata / Unit"}</span>
          <span className="font-mono text-xs font-bold tnum">{Number(holding.avg_buy_price) > 0 ? `${formatCurrency(Number(holding.avg_buy_price), settlementCurrency)} (${settlementCurrency})` : "â€”"}</span>
        </div>
        {(isRefreshing || quote) && (
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              {isEn ? "Market price" : "Harga pasar"}
              {!isRefreshing && marketDate ? ` Â· ${marketDate}` : ""}
            </span>
            {isRefreshing ? (
              <span className="inline-block h-3.5 w-20 animate-pulse rounded bg-slate-200 dark:bg-[#27272A]" />
            ) : (
              quote && <span className="font-mono text-xs font-bold tnum">{fmt(quote.price, quote.currency)}</span>
            )}
          </div>
        )}
      </div>
      <div className="px-4 pb-4">
        <AssetActions onBuy={onBuy} onSell={onSell} />
      </div>
    </div>
  );
}

function StockCard({
  holding,
  quote,
  marketValue: marketVal,
  costIdr,
  rates,
  isRefreshing,
  onBuy,
  onSell,
}: {
  holding: EnrichedStockHolding;
  quote?: { price: number; currency: string; fetchedAt: string };
  marketValue?: number;
  costIdr: number;
  rates?: ForexRatesMap;
  isRefreshing?: boolean;
  onBuy: () => void;
  onSell: () => void;
}) {
  const { t, language } = useLanguage();
  const i18n = t.investments;
  const isEn = language === "en";
  const isPrivate = usePrivacyMode();
  const displayCurrency = usePreferredCurrency();
  const settlementCurrency = holding.currency || holding.account?.currency || "IDR";
  const fmt = (amount: number, currency: string = settlementCurrency) =>
    maskCurrency(formatCurrency(convertAmount(amount, currency, displayCurrency, rates), displayCurrency), isPrivate);
  const lots = Number(holding.lots) || Number(holding.total_shares) / 100;
  const cost = Number(holding.total_cost) || 0;
  const pnl = marketVal !== undefined ? marketVal - costIdr : 0;
  const pnlPct = costIdr > 0 ? (pnl / costIdr) * 100 : 0;
  const marketDate = quote?.fetchedAt
    ? new Date(quote.fetchedAt).toLocaleString(isEn ? "en-US" : "id-ID", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-2xs dark:border-[#27272A] dark:bg-[#121215]">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <AssetLogo kind="stock" symbol={holding.ticker} />
          <div className="min-w-0">
            <p className="font-black text-sm text-[#0F172A] dark:text-[#F8FAFC]">{holding.ticker}</p>
            <p className="truncate text-[10px] text-[#64748B] dark:text-[#94A3B8]">{isEn ? "IDX Stocks" : "Saham IDX"}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="rounded-full border border-[#E5E7EB] px-2 py-0.5 text-[10px] font-semibold text-[#64748B] dark:border-[#27272A] dark:text-[#94A3B8]">{holding.account?.name || "RDN"} ({settlementCurrency})</span>
          {isRefreshing ? (
            <div className="flex flex-col items-end gap-1">
              <span className="inline-block h-4 w-24 animate-pulse rounded bg-slate-200 dark:bg-[#27272A]" />
              <span className="inline-block h-3 w-14 animate-pulse rounded bg-slate-100 dark:bg-[#1E1E24]" />
            </div>
          ) : (
            marketVal !== undefined && (
              <>
                <span className="font-mono text-sm font-black text-[#0F172A] dark:text-[#F8FAFC] tnum">{fmt(marketVal, "IDR")}</span>
                <span className={cn("font-mono text-[10px] font-bold", pnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                  {pnl >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                </span>
              </>
            )
          )}
        </div>
      </div>
      <div className="flex flex-col divide-y divide-[#F1F3F5] px-4 py-1 dark:divide-[#1E1E24]">
        <div className="flex items-center justify-between py-2">
          <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">{i18n.quantityLabel}</span>
          <span className="font-mono text-xs font-bold tnum">{lots} lot</span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">{i18n.capitalLabel}</span>
          <span className="font-mono text-xs font-bold tnum">{formatCurrency(cost, settlementCurrency)} ({settlementCurrency})</span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">{isEn ? "Avg Price / Share" : "Harga Rata-rata / Lembar"}</span>
          <span className="font-mono text-xs font-bold tnum">{Number(holding.avg_buy_price) > 0 ? `${formatCurrency(Number(holding.avg_buy_price), settlementCurrency)} (${settlementCurrency}) / lbr` : "â€”"}</span>
        </div>
        {(isRefreshing || quote) && (
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              {isEn ? "Market price" : "Harga pasar"}
              {!isRefreshing && marketDate ? ` Â· ${marketDate}` : ""}
            </span>
            {isRefreshing ? (
              <span className="inline-block h-3.5 w-20 animate-pulse rounded bg-slate-200 dark:bg-[#27272A]" />
            ) : (
              quote && <span className="font-mono text-xs font-bold tnum">{fmt(quote.price, quote.currency)}</span>
            )}
          </div>
        )}
      </div>
      <div className="px-4 pb-4">
        <AssetActions onBuy={onBuy} onSell={onSell} />
      </div>
    </div>
  );
}
function CryptoCard({
  holding,
  quote,
  marketValue: marketVal,
  costIdr,
  rates,
  isRefreshing,
  onBuy,
  onSell,
}: {
  holding: EnrichedCryptoHolding;
  quote?: { price: number; currency: string; fetchedAt: string };
  marketValue?: number;
  costIdr: number;
  rates?: ForexRatesMap;
  isRefreshing?: boolean;
  onBuy: () => void;
  onSell: () => void;
}) {
  const { t, language } = useLanguage();
  const i18n = t.investments;
  const isEn = language === "en";
  const isPrivate = usePrivacyMode();
  const displayCurrency = usePreferredCurrency();
  const settlementCurrency = holding.price_currency || "IDR";
  const fmt = (amount: number, currency: string = settlementCurrency) =>
    maskCurrency(formatCurrency(convertAmount(amount, currency, displayCurrency, rates), displayCurrency), isPrivate);
  const cost = Number(holding.cost_basis) || 0;
  const pnl = marketVal !== undefined ? marketVal - costIdr : 0;
  const pnlPct = costIdr > 0 ? (pnl / costIdr) * 100 : 0;
  const marketDate = quote?.fetchedAt
    ? new Date(quote.fetchedAt).toLocaleString(isEn ? "en-US" : "id-ID", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-2xs dark:border-[#27272A] dark:bg-[#121215]">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <AssetLogo kind="crypto" symbol={holding.symbol} />
          <div className="min-w-0">
            <p className="font-black text-sm text-[#0F172A] dark:text-[#F8FAFC]">{holding.symbol}</p>
            <p className="truncate text-[10px] text-[#64748B] dark:text-[#94A3B8]">{i18n.cryptoAsset}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="rounded-full border border-[#E5E7EB] px-2 py-0.5 text-[10px] font-semibold text-[#64748B] dark:border-[#27272A] dark:text-[#94A3B8]">{holding.account?.name || i18n.accountFallback} ({settlementCurrency})</span>
          {isRefreshing ? (
            <div className="flex flex-col items-end gap-1">
              <span className="inline-block h-4 w-24 animate-pulse rounded bg-slate-200 dark:bg-[#27272A]" />
              <span className="inline-block h-3 w-14 animate-pulse rounded bg-slate-100 dark:bg-[#1E1E24]" />
            </div>
          ) : (
            marketVal !== undefined && (
              <>
                <span className="font-mono text-sm font-black text-[#0F172A] dark:text-[#F8FAFC] tnum">{fmt(marketVal, "IDR")}</span>
                <span className={cn("font-mono text-[10px] font-bold", pnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                  {pnl >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                </span>
              </>
            )
          )}
        </div>
      </div>
      <div className="flex flex-col divide-y divide-[#F1F3F5] px-4 py-1 dark:divide-[#1E1E24]">
        <div className="flex items-center justify-between py-2">
          <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">{i18n.quantityLabel}</span>
          <span className="font-mono text-xs font-bold tnum break-all">{formatCryptoQuantity(holding.quantity)} {holding.symbol}</span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">{i18n.capitalLabel}</span>
          <span className="font-mono text-xs font-bold tnum">{formatCurrency(cost, settlementCurrency)} ({settlementCurrency})</span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">{isEn ? `Avg Buy Price / ${holding.symbol}` : `Harga Rata-rata / ${holding.symbol}`}</span>
          <span className="font-mono text-xs font-bold tnum">{Number(holding.average_buy_price) > 0 ? `${formatCurrency(Number(holding.average_buy_price), settlementCurrency)} (${settlementCurrency})` : "â€”"}</span>
        </div>
        {(isRefreshing || quote) && (
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              {isEn ? "Market price" : "Harga pasar"}
              {!isRefreshing && marketDate ? ` Â· ${marketDate}` : ""}
            </span>
            {isRefreshing ? (
              <span className="inline-block h-3.5 w-20 animate-pulse rounded bg-slate-200 dark:bg-[#27272A]" />
            ) : (
              quote && <span className="font-mono text-xs font-bold tnum">{fmt(quote.price, quote.currency)}</span>
            )}
          </div>
        )}
      </div>
      <div className="px-4 pb-4">
        <AssetActions onBuy={onBuy} onSell={onSell} />
      </div>
    </div>
  );
}
function AssetLogo({
  kind,
  symbol,
}: {
  kind: "stock" | "crypto" | "etf";
  symbol: string;
}) {
  const [hasError, setHasError] = useState(false);
  const normalizedSymbol = symbol.trim().toLowerCase();
  const publishableKey = process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY;
  const identifier =
    kind === "stock" ? `${normalizedSymbol}.jk` : normalizedSymbol;
  const logoUrl = publishableKey
    ? `https://img.logo.dev/${kind === "crypto" ? "crypto" : "ticker"}/${encodeURIComponent(identifier)}?token=${encodeURIComponent(publishableKey)}`
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
        // eslint-disable-next-line @next/next/no-img-element
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
        className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-xs font-bold text-[#0F172A] transition-all hover:bg-[#F8F9FA] dark:border-[#3F3F46] dark:bg-[#121215] dark:text-[#F8FAFC] dark:hover:bg-[#1A1A20] sm:min-h-11"
      >
        <Plus className="h-3.5 w-3.5" />
        {t.investments.buy}
      </button>
      <button
        type="button"
        onClick={onSell}
        className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-xs font-bold text-[#0F172A] transition-all hover:bg-[#F8F9FA] dark:border-[#3F3F46] dark:bg-[#121215] dark:text-[#F8FAFC] dark:hover:bg-[#1A1A20] sm:min-h-11"
      >
        <ArrowUpRight className="h-3.5 w-3.5" />
        {t.investments.sell}
      </button>
    </div>
  );
}
