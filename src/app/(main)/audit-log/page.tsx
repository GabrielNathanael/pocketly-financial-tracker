import React from "react";
import { getGlobalAuditLogs } from "@/actions/transactions";
import { GlobalAuditLogView } from "@/components/audit/global-audit-log-view";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    start?: string;
    end?: string;
    module?: string;
    action?: string;
    search?: string;
    page?: string;
  }>;
}) {
  const { start, end, module, action, search, page } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);
  const { logs, total } = await getGlobalAuditLogs({
    limit: PAGE_SIZE,
    offset: (currentPage - 1) * PAGE_SIZE,
    start,
    end,
    module: module || "all",
    action: action || "all",
    search: search || "",
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <GlobalAuditLogView
      initialLogs={logs}
      total={total}
      page={currentPage}
      totalPages={totalPages}
      initialStart={start}
      initialEnd={end}
      initialModule={module || "all"}
      initialAction={action || "all"}
      initialSearch={search || ""}
    />
  );
}
