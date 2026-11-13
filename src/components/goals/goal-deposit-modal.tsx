"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Account,
  EnrichedSavingsGoal,
  GoalDepositType,
} from "@/types/database";
import { recordGoalDeposit } from "@/actions/goals";
import { useLanguage } from "@/lib/i18n/language-context";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlertCircle,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";

interface GoalDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: EnrichedSavingsGoal | null;
  accounts: Account[];
  onSuccess?: () => void;
}

export function GoalDepositModal({
  isOpen,
  onClose,
  goal,
  accounts,
  onSuccess,
}: GoalDepositModalProps) {
  const { t } = useLanguage();

  const [type, setType] = useState<GoalDepositType>("deposit");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [depositDate, setDepositDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !goal) return;
    queueMicrotask(() => {
      setType("deposit");
      setAmount("");
      // Prioritize default/primary account if currency matches, then default account, then first currency match, then accounts[0]
      const defaultMatch =
        accounts.find((a) => a.is_default && a.currency === goal.currency) ||
        accounts.find((a) => a.is_default) ||
        accounts.find((a) => a.currency === goal.currency);
      setAccountId(defaultMatch?.id || accounts[0]?.id || "");
      setDepositDate(format(new Date(), "yyyy-MM-dd"));
      setNotes("");
      setErrorMsg(null);
    });
  }, [isOpen, goal, accounts]);

  if (!goal) return null;

  const targetAmt = Number(goal.target_amount);
  const currentAmt = Number(goal.current_amount);
  const remainingAmt = Math.max(0, targetAmt - currentAmt);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg(t.goals.errorAmountInvalid);
      return;
    }

    if (!accountId) {
      setErrorMsg(t.goals.errorSelectAccount);
      return;
    }

    if (type === "withdraw" && numAmount > currentAmt) {
      setErrorMsg(
        t.goals.errorWithdrawExceed.replace(
          "{amount}",
          formatCurrency(currentAmt, goal.currency),
        ),
      );
      return;
    }

    setLoading(true);
    try {
      const res = await recordGoalDeposit({
        goalId: goal.id,
        accountId,
        type,
        amount: numAmount,
        currency: goal.currency,
        depositDate,
        notes: notes.trim() || null,
      });

      if (res.error) {
        setErrorMsg(res.error);
        return;
      }

      toast.success(
        type === "deposit" ? t.goals.depositSuccess : t.goals.withdrawSuccess,
      );
      onSuccess?.();
      onClose();
    } catch {
      setErrorMsg(t.goals.errorUnexpected);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t.goals.depositModalTitle}: ${goal.name}`}
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        {/* Error Alert Banner */}
        {errorMsg && (
          <div className="p-3 rounded-lg bg-destructive-muted border border-destructive/20 flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Current Savings Summary Bar */}
        <div className="p-3 rounded-xl bg-canvas dark:bg-surface-subtle border border-border flex items-center justify-between text-xs font-mono">
          <div>
            <span className="font-sans text-foreground-secondary block text-[10px] uppercase font-bold tracking-wider">
              {t.goals.totalSaved}
            </span>
            <span className="font-bold text-success text-sm tnum">
              {formatCurrency(currentAmt, goal.currency)}
            </span>
          </div>
          <div className="text-right">
            <span className="font-sans text-foreground-secondary block text-[10px] uppercase font-bold tracking-wider">
              {t.goals.remainingTargetLabel}
            </span>
            <span className="font-bold text-foreground text-sm tnum">
              {formatCurrency(remainingAmt, goal.currency)}
            </span>
          </div>
        </div>

        {/* Deposit vs Withdraw Type Switcher */}
        <div className="grid grid-cols-2 p-1 bg-surface-subtle rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setType("deposit")}
            className={cn(
              "py-1.5 text-xs font-bold rounded-lg transition-all text-center cursor-pointer flex items-center justify-center gap-1.5",
              type === "deposit"
                ? "bg-surface text-success shadow-xs"
                : "text-foreground-secondary hover:text-foreground",
            )}
          >
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span>{t.goals.depositBtn}</span>
          </button>
          <button
            type="button"
            onClick={() => setType("withdraw")}
            className={cn(
              "py-1.5 text-xs font-bold rounded-lg transition-all text-center cursor-pointer flex items-center justify-center gap-1.5",
              type === "withdraw"
                ? "bg-surface text-destructive shadow-xs"
                : "text-foreground-secondary hover:text-foreground",
            )}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>{t.goals.withdrawBtn}</span>
          </button>
        </div>

        {/* Amount Input */}
        <Input
          label={t.common.amount}
          type="number"
          step="any"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          currency={goal.currency}
          required
          autoFocus
          className="font-mono font-bold text-sm tnum"
        />

        {/* Date Picker */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-foreground-secondary">
            {t.common.date}
          </label>
          <DatePicker value={depositDate} onChange={setDepositDate} />
        </div>

        {/* Account Selector (styled to match RecurringFormModal) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-foreground">
            {type === "deposit"
              ? t.goals.sourceAccountShortLabel
              : t.goals.depositDestinationAccountLabel}{" "}
            <span className="text-destructive">*</span>
          </label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="w-full min-w-0 text-xs">
              <SelectValue placeholder={t.common.account}>
                {(() => {
                  const acc = accounts.find((a) => a.id === accountId);
                  return acc
                    ? `${acc.name} (${formatCurrency(acc.current_balance, acc.currency)})`
                    : t.common.account;
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <div className="flex items-center justify-between gap-3 w-full">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-3.5 h-3.5 text-foreground-muted" />
                      <span>{a.name}</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-foreground-secondary tnum">
                      {formatCurrency(a.current_balance, a.currency)}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Notes Input */}
        <Input
          label={t.recurring.notesLabel}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t.goals.depositNotesPlaceholder}
          className="text-xs"
        />

        {/* Footer Actions */}
        <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs cursor-pointer"
          >
            {t.common.cancel}
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={loading}
            className={cn(
              "text-xs font-bold cursor-pointer",
              type === "deposit"
                ? "bg-success text-success-foreground hover:opacity-90"
                : "bg-destructive text-destructive-foreground hover:bg-destructive-hover",
            )}
          >
            {loading
              ? t.common.loading
              : type === "deposit"
                ? t.goals.depositBtn
                : t.goals.withdrawBtn}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
