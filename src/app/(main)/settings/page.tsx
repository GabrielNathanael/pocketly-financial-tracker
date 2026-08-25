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
      <SettingsView
        userEmail={user?.email || ''}
        currentExchangeRate={exchangeRate}
      />
    </div>
  )
}
