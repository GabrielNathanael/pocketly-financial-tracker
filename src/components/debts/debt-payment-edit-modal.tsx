"use client";

import React, { useState } from "react";
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
import { EnrichedDebtPayment, updateDebtPayment } from "@/actions/debts";
import { formatCurrency } from "@/lib/utils/currency";
import { useLanguage } from "@/lib/i18n/language-context";
import { getDefaultAccountId } from "@/lib/storage/default-account";
import { Wallet, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { localDateToISO, getLocalDateString } from "@/lib/utils/date";

interface DebtPaymentEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: EnrichedDebtPayment | null;
  debt: Debt | null;
  accounts: Account[];
  onSuccess?: () => void;
}

export function DebtPaymentEditModal({
  isOpen,
  onClose,
  payment,
  debt,
  accounts,
  onSuccess,
}: DebtPaymentEditModalProps) {
  const { t } = useLanguage();

  if (!isOpen || !payment || !debt) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.debts.editPaymentModalTitle || "Ubah Cicilan"}
      maxWidth="sm"
    >
      <DebtPaymentEditForm
        key={payment.id}
        payment={payment}
        debt={debt}
        accounts={accounts}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </Modal>
  );
}

interface DebtPaymentEditFormProps {
  payment: EnrichedDebtPayment;
  debt: Debt;
  accounts: Account[];
  onClose: () => void;
  onSuccess?: () => void;
}

function DebtPaymentEditForm({
  payment,
  debt,
  accounts,
  onClose,
  onSuccess,
}: DebtPaymentEditFormProps) {
  const { language, t } = useLanguage();
  const savedDefaultId =
    typeof window !== "undefined" ? getDefaultAccountId() : null;

  // Strict currency filter
  const matchingAccounts = accounts.filter((a) => a.currency === debt.currency);

  const initialAccountId =
    payment.transaction?.account_id ||
    matchingAccounts.find((a) => a.id === savedDefaultId)?.id ||
    matchingAccounts[0]?.id ||
    "";

  const [amount, setAmount] = useState<string>(String(payment.amount));
  const [paymentDate, setPaymentDate] = useState<string>(
    payment.payment_date
      ? getLocalDateString(payment.payment_date)
      : getLocalDateString(),
  );
  const [selectedAccountId, setSelectedAccountId] =
    useState<string>(initialAccountId);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAccount = matchingAccounts.find(
    (a) => a.id === selectedAccountId,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

    // Client-side Strict Balance Guard
    if (debt.type === "debt") {
      const oldAmount = Number(payment.amount) || 0;
      const currentBal = Number(selectedAccount.current_balance) || 0;
      const delta = numericAmount - oldAmount;
      if (currentBal - delta < 0) {
        const err =
          language === "en"
            ? `Insufficient balance in ${selectedAccount.name} for payment increase. (Available: ${formatCurrency(currentBal, selectedAccount.currency)})`
            : `Saldo ${selectedAccount.name} tidak mencukupi untuk kenaikan pembayaran. (Tersedia: ${formatCurrency(currentBal, selectedAccount.currency)})`;
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
      const res = await updateDebtPayment({
        paymentId: payment.id,
        debtId: debt.id,
        amount: numericAmount,
        paymentDate: localDateToISO(paymentDate),
        accountId: selectedAccountId,
      });

      if (res.error) {
        setError(res.error);
        toast.error(
          t.debts.updatePaymentFailed ||
            (language === "en"
              ? "Failed to Update Payment"
              : "Gagal Mengubah Cicilan"),
          { description: res.error },
        );
      } else {
        toast.success(
          language === "en"
            ? "Installment updated successfully"
            : "Perubahan cicilan berhasil disimpan",
        );
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
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
            {debt.currency}
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
              ? t.debts.mustMatchCurrency.replace("{currency}", debt.currency)
              : `Wajib ${debt.currency}`}
          </span>
        </div>

        {matchingAccounts.length === 0 ? (
          <div className="p-3 rounded-xl bg-[#FFFBEB] dark:bg-[#78350F]/20 border border-[#FDE68A] dark:border-[#92400E]/40 text-xs text-[#B45309] dark:text-[#FDE68A] flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {t.debts.noMatchingAccountShort
                ? t.debts.noMatchingAccountShort.replace(
                    "{currency}",
                    debt.currency,
                  )
                : `Belum ada akun dengan mata uang ${debt.currency}. Silakan buat akun baru di menu Akun.`}
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
  );
}
