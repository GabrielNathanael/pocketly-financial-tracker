import React from 'react'
import { notFound } from 'next/navigation'
import { getTransactionById, getTransactionAuditLogs } from '@/actions/transactions'
import { SingleTransactionAuditView } from '@/components/transactions/single-transaction-audit-view'

export const dynamic = 'force-dynamic'

interface AuditLogPageProps {
  params: Promise<{ id: string }>
}

export default async function TransactionAuditLogPage({ params }: AuditLogPageProps) {
  const { id } = await params
  const [transaction, logs] = await Promise.all([
    getTransactionById(id),
    getTransactionAuditLogs(id),
  ])

  if (!transaction && logs.length === 0) {
    notFound()
  }

  return <SingleTransactionAuditView transactionId={id} logs={logs} />
}
