'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { seedUserDefaultCategories } from '@/actions/categories'
import { revalidatePath } from 'next/cache'

export async function seedDemoData(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    // 1. Ensure default categories exist
    await seedUserDefaultCategories(user.id)

    // Fetch existing categories
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: categories } = await (supabase.from('categories') as any)
      .select('*')
      .eq('user_id', user.id)

    const catMap = new Map<string, string>()
    for (const c of categories || []) {
      catMap.set(c.name, c.id)
    }

    const getCat = (name: string) => catMap.get(name) || categories?.[0]?.id || ''

    // 2. Create Realistic Multi-Currency Accounts (IDR, USD, SGD)
    const demoAccounts = [
      {
        name: 'BCA Utama',
        type: 'bank',
        currency: 'IDR',
        initial_balance: 15450000,
        current_balance: 15450000,
        icon: 'Landmark',
        is_active: true,
        user_id: user.id,
      },
      {
        name: 'Mandiri Bisnis',
        type: 'bank',
        currency: 'IDR',
        initial_balance: 28900000,
        current_balance: 28900000,
        icon: 'Building',
        is_active: true,
        user_id: user.id,
      },
      {
        name: 'Dompet Fisik Tunai',
        type: 'cash',
        currency: 'IDR',
        initial_balance: 750000,
        current_balance: 750000,
        icon: 'Wallet',
        is_active: true,
        user_id: user.id,
      },
      {
        name: 'Gopay / E-Wallet',
        type: 'ewallet',
        currency: 'IDR',
        initial_balance: 920000,
        current_balance: 920000,
        icon: 'Smartphone',
        is_active: true,
        user_id: user.id,
      },
      {
        name: 'DBS Singapore (SGD)',
        type: 'bank',
        currency: 'SGD',
        initial_balance: 1450,
        current_balance: 1450,
        icon: 'Coins',
        is_active: true,
        user_id: user.id,
      },
      {
        name: 'Wise USD Vault',
        type: 'bank',
        currency: 'USD',
        initial_balance: 1250,
        current_balance: 1250,
        icon: 'DollarSign',
        is_active: true,
        user_id: user.id,
      },
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: createdAccounts, error: accErr } = await (supabase.from('accounts') as any)
      .insert(demoAccounts)
      .select()

    if (accErr || !createdAccounts) {
      return { success: false, error: accErr?.message || 'Gagal membuat akun demo' }
    }

    const bcaAcc = createdAccounts.find((a: { name: string }) => a.name === 'BCA Utama') || createdAccounts[0]
    const mandiriAcc = createdAccounts.find((a: { name: string }) => a.name === 'Mandiri Bisnis') || createdAccounts[1]
    const cashAcc = createdAccounts.find((a: { name: string }) => a.name === 'Dompet Fisik Tunai') || createdAccounts[2]
    const gopayAcc = createdAccounts.find((a: { name: string }) => a.name === 'Gopay / E-Wallet') || createdAccounts[3]
    const dbsAcc = createdAccounts.find((a: { name: string }) => a.name === 'DBS Singapore (SGD)') || createdAccounts[4]
    const wiseAcc = createdAccounts.find((a: { name: string }) => a.name === 'Wise USD Vault') || createdAccounts[5]

    // 3. Create Sample Rich Transactions (with sub-items, memos, and multi-currency)
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')

    const d = (dayOffset: number) => {
      const target = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000)
      return target.toISOString()
    }

    const demoTransactions = [
      // Income
      {
        user_id: user.id,
        account_id: bcaAcc.id,
        category_id: getCat('Gaji Pokok'),
        type: 'income',
        amount: 22500000,
        currency: 'IDR',
        description: 'Gaji Bulanan & Tunjangan [Memo: Transfer payroll dari PT Teknologi Nusantara]',
        transaction_date: d(1),
      },
      {
        user_id: user.id,
        account_id: mandiriAcc.id,
        category_id: getCat('Freelance & Proyek'),
        type: 'income',
        amount: 7500000,
        currency: 'IDR',
        description: 'Pelunasan Project UI/UX Redesign [Memo: Klien Startup E-Commerce]',
        transaction_date: d(3),
      },
      {
        user_id: user.id,
        account_id: wiseAcc.id,
        category_id: getCat('Freelance & Proyek'),
        type: 'income',
        amount: 600,
        currency: 'USD',
        description: 'Monthly Retainer Overseas Client [Memo: Remote consulting retainer]',
        transaction_date: d(5),
      },

      // Expenses with Sub-items & Memos (IDR)
      {
        user_id: user.id,
        account_id: bcaAcc.id,
        category_id: getCat('Belanja & Kebutuhan'),
        type: 'expense',
        amount: 322000,
        currency: 'IDR',
        description: 'Belanja Bulanan Supermarket [Memo: Stok bahan dapur & cemilan] [Items: Beras Premium 5kg (Rp 75.000), Daging Sapi Slice (Rp 120.000), Minyak Goreng 2L (Rp 35.000), Susu UHT 1L (Rp 22.000), Buah Apel Fuji (Rp 45.000), Telur Ayam 1kg (Rp 25.000)]',
        transaction_date: d(0),
      },
      {
        user_id: user.id,
        account_id: cashAcc.id,
        category_id: getCat('Makanan & Minuman'),
        type: 'expense',
        amount: 85000,
        currency: 'IDR',
        description: 'Makan Siang Bareng Tim Kantor [Memo: Makan siang di Resto Padang] [Items: Nasi Ayam Pop (Rp 28.000), Rendang Daging (Rp 30.000), Jus Alpukat (Rp 15.000), Es Teh Manis (Rp 12.000)]',
        transaction_date: d(0),
      },
      {
        user_id: user.id,
        account_id: gopayAcc.id,
        category_id: getCat('Makanan & Minuman'),
        type: 'expense',
        amount: 48000,
        currency: 'IDR',
        description: 'Kopi Pagi & Snack [Items: Iced Latte Oatmilk (Rp 32.000), Butter Croissant (Rp 16.000)]',
        transaction_date: d(1),
      },
      {
        user_id: user.id,
        account_id: bcaAcc.id,
        category_id: getCat('Transportasi & Bensin'),
        type: 'expense',
        amount: 250000,
        currency: 'IDR',
        description: 'Isi Bensin Pertamax Full Tank [Memo: SPBU Pertamina Dago]',
        transaction_date: d(2),
      },
      {
        user_id: user.id,
        account_id: bcaAcc.id,
        category_id: getCat('Tagihan & Utilitas'),
        type: 'expense',
        amount: 485000,
        currency: 'IDR',
        description: 'Tagihan Listrik PLN & Internet [Items: Token Listrik Rumah (Rp 250.000), Tagihan Indihome 50Mbps (Rp 235.000)]',
        transaction_date: d(4),
      },
      {
        user_id: user.id,
        account_id: gopayAcc.id,
        category_id: getCat('Langganan & Digital'),
        type: 'expense',
        amount: 186000,
        currency: 'IDR',
        description: 'Langganan Hiburan Digital [Items: Netflix Premium 4K (Rp 186.000)]',
        transaction_date: d(6),
      },
      {
        user_id: user.id,
        account_id: bcaAcc.id,
        category_id: getCat('Investasi & Dividen'),
        type: 'expense',
        amount: 2500000,
        currency: 'IDR',
        description: 'Autodebit Reksadana Saham & SBN [Memo: Alokasi investasi bulanan rutin]',
        transaction_date: d(7),
      },
      {
        user_id: user.id,
        account_id: cashAcc.id,
        category_id: getCat('Kesehatan & Medis'),
        type: 'expense',
        amount: 145000,
        currency: 'IDR',
        description: 'Apotek & Vitamin [Items: Multivitamin Komplit (Rp 95.000), Masker Medis Box (Rp 50.000)]',
        transaction_date: d(9),
      },

      // SGD Transactions
      {
        user_id: user.id,
        account_id: dbsAcc.id,
        category_id: getCat('Transportasi & Bensin'),
        type: 'expense',
        amount: 45,
        currency: 'SGD',
        description: 'MRT & Bus Transit Singapore [Memo: EZ-Link Card Monthly Reload]',
        transaction_date: d(2),
      },
      {
        user_id: user.id,
        account_id: dbsAcc.id,
        category_id: getCat('Makanan & Minuman'),
        type: 'expense',
        amount: 32.5,
        currency: 'SGD',
        description: 'Dinner at Hawker Center [Items: Hainanese Chicken Rice (S$ 8.50), Chili Crab Pau (S$ 18.00), Sugarcane Juice (S$ 6.00)]',
        transaction_date: d(4),
      },

      // USD Transactions
      {
        user_id: user.id,
        account_id: wiseAcc.id,
        category_id: getCat('Langganan & Digital'),
        type: 'expense',
        amount: 40,
        currency: 'USD',
        description: 'Developer SaaS Tools [Items: GitHub Copilot Subscription ($10.00), ChatGPT Plus ($20.00), Figma Pro ($10.00)]',
        transaction_date: d(3),
      },
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('transactions') as any).insert(demoTransactions)

    // 4. Create Cross-Currency Transfers with Snapshot Rates
    const demoTransfers = [
      {
        user_id: user.id,
        from_account_id: bcaAcc.id,
        to_account_id: dbsAcc.id,
        amount: 5925000,
        from_currency: 'IDR',
        to_currency: 'SGD',
        exchange_rate_used: 0.000084388,
        description: '[Tukar Valas: 1 IDR = 0.00008439 SGD | Terima: S$ 500.00]',
        transfer_date: d(6),
      },
      {
        user_id: user.id,
        from_account_id: wiseAcc.id,
        to_account_id: bcaAcc.id,
        amount: 250,
        from_currency: 'USD',
        to_currency: 'IDR',
        exchange_rate_used: 16200,
        description: '[Tukar Valas: 1 USD = 16.200 IDR | Terima: Rp 4.050.000]',
        transfer_date: d(8),
      },
      {
        user_id: user.id,
        from_account_id: bcaAcc.id,
        to_account_id: gopayAcc.id,
        amount: 500000,
        from_currency: 'IDR',
        to_currency: 'IDR',
        exchange_rate_used: 1,
        description: 'Top Up Saldo E-Wallet via BCA Mobile',
        transfer_date: d(2),
      },
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('transfers') as any).insert(demoTransfers)

    // 5. Create Active Category Budgets for Current Period
    const currentPeriodStr = `${yyyy}-${mm}-01`
    const demoBudgets = [
      {
        user_id: user.id,
        category_id: getCat('Makanan & Minuman'),
        amount: 2500000,
        period_start_date: currentPeriodStr,
      },
      {
        user_id: user.id,
        category_id: getCat('Belanja & Kebutuhan'),
        amount: 2000000,
        period_start_date: currentPeriodStr,
      },
      {
        user_id: user.id,
        category_id: getCat('Transportasi & Bensin'),
        amount: 1200000,
        period_start_date: currentPeriodStr,
      },
      {
        user_id: user.id,
        category_id: getCat('Tagihan & Utilitas'),
        amount: 1000000,
        period_start_date: currentPeriodStr,
      },
      {
        user_id: user.id,
        category_id: getCat('Langganan & Digital'),
        amount: 500000,
        period_start_date: currentPeriodStr,
      },
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('budgets') as any).upsert(demoBudgets, {
      onConflict: 'user_id,category_id,period_start_date',
    })

    // 6. Create Multi-Currency Debts & Receivables with Payment History
    const demoDebts = [
      {
        user_id: user.id,
        counterparty_name: 'Koperasi Kantor (Cicilan Laptop MacBook)',
        type: 'debt',
        initial_amount: 12000000,
        remaining_amount: 6000000,
        currency: 'IDR',
        status: 'active',
        due_date: `${yyyy}-12-31`,
        notes: 'Cicilan 6x @ Rp 2.000.000 per bulan',
      },
      {
        user_id: user.id,
        counterparty_name: 'Dimas (Talangan Tiket Konser & Hotel)',
        type: 'receivable',
        initial_amount: 2500000,
        remaining_amount: 1000000,
        currency: 'IDR',
        status: 'active',
        due_date: `${yyyy}-${mm}-28`,
        notes: 'Janji cicil 2x saat tanggal gajian',
      },
      {
        user_id: user.id,
        counterparty_name: 'Alex Tan (SG Project Downpayment)',
        type: 'receivable',
        initial_amount: 800,
        remaining_amount: 400,
        currency: 'SGD',
        status: 'active',
        due_date: `${yyyy}-${mm}-30`,
        notes: 'Remaining 50% milestone payment for web app design',
      },
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: createdDebts } = await (supabase.from('debts') as any).insert(demoDebts).select()

    if (createdDebts && createdDebts.length > 0) {
      // Add payment records
      const demoPayments = [
        {
          debt_id: createdDebts[0].id,
          amount: 3000000,
          payment_date: d(20),
        },
        {
          debt_id: createdDebts[0].id,
          amount: 3000000,
          payment_date: d(5),
        },
        {
          debt_id: createdDebts[1].id,
          amount: 1500000,
          payment_date: d(10),
        },
        {
          debt_id: createdDebts[2].id,
          amount: 400,
          payment_date: d(12),
        },
      ]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('debt_payments') as any).insert(demoPayments)
    }

    revalidatePath('/')
    revalidatePath('/transactions')
    revalidatePath('/accounts')
    revalidatePath('/budget')
    revalidatePath('/debts')
    revalidatePath('/net-worth')
    revalidatePath('/settings')

    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

export async function clearUserData(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    // Delete transactions, transfers, debts, budgets, accounts for this user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('transactions') as any).delete().eq('user_id', user.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('transfers') as any).delete().eq('user_id', user.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('debt_payments') as any).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('debts') as any).delete().eq('user_id', user.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('budgets') as any).delete().eq('user_id', user.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('accounts') as any).delete().eq('user_id', user.id)

    revalidatePath('/')
    revalidatePath('/transactions')
    revalidatePath('/accounts')
    revalidatePath('/budget')
    revalidatePath('/debts')
    revalidatePath('/net-worth')
    revalidatePath('/settings')

    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}
