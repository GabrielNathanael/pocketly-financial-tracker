import React from 'react'
import { getBudgetsWithActuals } from '@/actions/budgets'
import { BudgetManager } from '@/components/budget/budget-manager'
import { getCurrentPeriodStartDate } from '@/lib/utils/date'

export const dynamic = 'force-dynamic'

interface BudgetPageProps {
  searchParams: Promise<{ period?: string }>
}

export default async function BudgetPage({ searchParams }: BudgetPageProps) {
  const params = await searchParams
  const currentPeriod = params.period || getCurrentPeriodStartDate()
  const budgets = await getBudgetsWithActuals(currentPeriod)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
          Alokasi & Batas Anggaran
        </h1>
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-mono">
          Batas pengeluaran per kategori dan pantauan realisasi bulanan
        </p>
      </div>

      <BudgetManager budgets={budgets} currentPeriod={currentPeriod} />
    </div>
  )
}
