// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This Edge Function is designed to run via Supabase scheduled cron 1x/day

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch from Frankfurter API
    const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=IDR')
    let rate = 16000

    if (res.ok) {
      const data = await res.json()
      if (data.rates?.IDR) {
        rate = Number(data.rates.IDR)
      }
    } else {
      const fallback = await fetch('https://open.er-api.com/v6/latest/USD')
      const fallbackData = await fallback.json()
      if (fallbackData.rates?.IDR) {
        rate = Number(fallbackData.rates.IDR)
      }
    }

    const { error } = await supabase.from('exchange_rates').insert({
      base_currency: 'USD',
      target_currency: 'IDR',
      rate: rate,
      fetched_at: new Date().toISOString(),
    })

    if (error) throw error

    return new Response(
      JSON.stringify({ message: 'Exchange rate updated successfully', rate }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
