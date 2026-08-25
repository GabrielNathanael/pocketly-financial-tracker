'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useLanguage } from '@/lib/i18n/language-context'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { formatCurrency } from '@/lib/utils/currency'
import {
  Sparkles,
  ArrowRight,
  Zap,
  Globe2,
  Scale,
  TrendingUp,
  ShieldCheck,
  Moon,
  CheckCircle2,
  ChevronRight,
  ArrowDownRight,
  ArrowUpRight,
  Wallet,
  Coins,
  BookOpen,
} from 'lucide-react'

export default function LandingPage() {
  const { t, language, setLanguage } = useLanguage()
  const [demoCurrency, setDemoCurrency] = useState<'IDR' | 'USD' | 'SGD'>('IDR')

  // Interactive demo preview state
  const mockBalances = {
    IDR: { total: 48500000, income: 15000000, expense: 6200000, netWorth: 54300000 },
    USD: { total: 3100, income: 1000, expense: 420, netWorth: 3500 },
    SGD: { total: 4150, income: 1300, expense: 550, netWorth: 4650 },
  }

  const currentDemo = mockBalances[demoCurrency]

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#09090B] text-[#0F172A] dark:text-[#F8FAFC] flex flex-col selection:bg-[#0F172A] selection:text-white dark:selection:bg-white dark:selection:text-[#0F172A]">
      {/* 1. Header Navbar */}
      <header className="sticky top-0 z-50 w-full bg-white/80 dark:bg-[#121215]/80 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#27272A] px-4 sm:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
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
          {/* Language Switcher */}
          <button
            type="button"
            onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
            className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#1A1A20] text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] transition-colors cursor-pointer"
            title="Ganti Bahasa / Switch Language"
          >
            {language === 'id' ? 'ID' : 'EN'}
          </button>

          <ThemeToggle />

          <Link
            href="/login"
            className="hidden sm:inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[#0F172A] dark:text-[#FAFAFA] hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] transition-colors"
          >
            {t.landing.loginBtn}
          </Link>

          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A] hover:opacity-90 transition-all shadow-xs"
          >
            <span>{t.landing.openDashboard}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative pt-12 pb-16 sm:pt-20 sm:pb-24 px-4 sm:px-6 max-w-5xl mx-auto flex flex-col items-center text-center">
        {/* Subtle Background Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[550px] h-[300px] bg-linear-to-tr from-[#0D9488]/15 via-[#6366F1]/10 to-[#E11D48]/15 rounded-full blur-3xl -z-10 pointer-events-none" />

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-xs mb-6 text-xs font-bold text-[#64748B] dark:text-[#94A3B8] animate-in fade-in zoom-in-95 duration-500">
          <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
          <span>{t.landing.badge}</span>
        </div>

        {/* Headline */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[#0F172A] dark:text-[#F8FAFC] max-w-3xl leading-[1.15]">
          {t.landing.heroTitle}
        </h1>

        {/* Subtitle */}
        <p className="mt-5 text-sm sm:text-base md:text-lg text-[#64748B] dark:text-[#94A3B8] max-w-2xl leading-relaxed">
          {t.landing.heroSubtitle}
        </p>

        {/* CTA Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md"
          >
            <span>{t.landing.getStarted}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/login"
            className="inline-flex items-center justify-center px-5 py-3 rounded-xl text-sm font-semibold bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20] transition-colors"
          >
            {t.landing.loginBtn}
          </Link>
        </div>

        {/* 3. Interactive Showcase Preview Card */}
        <div className="mt-12 w-full max-w-3xl rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] p-5 sm:p-7 shadow-2xl text-left flex flex-col gap-5">
          {/* Card Header with Currency Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E5E7EB] dark:border-[#27272A]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A] flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                  Live Ledger Preview
                </h2>
                <p className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  {language === 'id' ? 'Simulasi Saldo Multi-Valas' : 'Multi-Currency Live Balance'}
                </p>
              </div>
            </div>

            {/* Currency Pill Switcher */}
            <div className="flex items-center p-1 bg-[#F1F3F5] dark:bg-[#1A1A20] rounded-lg border border-[#E5E7EB] dark:border-[#27272A]">
              {(['IDR', 'USD', 'SGD'] as const).map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => setDemoCurrency(curr)}
                  className={`px-3 py-1 rounded-md text-xs font-mono font-bold transition-colors cursor-pointer ${
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

          {/* Balance Numbers Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                {language === 'id' ? 'Total Saldo Likuid' : 'Total Liquid Balance'}
              </span>
              <span className="text-xl sm:text-2xl font-mono font-bold text-[#0F172A] dark:text-[#F8FAFC] tnum">
                {formatCurrency(currentDemo.total, demoCurrency)}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#0D9488] flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3 stroke-[2.5]" />
                {language === 'id' ? 'Pemasukan Bulan Ini' : 'Monthly Income'}
              </span>
              <span className="text-xl sm:text-2xl font-mono font-bold text-[#0D9488] tnum">
                +{formatCurrency(currentDemo.income, demoCurrency)}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#E11D48] flex items-center gap-1">
                <ArrowDownRight className="w-3 h-3 stroke-[2.5]" />
                {language === 'id' ? 'Pengeluaran Bulan Ini' : 'Monthly Expense'}
              </span>
              <span className="text-xl sm:text-2xl font-mono font-bold text-[#E11D48] tnum">
                -{formatCurrency(currentDemo.expense, demoCurrency)}
              </span>
            </div>
          </div>

          {/* Real-time Net Worth Formula Bar */}
          <div className="flex flex-wrap items-center justify-between p-3.5 rounded-xl bg-[#F1F3F5] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-xs">
            <div className="flex items-center gap-2 font-medium text-[#64748B] dark:text-[#94A3B8]">
              <Coins className="w-4 h-4 text-[#D97706]" />
              <span>
                {language === 'id'
                  ? 'Kekayaan Bersih = Saldo Likuid + Piutang - Utang'
                  : 'Net Worth = Liquid Assets + Receivables - Debts'}
              </span>
            </div>
            <span className="font-mono font-bold text-[#0F172A] dark:text-[#FAFAFA] text-sm tnum">
              {formatCurrency(currentDemo.netWorth, demoCurrency)}
            </span>
          </div>
        </div>
      </section>

      {/* 4. Core Features Grid */}
      <section className="py-16 px-4 sm:px-6 bg-white dark:bg-[#121215] border-t border-b border-[#E5E7EB] dark:border-[#27272A]">
        <div className="max-w-5xl mx-auto flex flex-col gap-12">
          <div className="text-center flex flex-col gap-2 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
              {t.landing.featuresTitle}
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8]">
              {t.landing.featuresSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3.5 hover:border-[#0F172A] dark:hover:border-[#FAFAFA] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-center text-[#0F172A] dark:text-[#FAFAFA] shadow-xs">
                <Zap className="w-5 h-5 text-[#D97706]" />
              </div>
              <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {t.landing.feature1Title}
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                {t.landing.feature1Desc}
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3.5 hover:border-[#0F172A] dark:hover:border-[#FAFAFA] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-center text-[#0F172A] dark:text-[#FAFAFA] shadow-xs">
                <Globe2 className="w-5 h-5 text-[#0D9488]" />
              </div>
              <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {t.landing.feature2Title}
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                {t.landing.feature2Desc}
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3.5 hover:border-[#0F172A] dark:hover:border-[#FAFAFA] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-center text-[#0F172A] dark:text-[#FAFAFA] shadow-xs">
                <Scale className="w-5 h-5 text-[#6366F1]" />
              </div>
              <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {t.landing.feature3Title}
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                {t.landing.feature3Desc}
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3.5 hover:border-[#0F172A] dark:hover:border-[#FAFAFA] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-center text-[#0F172A] dark:text-[#FAFAFA] shadow-xs">
                <TrendingUp className="w-5 h-5 text-[#0D9488]" />
              </div>
              <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {t.landing.feature4Title}
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                {t.landing.feature4Desc}
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-2xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3.5 hover:border-[#0F172A] dark:hover:border-[#FAFAFA] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-center text-[#0F172A] dark:text-[#FAFAFA] shadow-xs">
                <ShieldCheck className="w-5 h-5 text-[#0F172A] dark:text-[#FAFAFA]" />
              </div>
              <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {t.landing.feature5Title}
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                {t.landing.feature5Desc}
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-2xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3.5 hover:border-[#0F172A] dark:hover:border-[#FAFAFA] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-center text-[#0F172A] dark:text-[#FAFAFA] shadow-xs">
                <Moon className="w-5 h-5 text-[#E11D48]" />
              </div>
              <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {t.landing.feature6Title}
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                {t.landing.feature6Desc}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CTA Banner Section */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 max-w-4xl mx-auto w-full text-center">
        <div className="p-8 sm:p-12 rounded-3xl bg-[#0F172A] dark:bg-[#121215] border border-[#334155] dark:border-[#27272A] text-white flex flex-col items-center gap-6 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              {t.landing.ctaTitle}
            </h2>
            <p className="text-xs sm:text-sm text-[#94A3B8] max-w-md mx-auto">
              {t.landing.ctaSubtitle}
            </p>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-sm font-bold bg-white text-[#0F172A] hover:bg-[#F1F3F5] transition-transform active:scale-95 shadow-lg"
          >
            <span>{t.landing.openDashboard}</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* 6. Footer */}
      <footer className="mt-auto border-t border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] py-8 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
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

          <div className="flex items-center gap-4 text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
            <Link href="/dashboard" className="hover:text-[#0F172A] dark:hover:text-[#FAFAFA] transition-colors">
              {t.nav.overview}
            </Link>
            <Link href="/guide" className="hover:text-[#0F172A] dark:hover:text-[#FAFAFA] transition-colors">
              {t.nav.guide}
            </Link>
            <Link href="/login" className="hover:text-[#0F172A] dark:hover:text-[#FAFAFA] transition-colors">
              {t.landing.loginBtn}
            </Link>
          </div>

          <div className="text-[11px] text-[#94A3B8]">
            Pocketly &copy; {new Date().getFullYear()} — {t.landing.footerCopyright}
          </div>
        </div>
      </footer>
    </div>
  )
}
