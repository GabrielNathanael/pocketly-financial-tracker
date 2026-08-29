"use client";

import React, { useState, useEffect } from "react";
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
import { Debt, Account } from "@/types/database";
import { addDebtPayment } from "@/actions/debts";
import { formatCurrency } from "@/lib/utils/currency";
import { useLanguage } from "@/lib/i18n/language-context";
import { getDefaultAccountId } from "@/lib/storage/default-account";
import { Wallet, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { localDateToISO, getLocalDateString } from "@/lib/utils/date";

interface DebtPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  debt: Debt | null;
  accounts: Account[];
  onSuccess?: () => void;
}

export function DebtPaymentModal({
  isOpen,
  onClose,
  debt,
  accounts,
  onSuccess,
}: DebtPaymentModalProps) {
  const { language, t } = useLanguage();

  const [amount, setAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(getLocalDateString());
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter accounts strictly by matching debt currency
  const matchingAccounts = debt
    ? accounts.filter((a) => a.currency === debt.currency)
    : accounts;

  // Auto-select default or first matching account whenever modal opens
  useEffect(() => {
    if (isOpen && debt) {
      const savedDefaultId = getDefaultAccountId();
      const defaultMatch = matchingAccounts.find(
        (a) => a.id === savedDefaultId,
      );
      if (defaultMatch) {
        setSelectedAccountId(defaultMatch.id);
      } else if (matchingAccounts.length > 0) {
        setSelectedAccountId(matchingAccounts[0].id);
      } else {
        setSelectedAccountId("");
      }
      setAmount("");
      setError(null);
    }
  }, [isOpen, debt?.id]);

  const selectedAccount = matchingAccounts.find(
    (a) => a.id === selectedAccountId,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debt) return;

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError(t.debts.paymentAmount + " > 0");
      return;
    }

    if (!selectedAccountId || !selectedAccount) {
      const err = t.debts.selectMatchingCurrencyAccount
        ? t.debts.selectMatchingCurrencyAccount.replace(
            "{currency}",
            debt.currency,
          )
        : `Pilih rekening transaksi bermata uang ${debt.currency}`;
      setError(err);
      toast.error(err);
      return;
    }

    // Client-side Strict Non-Negative Balance Guard
    if (debt.type === "debt") {
      const currentBal = Number(selectedAccount.current_balance) || 0;
      if (currentBal - numericAmount < 0) {
        const err =
          language === "en"
            ? `Insufficient balance in ${selectedAccount.name} (Available: ${formatCurrency(currentBal, selectedAccount.currency)}, Required: ${formatCurrency(numericAmount, selectedAccount.currency)})`
            : `Saldo ${selectedAccount.name} tidak mencukupi (Tersedia: ${formatCurrency(currentBal, selectedAccount.currency)}, Dibutuhkan: ${formatCurrency(numericAmount, selectedAccount.currency)})`;
        setError(err);
        toast.error(
          t.transactions.insufficientBalance ||
            (language === "en"
              ? "Insufficient Balance"
              : "Saldo Tidak Mencukupi"),
          { description: err },
        );
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await addDebtPayment({
        debtId: debt.id,
        amount: numericAmount,
        paymentDate: localDateToISO(paymentDate),
        accountId: selectedAccountId,
      });

      if (res.error) {
        setError(res.error);
        toast.error(
          t.debts.createPaymentFailed ||
            (language === "en"
              ? "Failed to Record Payment"
              : "Gagal Mencatat Cicilan"),
          { description: res.error },
        );
      } else {
        toast.success(
          language === "en"
            ? "Installment recorded successfully"
            : "Cicilan berhasil dicatat & saldo akun terpotong",
        );
        setAmount("");
        onSuccess?.();
        onClose();
      }
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error(
        language === "en" ? "An error occurred" : "Terjadi Kesalahan",
        { description: msg },
      );
    } finally {
      setIsLoading(false);
    }
  };

  const savedDefaultId =
    typeof window !== "undefined" ? getDefaultAccountId() : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t.debts.paymentModalTitle}: ${debt?.counterparty_name || ""}`}
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="p-3 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between text-xs font-mono">
          <span className="font-sans text-[#64748B] dark:text-[#94A3B8]">
            {t.debts.remainingTagihan}:
          </span>
          <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC] tnum">
            {formatCurrency(debt?.remaining_amount, debt?.currency)}
          </span>
        </div>

        <Input
          label={t.debts.paymentAmount}
          type="number"
          step="any"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          autoFocus
          className="font-mono font-bold text-sm tnum"
          rightIcon={
            <span className="text-xs font-mono font-bold text-[#94A3B8]">
              {debt?.currency}
            </span>
          }
        />

        {/* Payment Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
            {t.debts.paymentDate}
          </label>
          <DatePicker value={paymentDate} onChange={setPaymentDate} />
        </div>

        {/* Rekening Transaksi (Strict Currency Matched) */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {t.debts.selectLinkedAccount}
            </label>
            <span className="text-[10px] font-mono font-bold text-[#D97706]">
              {t.debts.mustMatchCurrency
                ? t.debts.mustMatchCurrency.replace(
                    "{currency}",
                    debt?.currency || "",
                  )
                : `Wajib ${debt?.currency}`}
            </span>
          </div>

          {matchingAccounts.length === 0 ? (
            <div className="p-3 rounded-xl bg-[#FFFBEB] dark:bg-[#78350F]/20 border border-[#FDE68A] dark:border-[#92400E]/40 text-xs text-[#B45309] dark:text-[#FDE68A] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {t.debts.noMatchingAccount
                  ? t.debts.noMatchingAccount.replace(
                      "{currency}",
                      debt?.currency || "",
                    )
                  : `Belum ada akun dengan mata uang ${debt?.currency}. Silakan buat akun baru di menu Akun.`}
              </span>
            </div>
          ) : (
            <Select
              value={selectedAccountId}
              onValueChange={setSelectedAccountId}
            >
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder={t.debts.selectLinkedAccount}>
                  {(() => {
                    const acc = matchingAccounts.find(
                      (a) => a.id === selectedAccountId,
                    );
                    return acc
                      ? `${acc.name} (${formatCurrency(acc.current_balance, acc.currency)})`
                      : t.debts.selectLinkedAccount;
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {matchingAccounts.map((a) => {
                  const isDef = a.id === savedDefaultId;
                  return (
                    <SelectItem key={a.id} value={a.id}>
                      <div className="flex items-center justify-between gap-3 w-full">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-3.5 h-3.5 text-[#94A3B8]" />
                          <span>{a.name}</span>
                          {isDef && (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A]">
                              Default
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono font-bold text-[#64748B] dark:text-[#94A3B8] tnum">
                          {formatCurrency(a.current_balance, a.currency)}
                        </span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}

          <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">
            {debt?.type === "debt"
              ? t.debts.accountDeductNote ||
                "Saldo rekening terpilih akan otomatis terpotong (Pengeluaran)."
              : t.debts.accountCreditNote ||
                "Saldo rekening terpilih akan otomatis bertambah (Pemasukan)."}
          </p>
        </div>

        {error && (
          <p className="text-xs font-semibold text-[#E11D48] text-center">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-[#E5E7EB] dark:border-[#27272A]">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            {t.common.cancel}
          </Button>
          <Button
            type="submit"
            isLoading={isLoading}
            disabled={matchingAccounts.length === 0}
          >
            {t.common.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
