import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  processOneRecurringPeriod,
  type DueRecurringRule,
  type RecurringSupabaseClient,
} from "@/lib/recurring/process-due-recurring";
import { fetchAndSaveForexRatesAdmin } from "@/lib/net-worth/forex";
import { refreshAssetPrices } from "@/lib/net-worth/prices";
import { snapshotNetWorthForUser } from "@/lib/net-worth/snapshot";
import { getTodayDateStringInTimeZone } from "@/lib/utils/date";

const CRON_TIME_ZONE = "Asia/Jakarta";
const MAX_CATCH_UP_PER_RULE = 36;

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "CRON_SECRET belum diatur di environment" },
      { status: 500 },
    );
  }

  let supabase;
  try {
    supabase = createAdminSupabaseClient();
  } catch (err) {
    console.error("[cron/daily] admin client error:", err);
    return NextResponse.json(
      { error: "SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY belum diatur" },
      { status: 500 },
    );
  }
  const admin = supabase as unknown as RecurringSupabaseClient;

  const todayStr = getTodayDateStringInTimeZone(CRON_TIME_ZONE);

  // 1) Forex rates (fresh for snapshot + all conversions today)
  const rates = await fetchAndSaveForexRatesAdmin(
    supabase as unknown as Parameters<typeof fetchAndSaveForexRatesAdmin>[0],
  );

  // 1b) Market prices for owned assets (crypto/stock/ETF cache)
  const prices = await refreshAssetPrices(
    supabase as unknown as Parameters<typeof refreshAssetPrices>[0],
  );

  // 2) Recurring auto-process (catch-up)
  const { data: dueRules, error: dueErr } = await supabase
    .from("recurring_transactions")
    .select("*")
    .eq("is_active", true)
    .eq("auto_process", true)
    .lte("next_due_date", todayStr)
    .order("next_due_date", { ascending: true })
    .limit(500);

  if (dueErr) {
    console.error("[cron/daily] fetch due rules error:", dueErr);
    return NextResponse.json({ error: dueErr.message }, { status: 500 });
  }

  let processed = 0;
  const skipped: Array<{ id: string; name: string; reason: string }> = [];
  const failed: Array<{ id: string; name: string; error: string }> = [];

  for (const initialRule of dueRules || []) {
    let rule = initialRule as DueRecurringRule;
    let iterations = 0;
    while (
      rule &&
      String(rule.next_due_date).substring(0, 10) <= todayStr &&
      (!rule.end_date ||
        String(rule.next_due_date).substring(0, 10) <=
          String(rule.end_date).substring(0, 10)) &&
      iterations < MAX_CATCH_UP_PER_RULE
    ) {
      iterations++;
      const result = await processOneRecurringPeriod(
        admin,
        rule,
        CRON_TIME_ZONE,
      );
      if (!result.ok) {
        if (result.reason === "insert_failed" || result.reason === "update_failed") {
          failed.push({ id: rule.id, name: rule.name, error: result.error || result.reason });
        } else {
          skipped.push({ id: rule.id, name: rule.name, reason: result.reason });
        }
        break;
      }
      processed++;
      if (result.shouldDeactivate) break;
      rule = { ...rule, next_due_date: result.nextDueDate };
    }
  }

  // 3) Net worth snapshot per user (distinct owners with an account)
  const { data: accountOwners } = await supabase
    .from("accounts")
    .select("user_id")
    .eq("is_active", true)
    .limit(1000);

  const userIds = Array.from(
    new Set(
      ((accountOwners || []) as Array<{ user_id: string | null }>)
        .map((r) => r.user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  let snapshotted = 0;
  const snapshotFailed: Array<{ userId: string; error: string }> = [];
  for (const userId of userIds) {
    const res = await snapshotNetWorthForUser(
      supabase as unknown as Parameters<typeof snapshotNetWorthForUser>[0],
      userId,
      todayStr,
      rates,
    );
    if (res.ok) snapshotted++;
    else snapshotFailed.push({ userId, error: res.error || "failed" });
  }

  return NextResponse.json({
    ok: true,
    today: todayStr,
    rates,
    prices,
    recurring: { checked: (dueRules || []).length, processed, skipped, failed },
    snapshots: { users: userIds.length, snapshotted, failed: snapshotFailed },
  });
}
