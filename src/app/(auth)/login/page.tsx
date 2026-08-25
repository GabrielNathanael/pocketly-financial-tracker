'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { login } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { useLanguage } from '@/lib/i18n/language-context'
import { ArrowLeft, Lock, Mail, Sparkles } from 'lucide-react'

export default function LoginPage() {
  const { t, language, setLanguage } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const res = await login({ email, password })
      if (res?.error) {
        setError(res.error)
        setIsLoading(false)
      } else {
        window.location.href = '/dashboard'
      }
    } catch (err) {
      const msg = (err as Error).message
      if (msg && !msg.includes('NEXT_REDIRECT')) {
        setError(msg)
      }
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-between p-4 sm:p-8 bg-[#F8F9FA] dark:bg-[#09090B] text-[#0F172A] dark:text-[#F8FAFC]">
      {/* Top Bar */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{language === 'id' ? 'Kembali ke Beranda' : 'Back to Home'}</span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Language Switcher */}
          <button
            type="button"
            onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
            className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] transition-colors cursor-pointer"
          >
            {language === 'id' ? 'ID' : 'EN'}
          </button>
          <ThemeToggle />
        </div>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md mx-auto my-auto py-8">
        <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-xl flex flex-col gap-6 relative overflow-hidden">
          {/* Subtle decorative glow */}
          <div className="absolute -top-16 -right-16 w-32 h-32 bg-[#0D9488]/10 rounded-full blur-2xl pointer-events-none" />

          {/* Logo & Header */}
          <div className="flex flex-col items-center text-center gap-2.5">
            <div className="relative">
              <Image
                src="/logo.png"
                alt="Pocketly Logo"
                width={64}
                height={64}
                className="w-16 h-16 object-contain drop-shadow-md"
                priority
              />
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
                Pocketly
              </h1>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] max-w-xs">
                {language === 'id'
                  ? 'Masuk ke buku kas keuangan personal dan kelola seluruh aset Anda.'
                  : 'Sign in to your personal financial ledger and take control of your assets.'}
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                {language === 'id' ? 'Alamat Email' : 'Email Address'}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="admin@pocketly.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#0F172A] dark:focus:border-[#FAFAFA] transition-colors"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                {language === 'id' ? 'Kata Sandi' : 'Password'}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#0F172A] dark:focus:border-[#FAFAFA] transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-[#FFF1F2] dark:bg-[#881337]/20 border border-[#FECDD3] dark:border-[#9F1239]/40 text-[#E11D48] text-xs font-semibold text-center">
                {error}
              </div>
            )}

            <Button
              type="submit"
              isLoading={isLoading}
              className="w-full py-2.5 h-auto font-bold text-xs rounded-xl mt-1"
            >
              {language === 'id' ? 'Masuk ke Dashboard' : 'Sign In to Dashboard'}
            </Button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-center text-[11px] text-[#94A3B8]">
        Pocketly &copy; {new Date().getFullYear()} — Multi-Currency Financial Ledger
      </div>
    </div>
  )
}
