"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Account, Debt, DebtType, CurrencyCode } from "@/types/database";
import { createDebt, updateDebt, deleteDebt } from "@/actions/debts";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CURRENCY_LIST } from "@/lib/constants/currencies";
import { formatCurrency } from "@/lib/utils/currency";
import { useLanguage } from "@/lib/i18n/language-context";
import { toast } from "sonner";
import { Trash2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface DebtFormProps {
  initialData?: Debt | null;
  accounts?: Account[];
  onSuccess?: () => void;
}

export function DebtForm({
  initialData,
  accounts = [],
  onSuccess,
}: DebtFormProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const isEditing = !!initialData;

  const initCurrency = (initialData?.currency || "IDR") as CurrencyCode;

  const getBestAccountId = (accs: Account[], curr: CurrencyCode) => {
    const defaultMatch = accs.find((a) => a.is_default && a.currency === curr);
    if (defaultMatch) return defaultMatch.id;
    const firstMatch = accs.find((a) => a.currency === curr);
    return firstMatch ? firstMatch.id : accs[0]?.id || "";
  };

  const [type, setType] = useState<DebtType>(initialData?.type || "debt");
  const [counterpartyName, setCounterpartyName] = useState(
    initialData?.counterparty_name || "",
  );
  const [initialAmount, setInitialAmount] = useState<string>(
    initialData?.initial_amount ? String(initialData.initial_amount) : "",
  );
  const [currency, setCurrency] = useState<CurrencyCode>(initCurrency);
  const [dueDate, setDueDate] = useState<string>(initialData?.due_date || "");
  const [notes, setNotes] = useState<string>(initialData?.notes || "");
  const [accountId, setAccountId] = useState<string>(() =>
    getBestAccountId(accounts, initCurrency),
  );
  const [recordTransaction, setRecordTransaction] = useState<boolean>(true);

  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTransactions, setDeleteTransactions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counterpartyName.trim()) {
      setError(t.debts.counterpartyLabel + " is required");
      return;
    }

    const numericAmount = parseFloat(initialAmount);
    if (!isEditing && (isNaN(numericAmount) || numericAmount <= 0)) {
      setError(t.debts.principalLabel + " must be > 0");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (isEditing && initialData) {
        const res = await updateDebt(initialData.id, {
          counterpartyName,
          dueDate: dueDate || null,
          notes: notes || null,
        });
        if (res.error) {
          setError(res.error);
          return;
        }
      } else {
        const res = await createDebt({
          type,
          counterpartyName,
          initialAmount: numericAmount,
          currency,
          dueDate: dueDate || null,
          notes: notes || null,
          accountId: recordTransaction ? accountId : null,
          recordTransaction,
        });
        if (res.error) {
          setError(res.error);
          return;
        }
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/debts");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData) return;
    setIsDeleting(true);
    setShowDeleteConfirm(false);
    setError(null);

    try {
      const res = await deleteDebt(initialData.id, { deleteTransactions });
      if (res.error) {
        setError(res.error);
      } else {
        toast.success(t.debts.deleteSuccess);
        if (onSuccess) {
          onSuccess();
        } else {
          router.push("/debts");
        }
      }
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const matchingAccounts = accounts.filter((a) => a.currency === currency);

  const handleCurrencyChange = (newCurrency: CurrencyCode) => {
    setCurrency(newCurrency);
    setAccountId(getBestAccountId(accounts, newCurrency));
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="p-3 rounded-lg bg-destructive-muted border border-destructive/20 text-destructive text-xs font-medium flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}
      {/* Type toggle */}
      {!isEditing && (
        <div className="grid grid-cols-2 p-1 bg-surface-subtle rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setType("debt")}
            className={cn(
              "py-2 rounded-md font-bold text-xs transition-colors cursor-pointer text-center",
              type === "debt"
                ? "bg-destructive text-destructive-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.debts.debtType}
          </button>
          <button
            type="button"
            onClick={() => setType("receivable")}
            className={cn(
              "py-2 rounded-md font-bold text-xs transition-colors cursor-pointer text-center",
              type === "receivable"
                ? "bg-success text-success-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.debts.receivableType}
          </button>
        </div>
      )}

      <Input
        label={t.debts.counterpartyLabel}
        type="text"
        placeholder={t.debts.counterpartyPlaceholder}
        value={counterpartyName}
        onChange={(e) => setCounterpartyName(e.target.value)}
        required
      />

      {!isEditing && (
        <div className="flex flex-col gap-3">
          {/* Currency Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {t.common.currency}
            </label>
            <Select
              value={currency}
              onValueChange={(val) => handleCurrencyChange(val as CurrencyCode)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_LIST.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code} ({c.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Principal Amount */}
          <Input
            label={`${t.debts.principalLabel} (${currency})`}
            type="number"
            step="any"
            placeholder="0"
            value={initialAmount}
            onChange={(e) => setInitialAmount(e.target.value)}
            currency={currency}
            required
            className="font-mono font-bold text-base tnum"
          />
        </div>
      )}

      {/* Linked Account Selection & Sync Option */}
      {!isEditing && accounts && accounts.length > 0 && (
        <div className="flex flex-col gap-2.5 p-3.5 rounded-xl bg-surface-subtle border border-border">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={recordTransaction}
              onChange={(e) => setRecordTransaction(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-ring cursor-pointer"
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold text-foreground">
                {t.debts.recordDisbursementCheck}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {recordTransaction
                  ? type === "receivable"
                    ? t.debts.disbursementDeductDesc
                    : t.debts.disbursementCreditDesc
                  : t.debts.skipDisbursementDesc}
              </span>
            </div>
          </label>

          {recordTransaction && (
            <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {t.debts.disbursementAccountLabel} ({currency})
              </label>
              {matchingAccounts.length > 0 ? (
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue placeholder={t.quickAdd.selectAccount} />
                  </SelectTrigger>
                  <SelectContent>
                    {matchingAccounts.map((acc) => (
                      <SelectItem
                        key={acc.id}
                        value={acc.id}
                        className="text-xs"
                      >
                        {acc.name} (
                        {formatCurrency(acc.current_balance, acc.currency)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-2.5 rounded-lg bg-warning-muted border border-warning/20 text-warning text-[11px]">
                  {t.debts.noMatchingAccountShort}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Due Date Picker */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {t.debts.dueDateLabel}
        </label>
        <DatePicker
          value={dueDate}
          onChange={setDueDate}
          placeholder={t.debts.dueDatePlaceholder}
        />
      </div>

      {/* Free-Text Notes */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {t.debts.notesLabel}
        </label>
        <textarea
          rows={3}
          placeholder={t.debts.notesPlaceholder}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl bg-surface-subtle border border-border text-xs text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring transition-all resize-y min-h-17.5 leading-relaxed"
        />
      </div>

      {error && <p className="text-xs font-semibold text-destructive">{error}</p>}

      <div className="flex items-center gap-2 pt-2">
        {isEditing && (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteTransactions(false);
                setShowDeleteConfirm(true);
              }}
              className="px-3"
            >
              {t.debts.deleteKeepTransactions}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                setDeleteTransactions(true);
                setShowDeleteConfirm(true);
              }}
              className="px-3"
              title={t.debts.deleteAndRollback}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </>
        )}
        <Button type="submit" isLoading={isLoading} className="flex-1">
          {isEditing ? t.debts.saveRecord : t.debts.createRecord}
        </Button>
      </div>

      {isEditing && (
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
          isLoading={isDeleting}
          title={t.debts.deleteConfirmTitle}
          message={
            deleteTransactions
              ? t.debts.deleteRollbackConfirmMsg
              : t.debts.deleteKeepConfirmMsg
          }
        />
      )}
    </form>
  );
}
