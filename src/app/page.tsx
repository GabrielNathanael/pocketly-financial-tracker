'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useLanguage } from '@/lib/i18n/language-context'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { useTheme } from '@/components/layout/theme-provider'
import { formatCurrency } from '@/lib/utils/currency'
import {
  ArrowRight,
  Globe2,
  Scale,
  TrendingUp,
  ChevronRight,
  ArrowDownRight,
  ArrowUpRight,
  Wallet,
  Coins,
  Smartphone,
  ScanLine,
  CalendarCheck,
  Target,
  FileSpreadsheet,
  Eye,
  EyeOff,
  History,
  SlidersHorizontal,
  Sun,
  Moon,
  Monitor,
  X,
  CreditCard,
  Building,
  CheckCircle2,
  DollarSign,
  Landmark,
} from 'lucide-react'

export default function LandingPage() {
  const { language, setLanguage } = useLanguage()
  const { theme, setTheme } = useTheme()
  const [demoCurrency, setDemoCurrency] = useState<'IDR' | 'USD' | 'SGD'>('IDR')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isDemoPrivate, setIsDemoPrivate] = useState(false)

  // Real native balances (NO messy converted parentheses)
  const nativeWallets = [
    { name: 'BCA Utama', type: language === 'id' ? 'Rekening Bank' : 'Bank Account', balance: 'Rp 22.500.000', icon: Landmark, color: '#3B82F6' },
    { name: 'Wise USD Vault', type: language === 'id' ? 'Valas USD' : 'USD Vault', balance: '$1,250.00', icon: DollarSign, color: '#10B981' },
    { name: 'DBS Singapore', type: language === 'id' ? 'Valas SGD' : 'SGD Account', balance: 'S$ 1,450.00', icon: Coins, color: '#F59E0B' },
    { name: 'RDN Mandiri', type: language === 'id' ? 'Investasi Saham' : 'Stock Brokerage', balance: 'Rp 15.600.000', icon: TrendingUp, color: '#8B5CF6' },
  ]

  // Totals dynamically converted by selected base currency
  const mockTotals = {
    IDR: { total: 54300000, income: 15000000, expense: 6200000, approx: null },
    USD: { total: 3351.85, income: 925.92, expense: 382.71, approx: '≈ Rp 54.300.000' },
    SGD: { total: 4583.42, income: 1266.12, expense: 523.33, approx: '≈ Rp 54.300.000' },
  }

  const currentTotal = mockTotals[demoCurrency]

  const formatMask = (val: string) => (isDemoPrivate ? '••••••••' : val)

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#09090B] text-[#0F172A] dark:text-[#F8FAFC] flex flex-col selection:bg-[#0F172A] selection:text-white dark:selection:bg-white dark:selection:text-[#0F172A] overflow-x-hidden">
      {/* 1. Header Navbar */}
      <header className="sticky top-0 z-50 w-full bg-white/90 dark:bg-[#121215]/90 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#27272A] px-4 sm:px-8 h-16 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-2.5">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Image
              src="/logo.png"
              alt="Pocketly Logo"
              width={32}
              height={32}
              className="w-8 h-8 object-contain group-hover:scale-105 transition-transform"
              priority
            />
            <span className="font-extrabold text-lg tracking-tight text-[#0F172A] dark:text-[#FAFAFA]">
              Pocketly
            </span>
          </Link>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Desktop Controls (Hidden on Mobile) */}
          <div className="hidden sm:flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
              className="px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#1A1A20] text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] transition-colors cursor-pointer"
              title="Ganti Bahasa / Switch Language"
            >
              {language === 'id' ? 'ID' : 'EN'}
            </button>
            <ThemeToggle />
          </div>

          {/* Mobile Single Settings Toggle Button */}
          <div className="relative sm:hidden">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#1A1A20] text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              aria-label="Pengaturan Tampilan & Bahasa"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="font-mono text-[11px]">{language.toUpperCase()}</span>
            </button>

            {/* Mobile Dropdown Menu */}
            {isMobileMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsMobileMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 p-3 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-2xl z-50 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB] dark:border-[#27272A]">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                      {language === 'id' ? 'Preferensi' : 'Preferences'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="p-1 rounded-md text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Language Section */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                      {language === 'id' ? 'Bahasa' : 'Language'}
                    </span>
                    <div className="grid grid-cols-2 gap-1 p-1 bg-[#F1F3F5] dark:bg-[#1A1A20] rounded-xl border border-[#E5E7EB] dark:border-[#27272A]">
                      <button
                        type="button"
                        onClick={() => {
                          setLanguage('id')
                          setIsMobileMenuOpen(false)
                        }}
                        className={`py-1 rounded-lg text-xs font-bold transition-all ${
                          language === 'id'
                            ? 'bg-white dark:bg-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] shadow-xs'
                            : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]'
                        }`}
                      >
                        Bahasa (ID)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLanguage('en')
                          setIsMobileMenuOpen(false)
                        }}
                        className={`py-1 rounded-lg text-xs font-bold transition-all ${
                          language === 'en'
                            ? 'bg-white dark:bg-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] shadow-xs'
                            : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]'
                        }`}
                      >
                        English (EN)
                      </button>
                    </div>
                  </div>

                  {/* Theme Section */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                      {language === 'id' ? 'Tema Tampilan' : 'Appearance'}
                    </span>
                    <div className="grid grid-cols-3 gap-1 p-1 bg-[#F1F3F5] dark:bg-[#1A1A20] rounded-xl border border-[#E5E7EB] dark:border-[#27272A]">
                      <button
                        type="button"
                        onClick={() => {
                          setTheme('light')
                          setIsMobileMenuOpen(false)
                        }}
                        className={`py-1 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all ${
                          theme === 'light'
                            ? 'bg-white dark:bg-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] shadow-xs'
                            : 'text-[#64748B]'
                        }`}
                      >
                        <Sun className="w-3 h-3" />
                        <span>Light</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTheme('dark')
                          setIsMobileMenuOpen(false)
                        }}
                        className={`py-1 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all ${
                          theme === 'dark'
                            ? 'bg-white dark:bg-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] shadow-xs'
                            : 'text-[#64748B]'
                        }`}
                      >
                        <Moon className="w-3 h-3" />
                        <span>Dark</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTheme('system')
                          setIsMobileMenuOpen(false)
                        }}
                        className={`py-1 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all ${
                          theme === 'system'
                            ? 'bg-white dark:bg-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] shadow-xs'
                            : 'text-[#64748B]'
                        }`}
                      >
                        <Monitor className="w-3 h-3" />
                        <span>Auto</span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A] hover:opacity-90 active:scale-95 transition-all shadow-xs shrink-0"
          >
            <span>{language === 'id' ? 'Coba Demo' : 'Try Demo'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative pt-12 pb-12 sm:pt-20 sm:pb-20 px-4 sm:px-6 max-w-5xl mx-auto flex flex-col items-center text-center w-full">
        {/* Ambient Subtle Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] sm:w-[650px] h-[300px] bg-linear-to-tr from-teal-500/10 via-indigo-500/10 to-rose-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

        {/* Headline */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[#0F172A] dark:text-[#F8FAFC] max-w-4xl leading-[1.15]">
          {language === 'id'
            ? 'Kendali Penuh Atas Seluruh Akun Bank, Valuta Asing & Investasi Anda'
            : 'Take Complete Control of Your Multi-Currency Cash Flow & Wealth'}
        </h1>

        {/* Subtitle */}
        <p className="mt-4 sm:mt-6 text-sm sm:text-base md:text-lg text-[#64748B] dark:text-[#94A3B8] max-w-2xl leading-relaxed">
          {language === 'id'
            ? 'Buku kas personal cerdas dengan agregasi saldo otomatis, live kurs valas, pelacak portofolio saham, cicilan hutang/piutang, dan scan struk pintar.'
            : 'Precision personal finance ledger with automated balance calculation, multi-currency live conversions, stock holdings, debt schedules, and receipt scanning.'}
        </p>

        {/* Proportional CTA Buttons (Side by Side on Desktop, Compact on Mobile) */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto">
          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md"
          >
            <span>{language === 'id' ? 'Coba Demo' : 'Try Live Demo'}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-xl text-sm font-semibold bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20] transition-colors shadow-xs"
          >
            {language === 'id' ? 'Masuk' : 'Sign In'}
          </Link>
        </div>

        {/* 3. Sleek Interactive App Preview Frame (Authentic Dashboard Layout) */}
        <div className="mt-12 w-full max-w-4xl rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-2xl overflow-hidden text-left flex flex-col animate-in fade-in zoom-in-95 duration-500">
          {/* Top Window Bar (No fake URL, clean controls) */}
          <div className="px-4 py-3 bg-[#F8F9FA] dark:bg-[#18181B] border-b border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#EF4444]/80" />
              <div className="w-3 h-3 rounded-full bg-[#F59E0B]/80" />
              <div className="w-3 h-3 rounded-full bg-[#10B981]/80" />
            </div>

            {/* Currency Pill Switcher */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#64748B] dark:text-[#94A3B8] hidden xs:inline">
                {language === 'id' ? 'Pilih Valas:' : 'Currency:'}
              </span>
              <div className="flex items-center p-0.5 bg-[#E5E7EB] dark:bg-[#27272A] rounded-lg">
                {(['IDR', 'USD', 'SGD'] as const).map((curr) => (
                  <button
                    key={curr}
                    type="button"
                    onClick={() => setDemoCurrency(curr)}
                    className={`px-3 py-1 rounded-md text-xs font-mono font-bold transition-all cursor-pointer ${
                      demoCurrency === curr
                        ? 'bg-white dark:bg-[#121215] text-[#0F172A] dark:text-[#FAFAFA] shadow-xs'
                        : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]'
                    }`}
                  >
                    {curr}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Mockup Body */}
          <div className="p-4 sm:p-6 flex flex-col gap-6 bg-[#F8F9FA]/50 dark:bg-[#09090B]/50">
            {/* 1. Real BalanceSummary Card */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-4 shadow-xs">
              {/* Header row with Privacy Toggle */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                    {language === 'id' ? 'Total Saldo Kas' : 'Net Cash Balance'} ({demoCurrency})
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsDemoPrivate(!isDemoPrivate)}
                    className="p-1 rounded-md text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#FAFAFA] hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20] transition-colors cursor-pointer"
                    title={isDemoPrivate ? 'Tampilkan Saldo' : 'Sensor Saldo (Privasi)'}
                  >
                    {isDemoPrivate ? (
                      <EyeOff className="w-3.5 h-3.5 text-amber-500" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <div className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F172A] dark:text-[#FAFAFA]">
                  <span>{language === 'id' ? 'Semua Transaksi' : 'All Transactions'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Big Balance Number */}
              <div className="flex flex-col gap-1">
                <h2 className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight tnum text-[#0F172A] dark:text-[#FAFAFA]">
                  {formatMask(formatCurrency(currentTotal.total, demoCurrency))}
                </h2>
                {currentTotal.approx && (
                  <span className="text-xs font-mono text-[#94A3B8] tnum">
                    {formatMask(currentTotal.approx)}
                  </span>
                )}
              </div>

              {/* 2 Mini Cards (Income & Expense) */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#E5E7EB] dark:border-[#27272A]">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
                    <div className="w-4 h-4 rounded-full bg-[#ECFDF5] dark:bg-[#064E3B]/30 flex items-center justify-center text-[#0D9488]">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </div>
                    <span>{language === 'id' ? 'Pemasukan Bulan Ini' : 'Monthly Income'}</span>
                  </div>
                  <span className="font-bold font-mono text-sm sm:text-base text-[#0D9488] tracking-tight tnum">
                    +{formatMask(formatCurrency(currentTotal.income, demoCurrency))}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
                    <div className="w-4 h-4 rounded-full bg-[#FFF1F2] dark:bg-[#881337]/30 flex items-center justify-center text-[#E11D48]">
                      <ArrowDownRight className="w-3.5 h-3.5" />
                    </div>
                    <span>{language === 'id' ? 'Pengeluaran Bulan Ini' : 'Monthly Expense'}</span>
                  </div>
                  <span className="font-bold font-mono text-sm sm:text-base text-[#E11D48] tracking-tight tnum">
                    -{formatMask(formatCurrency(currentTotal.expense, demoCurrency))}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Multi-Wallet Cards (Clean native balances, NO messy conversions) */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                  {language === 'id' ? 'Daftar Akun & Dompet' : 'Accounts & Wallets'}
                </span>
                <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
                  4 {language === 'id' ? 'Akun Aktif' : 'Active'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {nativeWallets.map((w, idx) => {
                  const Icon = w.icon
                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col justify-between gap-3 shadow-xs hover:border-[#0F172A] dark:hover:border-[#FAFAFA] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-center text-[#0F172A] dark:text-[#FAFAFA]">
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                            {w.name}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                          {w.type}
                        </span>
                        <span className="text-sm font-mono font-bold text-[#0F172A] dark:text-[#F8FAFC] tnum">
                          {formatMask(w.balance)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 3. Recent Transactions Stream */}
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                {language === 'id' ? 'Transaksi Terbaru' : 'Recent Transactions'}
              </span>
              <div className="flex flex-col gap-2">
                {[
                  { title: 'Gaji Bulanan & Bonus', category: 'Gaji Pokok', account: 'BCA Utama', amount: '+Rp 15.000.000', isIncome: true },
                  { title: 'Developer SaaS Tools', category: 'Langganan & Digital', account: 'Wise USD Vault', amount: '-$40.00', isIncome: false },
                  { title: 'Belanja Supermarket', category: 'Belanja & Kebutuhan', account: 'BCA Utama', amount: '-Rp 322.000', isIncome: false },
                ].map((tx, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          tx.isIncome
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {tx.isIncome ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                          {tx.title}
                        </span>
                        <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                          {tx.category} • {tx.account}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-xs sm:text-sm font-mono font-bold shrink-0 tnum ${
                        tx.isIncome
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {formatMask(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Complete Features Grid */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-white dark:bg-[#121215] border-t border-b border-[#E5E7EB] dark:border-[#27272A]">
        <div className="max-w-5xl mx-auto flex flex-col gap-12 sm:gap-16">
          <div className="text-center flex flex-col gap-3 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
              {language === 'id'
                ? 'Semua yang Anda Butuhkan untuk Mengelola Keuangan'
                : 'Everything You Need to Master Your Finances'}
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
              {language === 'id'
                ? 'Semua alat yang Anda butuhkan untuk mengelola likuiditas multi-valas, investasi, cicilan, dan otomasi kas dalam satu platform terpadu.'
                : 'Everything you need to manage global cash flows, stock holdings, recurring bills, and savings milestones in one unified ledger.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* 1. Multi-Valas & Live Forex */}
            <div className="p-5 rounded-2xl bg-[#F8F9FA] dark:bg-[#18181B] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3 hover:border-[#0F172A] dark:hover:border-[#FAFAFA] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-center text-[#0D9488] shadow-xs">
                <Globe2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {language === 'id' ? 'Multi-Valas & Live Kurs' : 'Multi-Currency Live FX'}
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                {language === 'id'
                  ? 'Catat transaksi dalam IDR, USD, SGD, EUR, JPY dengan update kurs realtime dan konsolidasi aset instan.'
                  : 'Track balances across global currencies with live exchange rates and automatic net worth consolidation.'}
              </p>
            </div>

            {/* 2. Investasi & Portofolio Aset */}
            <div className="p-5 rounded-2xl bg-[#F8F9FA] dark:bg-[#18181B] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3 hover:border-[#0F172A] dark:hover:border-[#FAFAFA] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-center text-emerald-600 shadow-xs">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {language === 'id' ? 'Portofolio Investasi & Aset' : 'Investment & Asset Portfolio'}
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                {language === 'id'
                  ? 'Pantau kepemilikan saham IDX, reksa dana, deposito, modal beli rata-rata, dan akun kas RDN terintegrasi.'
                  : 'Track equities, mutual funds, deposits, average buy prices, and integrated brokerage cash accounts.'}
              </p>
            </div>

            {/* 3. Savings Goals */}
            <div className="p-5 rounded-2xl bg-[#F8F9FA] dark:bg-[#18181B] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3 hover:border-[#0F172A] dark:hover:border-[#FAFAFA] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-center text-blue-500 shadow-xs">
                <Target className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {language === 'id' ? 'Target Tabungan (Goals)' : 'Savings Goals & Targets'}
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                {language === 'id'
                  ? 'Tetapkan target dana darurat atau impian belanja dengan alokasi setoran langsung dari dompet sumber.'
                  : 'Set milestone savings targets with progress tracking and direct wallet deposit allocations.'}
              </p>
            </div>

            {/* 4. Tagihan Rutin & Due Center */}
            <div className="p-5 rounded-2xl bg-[#F8F9FA] dark:bg-[#18181B] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3 hover:border-[#0F172A] dark:hover:border-[#FAFAFA] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-center text-purple-500 shadow-xs">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {language === 'id' ? 'Tagihan Rutin & Due Center' : 'Recurring Bills & Due Center'}
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                {language === 'id'
                  ? 'Otomasi pengingat langganan Netflix, internet, dan tagihan bulanan dalam satu pusat jatuh tempo.'
                  : 'Automate subscription schedules, utilities, and upcoming bill reminders in a unified due center.'}
              </p>
            </div>

            {/* 5. Hutang & Piutang */}
            <div className="p-5 rounded-2xl bg-[#F8F9FA] dark:bg-[#18181B] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3 hover:border-[#0F172A] dark:hover:border-[#FAFAFA] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-center text-indigo-500 shadow-xs">
                <Scale className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {language === 'id' ? 'Hutang & Piutang' : 'Debts & Receivables'}
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                {language === 'id'
                  ? 'Catat siapa yang meminjam uang dan cicilan pinjaman dengan pemotongan saldo dompet otomatis.'
                  : 'Manage borrow and lend records with partial installment logs and direct wallet balance updates.'}
              </p>
            </div>

            {/* 6. AI OCR Receipt Scanner */}
            <div className="p-5 rounded-2xl bg-[#F8F9FA] dark:bg-[#18181B] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3 hover:border-[#0F172A] dark:hover:border-[#FAFAFA] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-center text-amber-500 shadow-xs">
                <ScanLine className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {language === 'id' ? 'OCR Scan Struk Belanja' : 'AI Receipt OCR Scanner'}
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                {language === 'id'
                  ? 'Foto struk belanja Anda untuk ekstraksi otomatis nama toko, rincian barang belanjaan, dan total harga.'
                  : 'Snap a receipt photo to auto-extract merchant name, itemized sub-items, and total expense.'}
              </p>
            </div>

            {/* 7. Universal Audit Trail */}
            <div className="p-5 rounded-2xl bg-[#F8F9FA] dark:bg-[#18181B] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3 hover:border-[#0F172A] dark:hover:border-[#FAFAFA] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-center text-teal-600 shadow-xs">
                <History className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {language === 'id' ? 'Universal Audit Trail' : 'Immutable Audit Trail'}
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                {language === 'id'
                  ? 'Setiap penambahan, edit saldo, dan penghapusan tercatat secara permanen di trigger database.'
                  : 'Every single insert, update, and balance mutation is immutably logged via PostgreSQL triggers.'}
              </p>
            </div>

            {/* 8. Mode Privasi Sensor Saldo */}
            <div className="p-5 rounded-2xl bg-[#F8F9FA] dark:bg-[#18181B] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3 hover:border-[#0F172A] dark:hover:border-[#FAFAFA] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-center text-rose-500 shadow-xs">
                <EyeOff className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {language === 'id' ? 'Mode Privasi Sensor Saldo' : 'Masking Privacy Mode'}
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                {language === 'id'
                  ? 'Satu klik tombol cepat untuk memburamkan semua angka saldo saat membuka aplikasi di ruang publik.'
                  : 'Instantly blur all sensitive balance numbers with a single click in public environments.'}
              </p>
            </div>

            {/* 9. Laporan Keuangan & CSV */}
            <div className="p-5 rounded-2xl bg-[#F8F9FA] dark:bg-[#18181B] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3 hover:border-[#0F172A] dark:hover:border-[#FAFAFA] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-center text-cyan-500 shadow-xs">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {language === 'id' ? 'Laporan & Export CSV' : 'Financial Reports & CSV'}
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                {language === 'id'
                  ? 'Filter laporan keuangan kustom dan unduh seluruh transaksi ke format CSV untuk analisis spreadsheet.'
                  : 'Filter financial summaries and export structured transaction spreadsheets on demand.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Final CTA Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 max-w-4xl mx-auto w-full text-center">
        <div className="p-8 sm:p-14 rounded-3xl bg-[#0F172A] text-white dark:bg-[#121215] border border-[#334155] dark:border-[#27272A] flex flex-col items-center gap-6 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col gap-2.5 max-w-md mx-auto">
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              {language === 'id' ? 'Jelajahi Pocketly Sekarang' : 'Experience Pocketly Today'}
            </h2>
            <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed">
              {language === 'id'
                ? 'Gunakan akun demo publik untuk mencoba seluruh fitur secara langsung tanpa perlu mendaftar.'
                : 'Explore all modules instantly with the public pre-seeded demo account.'}
            </p>
          </div>

          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-sm font-bold bg-white text-[#0F172A] hover:bg-[#F1F3F5] transition-all active:scale-95 shadow-lg"
          >
            <span>{language === 'id' ? 'Coba Demo' : 'Try Live Demo'}</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* 6. Footer */}
      <footer className="mt-auto border-t border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] py-8 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="Pocketly Logo"
              width={24}
              height={24}
              className="w-6 h-6 object-contain"
            />
            <span className="font-bold text-sm text-[#0F172A] dark:text-[#FAFAFA]">
              Pocketly
            </span>
          </div>

          <div className="text-[11px] text-[#94A3B8]">
            Pocketly &copy; {new Date().getFullYear()} — Multi-Currency Financial Ledger
          </div>
        </div>
      </footer>
    </div>
  )
}
