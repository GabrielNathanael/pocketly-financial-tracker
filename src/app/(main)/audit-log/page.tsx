import React from "react";
import { getGlobalAuditLogs } from "@/actions/transactions";
import { GlobalAuditLogView } from "@/components/audit/global-audit-log-view";

export const dynamic = "force-dynamic";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const { start, end } = await searchParams;
  const logs = await getGlobalAuditLogs(200, start, end);

  return <GlobalAuditLogView initialLogs={logs} />;
}
