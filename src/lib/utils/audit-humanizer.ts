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
        moduleName: isId ? 'Transfer Antar Akun' : 'Transfer',
        title: isId ? 'Transfer Dana' : 'Fund Transfer',
        summary: isId
          ? `Mencatat transfer saldo senilai ${formattedAmt} (${fromCur} → ${toCur})`
          : `Recorded transfer of ${formattedAmt} (${fromCur} → ${toCur})`,
        changes: [
          { field: isId ? 'Nominal Transfer' : 'Transfer Amount', to: formattedAmt },
          ...(rate && rate !== 1 ? [{ field: isId ? 'Kurs Digunakan' : 'Exchange Rate Used', to: `1 ${fromCur} = ${rate} ${toCur}` }] : []),
          ...(newVal.transfer_date ? [{ field: isId ? 'Tanggal Transfer' : 'Date', to: formatDate(newVal.transfer_date, 'd MMM yyyy', lang) }] : []),
        ],
        badgeType: 'create',
        badgeLabel: isId ? 'Transfer' : 'Transfer',
      }
    }

    if (log.action === 'DELETE') {
      return {
        moduleName: isId ? 'Transfer Antar Akun' : 'Transfer',
        title: isId ? 'Pembatalan Transfer' : 'Transfer Reverted',
        summary: isId
          ? `Menghapus catatan transfer dana sebesar ${formattedAmt}`
          : `Deleted fund transfer record of ${formattedAmt}`,
        changes: [
          { field: isId ? 'Nominal Dibatalkan' : 'Cancelled Amount', from: formattedAmt },
        ],
        badgeType: 'delete',
        badgeLabel: isId ? 'Dibatalkan' : 'Deleted',
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
    const typeText = debtType === 'payable'
      ? (isId ? 'Hutang ke' : 'Payable to')
      : (isId ? 'Piutang dari' : 'Receivable from')
    const initAmt = formatCurrency(Number(newVal.initial_amount || oldVal.initial_amount || 0), cur)

    if (log.action === 'INSERT') {
      return {
        moduleName: isId ? 'Hutang Piutang' : 'Debts & Loans',
        title: isId ? `Pencatatan ${typeText} ${person}` : `Recorded ${typeText} ${person}`,
        summary: isId
          ? `Mencatat ${typeText} ${person} sebesar ${initAmt}`
          : `Created ${typeText} ${person} for ${initAmt}`,
        changes: [
          { field: isId ? 'Nominal Awal' : 'Initial Amount', to: initAmt },
          { field: isId ? 'Pihak Terkait' : 'Person', to: person },
          ...(newVal.due_date ? [{ field: isId ? 'Tenggat Waktu' : 'Due Date', to: formatDate(newVal.due_date, 'd MMM yyyy', lang) }] : []),
        ],
        badgeType: 'create',
        badgeLabel: isId ? 'Hutang Baru' : 'New Debt',
      }
    }

    if (log.action === 'DELETE') {
      return {
        moduleName: isId ? 'Hutang Piutang' : 'Debts & Loans',
        title: isId ? `Penghapusan Catatan Hutang/Piutang` : `Deleted Debt Record`,
        summary: isId
          ? `Menghapus catatan ${typeText} ${person} (${initAmt})`
          : `Deleted ${typeText} ${person} (${initAmt})`,
        changes: [
          { field: isId ? 'Nominal' : 'Amount', from: initAmt },
          { field: isId ? 'Pihak Terkait' : 'Person', from: person },
        ],
        badgeType: 'delete',
        badgeLabel: isId ? 'Dihapus' : 'Deleted',
      }
    }

    // UPDATE debt
    const debtChanges: Array<{ field: string; from?: string; to?: string }> = []
    if (oldVal.status !== newVal.status && (oldVal.status || newVal.status)) {
      debtChanges.push({
        field: isId ? 'Status Pelunasan' : 'Status',
        from: oldVal.status,
        to: newVal.status,
      })
    }
    if (oldVal.remaining_amount !== newVal.remaining_amount) {
      debtChanges.push({
        field: isId ? 'Sisa Hutang' : 'Remaining Balance',
        from: formatCurrency(Number(oldVal.remaining_amount || 0), cur),
        to: formatCurrency(Number(newVal.remaining_amount || 0), cur),
      })
    }

    return {
      moduleName: isId ? 'Hutang Piutang' : 'Debts & Loans',
      title: isId ? `Pembaruan Hutang: ${person}` : `Updated Debt: ${person}`,
      summary: isId
        ? `Memperbarui status / sisa hutang dengan ${person}`
        : `Updated debt balance / status with ${person}`,
      changes: debtChanges,
      badgeType: 'update',
      badgeLabel: isId ? 'Diperbarui' : 'Updated',
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
        moduleName: isId ? 'Cicilan Hutang' : 'Debt Payment',
        title: isId ? 'Pembayaran Cicilan Hutang' : 'Debt Installment Paid',
        summary: isId
          ? `Mencatat pembayaran cicilan sebesar ${amt}`
          : `Recorded installment payment of ${amt}`,
        changes: [
          { field: isId ? 'Nominal Pembayaran' : 'Payment Amount', to: amt },
          ...(newVal.payment_date ? [{ field: isId ? 'Tanggal Bayar' : 'Payment Date', to: formatDate(newVal.payment_date, 'd MMM yyyy', lang) }] : []),
          ...(newVal.notes ? [{ field: isId ? 'Catatan' : 'Notes', to: newVal.notes }] : []),
        ],
        badgeType: 'create',
        badgeLabel: isId ? 'Cicilan' : 'Payment',
      }
    }

    if (log.action === 'DELETE') {
      return {
        moduleName: isId ? 'Cicilan Hutang' : 'Debt Payment',
        title: isId ? 'Pembatalan Pembayaran Cicilan' : 'Payment Deleted',
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

    if (log.action === 'INSERT') {
      const initBal = formatCurrency(Number(newVal.initial_balance || 0), cur)
      return {
        moduleName: isId ? 'Rekening' : 'Account',
        title: isId ? `Pembuatan Akun: ${accName}` : `Created Account: ${accName}`,
        summary: isId
          ? `Membuat akun baru "${accName}" (${cur}) dengan saldo awal ${initBal}`
          : `Created account "${accName}" (${cur}) with starting balance of ${initBal}`,
        changes: [
          { field: isId ? 'Nama Akun' : 'Account Name', to: accName },
          { field: isId ? 'Mata Uang' : 'Currency', to: cur },
          { field: isId ? 'Saldo Awal' : 'Initial Balance', to: initBal },
        ],
        badgeType: 'create',
        badgeLabel: isId ? 'Akun Baru' : 'New Account',
      }
    }

    if (log.action === 'DELETE') {
      return {
        moduleName: isId ? 'Rekening' : 'Account',
        title: isId ? `Penghapusan Akun: ${accName}` : `Deleted Account: ${accName}`,
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
      moduleName: isId ? 'Rekening' : 'Account',
      title: isId ? `Ubah Profil Akun: ${accName}` : `Updated Account: ${accName}`,
      summary: isId
        ? `Memperbarui detail informasi akun "${accName}"`
        : `Updated details for account "${accName}"`,
      changes: accChanges,
      badgeType: 'update',
      badgeLabel: isId ? 'Diperbarui' : 'Updated',
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
        moduleName: isId ? 'Anggaran' : 'Budget',
        title: isId ? 'Penetapan Batas Anggaran' : 'Set Budget Limit',
        summary: isId
          ? `Menetapkan batas anggaran bulanan sebesar ${amt} (${cur})`
          : `Set monthly budget ceiling of ${amt} (${cur})`,
        changes: [
          { field: isId ? 'Batas Anggaran' : 'Budget Limit', to: amt },
          { field: isId ? 'Mata Uang' : 'Currency', to: cur },
          ...(period ? [{ field: isId ? 'Periode' : 'Period', to: formatDate(period, 'MMMM yyyy', lang) }] : []),
        ],
        badgeType: 'create',
        badgeLabel: isId ? 'Batas Baru' : 'New Limit',
      }
    }

    if (log.action === 'DELETE') {
      return {
        moduleName: isId ? 'Anggaran' : 'Budget',
        title: isId ? 'Pelepasan Batas Anggaran' : 'Removed Budget Limit',
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
      moduleName: isId ? 'Anggaran' : 'Budget',
      title: isId ? 'Penyesuaian Batas Anggaran' : 'Adjusted Budget Limit',
      summary: isId
        ? `Mengubah batas anggaran dari ${oldAmt} menjadi ${newAmt}`
        : `Changed budget limit from ${oldAmt} to ${newAmt}`,
      changes: [
        { field: isId ? 'Batas Anggaran' : 'Budget Limit', from: oldAmt, to: newAmt },
      ],
      badgeType: 'update',
      badgeLabel: isId ? 'Diubah' : 'Adjusted',
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
        moduleName: isId ? 'Kategori' : 'Category',
        title: isId ? `Kategori Baru: ${catName}` : `New Category: ${catName}`,
        summary: isId
          ? `Menambahkan kategori ${typeLabel} "${catName}"`
          : `Added ${typeLabel} category "${catName}"`,
        changes: [
          { field: isId ? 'Nama Kategori' : 'Category Name', to: catName },
          { field: isId ? 'Tipe' : 'Type', to: typeLabel },
        ],
        badgeType: 'create',
        badgeLabel: isId ? 'Kategori Baru' : 'New Category',
      }
    }

    if (log.action === 'DELETE') {
      return {
        moduleName: isId ? 'Kategori' : 'Category',
        title: isId ? `Penghapusan Kategori: ${catName}` : `Deleted Category: ${catName}`,
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
  }

  // ==========================================
  // 7. TRANSACTIONS (Default / Existing)
  // ==========================================
  if (log.action === 'INSERT') {
    const amount = newVal.amount ? formatCurrency(Number(newVal.amount), newVal.currency || 'IDR') : ''
    const typeLabel = newVal.type === 'income' ? (isId ? 'pemasukan' : 'income') : (isId ? 'pengeluaran' : 'expense')
    const cleanDesc = getCleanDescription(newVal.description)
    const descSuffix = cleanDesc ? ` (${cleanDesc})` : ''

    // Parse items and memo for structured display
    const rawDesc = newVal.description || ''
    const itemsMatch = rawDesc.match(/\[Items:\s*([^\]]+)\]/)
    const memoMatch = rawDesc.match(/\[Memo:\s*([^\]]+)\]/)

    return {
      moduleName: isId ? 'Transaksi' : 'Transaction',
      title: isId ? `Pencatatan Transaksi Baru` : `New Transaction Logged`,
      summary: isId
        ? `Mencatat ${typeLabel} sebesar ${amount}${descSuffix}`
        : `Recorded ${typeLabel} of ${amount}${descSuffix}`,
      changes: [
        ...(newVal.amount ? [{ field: isId ? 'Nominal' : 'Amount', to: amount }] : []),
        ...(cleanDesc ? [{ field: isId ? 'Keterangan' : 'Note', to: cleanDesc }] : []),
        ...(memoMatch ? [{ field: isId ? 'Catatan Memo' : 'Memo', to: memoMatch[1].trim() }] : []),
        ...(itemsMatch ? [{ field: isId ? 'Rincian Item' : 'Items Breakdown', to: itemsMatch[1].trim() }] : []),
        ...(newVal.transaction_date ? [{ field: isId ? 'Tanggal' : 'Date', to: formatDate(newVal.transaction_date, 'd MMM yyyy', lang) }] : []),
      ],
      badgeType: 'create',
      badgeLabel: isId ? 'Transaksi Baru' : 'Created',
    }
  }

  if (log.action === 'DELETE') {
    const amount = oldVal.amount ? formatCurrency(Number(oldVal.amount), oldVal.currency || 'IDR') : ''
    const cleanDesc = getCleanDescription(oldVal.description)
    const descSuffix = cleanDesc ? ` (${cleanDesc})` : ''

    return {
      moduleName: isId ? 'Transaksi' : 'Transaction',
      title: isId ? `Penghapusan Transaksi` : `Transaction Deleted`,
      summary: isId
        ? `Menghapus transaksi senilai ${amount}${descSuffix}`
        : `Deleted transaction record of ${amount}${descSuffix}`,
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

  return {
    moduleName: isId ? 'Transaksi' : 'Transaction',
    title: isId ? `Perubahan Data Transaksi` : `Transaction Modified`,
    summary: isId
      ? `Memperbarui rincian data transaksi di buku kas`
      : `Updated transaction details in ledger`,
    changes,
    badgeType: 'update',
    badgeLabel: isId ? 'Diubah' : 'Modified',
  }
}
