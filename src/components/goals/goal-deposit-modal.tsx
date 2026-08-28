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
import { getDefaultAccountId } from "@/lib/storage/default-account";

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
  const { t, language } = useLanguage();

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
    if (isOpen && goal) {
      setType("deposit");
      setAmount("");
      // Prioritize default/primary account if currency matches, then default account, then first currency match, then accounts[0]
      const defaultId = getDefaultAccountId();
      const defaultMatch = accounts.find(
        (a) => a.id === defaultId && a.currency === goal.currency,
      );
      const matching =
        defaultMatch ||
        accounts.find((a) => a.id === defaultId) ||
        accounts.find((a) => a.currency === goal.currency);
      setAccountId(matching?.id || accounts[0]?.id || "");
      setDepositDate(format(new Date(), "yyyy-MM-dd"));
      setNotes("");
      setErrorMsg(null);
    }
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
      setErrorMsg(
        language === "en"
          ? "Please enter a valid amount"
          : "Nominal harus lebih dari 0",
      );
      return;
    }

    if (!accountId) {
      setErrorMsg(
        language === "en"
          ? "Please select an account (Cash or Bank)"
          : "Silakan pilih akun sumber/tujuan (Kas Tunai atau Bank)",
      );
      return;
    }

    if (type === "withdraw" && numAmount > currentAmt) {
      setErrorMsg(
        language === "en"
          ? `Withdrawal cannot exceed saved balance (${formatCurrency(currentAmt, goal.currency)})`
          : `Nominal tarik melebihi saldo tabungan (${formatCurrency(currentAmt, goal.currency)})`,
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
      setErrorMsg(
        language === "en"
          ? "An unexpected error occurred"
          : "Terjadi kesalahan sistem",
      );
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
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Current Savings Summary Bar */}
        <div className="p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between text-xs font-mono">
          <div>
            <span className="font-sans text-[#64748B] dark:text-[#94A3B8] block text-[10px] uppercase font-bold tracking-wider">
              {t.goals.totalSaved}
            </span>
            <span className="font-bold text-[#0D9488] text-sm tnum">
              {formatCurrency(currentAmt, goal.currency)}
            </span>
          </div>
          <div className="text-right">
            <span className="font-sans text-[#64748B] dark:text-[#94A3B8] block text-[10px] uppercase font-bold tracking-wider">
              {language === "en" ? "Remaining Target" : "Sisa Target"}
            </span>
            <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC] text-sm tnum">
              {formatCurrency(remainingAmt, goal.currency)}
            </span>
          </div>
        </div>

        {/* Deposit vs Withdraw Type Switcher */}
        <div className="grid grid-cols-2 p-1 bg-[#F1F3F5] dark:bg-[#1A1A20] rounded-xl border border-[#E5E7EB] dark:border-[#27272A]">
          <button
            type="button"
            onClick={() => setType("deposit")}
            className={cn(
              "py-1.5 text-xs font-bold rounded-lg transition-all text-center cursor-pointer flex items-center justify-center gap-1.5",
              type === "deposit"
                ? "bg-white dark:bg-[#121215] text-[#0D9488] shadow-xs"
                : "text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8]",
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
                ? "bg-white dark:bg-[#121215] text-[#E11D48] shadow-xs"
                : "text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8]",
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
          required
          autoFocus
          className="font-mono font-bold text-sm tnum"
          rightIcon={
            <span className="text-xs font-mono font-bold text-[#94A3B8]">
              {goal.currency}
            </span>
          }
        />

        {/* Date Picker */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
            {t.common.date}
          </label>
          <DatePicker value={depositDate} onChange={setDepositDate} />
        </div>

        {/* Account Selector (styled to match RecurringFormModal) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#0F172A] dark:text-[#FAFAFA]">
            {type === "deposit"
              ? language === "en"
                ? "Source Account"
                : "Rekening Sumber"
              : language === "en"
                ? "Destination Account"
                : "Rekening Tujuan"}{" "}
            <span className="text-rose-500">*</span>
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
                      <Wallet className="w-3.5 h-3.5 text-[#94A3B8]" />
                      <span>{a.name}</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-[#64748B] dark:text-[#94A3B8] tnum">
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
          placeholder="misal: Setoran THR, Bonus Kerja"
          className="text-xs"
        />

        {/* Footer Actions */}
        <div className="pt-3 border-t border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-end gap-2">
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
              "text-xs font-bold text-white cursor-pointer",
              type === "deposit"
                ? "bg-[#0D9488] hover:bg-[#0F766E]"
                : "bg-[#E11D48] hover:bg-[#BE123C]",
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
