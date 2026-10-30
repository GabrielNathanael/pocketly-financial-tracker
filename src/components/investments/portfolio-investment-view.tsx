"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowUpRight,
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
} from "@/actions/crypto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { formatCurrency } from "@/lib/utils/currency";
import { getLocalDateString, localDateToISO } from "@/lib/utils/date";
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
}

export function PortfolioInvestmentView({
  stocks,
  stockTrades,
  cryptos,
  cryptoTrades,
  accounts,
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
  const activities = useMemo<Activity[]>(
    () =>
      [...stockTrades, ...cryptoTrades].sort(
        (a, b) =>
          new Date(b.trade_date).getTime() - new Date(a.trade_date).getTime(),
      ),
    [stockTrades, cryptoTrades],
  );
  const cryptoQuantity =
    Number(amount) > 0 && Number(price) > 0 ? Number(amount) / Number(price) : 0;
  const selectedStock = stocks.find((holding) => holding.id === selectedId);
  const selectedCrypto = cryptos.find((holding) => holding.id === selectedId);

  const closeModal = () => {
    setModal(null);
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
    if (holding) {
      setSelectedId(holding.id);
      if (kind === "stock") setTicker((holding as EnrichedStockHolding).ticker);
      else setSymbol((holding as EnrichedCryptoHolding).symbol);
      setAccountId(holding.account_id);
    }
    setModal("buy");
  };

  const openSell = (kind: AssetKind, holding?: EnrichedStockHolding | EnrichedCryptoHolding) => {
    setAssetKind(kind);
    if (holding) {
      setSelectedId(holding.id);
      setAccountId(holding.account_id);
      if (kind === "stock") {
        const stock = holding as EnrichedStockHolding;
        setTicker(stock.ticker);
        setLots(String(Number(stock.lots) || Number(stock.total_shares) / 100 || 1));
      } else {
        const crypto = holding as EnrichedCryptoHolding;
        setSymbol(crypto.symbol);
        setQuantity(String(crypto.quantity));
        setPrice(String(crypto.manual_price || crypto.average_buy_price));
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
              netAmount: Number(amount),
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
          tradeDate: localDateToISO(date),
        });
      } else if (assetKind === "crypto" && modal === "sell") {
        result = selectedCrypto
          ? await recordCryptoSell({
              holdingId: selectedCrypto.id,
              quantity: Number(quantity),
              grossAmount: Number(amount),
              feeAmount: Number(fee || 0),
              pricePerUnit: Number(price),
              notes: notes || null,
              tradeDate: localDateToISO(date),
            })
          : { error: language === "en" ? "Select an asset first" : "Pilih aset terlebih dahulu" };
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

  const handleDelete = async (trade: EnrichedStockTrade) => {
    if (!confirm(i18n.deleteConfirm)) return;
    const result = await deleteStockTrade(trade.id);
    if (result.error) toast.error(result.error);
    else {
      toast.success(i18n.deleteSuccess);
      router.refresh();
    }
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
          <Summary label={language === "en" ? "Investment costs" : "Biaya investasi"} value={formatCurrency(totalFees, "IDR")} />
        </div>
      </section>

      <div className="flex gap-1 overflow-x-auto border-b border-[#E5E7EB] dark:border-[#27272A]">
        {([
          ["portfolio", language === "en" ? "Portfolio" : "Portofolio", TrendingUp],
          ["activity", language === "en" ? "Activity" : "Aktivitas", History],
          ["fees", language === "en" ? "Fees & stamp duty" : "Biaya & Bea Materai", ReceiptText],
        ] as const).map(([value, label, Icon]) => (
          <button key={value} type="button" onClick={() => setTab(value)} className={cn("inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-bold transition-colors", tab === value ? "border-[#0F172A] text-[#0F172A] dark:border-[#FAFAFA] dark:text-[#FAFAFA]" : "border-transparent text-[#94A3B8] hover:text-[#475569]")}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "portfolio" && (
        <section className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-2xs dark:border-[#27272A] dark:bg-[#121215]">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3 dark:border-[#27272A] sm:px-5">
            <div>
              <h2 className="text-sm font-bold">{language === "en" ? "Your assets" : "Aset yang kamu miliki"}</h2>
              <p className="text-[11px] text-[#64748B]">{stocks.length + cryptos.length} {language === "en" ? "active assets" : "aset aktif"}</p>
            </div>
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F9FA] text-[10px] uppercase tracking-wider text-[#94A3B8] dark:bg-[#1A1A20]">
                <tr><th className="px-5 py-3">{language === "en" ? "Asset" : "Aset"}</th><th className="px-3 py-3">{language === "en" ? "Amount" : "Jumlah"}</th><th className="px-3 py-3 text-right">{language === "en" ? "Cost basis" : "Modal"}</th><th className="px-3 py-3 text-right">{language === "en" ? "Current value" : "Nilai saat ini"}</th><th className="px-5 py-3 text-right">{language === "en" ? "Actions" : "Aksi"}</th></tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#27272A]">
                {stocks.map((holding) => <StockRow key={holding.id} holding={holding} onBuy={() => openBuy("stock", holding)} onSell={() => openSell("stock", holding)} />)}
                {cryptos.map((holding) => <CryptoRow key={holding.id} holding={holding} onBuy={() => openBuy("crypto", holding)} onSell={() => openSell("crypto", holding)} />)}
              </tbody>
            </table>
          </div>
          <div className="grid gap-2 p-3 md:hidden">
            {stocks.map((holding) => <MobileStockCard key={holding.id} holding={holding} onBuy={() => openBuy("stock", holding)} onSell={() => openSell("stock", holding)} />)}
            {cryptos.map((holding) => <MobileCryptoCard key={holding.id} holding={holding} onBuy={() => openBuy("crypto", holding)} onSell={() => openSell("crypto", holding)} />)}
          </div>
          {stocks.length + cryptos.length === 0 && <div className="p-10 text-center text-xs text-[#64748B]">{language === "en" ? "No assets recorded yet." : "Belum ada aset yang dicatat."}</div>}
        </section>
      )}

      {tab === "activity" && (
        <section className="rounded-2xl border border-[#E5E7EB] bg-white shadow-2xs dark:border-[#27272A] dark:bg-[#121215]">
          <div className="border-b border-[#E5E7EB] px-4 py-3 dark:border-[#27272A]"><h2 className="text-sm font-bold">{language === "en" ? "Transaction history" : "Riwayat transaksi"}</h2><p className="text-[11px] text-[#64748B]">{language === "en" ? "Review, correct, or remove records when needed." : "Cek, koreksi, atau hapus pencatatan saat diperlukan."}</p></div>
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
              return <div key={activity.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"><div className="flex min-w-0 items-center gap-2.5"><div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", activity.type === "buy" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600")}>{activity.type === "buy" ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</div><div className="min-w-0"><p className="truncate text-xs font-bold">{isStock ? activity.ticker : activity.symbol} · {actionLabel}</p><p className="text-[10px] text-[#64748B]">{new Date(activity.trade_date).toLocaleDateString(language === "en" ? "en-US" : "id-ID")} · {activity.account?.name || "Investment account"}</p></div></div><div className="flex items-center gap-1.5"><span className="hidden font-mono text-xs font-bold sm:block">{formatCurrency(Number(isStock ? activity.net_amount : activity.gross_amount), activity.account?.currency || "IDR")}</span>{isStock && <><button type="button" onClick={() => { const trade = activity as EnrichedStockTrade; setSelectedId(trade.id); setTicker(trade.ticker); setLots(String(trade.lots || 1)); setAmount(String(trade.net_amount)); setDate(trade.trade_date.slice(0, 10)); setNotes(trade.notes || ""); setAssetKind("stock"); setModal("edit"); }} className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-slate-100 hover:text-slate-900"><Edit2 className="h-3.5 w-3.5" /></button><button type="button" onClick={() => handleDelete(activity as EnrichedStockTrade)} className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button></>}</div></div>;
            })}
            {activities.length === 0 && <div className="p-10 text-center text-xs text-[#64748B]">{language === "en" ? "No transactions recorded yet." : "Belum ada riwayat transaksi."}</div>}
          </div>
        </section>
      )}

      {tab === "fees" && <section className="grid gap-3 sm:grid-cols-2"><Summary label={language === "en" ? "Total fees recorded" : "Total biaya tercatat"} value={formatCurrency(totalFees, "IDR")} /><Summary label={i18n.dailyStampDuty} value={formatCurrency(stockTrades.reduce((sum, trade) => sum + Number(trade.stamp_duty || 0), 0), "IDR")} /></section>}

      <Modal isOpen={modal !== null} onClose={closeModal} title={modal === "edit" ? i18n.modalEditTradeTitle : modal === "buy" ? (assetKind === "stock" ? i18n.modalBuyTitle : cryptoI18n.buyTitle) : assetKind === "stock" ? i18n.modalSellTitle : cryptoI18n.sellTitle}>
        <form onSubmit={submitTransaction} className="flex flex-col gap-3.5">
          {modal !== "edit" && <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#F8F9FA] p-1.5 dark:bg-[#1A1A20]">
            <button type="button" onClick={() => setAssetKind("stock")} className={cn("rounded-lg px-3 py-2 text-xs font-bold", assetKind === "stock" ? "bg-white shadow-sm dark:bg-[#27272A]" : "text-[#64748B]")}>Saham</button>
            <button type="button" onClick={() => setAssetKind("crypto")} className={cn("rounded-lg px-3 py-2 text-xs font-bold", assetKind === "crypto" ? "bg-white shadow-sm dark:bg-[#27272A]" : "text-[#64748B]")}>Kripto</button>
          </div>}
          <Select value={accountId} onValueChange={setAccountId}><SelectTrigger><SelectValue placeholder={language === "en" ? "Investment account" : "Akun investasi"} /></SelectTrigger><SelectContent>{investmentAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name} · {formatCurrency(account.current_balance, account.currency)}</SelectItem>)}</SelectContent></Select>
          {assetKind === "stock" ? <><Input label={i18n.tickerLabel} value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase())} placeholder={i18n.tickerPlaceholder} required /><Input label={i18n.lotsLabel} type="number" step="any" min="0.01" value={lots} onChange={(event) => setLots(event.target.value)} required /><Input label={modal === "buy" ? i18n.netBuyAmountLabel : i18n.netSellAmountLabel} type="number" value={amount} onChange={(event) => setAmount(event.target.value)} required />{Number(amount) > 10_000_000 && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{i18n.stampDutyNotice}</p>}</> : <><Input label={cryptoI18n.symbol} value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} required /><Input label={cryptoI18n.grossAmount} type="number" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Contoh: 5000000" required /><Input label={cryptoI18n.pricePerUnit} type="number" step="any" value={price} onChange={(event) => setPrice(event.target.value)} required />{modal === "buy" ? <p className="rounded-xl bg-emerald-50 p-3 font-mono text-sm font-bold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">{cryptoI18n.quantityCalculated}: {cryptoQuantity > 0 ? cryptoQuantity.toFixed(8) : "—"} {symbol}</p> : <Input label={cryptoI18n.quantity} type="number" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />}<Input label={cryptoI18n.fee} type="number" step="any" value={fee} onChange={(event) => setFee(event.target.value)} placeholder="0" /></>}
          <Input label={i18n.tradeDateLabel} type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          <Input label={i18n.notesLabel} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={i18n.notesPlaceholder} />
          <Button type="submit" disabled={busy}>{busy ? i18n.saving : modal === "edit" ? i18n.updateTradeBtn : i18n.saveSuccess}</Button>
        </form>
      </Modal>
    </div>
  );
}

function Summary({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "positive" | "negative" }) {
  return <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-3.5 dark:border-[#27272A] dark:bg-[#1A1A20]"><p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">{label}</p><p title={value} className={cn("mt-1 break-all font-mono text-sm leading-tight font-black sm:text-base", tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-rose-600" : "text-[#0F172A] dark:text-[#F8FAFC]")}>{value}</p></div>;
}

function StockRow({ holding, onBuy, onSell }: { holding: EnrichedStockHolding; onBuy: () => void; onSell: () => void }) {
  const lots = Number(holding.lots) || Number(holding.total_shares) / 100;
  return <tr><td className="px-5 py-3"><p className="font-bold">{holding.ticker}</p><p className="text-[10px] text-[#64748B]">{holding.account?.name || "RDN"} · Saham</p></td><td className="px-3 py-3 font-mono">{lots} lot</td><td className="px-3 py-3 text-right font-mono">{formatCurrency(Number(holding.total_cost), holding.account?.currency)}</td><td className="px-3 py-3 text-right font-mono">{formatCurrency(Number(holding.total_cost), holding.account?.currency)}</td><td className="px-5 py-3 text-right"><span className="inline-flex gap-1.5">{<button type="button" onClick={onBuy} className="rounded-lg p-1.5 text-indigo-600 hover:bg-indigo-50"><Plus className="h-3.5 w-3.5" /></button>}<button type="button" onClick={onSell} className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"><ArrowUpRight className="h-3.5 w-3.5" /></button></span></td></tr>;
}

function CryptoRow({ holding, onBuy, onSell }: { holding: EnrichedCryptoHolding; onBuy: () => void; onSell: () => void }) {
  return <tr><td className="px-5 py-3"><p className="font-bold">{holding.symbol}</p><p className="text-[10px] text-[#64748B]">{holding.account?.name || "Investment"} · Kripto</p></td><td className="px-3 py-3 font-mono">{Number(holding.quantity).toFixed(8)} {holding.symbol}</td><td className="px-3 py-3 text-right font-mono">{formatCurrency(Number(holding.cost_basis), holding.price_currency)}</td><td className="px-3 py-3 text-right font-mono">{formatCurrency(Number(holding.quantity) * Number(holding.manual_price), holding.price_currency)}</td><td className="px-5 py-3 text-right"><span className="inline-flex gap-1.5"><button type="button" onClick={onBuy} className="rounded-lg p-1.5 text-indigo-600 hover:bg-indigo-50"><Plus className="h-3.5 w-3.5" /></button><button type="button" onClick={onSell} className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"><ArrowUpRight className="h-3.5 w-3.5" /></button></span></td></tr>;
}

function MobileStockCard({ holding, onBuy, onSell }: { holding: EnrichedStockHolding; onBuy: () => void; onSell: () => void }) {
  return <div className="rounded-xl border border-[#E5E7EB] p-3 dark:border-[#27272A]"><div className="flex items-center justify-between"><div><p className="font-bold">{holding.ticker}</p><p className="text-[10px] text-[#64748B]">Saham · {Number(holding.lots) || Number(holding.total_shares) / 100} lot</p></div><p className="font-mono text-xs font-bold">{formatCurrency(Number(holding.total_cost), holding.account?.currency)}</p></div><div className="mt-2 flex gap-2">{<Button size="sm" variant="outline" onClick={onBuy} className="h-7 text-[11px]"><Plus className="mr-1 h-3 w-3" /> Beli</Button>}<Button size="sm" variant="outline" onClick={onSell} className="h-7 text-[11px]"><ArrowUpRight className="mr-1 h-3 w-3" /> Jual</Button></div></div>;
}

function MobileCryptoCard({ holding, onBuy, onSell }: { holding: EnrichedCryptoHolding; onBuy: () => void; onSell: () => void }) {
  return <div className="rounded-xl border border-[#E5E7EB] p-3 dark:border-[#27272A]"><div className="flex items-center justify-between"><div><p className="font-bold">{holding.symbol}</p><p className="text-[10px] text-[#64748B]">Kripto · {Number(holding.quantity).toFixed(8)}</p></div><p className="font-mono text-xs font-bold">{formatCurrency(Number(holding.quantity) * Number(holding.manual_price), holding.price_currency)}</p></div><div className="mt-2 flex gap-2"><Button size="sm" variant="outline" onClick={onBuy} className="h-7 text-[11px]"><Plus className="mr-1 h-3 w-3" /> Beli</Button><Button size="sm" variant="outline" onClick={onSell} className="h-7 text-[11px]"><ArrowUpRight className="mr-1 h-3 w-3" /> Jual</Button></div></div>;
}
