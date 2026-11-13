"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Account, Debt, DebtType, DebtStatus } from "@/types/database";
import { EnrichedDebtWithPayments } from "@/actions/debts";
import { DebtCard } from "@/components/debts/debt-card";
import { DebtForm } from "@/components/debts/debt-form";
import { DebtPaymentModal } from "@/components/debts/debt-payment-modal";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils/currency";
import { useLanguage } from "@/lib/i18n/language-context";
import { Plus, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface DebtsManagerProps {
  debts: EnrichedDebtWithPayments[];
  accounts: Account[];
}

export function DebtsManager({ debts, accounts }: DebtsManagerProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [typeFilter, setTypeFilter] = useState<DebtType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<DebtStatus | "all">("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [paymentDebt, setPaymentDebt] = useState<Debt | null>(null);

  const filtered = debts.filter((d) => {
    if (typeFilter !== "all" && d.type !== typeFilter) return false;
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    return true;
  });

  const totalActiveDebts = debts
    .filter((d) => d.type === "debt" && d.status === "active")
    .reduce((acc, d) => acc + Number(d.remaining_amount), 0);

  const totalActiveReceivables = debts
    .filter((d) => d.type === "receivable" && d.status === "active")
    .reduce((acc, d) => acc + Number(d.remaining_amount), 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Dynamic Bilingual Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          {t.debts.title}
        </h1>
        <p className="text-xs text-muted-foreground font-mono">
          {t.debts.subtitle}
        </p>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="p-4 sm:p-5 rounded-xl bg-surface border border-border flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-destructive-muted text-destructive border border-destructive/20 flex items-center justify-center shrink-0">
            <ArrowDownRight className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              {t.debts.totalDebts}
            </span>
            <span className="text-lg sm:text-xl font-mono font-bold text-destructive tracking-tight tnum">
              {formatCurrency(totalActiveDebts, "IDR")}
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-xl bg-surface border border-border flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-success-muted text-success border border-success/20 flex items-center justify-center shrink-0">
            <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              {t.debts.totalReceivables}
            </span>
            <span className="text-lg sm:text-xl font-mono font-bold text-success tracking-tight tnum">
              {formatCurrency(totalActiveReceivables, "IDR")}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          {[
            { label: t.debts.allTypes, value: "all" },
            { label: t.debts.debtType, value: "debt" },
            { label: t.debts.receivableType, value: "receivable" },
          ].map((tItem) => (
            <button
              key={tItem.value}
              onClick={() => setTypeFilter(tItem.value as DebtType | "all")}
              className={cn(
                "px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors shrink-0 whitespace-nowrap cursor-pointer border",
                typeFilter === tItem.value
                  ? "bg-primary text-primary-foreground border-transparent"
                  : "bg-surface text-muted-foreground border-border hover:bg-surface-subtle",
              )}
            >
              {tItem.label}
            </button>
          ))}

          {/* Radix UI Select Component */}
          <Select
            value={statusFilter}
            onValueChange={(val) => setStatusFilter(val as DebtStatus | "all")}
          >
            <SelectTrigger className="h-8 text-[11px] w-30 shrink-0">
              <SelectValue placeholder={t.debts.allStatus} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.debts.allStatus}</SelectItem>
              <SelectItem value="active">{t.debts.activeStatus}</SelectItem>
              <SelectItem value="paid">{t.debts.paidStatus}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          size="sm"
          onClick={() => setIsAddModalOpen(true)}
          className="gap-1.5 shrink-0 whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          {t.debts.addBtn}
        </Button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="Scale"
          title={t.debts.emptyTitle}
          description={t.debts.emptyDesc}
          actionLabel={"+ " + t.debts.addBtn}
          onAction={() => setIsAddModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {filtered.map((d) => (
            <DebtCard
              key={d.id}
              debt={d}
              onRecordPaymentClick={() => setPaymentDebt(d)}
            />
          ))}
        </div>
      )}

      {/* Add Debt Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={t.debts.modalTitle}
        maxWidth="md"
      >
        <DebtForm
          accounts={accounts}
          onSuccess={() => {
            setIsAddModalOpen(false);
            router.refresh();
          }}
        />
      </Modal>

      {/* Payment Modal */}
      <DebtPaymentModal
        isOpen={!!paymentDebt}
        onClose={() => setPaymentDebt(null)}
        debt={paymentDebt}
        accounts={accounts}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
