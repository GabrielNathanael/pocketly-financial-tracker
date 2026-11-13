'use client'

import React from 'react'
import Link from 'next/link'
import { AuditLog } from '@/types/database'
import { formatDate } from '@/lib/utils/date'
import { humanizeAuditLog } from '@/lib/utils/audit-humanizer'
import { AuditItemsList } from '@/components/audit/audit-items-list'
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
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-secondary hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.transactions.backToDetail}</span>
        </Link>
      </div>

      <div className="flex flex-col gap-0.5">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          {t.transactions.auditTrail}
        </h1>
        <p className="text-xs text-foreground-secondary">
          {t.transactions.auditDesc}
        </p>
      </div>

      {logs.length === 0 ? (
        <div className="p-8 text-center bg-surface border border-border rounded-xl text-foreground-muted text-xs">
          {t.transactions.auditEmpty}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {logs.map((log) => {
            const h = humanizeAuditLog(log, language)

            return (
              <div
                key={log.id}
                className="p-4 rounded-xl bg-surface border border-border flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border',
                        h.badgeType === 'create'
                          ? 'bg-success-muted text-success border-success/20'
                          : h.badgeType === 'update'
                          ? 'bg-info-muted text-info border-info/20'
                          : 'bg-destructive-muted text-destructive border-destructive/20'
                      )}
                    >
                      {h.badgeType === 'create' && <PlusCircle className="w-3 h-3" />}
                      {h.badgeType === 'update' && <Edit className="w-3 h-3" />}
                      {h.badgeType === 'delete' && <Trash2 className="w-3 h-3" />}
                      {h.badgeLabel}
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      {h.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[10px] font-mono text-foreground-muted">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(log.changed_at, 'd MMM yyyy, HH:mm:ss', language)}</span>
                  </div>
                </div>

                <p className="text-xs text-foreground-secondary leading-relaxed">
                  {h.summary}
                </p>

                {/* Humanized Diff Changes */}
                {h.changes.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-canvas dark:bg-surface-subtle border border-border flex flex-col gap-1 text-xs">
                    {h.changes.map((c, idx) =>
                      c.items ? (
                        <div key={idx} className="flex flex-col gap-1.5 text-[11px]">
                          <span className="font-semibold text-foreground-secondary">
                            {c.field}:
                          </span>
                          {c.itemsFrom && c.itemsFrom.length > 0 && (
                            <>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
                                {t.transactions.fromLabel}
                              </span>
                              <AuditItemsList
                                items={c.itemsFrom}
                                currency={c.currency || "IDR"}
                                muted
                              />
                              {c.items.length > 0 && (
                                <span className="mt-2 border-t border-border pt-2 text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
                                  {t.transactions.toLabel}
                                </span>
                              )}
                            </>
                          )}
                          {c.items.length > 0 ? (
                            <AuditItemsList
                              items={c.items}
                              currency={c.currency || "IDR"}
                            />
                          ) : (
                            <span className="font-mono text-foreground-muted">
                              {c.to}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div key={idx} className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-semibold text-foreground-secondary">
                            {c.field}:
                          </span>
                          <div className="flex items-center gap-1.5 font-mono">
                            {c.from && (
                              <>
                                <span className="text-destructive line-through">{c.from}</span>
                                <ArrowRight className="w-3 h-3 text-foreground-muted" />
                              </>
                            )}
                            {c.to && (
                              <span className="font-bold text-success">{c.to}</span>
                            )}
                          </div>
                        </div>
                      ),
                    )}
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
