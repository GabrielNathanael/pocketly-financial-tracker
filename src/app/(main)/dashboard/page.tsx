import React from 'react'
import { getAccounts } from '@/actions/accounts'
import { getTransactions } from '@/actions/transactions'
import { getBudgetsWithActuals } from '@/actions/budgets'
import { getLatestExchangeRate } from '@/actions/exchange-rate'
import { getRecurringTransactions } from '@/actions/recurring'
import { getDebts } from '@/actions/debts'
import { getSavingsGoals } from '@/actions/goals'
import { BalanceSummary } from '@/components/dashboard/balance-summary'
import { AccountsWidget } from '@/components/dashboard/accounts-widget'
import { BudgetOverviewWidget } from '@/components/dashboard/budget-overview-widget'
import { RecentTransactions } from '@/components/dashboard/recent-transactions'
import { PinnedTransactionsWidget } from '@/components/dashboard/pinned-transactions-widget'
import { CashflowChartWidget } from '@/components/dashboard/cashflow-chart-widget'
import { CompactDueBanner } from '@/components/dashboard/compact-due-banner'
import { getCurrentPeriodStartDate } from '@/lib/utils/date'
import { convertAmount } from '@/lib/utils/currency'
import { startOfMonth, endOfMonth, format } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const currentPeriod = getCurrentPeriodStartDate()
  const exchangeRate = await getLatestExchangeRate('USD', 'IDR')

  const now = new Date()
  const startDate = format(startOfMonth(now), 'yyyy-MM-dd')
  const endDate = format(endOfMonth(now), 'yyyy-MM-dd')

  const [
    accounts,
    recentTransactions,
    monthTransactions,
    allRecentTransactions,
    budgets,
    recurringTransactions,
    debts,
    goals,
  ] = await Promise.all([
    getAccounts(),
    getTransactions({ limit: 5 }),
    getTransactions({ startDate, endDate }),
    getTransactions({ limit: 100 }),
    getBudgetsWithActuals(currentPeriod),
    getRecurringTransactions(),
    getDebts(),
    getSavingsGoals(),
  ])

  // Calculate aggregated balances
  let totalBalanceIdr = 0
  for (const acc of accounts) {
    if (acc.is_active) {
      totalBalanceIdr += convertAmount(Number(acc.current_balance), acc.currency, 'IDR', exchangeRate)
    }
  }

  // Calculate month income & expenses in IDR
  let totalIncomeMonth = 0
  let totalExpenseMonth = 0

  for (const tx of monthTransactions) {
    const amtIdr = convertAmount(Number(tx.amount), tx.currency, 'IDR', exchangeRate)
    if (tx.type === 'income') {
      totalIncomeMonth += amtIdr
    } else {
      totalExpenseMonth += amtIdr
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 0. Compact Due Date & Bill Reminder Banner */}
      <CompactDueBanner
        recurringTransactions={recurringTransactions}
        debts={debts}
        goals={goals}
        accounts={accounts}
        exchangeRate={exchangeRate}
      />

      {/* 1. Main Aggregate Balance Card */}
      <BalanceSummary
        totalBalanceIdr={totalBalanceIdr}
        totalIncomeMonth={totalIncomeMonth}
        totalExpenseMonth={totalExpenseMonth}
        exchangeRate={exchangeRate}
      />

      {/* 2. Cashflow & Category Analytics Chart Widget (Weekly & Monthly Summary) */}
      <CashflowChartWidget
        transactions={allRecentTransactions}
        exchangeRate={exchangeRate}
      />

      {/* 3. Pinned Frequent Transactions (1-Tap Fast Logging) */}
      <PinnedTransactionsWidget />

      {/* 4. Accounts List Carousel */}
      <AccountsWidget accounts={accounts} exchangeRate={exchangeRate} />

      {/* 5. Budget Overview Widget */}
      <BudgetOverviewWidget budgets={budgets} />

      {/* 6. Recent Ledger Entries */}
      <RecentTransactions transactions={recentTransactions} />
    </div>
  )
}
