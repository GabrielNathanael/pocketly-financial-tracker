'use client'

import React from 'react'
import Link from 'next/link'
import { AuditLog } from '@/types/database'
import { formatDate } from '@/lib/utils/date'
import { humanizeAuditLog } from '@/lib/utils/audit-humanizer'
import { useLanguage } from '@/lib/i18n/language-context'
import { ArrowLeft, Clock, PlusCircle, Edit, Trash2, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface SingleTransactionAuditViewProps {
  transactionId: string
  logs: AuditLog[]
}

export function SingleTransactionAuditView({
  transactionId,
  logs,
}: SingleTransactionAuditViewProps) {
  const { t, language } = useLanguage()

  return (
    <div className="flex flex-col gap-5 max-w-lg mx-auto">
      <div>
        <Link
          href={`/transactions/${transactionId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.transactions.backToDetail}</span>
        </Link>
      </div>

      <div className="flex flex-col gap-0.5">
        <h1 className="text-xl font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
          {t.transactions.auditTrail}
        </h1>
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
          {t.transactions.auditDesc}
        </p>
      </div>

      {logs.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] rounded-xl text-[#94A3B8] text-xs">
          {t.transactions.auditEmpty}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {logs.map((log) => {
            const h = humanizeAuditLog(log, language)

            return (
              <div
                key={log.id}
                className="p-4 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border',
                        h.badgeType === 'create'
                          ? 'bg-[#ECFDF5] dark:bg-[#064E3B]/20 text-[#0D9488] border-[#A7F3D0] dark:border-[#065F46]/40'
                          : h.badgeType === 'update'
                          ? 'bg-[#F0F9FF] dark:bg-[#0C4A6E]/20 text-[#0284C7] border-[#BAE6FD] dark:border-[#0369A1]/40'
                          : 'bg-[#FFF1F2] dark:bg-[#881337]/20 text-[#E11D48] border-[#FECDD3] dark:border-[#9F1239]/40'
                      )}
                    >
                      {h.badgeType === 'create' && <PlusCircle className="w-3 h-3" />}
                      {h.badgeType === 'update' && <Edit className="w-3 h-3" />}
                      {h.badgeType === 'delete' && <Trash2 className="w-3 h-3" />}
                      {h.badgeLabel}
                    </span>
                    <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                      {h.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[10px] font-mono text-[#94A3B8]">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(log.changed_at, 'd MMM yyyy, HH:mm:ss', language)}</span>
                  </div>
                </div>

                <p className="text-xs text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
                  {h.summary}
                </p>

                {/* Humanized Diff Changes */}
                {h.changes.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-1 text-xs">
                    {h.changes.map((c, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-semibold text-[#64748B] dark:text-[#94A3B8]">
                          {c.field}:
                        </span>
                        <div className="flex items-center gap-1.5 font-mono">
                          {c.from && (
                            <>
                              <span className="text-[#E11D48] line-through">{c.from}</span>
                              <ArrowRight className="w-3 h-3 text-[#94A3B8]" />
                            </>
                          )}
                          {c.to && (
                            <span className="font-bold text-[#0D9488]">{c.to}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
