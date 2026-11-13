import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  processOneRecurringPeriod,
  type DueRecurringRule,
  type RecurringSupabaseClient,
} from "@/lib/recurring/process-due-recurring";
import { getTodayDateStringInTimeZone } from "@/lib/utils/date";

// Cron runs in the background without a user session. Personal app:
// all users are in Asia/Jakarta by default (cookie timezone is not
// available to a service-role job).
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
    console.error("[cron/recurring] admin client error:", err);
    return NextResponse.json(
      { error: "SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY belum diatur" },
      { status: 500 },
    );
  }
  const admin = supabase as unknown as RecurringSupabaseClient;

  const todayStr = getTodayDateStringInTimeZone(CRON_TIME_ZONE);

  const { data: dueRules, error: dueErr } = await supabase
    .from("recurring_transactions")
    .select("*")
    .eq("is_active", true)
    .eq("auto_process", true)
    .lte("next_due_date", todayStr)
    .order("next_due_date", { ascending: true })
    .limit(500);

  if (dueErr) {
    console.error("[cron/recurring] fetch due rules error:", dueErr);
    return NextResponse.json({ error: dueErr.message }, { status: 500 });
  }

  let processed = 0;
  const skipped: Array<{ id: string; name: string; reason: string }> = [];
  const failed: Array<{ id: string; name: string; error: string }> = [];

  for (const initialRule of dueRules || []) {
    let rule = initialRule as DueRecurringRule;
    let iterations = 0;
    // Catch-up: a rule missed for several periods inserts one transaction
    // per missed due date, each dated on its own due date.
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
          failed.push({
            id: rule.id,
            name: rule.name,
            error: result.error || result.reason,
          });
        } else {
          // no_category / no_account / insufficient_balance: leave
          // next_due_date untouched so it retries tomorrow after the
          // user fixes the cause.
          skipped.push({ id: rule.id, name: rule.name, reason: result.reason });
        }
        break;
      }
      processed++;
      if (result.shouldDeactivate) break;
      // Advance in-memory rule for the next catch-up iteration.
      rule = { ...rule, next_due_date: result.nextDueDate };
    }
  }

  return NextResponse.json({
    ok: true,
    today: todayStr,
    checked: (dueRules || []).length,
    processed,
    skipped,
    failed,
  });
}
