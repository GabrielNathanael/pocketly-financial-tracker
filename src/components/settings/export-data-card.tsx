'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { exportAllFinancialData } from '@/actions/export'
import { useLanguage } from '@/lib/i18n/language-context'
import { Download, FileSpreadsheet, FileCode, Check } from 'lucide-react'

export function ExportDataCard() {
  const { t } = useLanguage()
  const [isExporting, setIsExporting] = useState(false)
  const [downloadSuccess, setDownloadSuccess] = useState(false)

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleExportCSV = async () => {
    setIsExporting(true)
    setDownloadSuccess(false)
    try {
      const data = await exportAllFinancialData()
      const timestamp = new Date().toISOString().split('T')[0]
      downloadFile(data.csvTransactions, `pocketly-transactions-${timestamp}.csv`, 'text/csv;charset=utf-8;')
      downloadFile(data.csvAccounts, `pocketly-accounts-${timestamp}.csv`, 'text/csv;charset=utf-8;')
      downloadFile(data.csvDebts, `pocketly-debts-${timestamp}.csv`, 'text/csv;charset=utf-8;')
      setDownloadSuccess(true)
      setTimeout(() => setDownloadSuccess(false), 3000)
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportJSON = async () => {
    setIsExporting(true)
    setDownloadSuccess(false)
    try {
      const data = await exportAllFinancialData()
      const timestamp = new Date().toISOString().split('T')[0]
      downloadFile(data.jsonData, `pocketly-backup-${timestamp}.json`, 'application/json')
      setDownloadSuccess(true)
      setTimeout(() => setDownloadSuccess(false), 3000)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3.5">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[#F1F3F5] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] flex items-center justify-center">
          <Download className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
            {t.settings.exportTitle}
          </h3>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
            {t.settings.exportDesc}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#E5E7EB] dark:border-[#27272A]">
        <Button
          size="sm"
          variant="outline"
          onClick={handleExportCSV}
          isLoading={isExporting}
          className="gap-1.5"
        >
          {downloadSuccess ? (
            <Check className="w-3.5 h-3.5 text-[#0D9488]" />
          ) : (
            <FileSpreadsheet className="w-3.5 h-3.5" />
          )}
          <span>{t.settings.exportCSV}</span>
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={handleExportJSON}
          isLoading={isExporting}
          className="gap-1.5"
        >
          {downloadSuccess ? (
            <Check className="w-3.5 h-3.5 text-[#0D9488]" />
          ) : (
            <FileCode className="w-3.5 h-3.5" />
          )}
          <span>{t.settings.exportJSON}</span>
        </Button>
      </div>
    </div>
  )
}
