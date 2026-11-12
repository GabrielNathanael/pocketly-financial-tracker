import { common } from "./modules/common";
import { nav } from "./modules/nav";
import { goals } from "./modules/goals";
import { recurring } from "./modules/recurring";
import { dashboard } from "./modules/dashboard";
import { quickAdd } from "./modules/quickAdd";
import { transactions } from "./modules/transactions";
import { dueCenter } from "./modules/dueCenter";
import { undo } from "./modules/undo";
import { budgets } from "./modules/budgets";
import { accounts } from "./modules/accounts";
import { investments } from "./modules/investments";
import { transfer } from "./modules/transfer";
import { debts } from "./modules/debts";
import { categories } from "./modules/categories";
import { netWorth } from "./modules/netWorth";
import { auditLog } from "./modules/auditLog";
import { settings } from "./modules/settings";
import { guide } from "./modules/guide";
import { reports } from "./modules/reports";
import { landing } from "./modules/landing";
import { splitBill } from "./modules/splitBill";

export type Language = "id" | "en";

export const translations = {
  id: {
    common: common.id,
    nav: nav.id,
    goals: goals.id,
    recurring: recurring.id,
    dashboard: dashboard.id,
    quickAdd: quickAdd.id,
    transactions: transactions.id,
    dueCenter: dueCenter.id,
    undo: undo.id,
    budgets: budgets.id,
    accounts: accounts.id,
    investments: investments.id,
    transfer: transfer.id,
    debts: debts.id,
    categories: categories.id,
    netWorth: netWorth.id,
    auditLog: auditLog.id,
    settings: settings.id,
    guide: guide.id,
    reports: reports.id,
    landing: landing.id,
    splitBill: splitBill.id,
  },
  en: {
    common: common.en,
    nav: nav.en,
    goals: goals.en,
    recurring: recurring.en,
    dashboard: dashboard.en,
    quickAdd: quickAdd.en,
    transactions: transactions.en,
    dueCenter: dueCenter.en,
    undo: undo.en,
    budgets: budgets.en,
    accounts: accounts.en,
    investments: investments.en,
    transfer: transfer.en,
    debts: debts.en,
    categories: categories.en,
    netWorth: netWorth.en,
    auditLog: auditLog.en,
    settings: settings.en,
    guide: guide.en,
    reports: reports.en,
    landing: landing.en,
    splitBill: splitBill.en,
  },
};
