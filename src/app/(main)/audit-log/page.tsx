import React from 'react'
import { getGlobalAuditLogs } from '@/actions/transactions'
import { GlobalAuditLogView } from '@/components/audit/global-audit-log-view'

export const dynamic = 'force-dynamic'

export default async function AuditLogPage() {
  const logs = await getGlobalAuditLogs(100)

  return <GlobalAuditLogView initialLogs={logs} />
}
