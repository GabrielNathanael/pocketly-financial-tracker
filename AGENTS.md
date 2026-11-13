<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Pocketly Agent Guide (Repository-Specific)

This file provides practical guidance for AI coding agents and contributors working in this repository. Prefer existing patterns and preserve financial correctness.

## 1. Project snapshot
- **App:** Pocketly (multi-currency personal finance tracker)
- **Stack:** Next.js 16 App Router, React 19, TypeScript (strict), Tailwind CSS 4, Supabase (Postgres/Auth/Storage/RLS/triggers), Zod 4
- **Key domains:** accounts, transactions, transfers, categories, budgets, debts, goals, recurring, investments (stock/crypto/ETF), net worth, reports/export, audit, split bill, OCR receipt scanning

## 2. Where things live
- `src/app/`: routes/layouts/loading UI (route groups `(auth)` and `(main)`), API cron routes
- `src/actions/`: Server Actions (primary mutation/query boundary)
- `src/components/`: feature UI modules, `layout/`, shared `ui/` primitives, `pwa/`
- `src/lib/`: Supabase clients/middleware/admin, i18n, utils, validations, net-worth, OCR, recurring processing, storage/context helpers
- `src/types/`: database and feature/domain types (e.g. `split-bill.ts`)
- `supabase/migrations/`: ordered SQL migrations (`001`–`027`)
- `supabase/functions/`: edge functions (e.g. forex fetch)

## 3. Core conventions
- **Server Actions:** keep `"use server"` actions in `src/actions/*`; follow existing return shapes (`{ success }`, `{ data }`, `{ error }`) and `revalidatePath(...)` patterns.
- **Supabase clients:** use `createServerSupabaseClient` in server/actions/routes, browser client in client contexts, and `createAdminSupabaseClient` only for privileged/background/cron tasks (service-role, bypasses RLS).
- **Auth/ownership:** always verify authenticated user and scope reads/writes by `user_id`/ownership; respect existing guards in pages, `(main)` layout, and proxy/middleware.
- **Validation & safety:** prefer existing Zod schemas (`src/lib/validations/*`) and domain guards (non-negative balances, currency consistency, account/category existence, status/state constraints).
- **DB invariants matter:** RLS, triggers, and balance/audit behavior are part of correctness—do not bypass or duplicate logic carelessly.
- **i18n:** user-facing strings should go through `src/lib/i18n/modules/*` and `translations.ts`/language context where applicable (ID/EN).
- **Styling/UI:** follow existing Tailwind/mobile-first patterns, shared `ui/*` primitives, skeleton/loading conventions, and dark-mode-aware classes.

## 4. Financial/domain correctness (important)
When changing money flows, preserve:
- **Currency handling:** `IDR/USD/SGD`, stored/derived rates, settlement currencies, and conversion via shared currency/forex utilities
- **Ledger effects:** transaction/transfer/trade/payment impacts on account balances and linked records (some handled by DB triggers, some explicitly in actions)
- **Fees and references:** transfer fees, investment/trading fees, stamp duty, and linkage columns/refs (`transfer_id`, trade IDs, goal/debt refs/tags)
- **Recurring processing:** due-date/timezone semantics and catch-up behavior in `src/lib/recurring/process-due-recurring.ts` and cron routes
- **Net worth/pricing:** canonical IDR computation, cached `asset_prices`/`exchange_rates`, snapshot upserts, and market-vs-cost fallback
- **Split bill math:** participants/items/assignments/charges/discount modes and "record/sync my portion" behavior

Reuse existing utilities (`lib/utils/*`, `lib/net-worth/*`, `lib/ocr/*`, `lib/recurring/*`) instead of ad-hoc logic.

## 5. Migrations, types, and schema changes
- Add schema changes as **new ordered SQL migrations** in `supabase/migrations/` (current sequence reaches `027`; continue incrementally).
- Update affected TypeScript contracts/types (`src/types/database.ts`, feature types like `src/types/split-bill.ts`) and dependent actions/components/lib code.
- Be aware `database.ts` may not fully cover every newer table/feature; inspect actual migrations and usage before assuming type coverage.

## 6. OCR and scan flows
- Keep OCR logic in `src/lib/ocr/*` and scan actions/clients; distinguish:
  - **Transaction receipt scan:** `receipt-ai` flow
  - **Split-bill receipt scan:** `split-bill-scan` flow (different structured output/normalization)
- Normalize user-visible failures via `src/lib/ocr/scan-error.ts` patterns; avoid leaking raw provider/internal errors.

## 7. Routing, shell, and special UX flows
- `(main)/layout.tsx` bootstraps shared data for app shell/nav (accounts, categories, recent transactions, debts, most-used categories)—account for this when changing shell/quick-add behavior.
- Many authenticated routes are `force-dynamic` and/or use skeletons; preserve loading behavior.
- Split-bill routes use mode/query/cookie-driven UI state and specialized loading/skeleton transitions—change carefully.
- Cron endpoints have overlapping responsibilities (`daily` includes recurring + snapshots/prices/rates; `recurring` handles recurring only); verify schedule/intent before modifying.

## 8. Quality checks
Run relevant checks for the scope of changes:
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build` (for integration/deploy-impacting changes)

Validate behavior in affected domains (especially multi-currency, balances, recurring, investments/net-worth, split bill, exports, OCR).

## 9. Documentation hygiene
When adding or materially changing features/modules, update docs in the same change as needed:
- `README.md` (features, setup, migrations/cron/env notes, structure)
- `architecture.md` (routes, modules, data flow, schema evolution, integrations)
- This `agents.md` (repo conventions/gotchas)

Do not remove the auto-managed Next.js rules block at the top of this file.
