import React from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getLatestExchangeRate } from '@/actions/exchange-rate'
import { SettingsView } from '@/components/settings/settings-view'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const exchangeRate = await getLatestExchangeRate('USD', 'IDR')

  return (
    <div className="flex flex-col gap-4 max-w-xl mx-auto">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
          Pengaturan Sistem
        </h1>
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-mono">
          Preferensi antarmuka, tema tampilan dan konfigurasi kurs mata uang
        </p>
      </div>

      <SettingsView
        userEmail={user?.email || 'Pengguna Terautentikasi'}
        currentExchangeRate={exchangeRate}
      />
    </div>
  )
}
