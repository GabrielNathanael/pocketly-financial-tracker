'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { AuditLog } from '@/types/database'
import { formatDate } from '@/lib/utils/date'
import { humanizeAuditLog } from '@/lib/utils/audit-humanizer'
import { useLanguage } from '@/lib/i18n/language-context'
import { Search, PlusCircle, Edit, Trash2, ArrowRight, ArrowLeft, History } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface GlobalAuditLogViewProps {
  initialLogs: AuditLog[]
}

export function GlobalAuditLogView({ initialLogs }: GlobalAuditLogViewProps) {
  const { language, t } = useLanguage()
  const [actionFilter, setActionFilter] = useState<'all' | 'INSERT' | 'UPDATE' | 'DELETE'>('all')
  const [search, setSearch] = useState('')

  const filteredLogs = useMemo(() => {
    return initialLogs.filter((log) => {
      if (actionFilter !== 'all' && log.action !== actionFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchTable = log.table_name.toLowerCase().includes(q)
        const matchRecord = log.record_id.toLowerCase().includes(q)
        const matchOld = JSON.stringify(log.old_values || {}).toLowerCase().includes(q)
        const matchNew = JSON.stringify(log.new_values || {}).toLowerCase().includes(q)
        return matchTable || matchRecord || matchOld || matchNew
      }
      return true
    })
  }, [initialLogs, actionFilter, search])

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.auditLog.backToSettings}</span>
        </Link>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-[#F1F3F5] dark:bg-[#1A1A20] text-[#64748B] dark:text-[#94A3B8] border border-[#E5E7EB] dark:border-[#27272A]">
          Security & Audit Trail
        </span>
      </div>

      {/* Page Title */}
      <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-lg bg-[#0F172A] dark:bg-[#FAFAFA] text-white dark:text-[#0F172A] flex items-center justify-center shrink-0">
          <History className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
            {t.auditLog.title}
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
            {t.auditLog.subtitle}
          </p>
        </div>
      </div>

      {/* Search and Action Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A]">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
          <input
            type="text"
            placeholder={t.auditLog.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] rounded-lg text-[#0F172A] dark:text-[#FAFAFA] placeholder:text-[#94A3B8] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {[
            { label: t.auditLog.all, value: 'all' },
            { label: t.auditLog.newRecord, value: 'INSERT' },
            { label: t.auditLog.updateRecord, value: 'UPDATE' },
            { label: t.auditLog.deleteRecord, value: 'DELETE' },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setActionFilter(item.value as typeof actionFilter)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-semibold transition-colors shrink-0 whitespace-nowrap cursor-pointer border',
                actionFilter === item.value
                  ? 'bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A] border-transparent'
                  : 'bg-white dark:bg-[#121215] text-[#64748B] dark:text-[#94A3B8] border-[#E5E7EB] dark:border-[#27272A] hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20]'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Timeline List */}
      {filteredLogs.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-[#121215] rounded-xl border border-[#E5E7EB] dark:border-[#27272A] text-xs text-[#94A3B8]">
          {t.auditLog.emptySearch}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredLogs.map((log) => {
            const h = humanizeAuditLog(log, language)

            return (
              <div
                key={log.id}
                className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3 transition-colors hover:border-[#0F172A] dark:hover:border-[#FAFAFA]"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-md border',
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
                    <h3 className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                      {h.title}
                    </h3>
                  </div>

                  <span className="text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8]">
                    {formatDate(log.changed_at, 'EEEE, d MMM yyyy • HH:mm', language)}
                  </span>
                </div>

                {/* Friendly Summary Text */}
                <p className="text-xs text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
                  {h.summary}
                </p>

                {/* Humanized Change Diff List */}
                {h.changes.length > 0 && (
                  <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-xs">
                    {h.changes.map((c, cIdx) => (
                      <div key={cIdx} className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
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
