import { AuditLog } from '@/types/database'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import { getCleanDescription } from '@/lib/utils/description'

export interface HumanizedAuditLog {
  title: string
  summary: string
  changes: Array<{ field: string; from?: string; to?: string }>
  badgeType: 'create' | 'update' | 'delete'
  badgeLabel: string
  moduleName: string
}

export function humanizeAuditLog(log: AuditLog, lang: 'id' | 'en' = 'id'): HumanizedAuditLog {
  const isId = lang === 'id'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oldVal = (log.old_values || {}) as Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newVal = (log.new_values || {}) as Record<string, any>
  const table = log.table_name

  // ==========================================
  // 1. TRANSFERS
  // ==========================================
  if (table === 'transfers') {
    const fromCur = newVal.from_currency || oldVal.from_currency || 'IDR'
    const toCur = newVal.to_currency || oldVal.to_currency || fromCur
    const amt = newVal.amount || oldVal.amount || 0
    const formattedAmt = formatCurrency(Number(amt), fromCur)
    const rate = newVal.exchange_rate_used || oldVal.exchange_rate_used

    if (log.action === 'INSERT') {
      return {
        moduleName: isId ? 'Transfer' : 'Transfer',
        title: `${formattedAmt} (${fromCur} → ${toCur})`,
        summary: isId
          ? `Mencatat transfer saldo senilai ${formattedAmt} (${fromCur} → ${toCur})`
          : `Recorded fund transfer of ${formattedAmt} (${fromCur} → ${toCur})`,
        changes: [
          { field: isId ? 'Nominal Transfer' : 'Transfer Amount', to: formattedAmt },
          ...(rate && rate !== 1 ? [{ field: isId ? 'Kurs Digunakan' : 'Exchange Rate Used', to: `1 ${fromCur} = ${rate} ${toCur}` }] : []),
          ...(newVal.transfer_date ? [{ field: isId ? 'Tanggal Transfer' : 'Date', to: formatDate(newVal.transfer_date, 'd MMM yyyy', lang) }] : []),
        ],
        badgeType: 'create',
        badgeLabel: isId ? 'Dibuat' : 'Created',
      }
    }

    if (log.action === 'DELETE') {
      return {
        moduleName: isId ? 'Transfer' : 'Transfer',
        title: `${formattedAmt}`,
        summary: isId
          ? `Menghapus catatan transfer dana sebesar ${formattedAmt}`
          : `Deleted fund transfer record of ${formattedAmt}`,
        changes: [
          { field: isId ? 'Nominal Dibatalkan' : 'Cancelled Amount', from: formattedAmt },
        ],
        badgeType: 'delete',
        badgeLabel: isId ? 'Dihapus' : 'Deleted',
      }
    }
  }

  // ==========================================
  // 2. DEBTS (Hutang & Piutang)
  // ==========================================
  if (table === 'debts') {
    const cur = newVal.currency || oldVal.currency || 'IDR'
    const debtType = newVal.type || oldVal.type
    const person = newVal.counterparty_name || oldVal.counterparty_name || (isId ? 'Pihak Lain' : 'Counterparty')
    const isDebt = debtType === 'debt' || debtType === 'payable'
    const typeText = isDebt
      ? (isId ? 'Hutang' : 'Debt')
      : (isId ? 'Piutang' : 'Receivable')
    const initAmt = formatCurrency(Number(newVal.initial_amount || oldVal.initial_amount || 0), cur)

    if (log.action === 'INSERT') {
      return {
        moduleName: isId ? 'Hutang Piutang' : 'Debts & Loans',
        title: `${person} • ${initAmt} (${typeText})`,
        summary: isId
          ? `Mencatat ${typeText.toLowerCase()} ${person} sebesar ${initAmt}`
          : `Created ${typeText.toLowerCase()} with ${person} for ${initAmt}`,
        changes: [
          { field: isId ? 'Pihak Terkait' : 'Person', to: person },
          { field: isId ? 'Nominal Awal' : 'Initial Amount', to: initAmt },
          ...(newVal.due_date ? [{ field: isId ? 'Tenggat Waktu' : 'Due Date', to: formatDate(newVal.due_date, 'd MMM yyyy', lang) }] : []),
        ],
        badgeType: 'create',
        badgeLabel: isId ? 'Dibuat' : 'Created',
      }
    }

    if (log.action === 'DELETE') {
      return {
        moduleName: isId ? 'Hutang Piutang' : 'Debts & Loans',
        title: `${person} • ${initAmt} (${typeText})`,
        summary: isId
          ? `Menghapus catatan ${typeText.toLowerCase()} ${person} (${initAmt})`
          : `Deleted ${typeText.toLowerCase()} record of ${person} (${initAmt})`,
        changes: [
          { field: isId ? 'Pihak Terkait' : 'Person', from: person },
          { field: isId ? 'Nominal' : 'Amount', from: initAmt },
        ],
        badgeType: 'delete',
        badgeLabel: isId ? 'Dihapus' : 'Deleted',
      }
    }

    // UPDATE debt
    const debtChanges: Array<{ field: string; from?: string; to?: string }> = []
    if (oldVal.counterparty_name !== newVal.counterparty_name && (oldVal.counterparty_name || newVal.counterparty_name)) {
      debtChanges.push({
        field: isId ? 'Pihak Terkait' : 'Person',
        from: oldVal.counterparty_name || '-',
        to: newVal.counterparty_name || '-',
      })
    }
    if (oldVal.status !== newVal.status && (oldVal.status || newVal.status)) {
      debtChanges.push({
        field: isId ? 'Status Pelunasan' : 'Status',
        from: oldVal.status,
        to: newVal.status,
      })
    }
    if (oldVal.remaining_amount !== newVal.remaining_amount) {
      debtChanges.push({
        field: isId ? 'Sisa Tagihan' : 'Remaining Balance',
        from: formatCurrency(Number(oldVal.remaining_amount || 0), cur),
        to: formatCurrency(Number(newVal.remaining_amount || 0), cur),
      })
    }
    if (oldVal.due_date !== newVal.due_date && (oldVal.due_date || newVal.due_date)) {
      debtChanges.push({
        field: isId ? 'Tenggat Waktu' : 'Due Date',
        from: oldVal.due_date ? formatDate(oldVal.due_date, 'd MMM yyyy', lang) : (isId ? '(Tanpa Tenggat)' : '(No Due Date)'),
        to: newVal.due_date ? formatDate(newVal.due_date, 'd MMM yyyy', lang) : (isId ? '(Tanpa Tenggat)' : '(No Due Date)'),
      })
    }
    if (oldVal.notes !== newVal.notes && (oldVal.notes || newVal.notes)) {
      debtChanges.push({
        field: isId ? 'Catatan' : 'Notes',
        from: oldVal.notes || (isId ? '(Kosong)' : '(Empty)'),
        to: newVal.notes || (isId ? '(Kosong)' : '(Empty)'),
      })
    }

    return {
      moduleName: isId ? 'Hutang Piutang' : 'Debts & Loans',
      title: `${person} • ${typeText}`,
      summary: isId
        ? `Memperbarui status / rincian ${typeText.toLowerCase()} ${person}`
        : `Updated ${typeText.toLowerCase()} details with ${person}`,
      changes: debtChanges,
      badgeType: 'update',
      badgeLabel: isId ? 'Diubah' : 'Updated',
    }
  }

  // ==========================================
  // 3. DEBT PAYMENTS (Pembayaran Cicilan)
  // ==========================================
  if (table === 'debt_payments') {
    const cur = newVal.currency || oldVal.currency || 'IDR'
    const amt = formatCurrency(Number(newVal.amount || oldVal.amount || 0), cur)

    if (log.action === 'INSERT') {
      return {
        moduleName: isId ? 'Cicilan' : 'Payments',
        title: `${amt}`,
        summary: isId
          ? `Mencatat pembayaran cicilan sebesar ${amt}`
          : `Recorded installment payment of ${amt}`,
        changes: [
          { field: isId ? 'Nominal Pembayaran' : 'Payment Amount', to: amt },
          ...(newVal.payment_date ? [{ field: isId ? 'Tanggal Bayar' : 'Payment Date', to: formatDate(newVal.payment_date, 'd MMM yyyy', lang) }] : []),
          ...(newVal.notes ? [{ field: isId ? 'Catatan' : 'Notes', to: newVal.notes }] : []),
        ],
        badgeType: 'create',
        badgeLabel: isId ? 'Dibuat' : 'Created',
      }
    }

    if (log.action === 'DELETE') {
      return {
        moduleName: isId ? 'Cicilan' : 'Payments',
        title: `${amt}`,
        summary: isId
          ? `Menghapus riwayat pembayaran cicilan sebesar ${amt}`
          : `Deleted installment payment record of ${amt}`,
        changes: [
          { field: isId ? 'Nominal Dihapus' : 'Deleted Amount', from: amt },
        ],
        badgeType: 'delete',
        badgeLabel: isId ? 'Dihapus' : 'Deleted',
      }
    }
  }

  // ==========================================
  // 4. ACCOUNTS (Rekening / Dompet)
  // ==========================================
  if (table === 'accounts') {
    const accName = newVal.name || oldVal.name || (isId ? 'Akun' : 'Account')
    const cur = newVal.currency || oldVal.currency || 'IDR'
    const accType = newVal.type || oldVal.type || 'bank'

    if (log.action === 'INSERT') {
      const initBal = formatCurrency(Number(newVal.initial_balance || 0), cur)
      return {
        moduleName: isId ? 'Rekening' : 'Accounts',
        title: `${accName} (${cur})`,
        summary: isId
          ? `Membuat akun baru "${accName}" (${cur}) dengan saldo awal ${initBal}`
          : `Created account "${accName}" (${cur}) with starting balance of ${initBal}`,
        changes: [
          { field: isId ? 'Nama Akun' : 'Account Name', to: accName },
          { field: isId ? 'Tipe' : 'Type', to: accType },
          { field: isId ? 'Mata Uang' : 'Currency', to: cur },
          { field: isId ? 'Saldo Awal' : 'Initial Balance', to: initBal },
        ],
        badgeType: 'create',
        badgeLabel: isId ? 'Dibuat' : 'Created',
      }
    }

    if (log.action === 'DELETE') {
      return {
        moduleName: isId ? 'Rekening' : 'Accounts',
        title: `${accName} (${cur})`,
        summary: isId
          ? `Menghapus akun "${accName}" (${cur})`
          : `Deleted account "${accName}" (${cur})`,
        changes: [
          { field: isId ? 'Nama Akun Dihapus' : 'Deleted Account', from: accName },
        ],
        badgeType: 'delete',
        badgeLabel: isId ? 'Dihapus' : 'Deleted',
      }
    }

    // UPDATE account
    const accChanges: Array<{ field: string; from?: string; to?: string }> = []
    if (oldVal.name !== newVal.name && (oldVal.name || newVal.name)) {
      accChanges.push({ field: isId ? 'Nama Akun' : 'Account Name', from: oldVal.name, to: newVal.name })
    }
    if (oldVal.type !== newVal.type && (oldVal.type || newVal.type)) {
      accChanges.push({ field: isId ? 'Tipe Akun' : 'Account Type', from: oldVal.type, to: newVal.type })
    }

    return {
      moduleName: isId ? 'Rekening' : 'Accounts',
      title: `${accName}`,
      summary: isId
        ? `Memperbarui detail informasi akun "${accName}"`
        : `Updated details for account "${accName}"`,
      changes: accChanges,
      badgeType: 'update',
      badgeLabel: isId ? 'Diubah' : 'Updated',
    }
  }

  // ==========================================
  // 5. BUDGETS (Batas Anggaran)
  // ==========================================
  if (table === 'budgets') {
    const cur = newVal.currency || oldVal.currency || 'IDR'
    const amt = formatCurrency(Number(newVal.amount || oldVal.amount || 0), cur)
    const period = newVal.period_start_date || oldVal.period_start_date

    if (log.action === 'INSERT') {
      return {
        moduleName: isId ? 'Anggaran' : 'Budgets',
        title: `${amt} (${cur})`,
        summary: isId
          ? `Menetapkan batas anggaran bulanan sebesar ${amt} (${cur})`
          : `Set monthly budget ceiling of ${amt} (${cur})`,
        changes: [
          { field: isId ? 'Batas Anggaran' : 'Budget Limit', to: amt },
          { field: isId ? 'Mata Uang' : 'Currency', to: cur },
          ...(period ? [{ field: isId ? 'Periode' : 'Period', to: formatDate(period, 'MMMM yyyy', lang) }] : []),
        ],
        badgeType: 'create',
        badgeLabel: isId ? 'Dibuat' : 'Created',
      }
    }

    if (log.action === 'DELETE') {
      return {
        moduleName: isId ? 'Anggaran' : 'Budgets',
        title: `${amt}`,
        summary: isId
          ? `Menghapus batas anggaran senilai ${amt}`
          : `Removed budget limit of ${amt}`,
        changes: [
          { field: isId ? 'Batas Dihapus' : 'Removed Limit', from: amt },
        ],
        badgeType: 'delete',
        badgeLabel: isId ? 'Dihapus' : 'Deleted',
      }
    }

    // UPDATE budget
    const oldAmt = formatCurrency(Number(oldVal.amount || 0), oldVal.currency || 'IDR')
    const newAmt = formatCurrency(Number(newVal.amount || 0), newVal.currency || 'IDR')
    return {
      moduleName: isId ? 'Anggaran' : 'Budgets',
      title: `${newAmt}`,
      summary: isId
        ? `Mengubah batas anggaran dari ${oldAmt} menjadi ${newAmt}`
        : `Changed budget limit from ${oldAmt} to ${newAmt}`,
      changes: [
        { field: isId ? 'Batas Anggaran' : 'Budget Limit', from: oldAmt, to: newAmt },
      ],
      badgeType: 'update',
      badgeLabel: isId ? 'Diubah' : 'Updated',
    }
  }

  // ==========================================
  // 6. CATEGORIES (Kategori)
  // ==========================================
  if (table === 'categories') {
    const catName = newVal.name || oldVal.name || (isId ? 'Kategori' : 'Category')
    const catType = newVal.type || oldVal.type
    const typeLabel = catType === 'income' ? (isId ? 'Pemasukan' : 'Income') : (isId ? 'Pengeluaran' : 'Expense')

    if (log.action === 'INSERT') {
      return {
        moduleName: isId ? 'Kategori' : 'Categories',
        title: `${catName} (${typeLabel})`,
        summary: isId
          ? `Menambahkan kategori ${typeLabel.toLowerCase()} "${catName}"`
          : `Added ${typeLabel.toLowerCase()} category "${catName}"`,
        changes: [
          { field: isId ? 'Nama Kategori' : 'Category Name', to: catName },
          { field: isId ? 'Tipe' : 'Type', to: typeLabel },
        ],
        badgeType: 'create',
        badgeLabel: isId ? 'Dibuat' : 'Created',
      }
    }

    if (log.action === 'DELETE') {
      return {
        moduleName: isId ? 'Kategori' : 'Categories',
        title: `${catName}`,
        summary: isId
          ? `Menghapus kategori "${catName}"`
          : `Deleted category "${catName}"`,
        changes: [
          { field: isId ? 'Kategori Dihapus' : 'Deleted Category', from: catName },
        ],
        badgeType: 'delete',
        badgeLabel: isId ? 'Dihapus' : 'Deleted',
      }
    }

    return {
      moduleName: isId ? 'Kategori' : 'Categories',
      title: `${catName}`,
      summary: isId
        ? `Memperbarui kategori "${catName}"`
        : `Updated category "${catName}"`,
      changes: [
        { field: isId ? 'Nama Kategori' : 'Category Name', from: oldVal.name, to: newVal.name },
      ],
      badgeType: 'update',
      badgeLabel: isId ? 'Diubah' : 'Updated',
    }
  }

  // ==========================================
  // 7. RECURRING TRANSACTIONS (Transaksi Rutin)
  // ==========================================
  if (table === 'recurring_transactions') {
    const name = newVal.name || oldVal.name || (isId ? 'Transaksi Rutin' : 'Recurring Transaction')
    const cur = newVal.currency || oldVal.currency || 'IDR'
    const amt = formatCurrency(Number(newVal.amount || oldVal.amount || 0), cur)
    const freq = newVal.frequency || oldVal.frequency || 'monthly'
    const freqLabel =
      freq === 'daily'
        ? isId
          ? 'Harian'
          : 'Daily'
        : freq === 'weekly'
          ? isId
            ? 'Mingguan'
            : 'Weekly'
          : freq === 'yearly'
            ? isId
              ? 'Tahunan'
              : 'Yearly'
            : isId
              ? 'Bulanan'
              : 'Monthly'

    if (log.action === 'INSERT') {
      return {
        moduleName: isId ? 'Transaksi Rutin' : 'Recurring',
        title: `${name} • ${amt} (${freqLabel})`,
        summary: isId
          ? `Mendaftarkan transaksi rutin "${name}" senilai ${amt} (${freqLabel})`
          : `Created recurring transaction "${name}" for ${amt} (${freqLabel})`,
        changes: [
          { field: isId ? 'Nama Transaksi' : 'Name', to: name },
          { field: isId ? 'Nominal' : 'Amount', to: amt },
          { field: isId ? 'Frekuensi' : 'Frequency', to: freqLabel },
          ...(newVal.next_due_date ? [{ field: isId ? 'Jatuh Tempo Pertama' : 'First Due Date', to: formatDate(newVal.next_due_date, 'd MMM yyyy', lang) }] : []),
        ],
        badgeType: 'create',
        badgeLabel: isId ? 'Dibuat' : 'Created',
      }
    }

    if (log.action === 'DELETE') {
      return {
        moduleName: isId ? 'Transaksi Rutin' : 'Recurring',
        title: `${name} • ${amt}`,
        summary: isId
          ? `Menghapus jadwal transaksi rutin "${name}" (${amt})`
          : `Deleted recurring transaction schedule "${name}" (${amt})`,
        changes: [
          { field: isId ? 'Nama Transaksi' : 'Name', from: name },
          { field: isId ? 'Nominal' : 'Amount', from: amt },
        ],
        badgeType: 'delete',
        badgeLabel: isId ? 'Dihapus' : 'Deleted',
      }
    }

    // UPDATE recurring
    const recChanges: Array<{ field: string; from?: string; to?: string }> = []
    if (oldVal.amount !== newVal.amount && (oldVal.amount || newVal.amount)) {
      recChanges.push({
        field: isId ? 'Nominal' : 'Amount',
        from: oldVal.amount ? formatCurrency(Number(oldVal.amount), cur) : '-',
        to: newVal.amount ? formatCurrency(Number(newVal.amount), cur) : '-',
      })
    }
    if (oldVal.is_active !== newVal.is_active && (oldVal.is_active !== undefined || newVal.is_active !== undefined)) {
      recChanges.push({
        field: isId ? 'Status' : 'Status',
        from: oldVal.is_active ? (isId ? 'Aktif' : 'Active') : (isId ? 'Dijeda' : 'Paused'),
        to: newVal.is_active ? (isId ? 'Aktif' : 'Active') : (isId ? 'Dijeda' : 'Paused'),
      })
    }
    if (oldVal.next_due_date !== newVal.next_due_date && (oldVal.next_due_date || newVal.next_due_date)) {
      recChanges.push({
        field: isId ? 'Tanggal Jatuh Tempo' : 'Next Due Date',
        from: oldVal.next_due_date ? formatDate(oldVal.next_due_date, 'd MMM yyyy', lang) : '-',
        to: newVal.next_due_date ? formatDate(newVal.next_due_date, 'd MMM yyyy', lang) : '-',
      })
    }

    return {
      moduleName: isId ? 'Transaksi Rutin' : 'Recurring',
      title: `${name}`,
      summary: isId
        ? `Memperbarui konfigurasi transaksi rutin "${name}"`
        : `Updated recurring transaction details for "${name}"`,
      changes: recChanges,
      badgeType: 'update',
      badgeLabel: isId ? 'Diubah' : 'Updated',
    }
  }

  // ==========================================
  // 8. SAVINGS GOALS (Target Tabungan)
  // ==========================================
  if (table === 'savings_goals') {
    const name = newVal.name || oldVal.name || (isId ? 'Target Tabungan' : 'Savings Goal')
    const cur = newVal.currency || oldVal.currency || 'IDR'
    const targetAmt = formatCurrency(Number(newVal.target_amount || oldVal.target_amount || 0), cur)
    const currentAmt = formatCurrency(Number(newVal.current_amount || oldVal.current_amount || 0), cur)

    if (log.action === 'INSERT') {
      return {
        moduleName: isId ? 'Tabungan' : 'Savings Goals',
        title: `${name} • Target ${targetAmt}`,
        summary: isId
          ? `Membuat target tabungan "${name}" sebesar ${targetAmt}`
          : `Created savings goal "${name}" for ${targetAmt}`,
        changes: [
          { field: isId ? 'Nama Target' : 'Goal Name', to: name },
          { field: isId ? 'Target Dana' : 'Target Amount', to: targetAmt },
          ...(newVal.target_date ? [{ field: isId ? 'Tenggat Waktu' : 'Target Date', to: formatDate(newVal.target_date, 'd MMM yyyy', lang) }] : []),
        ],
        badgeType: 'create',
        badgeLabel: isId ? 'Dibuat' : 'Created',
      }
    }

    if (log.action === 'DELETE') {
      return {
        moduleName: isId ? 'Tabungan' : 'Savings Goals',
        title: `${name} • ${targetAmt}`,
        summary: isId
          ? `Menghapus target tabungan "${name}" (${targetAmt})`
          : `Deleted savings goal "${name}" (${targetAmt})`,
        changes: [
          { field: isId ? 'Nama Target' : 'Goal Name', from: name },
          { field: isId ? 'Target Dana' : 'Target Amount', from: targetAmt },
        ],
        badgeType: 'delete',
        badgeLabel: isId ? 'Dihapus' : 'Deleted',
      }
    }

    // UPDATE goal
    const goalChanges: Array<{ field: string; from?: string; to?: string }> = []
    if (oldVal.name !== newVal.name && (oldVal.name || newVal.name)) {
      goalChanges.push({
        field: isId ? 'Nama Target' : 'Goal Name',
        from: oldVal.name || '-',
        to: newVal.name || '-',
      })
    }
    if (oldVal.target_amount !== newVal.target_amount && (oldVal.target_amount || newVal.target_amount)) {
      goalChanges.push({
        field: isId ? 'Target Sasaran' : 'Target Amount',
        from: oldVal.target_amount ? formatCurrency(Number(oldVal.target_amount), cur) : '-',
        to: newVal.target_amount ? formatCurrency(Number(newVal.target_amount), cur) : '-',
      })
    }
    if (oldVal.current_amount !== newVal.current_amount && (oldVal.current_amount !== undefined || newVal.current_amount !== undefined)) {
      goalChanges.push({
        field: isId ? 'Terkumpul Saat Ini' : 'Current Progress',
        from: oldVal.current_amount ? formatCurrency(Number(oldVal.current_amount), cur) : '-',
        to: newVal.current_amount ? formatCurrency(Number(newVal.current_amount), cur) : '-',
      })
    }
    if (oldVal.target_date !== newVal.target_date && (oldVal.target_date || newVal.target_date)) {
      goalChanges.push({
        field: isId ? 'Tenggat Target' : 'Target Date',
        from: oldVal.target_date ? formatDate(oldVal.target_date, 'd MMM yyyy', lang) : (isId ? '(Tanpa Tenggat)' : '(No Deadline)'),
        to: newVal.target_date ? formatDate(newVal.target_date, 'd MMM yyyy', lang) : (isId ? '(Tanpa Tenggat)' : '(No Deadline)'),
      })
    }
    if (oldVal.status !== newVal.status && (oldVal.status || newVal.status)) {
      const getStatusLabel = (s?: string) =>
        s === 'completed' ? (isId ? 'Tercapai (100%)' : 'Completed') : s === 'paused' ? (isId ? 'Dijeda' : 'Paused') : (isId ? 'Berjalan' : 'In Progress')
      goalChanges.push({
        field: isId ? 'Status Target' : 'Status',
        from: getStatusLabel(oldVal.status),
        to: getStatusLabel(newVal.status),
      })
    }

    return {
      moduleName: isId ? 'Tabungan' : 'Savings Goals',
      title: `${name}`,
      summary: isId
        ? `Memperbarui konfigurasi / progres tabungan "${name}"`
        : `Updated progress or configuration for "${name}"`,
      changes: goalChanges,
      badgeType: 'update',
      badgeLabel: isId ? 'Diubah' : 'Updated',
    }
  }

  // ==========================================
  // 9. SAVINGS GOAL DEPOSITS (Setoran Tabungan)
  // ==========================================
  if (table === 'savings_goal_deposits') {
    const cur = newVal.currency || oldVal.currency || 'IDR'
    const amt = formatCurrency(Number(newVal.amount || oldVal.amount || 0), cur)
    const isWithdraw = (newVal.type || oldVal.type) === 'withdraw'
    const actionLabel = isWithdraw ? (isId ? 'Penarikan' : 'Withdrawal') : (isId ? 'Setoran' : 'Deposit')

    if (log.action === 'INSERT') {
      return {
        moduleName: isId ? 'Setoran Tabungan' : 'Goal Deposits',
        title: `${actionLabel} ${amt}`,
        summary: isId
          ? `Mencatat ${actionLabel.toLowerCase()} tabungan senilai ${amt}`
          : `Logged goal ${actionLabel.toLowerCase()} of ${amt}`,
        changes: [
          { field: isId ? 'Jenis Mutasi' : 'Type', to: actionLabel },
          { field: isId ? 'Nominal' : 'Amount', to: amt },
          ...(newVal.deposit_date ? [{ field: isId ? 'Tanggal' : 'Date', to: formatDate(newVal.deposit_date, 'd MMM yyyy', lang) }] : []),
        ],
        badgeType: 'create',
        badgeLabel: isId ? 'Dibuat' : 'Created',
      }
    }

    if (log.action === 'DELETE') {
      return {
        moduleName: isId ? 'Setoran Tabungan' : 'Goal Deposits',
        title: `${actionLabel} ${amt}`,
        summary: isId
          ? `Menghapus catatan ${actionLabel.toLowerCase()} tabungan senilai ${amt}`
          : `Deleted ${actionLabel.toLowerCase()} entry of ${amt}`,
        changes: [
          { field: isId ? 'Nominal' : 'Amount', from: amt },
        ],
        badgeType: 'delete',
        badgeLabel: isId ? 'Dihapus' : 'Deleted',
      }
    }
  }

  // ==========================================
  // 10. STOCK TRADES (Jual Beli Saham IDX)
  // ==========================================
  if (table === 'stock_trades') {
    const ticker = newVal.ticker || oldVal.ticker || 'IDX'
    const tradeType = newVal.type || oldVal.type || 'buy'
    const isBuy = tradeType === 'buy'
    const amt = formatCurrency(Number(newVal.net_amount || oldVal.net_amount || 0), 'IDR')
    const pnl = Number(newVal.realized_pnl || oldVal.realized_pnl || 0)

    if (log.action === 'INSERT') {
      if (isBuy) {
        return {
          moduleName: isId ? 'Investasi Saham' : 'Stock Trades',
          title: `${ticker} • ${amt} (Beli)`,
          summary: isId
            ? `Mencatat pembelian saham ${ticker} senilai ${amt} (terpotong dari RDN)`
            : `Recorded ${ticker} stock purchase of ${amt}`,
          changes: [
            { field: isId ? 'Kode Saham' : 'Ticker', to: ticker },
            { field: isId ? 'Total Beli Bersih' : 'Net Buy Amount', to: amt },
            ...(newVal.notes ? [{ field: isId ? 'Catatan' : 'Notes', to: newVal.notes }] : []),
            ...(newVal.trade_date ? [{ field: isId ? 'Tanggal' : 'Date', to: formatDate(newVal.trade_date, 'd MMM yyyy', lang) }] : []),
          ],
          badgeType: 'create',
          badgeLabel: isId ? 'Beli' : 'Buy',
        }
      } else {
        const isProfit = pnl >= 0
        const pnlFormatted = `${isProfit ? '+' : ''}${formatCurrency(pnl, 'IDR')}`
        return {
          moduleName: isId ? 'Investasi Saham' : 'Stock Trades',
          title: `${ticker} • ${amt} (${pnlFormatted} PnL)`,
          summary: isId
            ? `Mencatat penjualan saham ${ticker} senilai ${amt} (${pnlFormatted} PnL)`
            : `Recorded ${ticker} sale of ${amt} (${pnlFormatted} PnL)`,
          changes: [
            { field: isId ? 'Kode Saham' : 'Ticker', to: ticker },
            { field: isId ? 'Total Jual Bersih' : 'Net Proceeds', to: amt },
            { field: isId ? 'Hasil Trading (PnL)' : 'Realized PnL', to: pnlFormatted },
            ...(newVal.notes ? [{ field: isId ? 'Catatan' : 'Notes', to: newVal.notes }] : []),
            ...(newVal.trade_date ? [{ field: isId ? 'Tanggal' : 'Date', to: formatDate(newVal.trade_date, 'd MMM yyyy', lang) }] : []),
          ],
          badgeType: isProfit ? 'create' : 'delete',
          badgeLabel: isId ? 'Jual' : 'Sell',
        }
      }
    }

    if (log.action === 'DELETE') {
      return {
        moduleName: isId ? 'Investasi Saham' : 'Stock Trades',
        title: `${ticker} • ${amt}`,
        summary: isId
          ? `Menghapus catatan transaksi ${isBuy ? 'beli' : 'jual'} saham ${ticker} (${amt})`
          : `Deleted ${isBuy ? 'buy' : 'sell'} trade of ${ticker} (${amt})`,
        changes: [
          { field: isId ? 'Kode Saham' : 'Ticker', from: ticker },
          { field: isId ? 'Nominal' : 'Amount', from: amt },
        ],
        badgeType: 'delete',
        badgeLabel: isId ? 'Dihapus' : 'Deleted',
      }
    }

    // UPDATE stock trade
    const tradeChanges: Array<{ field: string; from?: string; to?: string }> = []
    if (oldVal.ticker !== newVal.ticker && (oldVal.ticker || newVal.ticker)) {
      tradeChanges.push({
        field: isId ? 'Kode Saham' : 'Ticker',
        from: oldVal.ticker || '-',
        to: newVal.ticker || '-',
      })
    }
    if (oldVal.net_amount !== newVal.net_amount && (oldVal.net_amount || newVal.net_amount)) {
      tradeChanges.push({
        field: isId ? 'Nominal Bersih' : 'Net Amount',
        from: oldVal.net_amount ? formatCurrency(Number(oldVal.net_amount), 'IDR') : '-',
        to: newVal.net_amount ? formatCurrency(Number(newVal.net_amount), 'IDR') : '-',
      })
    }
    if (oldVal.trade_date !== newVal.trade_date && (oldVal.trade_date || newVal.trade_date)) {
      tradeChanges.push({
        field: isId ? 'Tanggal Transaksi' : 'Trade Date',
        from: oldVal.trade_date ? formatDate(oldVal.trade_date, 'd MMM yyyy', lang) : '-',
        to: newVal.trade_date ? formatDate(newVal.trade_date, 'd MMM yyyy', lang) : '-',
      })
    }
    if (oldVal.notes !== newVal.notes && (oldVal.notes || newVal.notes)) {
      tradeChanges.push({
        field: isId ? 'Catatan' : 'Notes',
        from: oldVal.notes || (isId ? '(Kosong)' : '(Empty)'),
        to: newVal.notes || (isId ? '(Kosong)' : '(Empty)'),
      })
    }

    return {
      moduleName: isId ? 'Investasi Saham' : 'Stock Trades',
      title: `${ticker} • ${amt}`,
      summary: isId
        ? `Memperbarui rincian transaksi saham ${ticker}`
        : `Updated trade details for ${ticker}`,
      changes: tradeChanges,
      badgeType: 'update',
      badgeLabel: isId ? 'Diubah' : 'Updated',
    }
  }

  // ==========================================
  // 11. STOCK HOLDINGS (Posisi Kepemilikan Saham)
  // ==========================================
  if (table === 'stock_holdings') {
    const ticker = newVal.ticker || oldVal.ticker || 'IDX'
    const totalCost = formatCurrency(Number(newVal.total_cost || oldVal.total_cost || 0), 'IDR')

    if (log.action === 'INSERT') {
      return {
        moduleName: isId ? 'Portofolio Saham' : 'Holdings',
        title: `${ticker} • ${totalCost}`,
        summary: isId
          ? `Membuka posisi kepemilikan saham ${ticker} dengan modal ${totalCost}`
          : `Opened new holding in ${ticker} with cost basis of ${totalCost}`,
        changes: [
          { field: isId ? 'Kode Saham' : 'Ticker', to: ticker },
          { field: isId ? 'Modal Tertanam' : 'Invested Capital', to: totalCost },
        ],
        badgeType: 'create',
        badgeLabel: isId ? 'Dibuat' : 'Created',
      }
    }

    if (log.action === 'DELETE') {
      return {
        moduleName: isId ? 'Portofolio Saham' : 'Holdings',
        title: `${ticker}`,
        summary: isId
          ? `Posisi kepemilikan saham ${ticker} telah selesai/ditutup`
          : `Holding position in ${ticker} was closed/sold`,
        changes: [
          { field: isId ? 'Kode Saham' : 'Ticker', from: ticker },
        ],
        badgeType: 'delete',
        badgeLabel: isId ? 'Ditutup' : 'Closed',
      }
    }
  }

  // ==========================================
  // 12. TRANSACTIONS (Default / Existing)
  // ==========================================
  if (log.action === 'INSERT') {
    const amount = newVal.amount ? formatCurrency(Number(newVal.amount), newVal.currency || 'IDR') : ''
    const typeLabel = newVal.type === 'income' ? (isId ? 'Pemasukan' : 'Income') : (isId ? 'Pengeluaran' : 'Expense')
    const cleanDesc = getCleanDescription(newVal.description)

    // Parse items and memo for structured display
    const rawDesc = newVal.description || ''
    const itemsMatch = rawDesc.match(/\[Items:\s*([^\]]+)\]/)
    const memoMatch = rawDesc.match(/\[Memo:\s*([^\]]+)\]/)
    const tagsArr = Array.isArray(newVal.tags) ? newVal.tags : []

    return {
      moduleName: isId ? 'Transaksi' : 'Transactions',
      title: `${cleanDesc || (isId ? 'Transaksi Baru' : 'Transaction')} • ${amount} (${typeLabel})`,
      summary: isId
        ? `Mencatat ${typeLabel.toLowerCase()} sebesar ${amount}${cleanDesc ? ` (${cleanDesc})` : ''}`
        : `Recorded ${typeLabel.toLowerCase()} of ${amount}${cleanDesc ? ` (${cleanDesc})` : ''}`,
      changes: [
        ...(newVal.amount ? [{ field: isId ? 'Nominal' : 'Amount', to: amount }] : []),
        ...(cleanDesc ? [{ field: isId ? 'Keterangan' : 'Note', to: cleanDesc }] : []),
        ...(memoMatch ? [{ field: isId ? 'Catatan Memo' : 'Memo', to: memoMatch[1].trim() }] : []),
        ...(itemsMatch ? [{ field: isId ? 'Rincian Item' : 'Items Breakdown', to: itemsMatch[1].trim() }] : []),
        ...(tagsArr.length > 0 ? [{ field: isId ? 'Tagar (#tags)' : 'Tags', to: tagsArr.map((t: string) => `#${t}`).join(', ') }] : []),
        ...(newVal.transaction_date ? [{ field: isId ? 'Tanggal' : 'Date', to: formatDate(newVal.transaction_date, 'd MMM yyyy', lang) }] : []),
      ],
      badgeType: 'create',
      badgeLabel: isId ? 'Dibuat' : 'Created',
    }
  }

  if (log.action === 'DELETE') {
    const amount = oldVal.amount ? formatCurrency(Number(oldVal.amount), oldVal.currency || 'IDR') : ''
    const cleanDesc = getCleanDescription(oldVal.description)

    return {
      moduleName: isId ? 'Transaksi' : 'Transactions',
      title: `${cleanDesc || (isId ? 'Transaksi' : 'Transaction')} • ${amount}`,
      summary: isId
        ? `Menghapus transaksi senilai ${amount}${cleanDesc ? ` (${cleanDesc})` : ''}`
        : `Deleted transaction record of ${amount}${cleanDesc ? ` (${cleanDesc})` : ''}`,
      changes: [
        ...(oldVal.amount ? [{ field: isId ? 'Nominal Dihapus' : 'Deleted Amount', from: amount }] : []),
        ...(cleanDesc ? [{ field: isId ? 'Keterangan' : 'Note', from: cleanDesc }] : []),
      ],
      badgeType: 'delete',
      badgeLabel: isId ? 'Dihapus' : 'Deleted',
    }
  }

  // UPDATE action - trace only human meaningful fields
  const changes: Array<{ field: string; from?: string; to?: string }> = []

  if (oldVal.amount !== newVal.amount && (oldVal.amount !== undefined || newVal.amount !== undefined)) {
    changes.push({
      field: isId ? 'Nominal Transaksi' : 'Amount',
      from: oldVal.amount ? formatCurrency(Number(oldVal.amount), oldVal.currency || 'IDR') : '-',
      to: newVal.amount ? formatCurrency(Number(newVal.amount), newVal.currency || 'IDR') : '-',
    })
  }

  const oldCleanDesc = getCleanDescription(oldVal.description)
  const newCleanDesc = getCleanDescription(newVal.description)
  if (oldCleanDesc !== newCleanDesc) {
    changes.push({
      field: isId ? 'Catatan / Keterangan' : 'Description Note',
      from: oldCleanDesc || (isId ? '(Kosong)' : '(Empty)'),
      to: newCleanDesc || (isId ? '(Kosong)' : '(Empty)'),
    })
  }

  if (oldVal.type !== newVal.type && (oldVal.type || newVal.type)) {
    changes.push({
      field: isId ? 'Tipe Transaksi' : 'Transaction Type',
      from: oldVal.type === 'income' ? (isId ? 'Pemasukan' : 'Income') : (isId ? 'Pengeluaran' : 'Expense'),
      to: newVal.type === 'income' ? (isId ? 'Pemasukan' : 'Income') : (isId ? 'Pengeluaran' : 'Expense'),
    })
  }

  if (oldVal.transaction_date !== newVal.transaction_date && (oldVal.transaction_date || newVal.transaction_date)) {
    changes.push({
      field: isId ? 'Tanggal Transaksi' : 'Transaction Date',
      from: oldVal.transaction_date ? formatDate(oldVal.transaction_date, 'd MMM yyyy', lang) : '-',
      to: newVal.transaction_date ? formatDate(newVal.transaction_date, 'd MMM yyyy', lang) : '-',
    })
  }

  // Trace tags change in UPDATE
  const oldTags = Array.isArray(oldVal.tags) ? oldVal.tags.join(',') : ''
  const newTags = Array.isArray(newVal.tags) ? newVal.tags.join(',') : ''
  if (oldTags !== newTags) {
    changes.push({
      field: isId ? 'Tagar (#tags)' : 'Tags',
      from: oldVal.tags && oldVal.tags.length > 0 ? oldVal.tags.map((t: string) => `#${t}`).join(', ') : (isId ? '(Tanpa Tagar)' : '(No Tags)'),
      to: newVal.tags && newVal.tags.length > 0 ? newVal.tags.map((t: string) => `#${t}`).join(', ') : (isId ? '(Tanpa Tagar)' : '(No Tags)'),
    })
  }

  return {
    moduleName: isId ? 'Transaksi' : 'Transactions',
    title: `${newCleanDesc || oldCleanDesc || (isId ? 'Transaksi' : 'Transaction')}`,
    summary: isId
      ? `Memperbarui rincian data transaksi di buku kas`
      : `Updated transaction details in ledger`,
    changes,
    badgeType: 'update',
    badgeLabel: isId ? 'Diubah' : 'Updated',
  }
}
