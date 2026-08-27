'use server'

/**
 * ============================================================================
 * [DEPRECATED / NONAKTIF] DATA CONTOH & SEEDER DEMO
 * ============================================================================
 * Fitur demo seeder dan pengisian data contoh telah dinonaktifkan dan dihapus
 * dari antarmuka pengguna (UI Settings / Halaman Saham) sesuai permintaan.
 * Berkas ini dipertahankan sebagai referensi skema internal bila diperlukan.
 * ============================================================================
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { seedUserDefaultCategories } from '@/actions/categories'
import { getCanonicalCategoryName } from '@/lib/utils/category-i18n'
import { revalidatePath } from 'next/cache'

export async function seedDemoData(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    // 0. Automatically wipe out all previous demo/user data first
    await clearUserData()

    // 1. Ensure default categories exist and deduplicate
    await seedUserDefaultCategories(user.id)

    // Fetch existing categories
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: categories } = await (supabase.from('categories') as any)
      .select('*')
      .eq('user_id', user.id)

    // Build category map supporting English, Indonesian, and aliases
    const categoryLookup: Record<string, string> = {
      // Income
      'Salary': 'Salary',
      'Gaji': 'Salary',
      'Gaji Pokok': 'Salary',
      'Freelance & Side Gig': 'Freelance & Side Gig',
      'Freelance & Proyek': 'Freelance & Side Gig',
      'Freelance': 'Freelance & Side Gig',
      'Business & Sales': 'Business & Sales',
      'Bisnis': 'Business & Sales',
      'Investments & Dividends': 'Investments & Dividends',
      'Investasi & Dividen': 'Investments & Dividends',
      'Bunga Bank': 'Bunga Bank',
      'Reimbursement': 'Reimbursement',
      'Gifts & Grants': 'Gifts & Grants',
      'Hadiah': 'Gifts & Grants',
      'Other Income': 'Other Income',
      'Pemasukan Lainnya': 'Other Income',

      // Expense
      'Food & Drinks': 'Food & Drinks',
      'Makanan & Minuman': 'Food & Drinks',
      'Makanan': 'Food & Drinks',
      'Groceries': 'Groceries',
      'Belanja & Kebutuhan': 'Groceries',
      'Belanja Bulanan': 'Groceries',
      'Transportation': 'Transportation',
      'Transportasi & Bensin': 'Transportation',
      'Transportasi': 'Transportation',
      'Shopping': 'Shopping',
      'Belanja': 'Shopping',
      'Bills & Utilities': 'Bills & Utilities',
      'Tagihan & Utilitas': 'Bills & Utilities',
      'Tagihan': 'Bills & Utilities',
      'Housing': 'Housing',
      'Tempat Tinggal': 'Housing',
      'Entertainment': 'Entertainment',
      'Hiburan & Rekreasi': 'Entertainment',
      'Hiburan': 'Entertainment',
      'Langganan & Digital': 'Entertainment',
      'Game': 'Game',
      'Travel': 'Travel',
      'Liburan': 'Travel',
      'Health & Medical': 'Health & Medical',
      'Kesehatan & Medis': 'Health & Medical',
      'Education': 'Education',
      'Pendidikan': 'Education',
      'Personal Care': 'Personal Care',
      'Perawatan Diri': 'Personal Care',
      'Giving': 'Giving',
      'Donasi & Amal': 'Giving',
      'Transfer Fee': 'Transfer Fee',
      'Investment': 'Investment',
      'Investasi': 'Investment',
      'Loan & Debt': 'Loan & Debt',
      'Pinjaman & Utang': 'Loan & Debt',
      'Savings': 'Savings',
      'Tabungan': 'Savings',
      'Family & Kids': 'Family & Kids',
      'Other Expense': 'Other Expense',
      'Pengeluaran Lainnya': 'Other Expense',
    }

    const getCat = (name: string, type: 'income' | 'expense' = 'expense') => {
      const canonical = categoryLookup[name] || name
      const found = (categories || []).find((c: any) => c.name.toLowerCase() === canonical.toLowerCase() && c.type === type)
        || (categories || []).find((c: any) => c.name.toLowerCase() === canonical.toLowerCase())
        || (categories || []).find((c: any) => c.type === type && c.name !== 'Discrepancy')
        || categories?.[0]
      return found?.id || ''
    }

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
      {
        name: 'RDN Mandiri Sekuritas',
        type: 'investment',
        currency: 'IDR',
        initial_balance: 25000000,
        current_balance: 15100000,
        icon: 'TrendingUp',
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
    const rdnAcc = createdAccounts.find((a: { name: string }) => a.name === 'RDN Mandiri Sekuritas') || createdAccounts[6]

    // 3. Create Sample Rich Transactions (with sub-items, memos, tags, and multi-currency)
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')

    const d = (dayOffset: number) => {
      const target = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000)
      return target.toISOString()
    }

    const dDate = (dayOffset: number) => {
      const target = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000)
      return target.toISOString().split('T')[0]
    }

    const futureDate = (dayOffset: number) => {
      const target = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000)
      return target.toISOString().split('T')[0]
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
        tags: ['payroll', 'gajian'],
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
        tags: ['freelance', 'client-sg', 'proyek-a'],
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
        tags: ['freelance', 'usd-income'],
        transaction_date: d(5),
      },

      // Expenses with Sub-items, Memos & Tags (IDR)
      {
        user_id: user.id,
        account_id: bcaAcc.id,
        category_id: getCat('Belanja & Kebutuhan'),
        type: 'expense',
        amount: 322000,
        currency: 'IDR',
        description: 'Belanja Bulanan Supermarket [Memo: Stok bahan dapur & cemilan] [Items: Beras Premium 5kg (Rp 75.000), Daging Sapi Slice (Rp 120.000), Minyak Goreng 2L (Rp 35.000), Susu UHT 1L (Rp 22.000), Buah Apel Fuji (Rp 45.000), Telur Ayam 1kg (Rp 25.000)]',
        tags: ['kebutuhan-rumah', 'groceries'],
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
        tags: ['kuliner', 'lunch'],
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
        tags: ['kuliner', 'coffee'],
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
        tags: ['transport', 'bensin'],
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
        tags: ['tagihan', 'utilitas'],
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
        tags: ['langganan', 'streaming'],
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
        tags: ['investasi-rutin', 'dana-darurat'],
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
        tags: ['health-wellness'],
        transaction_date: d(9),
      },

      // Travel & Lifestyle with Tags
      {
        user_id: user.id,
        account_id: bcaAcc.id,
        category_id: getCat('Hiburan & Rekreasi'),
        type: 'expense',
        amount: 1250000,
        currency: 'IDR',
        description: 'Tiket Pesawat & Penginapan Liburan [Memo: Liburan akhir pekan di Bali] [Items: Tiket Pesawat Return (Rp 850.000), Hotel 2 Malam (Rp 400.000)]',
        tags: ['liburan', 'bali', 'weekend'],
        transaction_date: d(12),
      },
      {
        user_id: user.id,
        account_id: mandiriAcc.id,
        category_id: getCat('Belanja & Kebutuhan'),
        type: 'expense',
        amount: 1850000,
        currency: 'IDR',
        description: 'Upgrade Setup Meja Kerja [Items: Monitor Arm Dual (Rp 650.000), Mechanical Keyboard Wireless (Rp 1.200.000)]',
        tags: ['gadget', 'setup-desk', 'proyek-a'],
        transaction_date: d(14),
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
        tags: ['transit-sg'],
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
        tags: ['kuliner', 'singapore'],
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
        tags: ['saas', 'developer-tools'],
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
        due_date: futureDate(12),
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
        due_date: futureDate(5),
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
        due_date: futureDate(18),
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

    // 7. Create Recurring Transactions & Subscriptions (Phase 2 Feature)
    const demoRecurring = [
      {
        user_id: user.id,
        name: 'Indihome Fiber 100Mbps',
        type: 'expense',
        amount: 375000,
        currency: 'IDR',
        account_id: bcaAcc.id,
        category_id: getCat('Tagihan & Utilitas'),
        frequency: 'monthly',
        interval_count: 1,
        start_date: dDate(60),
        next_due_date: futureDate(3),
        is_active: true,
        auto_process: false,
        notes: 'Paket Internet Rumah Kecepatan Tinggi',
      },
      {
        user_id: user.id,
        name: 'Netflix Premium 4K UHD',
        type: 'expense',
        amount: 186000,
        currency: 'IDR',
        account_id: gopayAcc.id,
        category_id: getCat('Langganan & Digital'),
        frequency: 'monthly',
        interval_count: 1,
        start_date: dDate(90),
        next_due_date: futureDate(5),
        is_active: true,
        auto_process: true,
        notes: 'Langganan Streaming Keluarga',
      },
      {
        user_id: user.id,
        name: 'Spotify Family Plan',
        type: 'expense',
        amount: 86900,
        currency: 'IDR',
        account_id: bcaAcc.id,
        category_id: getCat('Langganan & Digital'),
        frequency: 'monthly',
        interval_count: 1,
        start_date: dDate(120),
        next_due_date: futureDate(11),
        is_active: true,
        auto_process: true,
        notes: 'Streaming Musik Tanpa Iklan',
      },
      {
        user_id: user.id,
        name: 'Fitness First Gym Membership',
        type: 'expense',
        amount: 750000,
        currency: 'IDR',
        account_id: bcaAcc.id,
        category_id: getCat('Kesehatan & Medis'),
        frequency: 'monthly',
        interval_count: 1,
        start_date: dDate(45),
        next_due_date: futureDate(16),
        is_active: true,
        auto_process: false,
        notes: 'Keanggotaan Gym Bulanan',
      },
      {
        user_id: user.id,
        name: 'GitHub Copilot & Figma Pro',
        type: 'expense',
        amount: 30,
        currency: 'USD',
        account_id: wiseAcc.id,
        category_id: getCat('Langganan & Digital'),
        frequency: 'monthly',
        interval_count: 1,
        start_date: dDate(30),
        next_due_date: futureDate(7),
        is_active: true,
        auto_process: true,
        notes: 'Langganan Tool Developer',
      },
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('recurring_transactions') as any).insert(demoRecurring)

    // 8. Create Savings Goals & Deposits History (Phase 3 Feature)
    const demoGoals = [
      {
        user_id: user.id,
        name: 'Dana Darurat 6 Bulan',
        target_amount: 30000000,
        current_amount: 18500000,
        currency: 'IDR',
        target_date: futureDate(120),
        category_id: null,
        icon: 'ShieldCheck',
        color: '#0D9488',
        status: 'in_progress',
        notes: 'Target cadangan biaya hidup 6 bulan ke depan',
      },
      {
        user_id: user.id,
        name: 'MacBook Pro M3 Max Workstation',
        target_amount: 36000000,
        current_amount: 24000000,
        currency: 'IDR',
        target_date: futureDate(45),
        category_id: null,
        icon: 'Laptop',
        color: '#3B82F6',
        status: 'in_progress',
        notes: 'Upgrade perangkat kerja untuk editing video & software development',
      },
      {
        user_id: user.id,
        name: 'Liburan Musim Semi Jepang',
        target_amount: 22000000,
        current_amount: 22000000,
        currency: 'IDR',
        target_date: futureDate(15),
        category_id: null,
        icon: 'Plane',
        color: '#E11D48',
        status: 'completed',
        notes: 'Tabungan tiket & akomodasi liburan Tokyo-Kyoto',
      },
      {
        user_id: user.id,
        name: 'Upgrade Kamera Sony A7 IV',
        target_amount: 28000000,
        current_amount: 7000000,
        currency: 'IDR',
        target_date: futureDate(210),
        category_id: null,
        icon: 'Camera',
        color: '#F59E0B',
        status: 'paused',
        notes: 'Ditunda sementara menunggu proyek baru',
      },
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: createdGoals } = await (supabase.from('savings_goals') as any).insert(demoGoals).select()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let demoDeposits: any[] = []

    if (createdGoals && createdGoals.length > 0) {
      const emergencyGoal = createdGoals.find((g: { name: string }) => g.name === 'Dana Darurat 6 Bulan') || createdGoals[0]
      const macbookGoal = createdGoals.find((g: { name: string }) => g.name === 'MacBook Pro M3 Max Workstation') || createdGoals[1]
      const japanGoal = createdGoals.find((g: { name: string }) => g.name === 'Liburan Musim Semi Jepang') || createdGoals[2]
      const cameraGoal = createdGoals.find((g: { name: string }) => g.name === 'Upgrade Kamera Sony A7 IV') || createdGoals[3]

      demoDeposits = [
        // Emergency fund deposits
        {
          user_id: user.id,
          goal_id: emergencyGoal.id,
          account_id: bcaAcc.id,
          type: 'deposit',
          amount: 10000000,
          currency: 'IDR',
          deposit_date: dDate(25),
          notes: 'Alokasi awal dana darurat dari bonus',
        },
        {
          user_id: user.id,
          goal_id: emergencyGoal.id,
          account_id: mandiriAcc.id,
          type: 'deposit',
          amount: 5000000,
          currency: 'IDR',
          deposit_date: dDate(15),
          notes: 'Hasil freelance website',
        },
        {
          user_id: user.id,
          goal_id: emergencyGoal.id,
          account_id: bcaAcc.id,
          type: 'deposit',
          amount: 3500000,
          currency: 'IDR',
          deposit_date: dDate(5),
          notes: 'Setoran rutin bulanan',
        },

        // MacBook goal deposits
        {
          user_id: user.id,
          goal_id: macbookGoal.id,
          account_id: mandiriAcc.id,
          type: 'deposit',
          amount: 15000000,
          currency: 'IDR',
          deposit_date: dDate(20),
          notes: 'DP dari project overseas client',
        },
        {
          user_id: user.id,
          goal_id: macbookGoal.id,
          account_id: bcaAcc.id,
          type: 'deposit',
          amount: 9000000,
          currency: 'IDR',
          deposit_date: dDate(8),
          notes: 'Alokasi tabungan bulanan',
        },

        // Japan goal deposits (100% completed)
        {
          user_id: user.id,
          goal_id: japanGoal.id,
          account_id: bcaAcc.id,
          type: 'deposit',
          amount: 10000000,
          currency: 'IDR',
          deposit_date: dDate(35),
          notes: 'Tabungan awal tiket pesawat',
        },
        {
          user_id: user.id,
          goal_id: japanGoal.id,
          account_id: bcaAcc.id,
          type: 'deposit',
          amount: 7000000,
          currency: 'IDR',
          deposit_date: dDate(22),
          notes: 'Tabungan hotel & akomodasi',
        },
        {
          user_id: user.id,
          goal_id: japanGoal.id,
          account_id: mandiriAcc.id,
          type: 'deposit',
          amount: 5000000,
          currency: 'IDR',
          deposit_date: dDate(4),
          notes: 'Pelunasan target liburan (100%)',
        },

        // Camera goal deposit
        {
          user_id: user.id,
          goal_id: cameraGoal.id,
          account_id: bcaAcc.id,
          type: 'deposit',
          amount: 7000000,
          currency: 'IDR',
          deposit_date: dDate(18),
          notes: 'Hasil penjualan lensa lama',
        },
      ]

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('savings_goal_deposits') as any).insert(demoDeposits)
    }

    // 8. Create Realistic Stock Holdings & Trade Logs (RDN)
    if (rdnAcc) {
      const demoHoldings = [
        {
          user_id: user.id,
          account_id: rdnAcc.id,
          ticker: 'BBCA',
          total_cost: 6500000,
          notes: 'DCA Core Bluechip Banking',
        },
        {
          user_id: user.id,
          account_id: rdnAcc.id,
          ticker: 'BBRI',
          total_cost: 3750000,
          notes: 'Dividen Play 2026',
        },
      ]

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('stock_holdings') as any).insert(demoHoldings)

      const demoTrades = [
        {
          user_id: user.id,
          account_id: rdnAcc.id,
          ticker: 'BBCA',
          type: 'buy',
          net_amount: 6500000,
          realized_pnl: null,
          notes: 'Beli BBCA 6.500.000 (bersih + fee broker)',
          trade_date: dDate(12),
        },
        {
          user_id: user.id,
          account_id: rdnAcc.id,
          ticker: 'BBRI',
          type: 'buy',
          net_amount: 3750000,
          realized_pnl: null,
          notes: 'Beli BBRI 3.750.000 (bersih + fee broker)',
          trade_date: dDate(8),
        },
        {
          user_id: user.id,
          account_id: rdnAcc.id,
          ticker: 'TLKM',
          type: 'buy',
          net_amount: 2500000,
          realized_pnl: null,
          notes: 'Beli swing entry (bersih + fee broker)',
          trade_date: dDate(20),
        },
        {
          user_id: user.id,
          account_id: rdnAcc.id,
          ticker: 'TLKM',
          type: 'sell',
          net_amount: 2850000,
          realized_pnl: 350000,
          notes: 'Take profit +14.0% Cuan (bersih setelah fee broker)',
          trade_date: dDate(3),
        },
      ]

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('stock_trades') as any).insert(demoTrades)
    }

    // 9. Reconcile and calculate exact mathematically accurate account balances
    for (const acc of createdAccounts) {
      let balance = Number(acc.initial_balance) || 0

      // Transactions
      demoTransactions.forEach((tx) => {
        if (tx.account_id === acc.id) {
          if (tx.type === 'income') balance += Number(tx.amount)
          else balance -= Number(tx.amount)
        }
      })

      // Transfers
      demoTransfers.forEach((tr) => {
        if (tr.from_account_id === acc.id) {
          balance -= Number(tr.amount)
        }
        if (tr.to_account_id === acc.id) {
          if (tr.from_currency !== tr.to_currency && tr.exchange_rate_used) {
            balance += Number(tr.amount) * Number(tr.exchange_rate_used)
          } else {
            balance += Number(tr.amount)
          }
        }
      })

      // Goal Deposits
      if (createdGoals && createdGoals.length > 0) {
        demoDeposits.forEach((dep) => {
          if (dep.account_id === acc.id) {
            if (dep.type === 'deposit') balance -= Number(dep.amount)
            else balance += Number(dep.amount)
          }
        })
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('accounts') as any)
        .update({ current_balance: balance })
        .eq('id', acc.id)
    }

    // Revalidate all pages across the app
    revalidatePath('/')
    revalidatePath('/transactions')
    revalidatePath('/accounts')
    revalidatePath('/budget')
    revalidatePath('/debts')
    revalidatePath('/recurring')
    revalidatePath('/goals')
    revalidatePath('/investments')
    revalidatePath('/reports')
    revalidatePath('/audit-log')
    revalidatePath('/net-worth')
    revalidatePath('/settings')

    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Standalone action to generate realistic stock test data for current user
 */
export async function seedStockTestData(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  try {
    // 1. Find or create an investment (RDN) account
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { data: rdnAcc } = await (supabase.from('accounts') as any)
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'investment')
      .eq('is_active', true)
      .maybeSingle()

    if (!rdnAcc) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newRdn, error: rdnErr } = await (supabase.from('accounts') as any)
        .insert({
          user_id: user.id,
          name: 'RDN Mandiri Sekuritas',
          type: 'investment',
          currency: 'IDR',
          initial_balance: 25000000,
          current_balance: 15100000,
          icon: 'TrendingUp',
          is_active: true,
        })
        .select()
        .single()

      if (rdnErr || !newRdn) {
        return { success: false, error: rdnErr?.message || 'Gagal membuat akun RDN' }
      }
      rdnAcc = newRdn
    }

    // Clear existing stock data for clean seed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('stock_trades') as any).delete().eq('user_id', user.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('stock_holdings') as any).delete().eq('user_id', user.id)

    // Insert sample holdings
    const demoHoldings = [
      {
        user_id: user.id,
        account_id: rdnAcc.id,
        ticker: 'BBCA',
        total_cost: 6500000,
        notes: 'DCA Core Bluechip Banking',
      },
      {
        user_id: user.id,
        account_id: rdnAcc.id,
        ticker: 'BBRI',
        total_cost: 3750000,
        notes: 'Dividen Play 2026',
      },
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('stock_holdings') as any).insert(demoHoldings)

    const now = new Date()
    const dDate = (dayOffset: number) => {
      const target = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000)
      return target.toISOString().split('T')[0]
    }

    // Insert sample trades
    const demoTrades = [
      {
        user_id: user.id,
        account_id: rdnAcc.id,
        ticker: 'BBCA',
        type: 'buy',
        net_amount: 6500000,
        realized_pnl: null,
        notes: 'Beli BBCA 6.500.000 (bersih + fee broker)',
        trade_date: dDate(12),
      },
      {
        user_id: user.id,
        account_id: rdnAcc.id,
        ticker: 'BBRI',
        type: 'buy',
        net_amount: 3750000,
        realized_pnl: null,
        notes: 'Beli BBRI 3.750.000 (bersih + fee broker)',
        trade_date: dDate(8),
      },
      {
        user_id: user.id,
        account_id: rdnAcc.id,
        ticker: 'TLKM',
        type: 'buy',
        net_amount: 2500000,
        realized_pnl: null,
        notes: 'Beli swing entry (bersih + fee broker)',
        trade_date: dDate(20),
      },
      {
        user_id: user.id,
        account_id: rdnAcc.id,
        ticker: 'TLKM',
        type: 'sell',
        net_amount: 2850000,
        realized_pnl: 350000,
        notes: 'Take profit +14.0% Cuan (bersih setelah fee broker)',
        trade_date: dDate(3),
      },
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('stock_trades') as any).insert(demoTrades)

    revalidatePath('/investments')
    revalidatePath('/accounts')
    revalidatePath('/net-worth')
    revalidatePath('/audit-log')

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
    // Delete all user data in foreign-key safe order
    // 0. Stock trades & stock holdings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('stock_trades') as any).delete().eq('user_id', user.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('stock_holdings') as any).delete().eq('user_id', user.id)

    // 1. Savings goal deposits & savings goals
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: errDeposits } = await (supabase.from('savings_goal_deposits') as any).delete().eq('user_id', user.id)
    if (errDeposits) console.warn('Error clearing deposits:', errDeposits)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: errGoals } = await (supabase.from('savings_goals') as any).delete().eq('user_id', user.id)
    if (errGoals) console.warn('Error clearing goals:', errGoals)

    // 2. Recurring transactions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: errRecurring } = await (supabase.from('recurring_transactions') as any).delete().eq('user_id', user.id)
    if (errRecurring) console.warn('Error clearing recurring:', errRecurring)

    // 3. Debt payments & debts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userDebts } = await (supabase.from('debts') as any).select('id').eq('user_id', user.id)
    if (userDebts && userDebts.length > 0) {
      const debtIds = userDebts.map((d: { id: string }) => d.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('debt_payments') as any).delete().in('debt_id', debtIds)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: errDebts } = await (supabase.from('debts') as any).delete().eq('user_id', user.id)
    if (errDebts) console.warn('Error clearing debts:', errDebts)

    // 4. Transfers & transactions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: errTransfers } = await (supabase.from('transfers') as any).delete().eq('user_id', user.id)
    if (errTransfers) console.warn('Error clearing transfers:', errTransfers)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: errTx } = await (supabase.from('transactions') as any).delete().eq('user_id', user.id)
    if (errTx) {
      console.error('Error clearing transactions:', errTx)
      return { success: false, error: `Gagal menghapus transaksi: ${errTx.message}` }
    }

    // 5. Budgets & accounts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: errBudgets } = await (supabase.from('budgets') as any).delete().eq('user_id', user.id)
    if (errBudgets) console.warn('Error clearing budgets:', errBudgets)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: errAccounts } = await (supabase.from('accounts') as any).delete().eq('user_id', user.id)
    if (errAccounts) {
      console.error('Error clearing accounts:', errAccounts)
      return { success: false, error: `Gagal menghapus akun: ${errAccounts.message}` }
    }

    // Revalidate all pages
    revalidatePath('/')
    revalidatePath('/transactions')
    revalidatePath('/accounts')
    revalidatePath('/budget')
    revalidatePath('/debts')
    revalidatePath('/recurring')
    revalidatePath('/goals')
    revalidatePath('/reports')
    revalidatePath('/audit-log')
    revalidatePath('/net-worth')
    revalidatePath('/settings')

    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}
