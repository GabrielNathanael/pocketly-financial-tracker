"use client";

import { ReactNode, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  Bitcoin,
  ChevronRight,
  Pencil,
  Plus,
  WalletCards,
} from "lucide-react";
import {
  Account,
  EnrichedCryptoHolding,
  EnrichedCryptoTrade,
} from "@/types/database";
import {
  createFloqWithdrawal,
  recordCryptoBuy,
  recordCryptoSell,
  updateCryptoManualPrice,
} from "@/actions/crypto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils/currency";
import { getLocalDateString, localDateToISO } from "@/lib/utils/date";
import { useLanguage } from "@/lib/i18n/language-context";

interface CryptoPortfolioProps {
  holdings: EnrichedCryptoHolding[];
  trades: EnrichedCryptoTrade[];
  accounts: Account[];
}

type ModalType = "buy" | "sell" | "withdraw" | "price" | null;

export function CryptoPortfolio({
  holdings,
  trades,
  accounts,
}: CryptoPortfolioProps) {
  const { t, language } = useLanguage();
  const router = useRouter();
  const crypto = t.investments.crypto;
  const floqAccounts = accounts.filter(
    (account) => account.type === "investment" && account.is_active,
  );
  const destinationAccounts = accounts.filter(
    (account) => account.type !== "investment" && account.is_active,
  );
  const [modal, setModal] = useState<ModalType>(null);
  const [holdingId, setHoldingId] = useState("");
  const [accountId, setAccountId] = useState(floqAccounts[0]?.id || "");
  const [toAccountId, setToAccountId] = useState(
    destinationAccounts[0]?.id || "",
  );
  const [symbol, setSymbol] = useState("BTC");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("");
  const [fee, setFee] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(getLocalDateString());
  const [busy, setBusy] = useState(false);

  const selectedHolding = holdings.find((holding) => holding.id === holdingId);
  const calculatedQuantity =
    Number(amount) > 0 && Number(price) > 0
      ? Number(amount) / Number(price)
      : 0;
  const marketValue = useMemo(
    () =>
      holdings.reduce(
        (total, holding) =>
          total + Number(holding.quantity) * Number(holding.manual_price || 0),
        0,
      ),
    [holdings],
  );
  const floqCash = floqAccounts.reduce(
    (total, account) => total + Number(account.current_balance),
    0,
  );

  const reset = () => {
    setModal(null);
    setHoldingId("");
    setAmount("");
    setQuantity("");
    setFee("");
    setPrice("");
    setDate(getLocalDateString());
  };

  const openBuy = () => {
    setSymbol("BTC");
    setModal("buy");
  };

  const openSell = () => {
    const first = holdings[0];
    if (first) {
      setHoldingId(first.id);
      setSymbol(first.symbol);
      setPrice(String(first.manual_price || first.average_buy_price || ""));
    }
    setModal("sell");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      let result: { error?: string } = {};
      if (modal === "buy") {
        result = await recordCryptoBuy({
          accountId,
          symbol,
          quantity: calculatedQuantity,
          grossAmount: Number(amount),
          feeAmount: Number(fee || 0),
          pricePerUnit: Number(price),
          tradeDate: localDateToISO(date),
        });
      } else if (modal === "sell") {
        result = selectedHolding
          ? await recordCryptoSell({
              holdingId,
              quantity: Number(quantity),
              grossAmount: Number(amount),
              feeAmount: Number(fee || 0),
              pricePerUnit: Number(price),
              tradeDate: localDateToISO(date),
            })
          : { error: language === "en" ? "Select an asset first" : "Pilih aset terlebih dahulu" };
      } else if (modal === "price") {
        result = await updateCryptoManualPrice({
          holdingId,
          manualPrice: Number(price),
        });
      } else if (modal === "withdraw") {
        result = await createFloqWithdrawal({
          fromAccountId: accountId,
          toAccountId,
          grossAmount: Number(amount),
          feeAmount: Number(fee || 0),
          transferDate: localDateToISO(date),
        });
      }

      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(crypto.saved);
      reset();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const modalTitle =
    modal === "buy"
      ? crypto.buyTitle
      : modal === "sell"
        ? crypto.sellTitle
        : modal === "withdraw"
          ? crypto.withdrawTitle
          : crypto.updatePrice;

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-4 pb-2">
      <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm dark:border-[#27272A] dark:bg-[#121215]">
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-5 py-5 text-white sm:px-7 sm:py-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-400/15 ring-1 ring-orange-300/25">
                <Bitcoin className="h-6 w-6 text-orange-300" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-200">
                  {crypto.title}
                </p>
                <h2 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">
                  {language === "en" ? "Your crypto, clearly tracked." : "Aset kripto tercatat dengan jelas."}
                </h2>
                <p className="mt-1 max-w-xl text-xs text-slate-300">
                  {crypto.subtitle}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={openBuy} className="h-9 gap-1.5 bg-white text-slate-950 hover:bg-slate-100">
                <Plus className="h-4 w-4" /> {crypto.buy}
              </Button>
              <Button size="sm" variant="outline" onClick={openSell} className="h-9 gap-1.5 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                {crypto.sell}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setModal("withdraw")} className="h-9 gap-1.5 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                <ArrowDownToLine className="h-4 w-4" /> {crypto.withdraw}
              </Button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label={crypto.marketValue} value={formatCurrency(marketValue, "IDR")} />
            <Metric label={crypto.costBasis} value={formatCurrency(holdings.reduce((sum, h) => sum + Number(h.cost_basis), 0), "IDR")} />
            <Metric label={crypto.quantity} value={`${holdings.reduce((sum, h) => sum + Number(h.quantity), 0).toFixed(8)} BTC`} />
            <Metric label={crypto.account} value={formatCurrency(floqCash, "IDR")} icon={<WalletCards className="h-3.5 w-3.5" />} />
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
          {holdings.map((holding) => (
            <div key={holding.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#27272A] dark:bg-[#18181D]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-300">
                    <Bitcoin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold">{holding.symbol}</p>
                    <p className="text-[10px] text-slate-500">{holding.account?.name || "Floq"}</p>
                  </div>
                </div>
                <button type="button" aria-label={crypto.updatePrice} onClick={() => { setHoldingId(holding.id); setPrice(String(holding.manual_price || "")); setModal("price"); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-900 dark:hover:bg-slate-800">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-4 flex items-end justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{crypto.quantity}</p>
                  <p className="mt-0.5 font-mono text-sm font-bold">{Number(holding.quantity).toFixed(8)} {holding.symbol}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{crypto.marketValue}</p>
                  <p className="mt-0.5 font-mono text-sm font-bold">{formatCurrency(Number(holding.quantity) * Number(holding.manual_price), holding.price_currency)}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2 text-[10px] text-slate-500 dark:border-slate-700">
                <span>{crypto.manualPrice}</span>
                <span className="font-mono font-semibold">{formatCurrency(Number(holding.manual_price), holding.price_currency)}</span>
              </div>
            </div>
          ))}
          {holdings.length === 0 && (
            <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 px-5 text-center sm:col-span-2 lg:col-span-3 dark:border-slate-700">
              <Bitcoin className="h-7 w-7 text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{crypto.empty}</p>
              <p className="mt-1 max-w-sm text-xs text-slate-500">{crypto.emptyHint}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-[11px] text-slate-500 dark:border-[#27272A] sm:px-5">
          <span>{trades.length} {crypto.transactions}</span>
          <span className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-300">
            {crypto.priceHint} <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>

      <Modal isOpen={modal !== null} onClose={reset} title={modalTitle}>
        <form onSubmit={submit} className="flex flex-col gap-3.5">
          {modal === "buy" && (
            <>
              <Input label={crypto.symbol} value={symbol} onChange={(event) => setSymbol(event.target.value)} required />
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder={crypto.account} /></SelectTrigger>
                <SelectContent>{floqAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name} · {formatCurrency(account.current_balance, account.currency)}</SelectItem>)}</SelectContent>
              </Select>
              <Input label={`${crypto.grossAmount} (IDR)`} type="number" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Contoh: 5000000" required />
              <Input label={`${crypto.pricePerUnit} (IDR)`} type="number" step="any" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Contoh: 1436522782" required />
              <CalculatedQuantity value={calculatedQuantity} label={crypto.quantityCalculated} symbol={symbol} />
              <Input label={`${crypto.fee} (IDR)`} type="number" step="any" value={fee} onChange={(event) => setFee(event.target.value)} placeholder="0" />
            </>
          )}
          {modal === "sell" && (
            <>
              <Select value={holdingId} onValueChange={(id) => { setHoldingId(id); const holding = holdings.find((item) => item.id === id); if (holding) { setSymbol(holding.symbol); setPrice(String(holding.manual_price || holding.average_buy_price)); } }}>
                <SelectTrigger><SelectValue placeholder={crypto.quantity} /></SelectTrigger>
                <SelectContent>{holdings.map((holding) => <SelectItem key={holding.id} value={holding.id}>{holding.symbol} · {Number(holding.quantity).toFixed(8)}</SelectItem>)}</SelectContent>
              </Select>
              <Input label={crypto.quantity} type="number" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
              <Input label={`${crypto.grossAmount} (IDR)`} type="number" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} required />
              <Input label={`${crypto.pricePerUnit} (IDR)`} type="number" step="any" value={price} onChange={(event) => setPrice(event.target.value)} required />
              <Input label={`${crypto.fee} (IDR)`} type="number" step="any" value={fee} onChange={(event) => setFee(event.target.value)} placeholder="0" />
            </>
          )}
          {modal === "price" && (
            <>
              <p className="rounded-xl bg-indigo-50 p-3 text-xs text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-200">{crypto.priceHint}</p>
              <Input label={`${crypto.manualPrice} (IDR)`} type="number" step="any" value={price} onChange={(event) => setPrice(event.target.value)} required />
            </>
          )}
          {modal === "withdraw" && (
            <>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder={crypto.account} /></SelectTrigger>
                <SelectContent>{floqAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name} · {formatCurrency(account.current_balance, account.currency)}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={toAccountId} onValueChange={setToAccountId}>
                <SelectTrigger><SelectValue placeholder={crypto.destination} /></SelectTrigger>
                <SelectContent>{destinationAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent>
              </Select>
              <Input label={`${crypto.grossAmount} (IDR)`} type="number" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={crypto.buyAmountHint} required />
              <Input label={`${crypto.fee} (IDR)`} type="number" step="any" value={fee} onChange={(event) => setFee(event.target.value)} placeholder="Masukkan sesuai transaksi" />
              {Number(amount) > 0 && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{crypto.received}: {formatCurrency(Math.max(0, Number(amount) - Number(fee || 0)), "IDR")}</p>}
            </>
          )}
          {modal !== "price" && <Input label={language === "en" ? "Date" : "Tanggal"} type="date" value={date} onChange={(event) => setDate(event.target.value)} />}
          <Button type="submit" disabled={busy || (modal === "sell" && !selectedHolding)}>{busy ? "..." : crypto.save}</Button>
        </form>
      </Modal>
    </section>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
      <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">{icon}{label}</p>
      <p className="mt-1 truncate font-mono text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function CalculatedQuantity({
  label,
  value,
  symbol,
}: {
  label: string;
  value: number;
  symbol: string;
}) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">{label}</p>
      <p className="mt-1 font-mono text-lg font-black text-emerald-800 dark:text-emerald-200">{value > 0 ? value.toFixed(8) : "—"} {symbol}</p>
    </div>
  );
}
