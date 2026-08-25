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
}

export function humanizeAuditLog(log: AuditLog, lang: 'id' | 'en' = 'id'): HumanizedAuditLog {
  const isId = lang === 'id'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oldVal = (log.old_values || {}) as Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newVal = (log.new_values || {}) as Record<string, any>

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

  if (oldVal.category_id !== newVal.category_id && (oldVal.category_id || newVal.category_id)) {
    changes.push({
      field: isId ? 'Kategori Pos' : 'Category',
      from: isId ? 'Kategori Lama' : 'Previous Category',
      to: isId ? 'Kategori Baru' : 'Updated Category',
    })
  }

  if (oldVal.account_id !== newVal.account_id && (oldVal.account_id || newVal.account_id)) {
    changes.push({
      field: isId ? 'Rekening / Dompet' : 'Account',
      from: isId ? 'Akun Sebelumnya' : 'Previous Account',
      to: isId ? 'Akun Baru' : 'Updated Account',
    })
  }

  if (oldVal.transaction_date !== newVal.transaction_date && (oldVal.transaction_date || newVal.transaction_date)) {
    changes.push({
      field: isId ? 'Tanggal Transaksi' : 'Date',
      from: oldVal.transaction_date ? formatDate(oldVal.transaction_date, 'd MMM yyyy', lang) : '-',
      to: newVal.transaction_date ? formatDate(newVal.transaction_date, 'd MMM yyyy', lang) : '-',
    })
  }

  const changeCount = changes.length
  const summaryText = isId
    ? changeCount > 0
      ? `Memperbarui ${changeCount} rincian data transaksi`
      : `Memperbarui data transaksi`
    : changeCount > 0
      ? `Updated ${changeCount} transaction details`
      : `Updated transaction record`

  return {
    title: isId ? `Perubahan Transaksi` : `Transaction Updated`,
    summary: summaryText,
    changes,
    badgeType: 'update',
    badgeLabel: isId ? 'Diubah' : 'Updated',
  }
}
