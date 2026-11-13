# Pocketly Architecture

This document describes the architecture of **Pocketly** as implemented in this repository: application layers, modules, data flows, database evolution, and operational/runtime concerns.

## 1. Product scope

Pocketly is a multi-currency personal finance application built with **Next.js (App Router)** and **Supabase (PostgreSQL/Auth/Storage)**. Core domains include:

- Accounts/wallets, balances, transfers, and account mutation history
- Transactions (income/expense), tags, itemized receipts, audit history
- Categories and budgets (monthly actuals/carryover/history)
- Debts/receivables and payments
- Savings goals and deposits/withdrawals
- Recurring transactions and due processing
- Investments: stocks, crypto, ETF holdings/trades and cash/fee flows
- Net worth computation, asset pricing, forex rates, and snapshots
- Split bill (draft/balanced flows, participants/items/charges/assignments, receipt scan, record/sync own portion)
- Reports/exports and analytics
- Global and per-transaction audit trail
- PWA/mobile-first UX with i18n (ID/EN), privacy mode, pinned quick-add templates

## 2. Tech stack and runtime

| Layer | Technologies / notes |
| --- | --- |
| Framework | Next.js 16 App Router, React 19, Server Components + Client Components, Server Actions |
| Language | TypeScript 5 (`strict: true`) |
| Styling/UI | Tailwind CSS 4, Radix UI primitives, Lucide icons, `cmdk`, `sonner`, `recharts` |
| Backend/data | Supabase PostgreSQL, Auth, RLS, triggers/functions, Storage (split-bill images), Edge Function (forex) |
| Validation | Zod 4 schemas in `src/lib/validations/*` and domain validation in actions |
| OCR/AI | Gemini-based receipt extraction (`src/lib/ocr/gemini.ts`, scan actions/clients), `tesseract.js` available in deps, scan error normalization |
| Export/reporting | `jspdf`, `jspdf-autotable`, `html2canvas`, `jszip`, CSV export action |
| Other | `date-fns`, DiceBear avatars, Vercel Analytics |

**Key config**
- `next.config.ts`: `devIndicators: false`, `experimental.serverActions.bodySizeLimit: "10mb"`
- `tsconfig.json`: strict, bundler resolution, alias `@/* -> ./src/*`, excludes `supabase/` from TS program
- `vercel.json`: region `sin1`, cron `GET /api/cron/daily` at `0 17 * * *` (UTC)

## 3. Repository structure (high level)

```text
src/
  actions/        # Server Actions: domain mutations/queries
  app/            # App Router routes, layouts, loading UI, API routes
  components/     # Feature UI modules + layout + ui primitives + pwa
  lib/            # Shared/domain logic: supabase, i18n, utils, validations, net-worth, ocr, recurring, storage, context
  types/          # Database and domain types (e.g. split-bill)
  proxy.ts        # Request entry -> session/auth middleware helper
supabase/
  migrations/     # Ordered SQL migrations (001..027)
  functions/      # Edge Functions (e.g. fetch-exchange-rate)
public/           # Static assets
```

## 4. Request lifecycle and auth

### 4.1 Edge/proxy + session refresh
- `src/proxy.ts` delegates to `updateSession` (`src/lib/supabase/middleware.ts`) for matched requests (excluding `_next/static`, `_next/image`, icons, and common static assets).
- `updateSession`:
  - Creates an SSR Supabase client bound to request/response cookies
  - Calls `supabase.auth.getUser()` to refresh/validate session
  - Redirects unauthenticated users from protected routes to `/login` (when Supabase env is configured)
  - Redirects authenticated users away from auth routes (`/login`, `/register`) to `/dashboard`
  - Preserves updated auth cookies in the response

### 4.2 App-level auth enforcement
- `src/app/(main)/layout.tsx` (server, `force-dynamic`) performs a server-side auth check and redirects unauthenticated users to `/login`.
- Selected pages also enforce auth/ownership as defense-in-depth (e.g. investments, due-center, split-bill routes).
- Public entry points include `/` (landing) and `(auth)` routes as applicable.

### 4.3 Supabase client boundaries
- `src/lib/supabase/client.ts`: browser client (`createBrowserClient<Database>`)
- `src/lib/supabase/server.ts`: server client using Next cookies (`createServerClient<Database>`)
- `src/lib/supabase/admin.ts`: service-role client for privileged/background work (bypasses RLS; no session persistence)
- `src/lib/supabase/middleware.ts`: request-scoped session handling and route gating helper

## 5. App Router structure (`src/app`)

### 5.1 Root
- `layout.tsx`: root metadata/viewport/fonts, global providers (`ThemeProvider`, `LanguageProvider`, `UndoProvider`), global UI (`Toaster`, `UndoSnackbar`, timezone/PWA/pinned sync helpers), analytics
- `manifest.ts`: PWA manifest (`standalone`, start URL `/dashboard`)
- `globals.css`: theme tokens, base styles, safe-area utilities, animations, tabular numerics, print styles
- `page.tsx`: public landing/demo preview

### 5.2 Route groups and major routes
- **`(auth)`**: `/login`, `/register` (redirects to login; registration disabled)
- **`(main)`** authenticated shell + feature routes:
  - `/dashboard`
  - `/transactions`, `/transactions/[id]`, `/transactions/[id]/audit-log`
  - `/accounts`, `/accounts/[id]`
  - `/categories`
  - `/budget`, `/budget/[categoryId]`
  - `/debts`, `/debts/[id]`
  - `/due-center`
  - `/goals`
  - `/recurring`
  - `/reports`
  - `/investments`
  - `/net-worth`
  - `/split-bill`, `/split-bill/[id]`, `/split-bill/history`
  - `/audit-log`
  - `/guide`
  - `/settings`

### 5.3 API routes (background/cron)
- `GET /api/cron/daily`: bearer-secret protected (when configured), `force-dynamic`, admin client, `Asia/Jakarta` processing; refreshes forex rates and asset prices, performs recurring auto-processing catch-up, and snapshots net worth per active user
- `GET /api/cron/recurring`: recurring auto-processing catch-up only (overlaps recurring responsibility with daily cron)

### 5.4 UX/loading patterns
- Most main routes provide `loading.tsx` skeletons; some pages also use `Suspense` fallbacks (e.g. transactions/accounts/net-worth patterns)
- Split-bill routes include mode/state-aware loading and UI-state restoration (query params/cookies) to preserve draft/step flow

## 6. Server Actions layer (`src/actions`)

Server Actions are the primary mutation/query boundary. Common conventions:
- `"use server"` modules returning `{ success, ... }`, `{ data }`, `{ error }`, or domain-specific payloads
- Auth checks (`getUser`) and user-scoped queries/mutations
- Zod validation for many input schemas; domain guards for balances, currency consistency, ownership, and state transitions
- `revalidatePath(...)` across affected surfaces after mutations
- Timezone-aware date handling and multi-currency/forex-aware calculations where relevant

### 6.1 Module map (by responsibility)

| Module | Responsibility / key concerns |
| --- | --- |
| `auth.ts` | Login/logout/current user; registration disabled |
| `accounts.ts` | Account CRUD/default/adjust-balance; merged account mutation history (transactions + transfers) |
| `transactions.ts` | Transaction CRUD/filtering/sorting, tags/items JSONB, audit log reads, helper queries |
| `transfers.ts` | Inter-account transfers with fee/exchange snapshots and guards |
| `categories.ts` | Category CRUD, defaults seeding, dedupe/canonicalization, system-category protection |
| `budgets.ts` | Period budgets, actuals, carryover/virtual budget cards, history |
| `debts.ts` | Debts/receivables, payments, linked transactions, status/remaining updates |
| `goals.ts` | Savings goals CRUD and deposit/withdraw flows with ledger/account effects |
| `recurring.ts` | Recurring rule CRUD, manual processing, payment history; delegates execution to shared processor |
| `pinned.ts` | Pinned/quick transaction templates |
| `investments.ts` | Stock holdings/trades, lot/share model, holding sync, stamp duty/fee-aware cash effects |
| `crypto.ts` | Crypto holdings/trades, fees, holding sync, investment cash transfer |
| `etf.ts` | ETF holdings/trades (nominal DCA, percent sell), fee linkage, holding sync |
| `exchange-rate.ts` | Fetch/persist/read forex rates, net worth data/snapshots read APIs |
| `asset-prices.ts` | Trigger asset price refresh (admin client) and revalidation |
| `export.ts` | CSV/JSON export with section/date filters and cached market valuation enrichment |
| `receipt-ai.ts` | Gemini receipt scan → transaction draft (`ParsedReceipt`) |
| `split-bill-scan.ts` | Gemini receipt scan → structured split-bill draft (items/charges/totals) |
| `split-bills.ts` | Split-bill CRUD, contacts/images/storage, calculations, record/sync "my portion" transaction |
| `seed-demo.ts` | Demo/utility seeding and user-data clearing helpers (not a normal UI flow; treat carefully) |

### 6.2 Cross-cutting domain rules
- **Ledger/balance safety:** non-negative balance guards on outflows, reversals, and trade/payment edits where applicable
- **Currency correctness:** account/transaction/debt/payment currency consistency checks; settlement currencies respected in investments/exports
- **System/operational categories:** special handling for categories such as `Discrepancy`, `Loan & Debt`, `Transfer Fee`, `Savings`, `Stamp Duty`, and investment fee categories
- **Compensation/consistency:** rollback/cleanup patterns in complex flows (trades, split-bill save/record, fee-linked rows)
- **Net worth/valuation:** canonical IDR aggregation using USD-base forex rates and cached asset prices; market-value fallback to cost basis when unavailable

## 7. UI/components architecture (`src/components`)

### 7.1 Organization
- **Feature domains:** `accounts`, `transactions`, `dashboard`, `debts`, `goals`, `investments`, `net-worth`, `reports`, `recurring`, `split-bill`, `budget`, `categories`, `audit`, `due-center`, `settings`
- **Cross-cutting:** `layout/` (shell, nav, quick add, search, theme/privacy/timezone sync), `pwa/`, `ui/` (shared primitives)

### 7.2 Patterns
- Feature UIs are predominantly client components receiving server-fetched/enriched props
- Local `useState` for interaction state; `useMemo/useCallback` for derived aggregates and expensive computations (analytics/charts/portfolio)
- Mutations via Server Actions with toast feedback and `router.refresh()`/callbacks
- Shared primitives: `Modal`, `BottomSheet`, `ConfirmDialog`, form inputs/selects/pickers, `NumberInput`+`NumberKeypad`, `Skeleton`, `EmptyState`, `DynamicIcon`, etc.
- Specialized flows: quick-add + OCR, split-bill editor/detail, investment portfolio analytics, reports/print/export

## 8. Shared/domain libraries (`src/lib`)

### 8.1 i18n
- `language-context.tsx`: client provider/hook (`id`/`en`, persisted in localStorage)
- `translations.ts` + `modules/*`: per-domain translation bundles (including split-bill, quick-add, due-center, etc.)

### 8.2 Utilities and validation
- `utils/currency.ts`: formatting, conversion (`ForexRatesMap`, USD-base), cross/natural FX helpers
- Date/timezone helpers, recurring date calculation, split-bill calculation utils, transaction item parsing/normalization, audit humanization, formatting helpers
- Zod schemas in `validations/*` for accounts, transactions, transfers, budgets, debts, goals, recurring

### 8.3 Net worth & pricing
- `net-worth/compute.ts`: canonical IDR net worth from accounts, holdings (stock/crypto/ETF), debts, goals with market/cost valuation
- `net-worth/prices.ts`: collect symbols, fetch/cache prices (`asset_prices`) and read price map
- `net-worth/forex.ts`: admin forex fetch/persist/fallback and rate matrix reads
- `net-worth/snapshot.ts`: compute + upsert daily `net_worth_snapshots`

### 8.4 Recurring processing
- `recurring/process-due-recurring.ts`: processes a single due period for a rule (category/account/balance checks, inserts transaction, advances/deactivates schedule). Shared by actions and cron routes.

### 8.5 OCR / receipt scanning
- `ocr/gemini.ts`: Gemini JSON extraction client
- `ocr/receipt-scanner.ts`: local Tesseract-based preprocessing/OCR/parsing pipeline
- `ocr/receipt-gemini-client.ts`, `ocr/split-bill-scan-client.ts`: client-side scan helpers
- `ocr/scan-error.ts`: maps provider/runtime failures to user-safe messages
- Actions `receipt-ai.ts` and `split-bill-scan.ts` produce normalized draft structures for transaction and split-bill flows

### 8.6 Client storage and context
- `storage/*`: preferred currency, privacy mode, default-account cache (legacy), pinned templates cache/sync
- `context/undo-context.tsx`: deferred delete with timed execution/undo

## 9. Types and schema contracts (`src/types`, Supabase)

- `src/types/database.ts`: typed Supabase schema contract for core/public tables, enums/unions, row aliases, and enriched join models (partial coverage relative to all migrations/features)
- `src/types/split-bill.ts`: split-bill domain entities, calculation/result models, and status/mode unions
- Not all newer tables/features are fully represented in `database.ts`; some flows rely on feature-specific types or less-strict query typing

## 10. Database and migrations (`supabase/migrations`)

Migrations are ordered `001`–`027` and represent the authoritative schema evolution.

### 10.1 Evolution highlights
- **001–005:** base schema (accounts/categories/transactions/transfers/budgets/debts/debt_payments/audit_logs/exchange_rates), RLS and core triggers, multi-currency adjustments, universal audit triggers/fixes
- **006–011:** recurring transactions, savings goals/deposits, transaction tags, audit/user-id fixes, stock investments, pinned templates
- **012–019:** crypto holdings/trades and fee-aware transfers, trade/fee/audit link columns, ledger precision/balance sources/events, crypto settlement amount, ETF support/fee links, audit fixes
- **020–023:** net worth snapshots, asset prices cache, transfer same-account guard, asset settlement currency
- **024–027:** split-bill domain (tables + RLS + storage bucket/policies, avatars/split mode/items enrichments), transaction items JSONB, split-bill item discount mode

### 10.2 Important DB behaviors
- RLS is owner-scoped for user data (with parent-ownership patterns for child records and storage objects)
- Triggers/functions enforce key invariants (e.g. balance synchronization, debt/payment updates, auditing)
- Historical/cached tables (`exchange_rates`, `asset_prices`, `net_worth_snapshots`) support reporting and background refresh flows

## 11. Background jobs and integrations

- **Cron (Vercel/HTTP):** `/api/cron/daily` and `/api/cron/recurring` perform scheduled maintenance/processing (forex/prices/snapshots/recurring) with bearer-secret protection expectations
- **Supabase Edge Function:** `supabase/functions/fetch-exchange-rate/index.ts` fetches and stores FX rates (alternative/parallel FX refresh path)
- **External data/services:** Supabase, Gemini Vision (OCR), exchange-rate providers, market/asset price sources used by net-worth/pricing utilities

## 12. Key architectural considerations

- **Financial correctness:** multi-currency conversions, fee handling, itemized amounts, trade PnL/cost basis, recurring execution, and snapshot valuation require reuse of shared utilities and careful guard preservation
- **Consistency model:** app-level guards plus DB triggers/RLS; some flows include compensating cleanup on partial failures
- **Performance/UX:** route-level dynamic rendering in many authenticated views, skeleton/loading states, preloading in main layout for shell interactions
- **Documentation/type drift risk:** feature growth (split bill, net worth/pricing, newer tables) can outpace README and typed schema coverage—keep migrations, types, actions, and docs aligned
