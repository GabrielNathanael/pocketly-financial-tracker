'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { Button } from '@/components/ui/button'
import { ExportDataCard } from '@/components/settings/export-data-card'
import { logout } from '@/actions/auth'
import { fetchAndSaveForexRates, getLatestForexRates } from '@/actions/exchange-rate'
import { seedDemoData, clearUserData } from '@/actions/seed-demo'
import { formatCurrency, ForexRatesMap, DEFAULT_FALLBACK_RATES, getCrossRate } from '@/lib/utils/currency'
import { setPreferredCurrency, usePreferredCurrency } from '@/lib/storage/preferred-currency'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { CURRENCY_LIST, CurrencyCode } from '@/lib/constants/currencies'
import { useLanguage } from '@/lib/i18n/language-context'
import { RefreshCw, LogOut, Check, Shield, Globe, BookOpen, ArrowRight, Sparkles, Trash2, History, Coins } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface SettingsViewProps {
  userEmail: string
  currentExchangeRate: number
}

export function SettingsView({ userEmail }: SettingsViewProps) {
  const { language, setLanguage, t } = useLanguage()
  const [forexRates, setForexRates] = useState<ForexRatesMap>(DEFAULT_FALLBACK_RATES)
  const displayCurrency = usePreferredCurrency()
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncSuccess, setSyncSuccess] = useState(false)

  const [isSeeding, setIsSeeding] = useState(false)
  const [seedSuccess, setSeedSuccess] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [clearSuccess, setClearSuccess] = useState(false)

  useEffect(() => {
    getLatestForexRates().then(setForexRates)
  }, [])

  const handleSelectDisplayCurrency = (code: CurrencyCode) => {
    setPreferredCurrency(code)
  }

  const handleSyncRate = async () => {
    setIsSyncing(true)
    setSyncSuccess(false)
    try {
      const newRates = await fetchAndSaveForexRates()
      setForexRates(newRates)
      setSyncSuccess(true)
      setTimeout(() => setSyncSuccess(false), 3000)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleSeedDemo = async () => {
    setIsSeeding(true)
    setSeedSuccess(false)
    try {
      const res = await seedDemoData()
      if (res.success) {
        setSeedSuccess(true)
        setTimeout(() => setSeedSuccess(false), 4000)
      }
    } finally {
      setIsSeeding(false)
    }
  }

  const handleClearData = async () => {
    if (!window.confirm(t.settings.clearConfirm || 'Apakah Anda yakin ingin mengosongkan seluruh data transaksi, akun, dan anggaran?')) {
      return
    }
    setIsClearing(true)
    setClearSuccess(false)
    try {
      const res = await clearUserData()
      if (res.success) {
        setClearSuccess(true)
        setTimeout(() => setClearSuccess(false), 4000)
      }
    } finally {
      setIsClearing(false)
    }
  }

  const sgdToIdr = getCrossRate('SGD', 'IDR', forexRates)

  return (
    <div className="flex flex-col gap-4">
      {/* Dynamic Bilingual Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
          {t.settings.title}
        </h1>
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-mono">
          {t.settings.subtitle}
        </p>
      </div>

      {/* Account Info */}
      <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#F1F3F5] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC] truncate">
              {t.settings.sessionTitle}
            </h3>
            <span className="text-xs font-mono text-[#64748B] dark:text-[#94A3B8] truncate">
              {userEmail || t.settings.authenticatedUser || 'Pengguna Terautentikasi'}
            </span>
          </div>
        </div>
      </div>

      {/* Global Audit Log Shortcut Card */}
      <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#F1F3F5] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] flex items-center justify-center shrink-0">
            <History className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
              {t.auditLog.auditShortcutCardTitle}
            </h3>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              {t.auditLog.auditShortcutCardDesc}
            </p>
          </div>
        </div>

        <Link
          href="/audit-log"
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F172A] hover:bg-[#1E293B] dark:bg-[#FAFAFA] dark:hover:bg-[#E2E8F0] text-white dark:text-[#0F172A] text-xs font-bold transition-colors shrink-0 whitespace-nowrap cursor-pointer"
        >
          <span>{t.auditLog.openAuditBtn}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Primary Display Currency Setting */}
      <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#F1F3F5] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] flex items-center justify-center shrink-0">
            <Coins className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
              {t.settings.primaryCurrencyTitle}
            </h3>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              {t.settings.primaryCurrencyDesc}
            </p>
          </div>
        </div>

        <div className="w-full sm:w-48 shrink-0">
          <Select
            value={displayCurrency}
            onValueChange={(val) => handleSelectDisplayCurrency(val as CurrencyCode)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCY_LIST.map((curr) => (
                <SelectItem key={curr.code} value={curr.code}>
                  <span className="flex items-center gap-1.5">
                    <span className="font-bold">{curr.code}</span>
                    <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-normal truncate">
                      ({curr.name})
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Foreign Exchange Rate Sync & Live Rates Matrix */}
      <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
              {t.settings.exchangeRateTitle}
            </h3>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
              {t.settings.forexMatrixDesc}
            </p>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleSyncRate}
            isLoading={isSyncing}
            className="gap-1.5 shrink-0 whitespace-nowrap self-start sm:self-auto"
          >
            {syncSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#0D9488]" />
                <span>{t.settings.syncedSuccess}</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{t.settings.syncLiveRate}</span>
              </>
            )}
          </Button>
        </div>

        {/* Live Forex Matrix Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-[#E5E7EB] dark:border-[#27272A] font-mono text-xs">
          <div className="p-2.5 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col">
            <span className="text-[10px] font-sans font-bold text-[#94A3B8]">USD / IDR</span>
            <span className="font-bold text-[#0F172A] dark:text-[#FAFAFA] mt-0.5">
              1 USD = {formatCurrency(forexRates.IDR || 16200, 'IDR')}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col">
            <span className="text-[10px] font-sans font-bold text-[#94A3B8]">USD / SGD</span>
            <span className="font-bold text-[#0F172A] dark:text-[#FAFAFA] mt-0.5">
              1 USD = {formatCurrency(forexRates.SGD || 1.34, 'SGD')}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col">
            <span className="text-[10px] font-sans font-bold text-[#94A3B8]">SGD / IDR (Cross)</span>
            <span className="font-bold text-[#0D9488] mt-0.5">
              1 SGD = {formatCurrency(sgdToIdr, 'IDR')}
            </span>
          </div>
        </div>
      </div>

      {/* Language Switcher */}
      <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#F1F3F5] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] flex items-center justify-center shrink-0">
            <Globe className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
              {t.settings.languageTitle}
            </h3>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              {t.settings.languageDesc}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 w-full sm:w-auto p-1 bg-[#F1F3F5] dark:bg-[#1A1A20] rounded-lg border border-[#E5E7EB] dark:border-[#27272A] shrink-0">
          <button
            type="button"
            onClick={() => setLanguage('id')}
            className={cn(
              'px-3.5 py-1.5 rounded-md text-xs whitespace-nowrap transition-all cursor-pointer font-medium text-center',
              language === 'id'
                ? 'bg-white dark:bg-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] border border-[#E5E7EB] dark:border-transparent font-bold shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]'
            )}
          >
            Bahasa Indonesia
          </button>
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={cn(
              'px-3.5 py-1.5 rounded-md text-xs whitespace-nowrap transition-all cursor-pointer font-medium text-center',
              language === 'en'
                ? 'bg-[#0F172A] text-white dark:bg-[#27272A] dark:text-[#FAFAFA] font-bold shadow-xs'
                : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]'
            )}
          >
            English
          </button>
        </div>
      </div>

      {/* Theme Settings */}
      <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
            {t.settings.themeTitle}
          </h3>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
            {t.settings.themeDesc}
          </p>
        </div>
        <ThemeToggle showLabels className="w-full sm:w-auto" />
      </div>

      {/* Demo Data Seeder Card */}
      <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A] flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
              {t.settings.demoTitle}
            </h3>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              {t.settings.demoDesc}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E5E7EB] dark:border-[#27272A]">
          <Button
            size="sm"
            onClick={handleSeedDemo}
            isLoading={isSeeding}
            className="gap-1.5"
          >
            {seedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#0D9488]" />
                <span>{t.settings.seedSuccess}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t.settings.seedBtn}</span>
              </>
            )}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleClearData}
            isLoading={isClearing}
            className="gap-1.5 text-[#E11D48] hover:text-[#E11D48] border-[#FECDD3] dark:border-[#9F1239]/40"
          >
            {clearSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#0D9488]" />
                <span>{t.settings.clearSuccess}</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t.settings.clearDataBtn}</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* User Guide Card */}
      <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#F1F3F5] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
              {t.settings.guideTitle}
            </h3>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              {t.settings.guideDesc}
            </p>
          </div>
        </div>

        <Link
          href="/guide"
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F172A] hover:bg-[#1E293B] dark:bg-[#FAFAFA] dark:hover:bg-[#E2E8F0] text-white dark:text-[#0F172A] text-xs font-bold transition-colors shrink-0 whitespace-nowrap cursor-pointer"
        >
          <span>{t.settings.openGuideBtn}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Data Export Card */}
      <ExportDataCard />

      {/* Sign Out */}
      <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#E11D48]">
            {t.settings.terminateTitle}
          </h3>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
            {t.settings.terminateDesc}
          </p>
        </div>

        <form action={logout}>
          <Button type="submit" variant="danger" size="sm" className="gap-1.5 cursor-pointer whitespace-nowrap">
            <LogOut className="w-3.5 h-3.5" />
            {t.settings.signOutBtn}
          </Button>
        </form>
      </div>
    </div>
  )
}
