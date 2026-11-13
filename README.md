<p align="center">
  <img src="public/logo.png" alt="Pocketly Logo" width="120" style="border-radius: 24px;" />
</p>

<h1 align="center">Pocketly — Multi-Currency Personal Finance Tracker</h1>

<p align="center">
  <strong>A privacy-first personal finance app built with Next.js and Supabase for multi-currency ledgers, budgeting, investments, net worth, recurring bills, split bills, receipt OCR, and auditable financial workflows.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.3-black?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/TailwindCSS-4.0-38B2AC?style=flat-square&logo=tailwind-css" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase" alt="Supabase" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

---

## Overview

**Pocketly** is an end-to-end personal finance companion for managing cash and non-cash accounts, multi-currency transactions, budgets, debts, savings goals, recurring obligations, investments, and net worth in one place.

The app uses **Next.js 16 App Router + Server Actions**, **Supabase (PostgreSQL, Auth, RLS, triggers, Storage)**, and **Tailwind CSS 4**, with domain logic for currency conversion, cached market pricing, receipt OCR, split-bill calculations, and auditability.

## Key Features

### Accounts, transactions, and transfers
- **Multi-wallet accounts:** bank, cash, e-wallet, credit card, and investment accounts (IDR/USD/SGD support)
- **Transaction ledger:** income/expense tracking with categories, tags, itemized breakdowns, filters, detail views, and per-transaction audit history
- **Transfers:** inter-account transfers with exchange-rate handling, optional fees, and balance/accounting safeguards
- **Balance tools:** current balance tracking, reconciliation/adjustment flows, and account mutation history

### Budgeting, categories, and insights
- **Categories:** default/system categories, category management, and canonicalization/dedupe logic
- **Budgets:** monthly/category budgets with actuals, carryover behavior, and budget history
- **Reports & analytics:** cashflow and breakdown views with charts, filters, and export/report outputs
- **Global audit log:** filterable activity trail across modules plus transaction-level audit views

### Debts, goals, and recurring obligations
- **Debts & receivables:** track liabilities/receivables, payments, statuses, and linked ledger effects
- **Savings goals:** targets, progress tracking, deposits/withdrawals, and goal-linked transactions
- **Recurring transactions:** schedules (daily/weekly/monthly/quarterly/annual), due handling, manual processing, and payment history
- **Due center:** consolidated view of upcoming/overdue recurring items, debts, and goal-related due items

### Investments and net worth
- **Portfolio tracking:** stock, crypto, and ETF holdings/trades with settlement currencies, fees/cost basis, and holding synchronization
- **Market-aware valuation:** cached asset prices and forex rates with market-vs-cost fallback where pricing is unavailable
- **Net worth:** canonical net-worth computation, asset/liability breakdowns, and historical snapshots
- **Background refresh:** cron/maintenance flows for forex rates, asset prices, recurring catch-up, and net-worth snapshots

### Split bill and receipt OCR
- **Split bill module:** create/manage drafts and balanced bills, participants/contacts/avatars, items and assignments, charges (tax/service/discount/other), item discounts (fixed/percent), proportional/equal split modes, history/detail flows
- **Receipt scanning:** Gemini-backed receipt extraction for transaction drafts and structured split-bill drafts (merchant/date/currency/items/charges/totals normalization)
- **Record your share:** record or sync the user's portion into transactions with linkage-aware behavior

### Experience and privacy
- **PWA:** installable standalone experience (manifest, icons, mobile-first UI)
- **i18n:** Indonesian and English language support
- **Privacy mode:** mask sensitive currency values in the UI
- **Quick actions:** quick-add flows, pinned templates, global search/navigation aids, and in-app guide/settings

## Tech Stack

| Layer | Technologies |
| --- | --- |
| **Framework** | Next.js 16.3 (App Router, Server Actions, Route Handlers) |
| **UI** | React 19.2, Tailwind CSS 4, Radix UI, Lucide React, cmdk, sonner, Recharts |
| **Language** | TypeScript 5 (strict) |
| **Backend** | Supabase (PostgreSQL, Auth, RLS, triggers/functions, Storage) |
| **Validation** | Zod 4 |
| **OCR / AI** | Gemini Vision-based scan flows (`src/lib/ocr/*`, scan actions), Tesseract.js dependency available |
| **Exports / docs** | jsPDF, jspdf-autotable, html2canvas, JSZip, CSV export |
| **Utilities** | date-fns, DiceBear avatars, Vercel Analytics |

## Project Structure

```text
pocketly/
├─ public/                       # Static assets (logos, icons, etc.)
├─ src/
│  ├─ actions/                   # Server Actions (domain queries/mutations)
│  ├─ app/                       # App Router routes, layouts, loading UI, API routes
│  │  ├─ (auth)/                 # Login/register routes
│  │  ├─ (main)/                 # Authenticated app routes (dashboard, accounts, transactions, split-bill, net-worth, etc.)
│  │  └─ api/cron/              # Scheduled/maintenance route handlers
│  ├─ components/                # Feature UI modules, layout, shared ui primitives, pwa
│  ├─ lib/                       # Supabase clients, i18n, utils, validations, net-worth, OCR, recurring, storage, context
│  ├─ types/                     # DB and domain types
│  └─ proxy.ts                   # Request proxy -> session/auth middleware helper
├─ supabase/
│  ├─ migrations/                # Ordered SQL migrations (001..027)
│  └─ functions/                 # Edge Functions (e.g. fetch-exchange-rate)
├─ architecture.md               # Architecture overview
├─ agents.md                     # Repository/agent contributor guidance
└─ package.json
```

> For deeper implementation details (routing, actions, domain flows, schema evolution, cron/OCR/net-worth behavior), see [`architecture.md`](architecture.md).

## Getting Started

### Prerequisites
- **Node.js** `>= 18.18.0`
- **npm** (or pnpm/yarn)
- A **Supabase** project

### 1. Clone and install
```bash
git clone <your-repo-url>
cd pocketly
npm install
```

### 2. Configure environment variables
Create `.env.local` in the project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key

# Server-only / privileged operations (admin client, cron, maintenance)
SUPABASE_SECRET_KEY=your-service-role-or-secret-key
# or legacy name used by some code paths:
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Receipt / split-bill OCR (Gemini)
GEMINI_API_KEY=your-gemini-api-key

# Cron protection (recommended in deployed environments)
CRON_SECRET=your-cron-secret
```

> Notes:
> - Some OCR/config features depend on Gemini credentials; scanning behavior and limits depend on provider availability.
> - `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` is required for admin/cron operations (e.g. price/rate refresh, snapshots, recurring catch-up).

### 3. Apply database migrations
Run the SQL files in `supabase/migrations/` **in numeric order** against your Supabase/Postgres database.

Current migration range: **`001_initial_schema.sql` through `027_split_bill_item_discount_mode.sql`**.

Key milestones include:
- `001`–`005`: core schema, multi-currency/budget updates, audit triggers/fixes
- `006`–`011`: recurring transactions, savings goals/deposits, tags, investments (stocks), pinned templates
- `012`–`019`: crypto/ETF support, fee/settlement/linkage fields, ledger precision and balance/audit fixes
- `020`–`023`: net worth snapshots, asset prices, transfer guards, settlement currency
- `024`–`027`: split bill domain (tables/RLS/storage), avatars/items enrichments, transaction items, split-bill discount modes

### 4. Run the app
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev    # Start development server
npm run build  # Production build
npm run start  # Start production server
npm run lint   # Run ESLint
```

## Background jobs (cron)

The app includes route handlers for scheduled maintenance:
- `/api/cron/daily`: refreshes forex rates and asset prices, performs recurring auto-processing catch-up, and writes net-worth snapshots
- `/api/cron/recurring`: performs recurring auto-processing catch-up

`vercel.json` schedules `/api/cron/daily` (`0 17 * * *` UTC, region `sin1`). Protect cron endpoints with `CRON_SECRET` and configure required server-side Supabase credentials in deployed environments.

## PWA install

Pocketly ships as a PWA (manifest + standalone experience):

- **iOS (Safari):** Share → Add to Home Screen
- **Android (Chrome):** Menu → Install app / Add to Home screen
- **Desktop:** Browser install prompt/menu (when supported)

## Notes

- This is an actively evolving codebase; feature behavior is defined by the current implementation in `src/`, `supabase/`, and migrations.
- Financial operations are protected by a combination of app-level guards and database RLS/triggers—preserve these invariants when modifying flows.
- See [`architecture.md`](architecture.md) and [`agents.md`](agents.md) for contributor/agent guidance and system details.

## License

This project is open-sourced under the [MIT License](LICENSE).

Copyright &copy; 2026 [Gabriel Nathanael](https://github.com/GabrielNathanael).
