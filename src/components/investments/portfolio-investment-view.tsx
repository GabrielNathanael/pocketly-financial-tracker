"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowUpRight,
  Coins,
  Edit2,
  History,
  Plus,
  ReceiptText,
  Trash2,
  TrendingUp,
} from "lucide-react";
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

type AssetKind = "stock" | "crypto";
type Activity = EnrichedStockTrade | EnrichedCryptoTrade;

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
  const investmentAccounts = accounts.filter(
    (account) => account.type === "investment" && account.is_active,
  );
  const [tab, setTab] = useState<"portfolio" | "activity" | "fees">("portfolio");
  const [modal, setModal] = useState<"buy" | "sell" | "edit" | null>(null);
  const [editTradeType, setEditTradeType] = useState<"buy" | "sell" | null>(null);
  const [assetKind, setAssetKind] = useState<AssetKind>("crypto");
  const [accountId, setAccountId] = useState(investmentAccounts[0]?.id || "");
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

  const stockValue = stocks.reduce((total, holding) => total + Number(holding.total_cost), 0);
  const cryptoCost = cryptos.reduce((total, holding) => total + Number(holding.cost_basis), 0);
  const cryptoValue = cryptos.reduce(
    (total, holding) => total + Number(holding.quantity) * Number(holding.manual_price),
    0,
  );
  const cashValue = investmentAccounts.reduce(
    (total, account) => total + Number(account.current_balance),
    0,
  );
  const realizedPnl = stockTrades.reduce(
    (total, trade) => total + (Number(trade.realized_pnl) || 0),
    0,
  ) + cryptoTrades.reduce(
    (total, trade) => total + (Number(trade.realized_pnl) || 0),
    0,
  );
  const totalFees = stockTrades.reduce(
    (total, trade) => total + (Number(trade.stamp_duty) || 0),
    0,
  ) + cryptoTrades.reduce(
    (total, trade) => total + (Number(trade.fee_amount) || 0),
    0,
  );
  const transferFees = transfers.reduce(
    (total, transfer) => total + (Number(transfer.fee_amount) || 0),
    0,
  );
  const totalRecordedFees = totalFees + transferFees;
  const feeDetails = useMemo(
    () => [
      ...stockTrades
        .filter((trade) => Number(trade.stamp_duty) > 0)
        .map((trade) => ({
          id: `stock-${trade.id}`,
          date: trade.trade_date,
          type: i18n.feesStock,
          reference: `${trade.ticker} · ${trade.type === "buy" ? i18n.buy : i18n.sell}`,
          amount: Number(trade.stamp_duty),
        })),
      ...cryptoTrades
        .filter((trade) => Number(trade.fee_amount) > 0)
        .map((trade) => ({
          id: `crypto-${trade.id}`,
          date: trade.trade_date,
          type: i18n.feesCrypto,
          reference: `${trade.symbol} · ${trade.type === "buy" ? i18n.buy : i18n.sell}`,
          amount: Number(trade.fee_amount),
        })),
      ...transfers
        .filter((transfer) => Number(transfer.fee_amount) > 0)
        .map((transfer) => ({
          id: `transfer-${transfer.id}`,
          date: transfer.transfer_date,
          type: i18n.feesTransfer,
          reference:
            transfer.description ||
            `${transfer.from_account?.name || "—"} → ${transfer.to_account?.name || "—"}`,
          amount: Number(transfer.fee_amount),
        })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [cryptoTrades, i18n, stockTrades, transfers],
  );
  const activities = useMemo<Activity[]>(
    () =>
      [...stockTrades, ...cryptoTrades].sort(
        (a, b) =>
          new Date(b.trade_date).getTime() - new Date(a.trade_date).getTime(),
      ),
    [stockTrades, cryptoTrades],
  );
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
  };

  const openBuy = (kind: AssetKind, holding?: EnrichedStockHolding | EnrichedCryptoHolding) => {
    setAssetKind(kind);
    setSelectedId(holding?.id || "");
    if (holding) {
      if (kind === "stock") {
        setTicker((holding as EnrichedStockHolding).ticker);
        setLots(String(Number((holding as EnrichedStockHolding).lots) || Number((holding as EnrichedStockHolding).total_shares) / 100 || 1));
      } else {
        setSymbol((holding as EnrichedCryptoHolding).symbol);
        setPrice(String((holding as EnrichedCryptoHolding).manual_price || (holding as EnrichedCryptoHolding).average_buy_price || ""));
      }
      setAccountId(holding.account_id);
    }
    setModal("buy");
  };

  const openSell = (kind: AssetKind, holding?: EnrichedStockHolding | EnrichedCryptoHolding) => {
    setAssetKind(kind);
    setSelectedId(holding?.id || "");
    if (holding) {
      setAccountId(holding.account_id);
      if (kind === "stock") {
        const stock = holding as EnrichedStockHolding;
        setTicker(stock.ticker);
        setLots(String(Number(stock.lots) || Number(stock.total_shares) / 100 || 1));
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
        result = await recordStockBuy({
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
          : { error: language === "en" ? "Select a stock first" : "Pilih saham terlebih dahulu" };
      } else if (assetKind === "crypto" && modal === "buy") {
        result = await recordCryptoBuy({
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
          : { error: language === "en" ? "Select an asset first" : "Pilih aset terlebih dahulu" };
      } else if (assetKind === "crypto" && modal === "edit" && selectedId) {
        result = await updateCryptoTrade({
          id: selectedId,
          quantity: Number(editTradeType === "buy" ? cryptoQuantity : quantity),
          grossAmount: editTradeType === "buy" ? Number(amount) : cryptoSellGrossAmount,
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
      toast.success(
        isCrypto
        ? i18n.deleteCryptoSuccess
          : i18n.deleteSuccess,
      );
      router.refresh();
    }
    setIsDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-1 pb-16 sm:px-2">
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-2xs dark:border-[#27272A] dark:bg-[#121215] sm:p-5">
        <div className="flex flex-col gap-4 border-b border-[#E5E7EB] pb-4 dark:border-[#27272A] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight">{i18n.title}</h1>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">{i18n.subtitle}</p>
            </div>
          </div>
          <Button onClick={() => openBuy("crypto")} className="h-9 gap-1.5 text-xs">
            <Plus className="h-4 w-4" /> {i18n.addTradeBtn}
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Summary label={i18n.totalPortfolio} value={formatCurrency(stockValue + cryptoValue + cashValue, "IDR")} />
          <Summary label={i18n.totalInvested} value={formatCurrency(stockValue + cryptoCost, "IDR")} />
          <Summary label={i18n.netPnl} value={`${realizedPnl >= 0 ? "+" : ""}${formatCurrency(realizedPnl, "IDR")}`} tone={realizedPnl >= 0 ? "positive" : "negative"} />
          <Summary label={language === "en" ? "Total fees" : "Total biaya"} value={formatCurrency(totalRecordedFees, "IDR")} />
        </div>
      </section>

      <div className="flex gap-1 overflow-x-auto border-b border-[#E5E7EB] dark:border-[#27272A]">
        {([
          ["portfolio", i18n.holdingsTab, TrendingUp],
          ["activity", i18n.tradesTab, History],
          ["fees", i18n.feesTab, ReceiptText],
        ] as const).map(([value, label, Icon]) => (
          <button key={value} type="button" onClick={() => setTab(value)} className={cn("inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-bold transition-colors", tab === value ? "border-[#0F172A] text-[#0F172A] dark:border-[#FAFAFA] dark:text-[#FAFAFA]" : "border-transparent text-[#94A3B8] hover:text-[#475569]")}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "portfolio" && (
        <section className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-2xs dark:border-[#27272A] dark:bg-[#121215]">
          <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4">
            {stocks.map((holding) => <StockCard key={holding.id} holding={holding} onBuy={() => openBuy("stock", holding)} onSell={() => openSell("stock", holding)} />)}
            {cryptos.map((holding) => <CryptoCard key={holding.id} holding={holding} onBuy={() => openBuy("crypto", holding)} onSell={() => openSell("crypto", holding)} />)}
          </div>
          {stocks.length + cryptos.length === 0 && <div className="p-10 text-center text-xs text-[#64748B]">{i18n.emptyHoldingsTitle}</div>}
        </section>
      )}

      {tab === "activity" && (
        <section className="rounded-2xl border border-[#E5E7EB] bg-white shadow-2xs dark:border-[#27272A] dark:bg-[#121215]">
          <div className="border-b border-[#E5E7EB] px-4 py-3 dark:border-[#27272A]"><h2 className="text-sm font-bold">{i18n.tradesTitle}</h2><p className="text-[11px] text-[#64748B]">{i18n.emptyTradesDesc}</p></div>
          <div className="divide-y divide-[#E5E7EB] dark:divide-[#27272A]">
            {activities.map((activity) => {
              const isStock = "ticker" in activity;
              const actionLabel = isStock
                ? activity.type === "buy"
                  ? i18n.buyBtn
                  : i18n.sellBtn
                : activity.type === "buy"
                  ? cryptoI18n.buy
                  : cryptoI18n.sell;
              const realizedTradePnl = Number(activity.realized_pnl) || 0;
              const hasRealizedPnl = activity.type === "sell";
              return <div key={activity.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"><div className="flex min-w-0 items-center gap-2.5"><div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", activity.type === "buy" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600")}>{activity.type === "buy" ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</div><div className="min-w-0"><p className="truncate text-xs font-bold">{isStock ? (activity as EnrichedStockTrade).ticker : (activity as EnrichedCryptoTrade).symbol} · {actionLabel}</p><p className="text-[10px] text-[#64748B]">{new Date(activity.trade_date).toLocaleDateString(language === "en" ? "en-US" : "id-ID")} · {activity.account?.name || "Investment account"}</p>{hasRealizedPnl ? <p className={cn("text-[10px] font-bold", realizedTradePnl >= 0 ? "text-emerald-600" : "text-rose-600")}>{language === "en" ? "P&L" : "P&L"}: {realizedTradePnl >= 0 ? "+" : ""}{formatCurrency(realizedTradePnl, activity.account?.currency || "IDR")}</p> : <p className="text-[10px] text-[#94A3B8]">{language === "en" ? "P&L not realized" : "P&L belum terealisasi"}</p>}</div></div><div className="flex items-center gap-1.5"><span className="hidden font-mono text-xs font-bold sm:block">{formatCurrency(Number(isStock ? (activity as EnrichedStockTrade).net_amount : (activity as EnrichedCryptoTrade).gross_amount), activity.account?.currency || "IDR")}</span><button type="button" onClick={() => { if (isStock) { const trade = activity as EnrichedStockTrade; setTicker(trade.ticker); setLots(String(trade.lots || 1)); setAmount(String(trade.net_amount)); setDate(trade.trade_date.slice(0, 10)); setNotes(trade.notes || ""); setAssetKind("stock"); } else { const trade = activity as EnrichedCryptoTrade; setSymbol(trade.symbol); setQuantity(String(trade.quantity)); setAmount(String(trade.gross_amount)); setPrice(String(trade.price_per_unit)); setFee(String(trade.fee_amount || 0)); setDate(trade.trade_date.slice(0, 10)); setNotes(trade.notes || ""); setAssetKind("crypto"); } setSelectedId(activity.id); setEditTradeType(activity.type); setModal("edit"); }} className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-slate-100 hover:text-slate-900"><Edit2 className="h-3.5 w-3.5" /></button><button type="button" onClick={() => isStock ? handleDelete(activity as EnrichedStockTrade) : handleDeleteCrypto(activity as EnrichedCryptoTrade)} className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button></div></div>;
            })}
            {activities.length === 0 && <div className="p-10 text-center text-xs text-[#64748B]">{language === "en" ? "No transactions recorded yet." : "Belum ada riwayat transaksi."}</div>}
          </div>
        </section>
      )}

      {tab === "fees" && (
        <section className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Summary label={i18n.feesTotal} value={formatCurrency(totalRecordedFees, "IDR")} />
            <Summary label={i18n.feesStock} value={formatCurrency(stockTrades.reduce((sum, trade) => sum + Number(trade.stamp_duty || 0), 0), "IDR")} />
            <Summary label={i18n.feesCrypto} value={formatCurrency(cryptoTrades.reduce((sum, trade) => sum + Number(trade.fee_amount || 0), 0), "IDR")} />
            <Summary label={i18n.feesTransfer} value={formatCurrency(transferFees, "IDR")} />
          </div>
          <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white dark:border-[#27272A] dark:bg-[#121215]">
            <div className="border-b border-[#E5E7EB] px-4 py-3 dark:border-[#27272A]">
              <h2 className="text-sm font-bold">{i18n.feesDetailTitle}</h2>
            </div>
            {feeDetails.length > 0 ? (
              <div className="divide-y divide-[#E5E7EB] dark:divide-[#27272A]">
                {feeDetails.map((detail) => (
                  <div key={detail.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[110px_1fr_auto] sm:items-center">
                    <span className="text-[11px] text-[#64748B]">
                      {new Date(detail.date).toLocaleDateString(language === "en" ? "en-US" : "id-ID")}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold">{detail.type}</p>
                      <p className="truncate text-[10px] text-[#64748B]">{detail.reference}</p>
                    </div>
                    <span className="font-mono text-xs font-bold text-rose-600">
                      {formatCurrency(detail.amount, "IDR")}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-6 text-center text-xs text-[#64748B]">{i18n.feesEmpty}</p>
            )}
          </div>
        </section>
      )}

      <Modal isOpen={modal !== null} onClose={closeModal} title={
        modal === "edit"
          ? assetKind === "crypto"
            ? `${i18n.editCryptoTrade} · ${editTradeType === "buy" ? i18n.buy : i18n.sell}`
            : i18n.modalEditTradeTitle
          : modal === "buy"
            ? (assetKind === "stock" ? i18n.modalBuyTitle : cryptoI18n.buyTitle)
            : assetKind === "stock" ? i18n.modalSellTitle : cryptoI18n.sellTitle
      }>
        <form onSubmit={submitTransaction} className="flex flex-col gap-3.5">
          {modal !== "edit" && !selectedId && <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#F8F9FA] p-1.5 dark:bg-[#1A1A20]">
            <button type="button" onClick={() => setAssetKind("stock")} className={cn("rounded-lg px-3 py-2 text-xs font-bold", assetKind === "stock" ? "bg-white shadow-sm dark:bg-[#27272A]" : "text-[#64748B]")}>{i18n.stock}</button>
            <button type="button" onClick={() => setAssetKind("crypto")} className={cn("rounded-lg px-3 py-2 text-xs font-bold", assetKind === "crypto" ? "bg-white shadow-sm dark:bg-[#27272A]" : "text-[#64748B]")}>{i18n.cryptoAsset}</button>
          </div>}
          {modal !== "edit" && selectedId && <div className="rounded-xl bg-emerald-50 p-2.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">{assetKind === "stock" ? (ticker || i18n.stock) : (symbol || "BTC")} · {modal === "buy" ? i18n.addPosition : i18n.sellPosition}</div>}
          <Select value={accountId} onValueChange={setAccountId}><SelectTrigger><SelectValue placeholder={i18n.accountFallback} /></SelectTrigger><SelectContent>{investmentAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name} · {formatCurrency(account.current_balance, account.currency)}</SelectItem>)}</SelectContent></Select>
          {assetKind === "stock" ? <>{selectedId ? <div className="rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs font-bold dark:border-[#27272A]">{ticker}</div> : <Input label={i18n.tickerLabel} value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase())} placeholder={i18n.tickerPlaceholder} required />}<Input label={i18n.lotsLabel} type="number" step="any" min="0.01" max={modal === "sell" && selectedStock ? String(Number(selectedStock.lots) || Number(selectedStock.total_shares) / 100) : undefined} value={lots} onChange={(event) => setLots(event.target.value)} required />{modal === "buy" ? <Input label={i18n.netBuyAmountLabel} type="number" value={amount} onChange={(event) => setAmount(event.target.value)} required /> : <><Input label={language === "en" ? "Sell price per share" : "Harga jual per saham"} type="number" step="any" min="0.01" value={price} onChange={(event) => setPrice(event.target.value)} required /><CalculatedAmount label={language === "en" ? "Gross sale proceeds" : "Hasil jual bruto"} value={stockSellGrossAmount} /></>}{modal === "buy" && Number(amount) > 10_000_000 && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{i18n.stampDutyNotice}</p>}</> : <>{selectedId ? <div className="rounded-xl border border-[#E5E7EB] px-3 py-2 text-xs font-bold dark:border-[#27272A]">{symbol}</div> : <Input label={cryptoI18n.symbol} value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} required />}{modal === "buy" || (modal === "edit" && editTradeType === "buy") ? <Input label={language === "en" ? "Gross buy amount" : "Nominal bruto pembelian"} type="number" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Contoh: 5000000" required /> : <Input label={`${cryptoI18n.quantity} (${symbol})`} type="number" step="any" min="0.00000001" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />}<Input label={`${language === "en" ? "Price per" : "Harga per"} ${symbol || "asset"} (${modal === "buy" || (modal === "edit" && editTradeType === "buy") ? (language === "en" ? "buy" : "beli") : (language === "en" ? "sell" : "jual")})`} type="number" step="any" min="0.01" value={price} onChange={(event) => setPrice(event.target.value)} required />{modal === "buy" || (modal === "edit" && editTradeType === "buy") ? <p className="rounded-xl bg-emerald-50 p-3 font-mono text-sm font-bold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">{language === "en" ? `Quantity ${symbol} calculated automatically` : `Jumlah ${symbol} dihitung otomatis`}: {cryptoQuantity > 0 ? cryptoQuantity.toFixed(18).replace(/\.?0+$/, "") : "—"} {symbol}</p> : <CalculatedAmount label={language === "en" ? "Gross sale proceeds (calculated)" : "Hasil jual bruto (dihitung otomatis)"} value={cryptoSellGrossAmount} />}<Input label={cryptoI18n.fee} type="number" step="any" min="0" value={fee} onChange={(event) => setFee(event.target.value)} placeholder="0" /></>}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {i18n.tradeDateLabel}
            </label>
            <DatePicker value={date} onChange={setDate} clearable={false} />
          </div>
          <Input label={i18n.notesLabel} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={i18n.notesPlaceholder} />
          <Button type="submit" disabled={busy}>{busy ? i18n.saving : modal === "edit" ? i18n.updateTradeBtn : i18n.saveSuccess}</Button>
        </form>
      </Modal>
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        title={language === "en" ? "Delete investment transaction" : "Hapus transaksi investasi"}
        message={
          language === "en"
            ? "This will delete the record and recalculate the related balance and holding. Continue?"
            : "Catatan ini akan dihapus dan saldo serta kepemilikan terkait akan dihitung ulang. Lanjutkan?"
        }
      />
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

function Summary({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "positive" | "negative" }) {
  return <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-3.5 dark:border-[#27272A] dark:bg-[#1A1A20]"><p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">{label}</p><p title={value} className={cn("mt-1 break-all font-mono text-sm leading-tight font-black sm:text-base", tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-rose-600" : "text-[#0F172A] dark:text-[#F8FAFC]")}>{value}</p></div>;
}

function StockCard({ holding, onBuy, onSell }: { holding: EnrichedStockHolding; onBuy: () => void; onSell: () => void }) {
  const { t } = useLanguage();
  const i18n = t.investments;
  const lots = Number(holding.lots) || Number(holding.total_shares) / 100;
  return <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white dark:border-[#27272A] dark:bg-[#121215]">
    <div className="flex items-center justify-between gap-3 bg-indigo-100 px-5 py-4 dark:bg-indigo-950/40">
      <div className="flex min-w-0 items-center gap-3">
        <AssetLogo kind="stock" symbol={holding.ticker} />
        <div className="min-w-0">
          <p className="font-black">{holding.ticker}</p>
          <p className="truncate text-[10px] text-indigo-800/70 dark:text-indigo-200/70">{i18n.stock}</p>
        </div>
      </div>
      <span className="truncate text-right text-xs font-medium text-indigo-900 dark:text-indigo-100">{holding.account?.name || "RDN"}</span>
    </div>
    <div className="p-5">
      <div className="grid grid-cols-2 gap-3">
        <AssetMetric label={i18n.quantityLabel} value={`${lots} lot`} />
        <AssetMetric label={i18n.capitalLabel} value={formatCurrency(Number(holding.total_cost), holding.account?.currency)} />
      </div>
    <AssetActions onBuy={onBuy} onSell={onSell} />
    </div>
  </div>;
}

function CryptoCard({ holding, onBuy, onSell }: { holding: EnrichedCryptoHolding; onBuy: () => void; onSell: () => void }) {
  const { t } = useLanguage();
  const i18n = t.investments;
  return <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white dark:border-[#27272A] dark:bg-[#121215]">
    <div className="flex items-center justify-between gap-3 bg-[#F9DFA6] px-5 py-4 dark:bg-[#5A431D]">
      <div className="flex min-w-0 items-center gap-3">
        <AssetLogo kind="crypto" symbol={holding.symbol} />
        <div className="min-w-0">
          <p className="font-black">{holding.symbol}</p>
          <p className="truncate text-[10px] text-[#704500]/75 dark:text-[#FFE9B0]/75">{i18n.cryptoAsset}</p>
        </div>
      </div>
      <span className="truncate text-right text-xs font-medium text-[#704500] dark:text-[#FFE9B0]">{holding.account?.name || i18n.accountFallback}</span>
    </div>
    <div className="p-5">
      <div className="grid grid-cols-2 gap-3">
        <AssetMetric label={i18n.quantityLabel} value={`${formatCryptoQuantity(holding.quantity)} ${holding.symbol}`} valueClassName="break-all" />
        <AssetMetric label={i18n.capitalLabel} value={formatCurrency(Number(holding.cost_basis), holding.price_currency)} />
      </div>
    <AssetActions onBuy={onBuy} onSell={onSell} />
    </div>
  </div>;
}

function AssetLogo({ kind, symbol }: { kind: "stock" | "crypto"; symbol: string }) {
  const [hasError, setHasError] = useState(false);
  const normalizedSymbol = symbol.trim().toLowerCase();
  const publishableKey = process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY;
  const identifier = kind === "stock"
    ? `${normalizedSymbol}.jk`
    : normalizedSymbol;
  const logoUrl = publishableKey
    ? `https://img.logo.dev/${kind === "stock" ? "ticker" : "crypto"}/${encodeURIComponent(identifier)}?token=${encodeURIComponent(publishableKey)}`
    : null;

  return (
    <div className={cn(
      "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/80 shadow-sm",
      kind === "stock"
        ? "text-indigo-700 dark:bg-indigo-100 dark:text-indigo-800"
        : "text-orange-700 dark:bg-orange-100 dark:text-orange-800",
    )}>
      {!hasError && logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setHasError(true)}
        />
      ) : (
        <Coins className="h-5 w-5" />
      )}
    </div>
  );
}

function AssetMetric({ label, value, valueClassName = "" }: { label: string; value: string; valueClassName?: string }) {
  return <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">{label}</p><p className={cn("mt-1 font-mono text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]", valueClassName)}>{value}</p></div>;
}

function AssetActions({ onBuy, onSell }: { onBuy: () => void; onSell: () => void }) {
  const { t } = useLanguage();
  return <div className="mt-4 flex gap-2 border-t border-[#E5E7EB] pt-3 dark:border-[#27272A]">
    <button type="button" onClick={onBuy} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-xs font-bold text-[#0F172A] hover:bg-[#F8F9FA] dark:border-[#3F3F46] dark:bg-[#121215] dark:text-[#F8FAFC] dark:hover:bg-[#1A1A20]"><Plus className="h-3.5 w-3.5" />{t.investments.buy}</button>
    <button type="button" onClick={onSell} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#D1D5DB] bg-white px-3 py-2 text-xs font-bold text-[#0F172A] hover:bg-[#F8F9FA] dark:border-[#3F3F46] dark:bg-[#121215] dark:text-[#F8FAFC] dark:hover:bg-[#1A1A20]"><ArrowUpRight className="h-3.5 w-3.5" />{t.investments.sell}</button>
  </div>;
}
