"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Account } from "@/types/database";
import { createTransfer } from "@/actions/transfers";
import { getLatestForexRates } from "@/actions/exchange-rate";
import {
  formatCurrency,
  formatNaturalForexRate,
  getNaturalPairInfo,
  getCrossRate,
  ForexRatesMap,
  DEFAULT_FALLBACK_RATES,
} from "@/lib/utils/currency";
import { useLanguage } from "@/lib/i18n/language-context";
import { getDefaultAccountId } from "@/lib/storage/default-account";
import { ArrowRightLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  defaultFromAccountId?: string;
  defaultExchangeRate?: number;
  onSuccess?: () => void;
}

export function TransferModal({
  isOpen,
  onClose,
  accounts,
  defaultFromAccountId,
  onSuccess,
}: TransferModalProps) {
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.transfer.modalTitle}
      maxWidth="md"
    >
      <TransferForm
        accounts={accounts}
        defaultFromAccountId={defaultFromAccountId}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </Modal>
  );
}

interface TransferFormProps {
  accounts: Account[];
  defaultFromAccountId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

function TransferForm({ accounts, defaultFromAccountId, onClose, onSuccess }: TransferFormProps) {
  const { language, t } = useLanguage();
  const initialFrom = defaultFromAccountId || (accounts.find((a) => a.id === getDefaultAccountId())?.id) || accounts[0]?.id || "";
  const initialTo = accounts.find((a) => a.id !== initialFrom)?.id || accounts[1]?.id || accounts[0]?.id || "";
  const [fromAccountId, setFromAccountId] = useState<string>(initialFrom);
  const [toAccountId, setToAccountId] = useState<string>(initialTo);
  const [amount, setAmount] = useState<string>("");
  const [transferFee, setTransferFee] = useState<string>("");
  const [receivedAmount, setReceivedAmount] = useState<string>("");
  const [naturalRate, setNaturalRate] = useState<string>("1");
  const [description, setDescription] = useState<string>("");
  const [transferDate, setTransferDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [rates, setRates] = useState<ForexRatesMap>(DEFAULT_FALLBACK_RATES);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFetchingRates, setIsFetchingRates] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fromAccount =
    accounts.find((a) => a.id === fromAccountId) || accounts[0];
  const toAccount = accounts.find((a) => a.id === toAccountId) || accounts[1];
  const isCrossCurrency =
    fromAccount && toAccount && fromAccount.currency !== toAccount.currency;

  const pairInfo = getNaturalPairInfo(
    fromAccount?.currency || "IDR",
    toAccount?.currency || "IDR",
    rates
  );

  const recalculateAmounts = useCallback(
    (
      fromId: string,
      toId: string,
      sentVal: string,
      curRates: ForexRatesMap,
      customNatRate?: string
    ) => {
      const fromA = accounts.find((a) => a.id === fromId);
      const toA = accounts.find((a) => a.id === toId);
      if (fromA && toA && fromA.currency !== toA.currency) {
        const info = getNaturalPairInfo(fromA.currency, toA.currency, curRates);
        const rateToUse = customNatRate !== undefined ? (parseFloat(customNatRate) || info.defaultRate) : info.defaultRate;
        const numericAmount = parseFloat(sentVal);
        if (!isNaN(numericAmount) && numericAmount > 0) {
          const converted = info.calculateReceived(numericAmount, rateToUse);
          setReceivedAmount(converted.toFixed(2));
        } else {
          setReceivedAmount("");
        }
        if (customNatRate === undefined) {
          setNaturalRate(rateToUse.toFixed(2));
        }
      } else {
        setReceivedAmount(sentVal);
        setNaturalRate("1");
      }
    },
    [accounts],
  );

  // Fetch forex rates on mount
  useEffect(() => {
    let isMounted = true;
    setIsFetchingRates(true);
    getLatestForexRates()
      .then((live) => {
        if (isMounted) {
          setRates(live);
          recalculateAmounts(fromAccountId, toAccountId, amount, live);
        }
      })
      .finally(() => {
        if (isMounted) setIsFetchingRates(false);
      });
    return () => {
      isMounted = false;
    };
  }, [fromAccountId, toAccountId, recalculateAmounts, amount]);

  const handleFromChange = (id: string) => {
    setFromAccountId(id);
    recalculateAmounts(id, toAccountId, amount, rates);
  };

  const handleToChange = (id: string) => {
    setToAccountId(id);
    recalculateAmounts(fromAccountId, id, amount, rates);
  };

  const handleAmountChange = (val: string) => {
    setAmount(val);
    const sent = parseFloat(val);
    const nat = parseFloat(naturalRate) || pairInfo.defaultRate;
    if (!isNaN(sent) && sent > 0) {
      const recv = pairInfo.calculateReceived(sent, nat);
      setReceivedAmount(recv.toFixed(2));
    } else {
      setReceivedAmount("");
    }
  };

  const handleReceivedAmountChange = (val: string) => {
    setReceivedAmount(val);
    const sent = parseFloat(amount);
    const recv = parseFloat(val);
    if (!isNaN(sent) && sent > 0 && !isNaN(recv) && recv > 0) {
      const nat = pairInfo.calculateNaturalRate(sent, recv);
      if (nat > 0) {
        setNaturalRate(nat.toFixed(2));
      }
    }
  };

  const handleNaturalRateChange = (val: string) => {
    setNaturalRate(val);
    const sent = parseFloat(amount);
    const nat = parseFloat(val);
    if (!isNaN(sent) && sent > 0 && !isNaN(nat) && nat > 0) {
      const recv = pairInfo.calculateReceived(sent, nat);
      setReceivedAmount(recv.toFixed(2));
    }
  };

  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  const handleManualRateRefresh = async () => {
    if (lastSyncTime && Date.now() - lastSyncTime < 30000) {
      toast.success(
        language === "en"
          ? "Exchange rates are already up to date"
          : "Kurs mata uang sudah yang paling terbaru",
      );
      return;
    }

    setIsFetchingRates(true);
    try {
      const live = await getLatestForexRates();
      setRates(live);
      setLastSyncTime(Date.now());
      recalculateAmounts(fromAccountId, toAccountId, amount, live);
      toast.success(
        language === "en"
          ? "Currency exchange rates updated successfully"
          : "Kurs mata uang berhasil diperbarui",
      );
    } catch {
      toast.error(
        language === "en"
          ? "Failed to fetch exchange rates"
          : "Gagal memperbarui kurs mata uang",
      );
    } finally {
      setIsFetchingRates(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (fromAccountId === toAccountId) {
      const err = t.transfer.sameAccountError || "Akun sumber dan tujuan tidak boleh sama";
      setError(err);
      toast.error(err);
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError(t.transfer.amountLabel + " > 0");
      return;
    }

    const numFee = parseFloat(transferFee) || 0;
    const totalRequired = numAmount + numFee;

    if (fromAccount && Number(fromAccount.current_balance) < totalRequired) {
      const err =
        language === "en"
          ? `Insufficient balance in ${fromAccount.name}`
          : `Saldo ${fromAccount.name} tidak mencukupi`;
      setError(err);
      toast.error(err);
      return;
    }

    let rawMultiplier = 1;
    if (isCrossCurrency) {
      const recv = parseFloat(receivedAmount) || pairInfo.calculateReceived(numAmount, parseFloat(naturalRate) || pairInfo.defaultRate);
      rawMultiplier = numAmount > 0 ? (recv / numAmount) : 1;
    }

    setIsLoading(true);

    try {
      const res = await createTransfer({
        fromAccountId,
        toAccountId,
        amount: numAmount,
        transferFee: numFee,
        exchangeRateUsed: rawMultiplier,
        description: description.trim() || null,
        transferDate: `${transferDate}T${new Date().toTimeString().split(" ")[0]}.000Z`,
      });

      if (res.error) {
        setError(res.error);
        toast.error(t.transfer.transferFailed || "Gagal Transfer", { description: res.error });
      } else {
        toast.success(
          isCrossCurrency
            ? language === "en"
              ? "Currency exchange & transfer successful"
              : "Transfer & konversi valas berhasil disimpan"
            : language === "en"
              ? "Transfer saved successfully"
              : "Transfer berhasil disimpan",
        );
        onSuccess?.();
        onClose();
      }
    } catch {
      const err = language === "en" ? "Failed to save transfer" : "Gagal menyimpan transfer";
      setError(err);
      toast.error(t.transfer.transferFailed || "Gagal Transfer", { description: err });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
          {error}
        </div>
      )}

      {/* Source Account */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
          {t.transfer.sourceLabel}
        </label>
        <Select value={fromAccountId} onValueChange={handleFromChange}>
          <SelectTrigger className="w-full text-xs">
            <SelectValue placeholder={t.transfer.sourceLabel} />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id} className="text-xs">
                <div className="flex items-center justify-between gap-2 w-full">
                  <span className="truncate">
                    {a.name} ({a.currency})
                  </span>
                  <span className="text-[10px] font-mono text-[#94A3B8] shrink-0 font-bold">
                    ({formatCurrency(a.current_balance, a.currency)})
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Destination Account */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
          {t.transfer.destLabel}
        </label>
        <Select value={toAccountId} onValueChange={handleToChange}>
          <SelectTrigger className="w-full text-xs">
            <SelectValue placeholder={t.transfer.destLabel} />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id} className="text-xs">
                <div className="flex items-center justify-between gap-2 w-full">
                  <span className="truncate">
                    {a.name} ({a.currency})
                  </span>
                  <span className="text-[10px] font-mono text-[#94A3B8] shrink-0 font-bold">
                    ({formatCurrency(a.current_balance, a.currency)})
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2.5">
        <Input
          label={`${t.transfer.amountLabel} (${fromAccount?.currency || 'IDR'})`}
          type="number"
          step="any"
          placeholder="0"
          value={amount}
          onChange={(e) => handleAmountChange(e.target.value)}
          required
          autoFocus
          className="font-mono font-bold text-sm tnum"
          rightIcon={
            <span className="text-xs font-mono font-bold text-[#94A3B8]">
              {fromAccount?.currency || 'IDR'}
            </span>
          }
        />

        <Input
          label={`${t.transfer.adminFeeLabel || (language === "en" ? "Admin Fee (Optional)" : "Biaya Admin (Opsional)")} (${fromAccount?.currency || 'IDR'})`}
          type="number"
          step="any"
          placeholder="0"
          value={transferFee}
          onChange={(e) => setTransferFee(e.target.value)}
          className="font-mono text-sm tnum"
          rightIcon={
            <span className="text-xs font-mono font-bold text-[#94A3B8]">
              {fromAccount?.currency || 'IDR'}
            </span>
          }
        />
      </div>

      {parseFloat(transferFee) > 0 && parseFloat(amount) > 0 && (
        <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-[11px] text-amber-900 dark:text-amber-300 flex items-center justify-between">
          <span className="font-medium">
            {t.transfer.totalDeductedLabel || "Total Terpotong"}:
          </span>
          <span className="font-mono font-black">
            {formatCurrency((parseFloat(amount) || 0) + (parseFloat(transferFee) || 0), fromAccount?.currency)}
          </span>
        </div>
      )}

      {isCrossCurrency && (
        <div className="p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {t.transfer.conversionTitle}
            </span>
            <button
              type="button"
              onClick={handleManualRateRefresh}
              disabled={isFetchingRates}
              className="inline-flex items-center gap-1 text-[11px] font-mono text-[#0F172A] dark:text-[#FAFAFA] hover:underline disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw
                className={`w-3 h-3 ${isFetchingRates ? "animate-spin" : ""}`}
              />
              <span>
                {isFetchingRates
                  ? (language === "en" ? "Updating..." : "Memperbarui...")
                  : (language === "en" ? "Sync Rates" : "Sinkron Kurs")}
              </span>
            </button>
          </div>

          <div className="flex flex-col gap-2.5 pt-1 border-t border-[#E5E7EB] dark:border-[#27272A]">
            <Input
              label={`${t.transfer.receivedAmountLabel || "Nominal Diterima"} (${toAccount?.currency})`}
              type="number"
              step="any"
              placeholder="0"
              value={receivedAmount}
              onChange={(e) => handleReceivedAmountChange(e.target.value)}
              required
              className="text-xs font-mono font-bold text-[#0D9488]"
            />

            <Input
              label={`${language === "en" ? "Exchange Rate" : "Kurs Transaksi"} (1 ${pairInfo.baseCurrency} = ... ${pairInfo.quoteCurrency})`}
              type="number"
              step="any"
              placeholder={pairInfo.defaultRate.toString()}
              value={naturalRate}
              onChange={(e) => handleNaturalRateChange(e.target.value)}
              className="text-xs font-mono font-bold"
              rightIcon={
                <span className="text-[11px] font-mono font-bold text-[#64748B] dark:text-[#94A3B8]">
                  {pairInfo.quoteCurrency}
                </span>
              }
            />

            {/* Natural Human-Readable Effective Forex Indicator */}
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono flex items-center justify-between">
              <span className="text-[#64748B] dark:text-[#94A3B8] font-sans text-[11px]">
                {language === "en" ? "Effective Rate:" : "Kurs Berlaku:"}
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                1 {pairInfo.baseCurrency} = {formatCurrency(parseFloat(naturalRate) || pairInfo.defaultRate, pairInfo.quoteCurrency)}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
          {t.transfer.dateLabel}
        </label>
        <DatePicker value={transferDate} onChange={setTransferDate} />
      </div>

      {/* Description / Free-Text Note */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
          {t.transfer.noteLabel}
        </label>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t.transfer.notePlaceholder || (language === 'en' ? 'e.g. Monthly savings, Wise FX conversion, family transfer...' : 'Contoh: Tabungan bulanan, konversi Wise, transfer keluarga...')}
          className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#0F172A] dark:focus:ring-white resize-y min-h-[56px] max-h-[160px] transition-colors"
        />
      </div>

      {error && <p className="text-xs font-semibold text-[#E11D48]">{error}</p>}

      <div className="flex items-center gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="flex-1"
        >
          {t.common.cancel}
        </Button>
        <Button
          type="submit"
          isLoading={isLoading}
          className="flex-1 font-bold"
        >
          <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />
          {t.transfer.executeBtn}
        </Button>
      </div>
    </form>
  );
}
