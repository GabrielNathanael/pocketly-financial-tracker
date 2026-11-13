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
  const { t } = useLanguage();

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
    if (!isOpen || !debt) return;
    queueMicrotask(() => {
      const defaultMatch = matchingAccounts.find((a) => a.is_default);
      if (defaultMatch) {
        setSelectedAccountId(defaultMatch.id);
      } else if (matchingAccounts.length > 0) {
        setSelectedAccountId(matchingAccounts[0].id);
      } else {
        setSelectedAccountId("");
      }
      setAmount("");
      setError(null);
    });
  }, [isOpen, debt, matchingAccounts]);

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
        const err = t.transactions.insufficientBalanceDesc
          .replace("{account}", selectedAccount.name)
          .replace(
            "{available}",
            formatCurrency(currentBal, selectedAccount.currency),
          )
          .replace(
            "{needed}",
            formatCurrency(numericAmount, selectedAccount.currency),
          );
        setError(err);
        toast.error(t.transactions.insufficientBalance, {
          description: err,
        });
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
        toast.error(t.debts.createPaymentFailed, { description: res.error });
      } else {
        toast.success(t.debts.createPaymentSuccess);
        setAmount("");
        onSuccess?.();
        onClose();
      }
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error(t.common.error, { description: msg });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t.debts.paymentModalTitle}: ${debt?.counterparty_name || ""}`}
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="p-3 rounded-lg bg-surface-subtle border border-border flex items-center justify-between text-xs font-mono">
          <span className="font-sans text-muted-foreground">
            {t.debts.remainingTagihan}:
          </span>
          <span className="font-bold text-foreground tnum">
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
          currency={debt?.currency || "IDR"}
          required
          autoFocus
          className="font-mono font-bold text-sm tnum"
        />

        {/* Payment Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {t.debts.paymentDate}
          </label>
          <DatePicker value={paymentDate} onChange={setPaymentDate} />
        </div>

        {/* Rekening Transaksi (Strict Currency Matched) */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {t.debts.selectLinkedAccount}
            </label>
            <span className="text-[10px] font-mono font-bold text-warning">
              {t.debts.mustMatchCurrency
                ? t.debts.mustMatchCurrency.replace(
                    "{currency}",
                    debt?.currency || "",
                  )
                : `Wajib ${debt?.currency}`}
            </span>
          </div>

          {matchingAccounts.length === 0 ? (
            <div className="p-3 rounded-xl bg-warning-muted border border-warning/20 text-xs text-warning flex items-start gap-2">
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
                  const isDef = a.is_default;
                  return (
                    <SelectItem key={a.id} value={a.id}>
                      <div className="flex items-center justify-between gap-3 w-full">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-3.5 h-3.5 text-foreground-muted" />
                          <span>{a.name}</span>
                          {isDef && (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                              Default
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono font-bold text-muted-foreground tnum">
                          {formatCurrency(a.current_balance, a.currency)}
                        </span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}

          <p className="text-[10px] text-muted-foreground">
            {debt?.type === "debt"
              ? t.debts.accountDeductNote ||
                "Saldo rekening terpilih akan otomatis terpotong (Pengeluaran)."
              : t.debts.accountCreditNote ||
                "Saldo rekening terpilih akan otomatis bertambah (Pemasukan)."}
          </p>
        </div>

        {error && (
          <p className="text-xs font-semibold text-destructive text-center">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-border">
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
