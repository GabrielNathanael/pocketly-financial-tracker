'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Category, TransactionType } from '@/types/database'
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '@/lib/constants/default-categories'

import { getCanonicalCategoryName } from '@/lib/utils/category-i18n'

export async function getCategories(type?: TransactionType): Promise<Category[]> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await seedUserDefaultCategories(user.id)
  }

  let query = supabase.from('categories').select('*').order('name', { ascending: true })

  if (type) {
    query = query.eq('type', type)
  }

  const { data, error } = await query
  if (error) {
    console.error('Error fetching categories:', error)
    return []
  }

  return (data as Category[]) || []
}

/**
 * Merges and removes any duplicate categories (e.g., matching Indonesian & English pairs).
 */
export async function deduplicateUserCategories(userId?: string) {
  const supabase = await createServerSupabaseClient()
  let targetUserId = userId

  if (!targetUserId) {
    const { data: { user } } = await supabase.auth.getUser()
    targetUserId = user?.id
  }

  if (!targetUserId) return { success: false, error: 'Unauthorized' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allCategories, error } = await (supabase.from('categories') as any)
    .select('*')
    .eq('user_id', targetUserId)

  if (error || !allCategories || allCategories.length === 0) {
    return { success: true }
  }

  // Group by (type + canonical English name)
  const canonicalMap = new Map<string, Category[]>()
  for (const cat of allCategories as Category[]) {
    const canonicalName = getCanonicalCategoryName(cat.name) || cat.name
    const key = `${cat.type}_${canonicalName.toLowerCase()}`
    const existing = canonicalMap.get(key) || []
    existing.push(cat)
    canonicalMap.set(key, existing)
  }

  for (const [, catList] of canonicalMap.entries()) {
    const canonicalEnglishName = getCanonicalCategoryName(catList[0].name) || catList[0].name

    if (catList.length > 1) {
      // Pick survivor: prefer one that already has the English canonical name, or is_default
      const survivor =
        catList.find(c => c.name === canonicalEnglishName) ||
        catList.find(c => c.is_default) ||
        catList[0]

      // Ensure survivor has the canonical English name
      if (survivor.name !== canonicalEnglishName) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('categories') as any)
          .update({ name: canonicalEnglishName, is_default: true })
          .eq('id', survivor.id)
      }

      const toDelete = catList.filter(c => c.id !== survivor.id)
      const deleteIds = toDelete.map(c => c.id)

      // Re-point transactions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('transactions') as any)
        .update({ category_id: survivor.id })
        .in('category_id', deleteIds)

      // Re-point budgets
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('budgets') as any)
        .update({ category_id: survivor.id })
        .in('category_id', deleteIds)

      // Re-point recurring_transactions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('recurring_transactions') as any)
        .update({ category_id: survivor.id })
        .in('category_id', deleteIds)

      // Re-point savings_goals
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('savings_goals') as any)
        .update({ category_id: survivor.id })
        .in('category_id', deleteIds)

      // Delete duplicate category records
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('categories') as any)
        .delete()
        .in('id', deleteIds)
    } else if (catList.length === 1) {
      // Single category: check if it's currently an Indonesian default name that needs renaming to English
      const singleCat = catList[0]
      if (singleCat.name !== canonicalEnglishName) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('categories') as any)
          .update({ name: canonicalEnglishName, is_default: true })
          .eq('id', singleCat.id)
      }
    }
  }

  return { success: true }
}

export async function seedUserDefaultCategories(userId?: string) {
  const supabase = await createServerSupabaseClient()
  let targetUserId = userId

  if (!targetUserId) {
    const { data: { user } } = await supabase.auth.getUser()
    targetUserId = user?.id
  }

  if (!targetUserId) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingCategories } = await (supabase.from('categories') as any)
    .select('id, name, type')
    .eq('user_id', targetUserId)

  if (!existingCategories || existingCategories.length === 0) {
    const toInsert = [
      ...DEFAULT_EXPENSE_CATEGORIES.map(c => ({
        user_id: targetUserId!,
        name: c.name,
        type: c.type,
        icon: c.icon,
        color: c.color,
        is_default: true,
      })),
      ...DEFAULT_INCOME_CATEGORIES.map(c => ({
        user_id: targetUserId!,
        name: c.name,
        type: c.type,
        icon: c.icon,
        color: c.color,
        is_default: true,
      })),
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('categories') as any).insert(toInsert)
    return
  }

  // Ensure essential system categories 'Discrepancy' & 'Loan & Debt' exist for both expense and income
  const checkHasCategory = (name: string, type: 'expense' | 'income') =>
    existingCategories.some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any) =>
        c.type === type &&
        (c.name?.toLowerCase() === name.toLowerCase() ||
          getCanonicalCategoryName(c.name).toLowerCase() === name.toLowerCase())
    )

  const missingCategories = []
  if (!checkHasCategory('Discrepancy', 'expense')) {
    missingCategories.push({
      user_id: targetUserId,
      name: 'Discrepancy',
      type: 'expense',
      icon: 'Scale',
      color: '#64748B',
      is_default: true,
    })
  }
  if (!checkHasCategory('Discrepancy', 'income')) {
    missingCategories.push({
      user_id: targetUserId,
      name: 'Discrepancy',
      type: 'income',
      icon: 'Scale',
      color: '#64748B',
      is_default: true,
    })
  }
  if (!checkHasCategory('Loan & Debt', 'expense')) {
    missingCategories.push({
      user_id: targetUserId,
      name: 'Loan & Debt',
      type: 'expense',
      icon: 'HandCoins',
      color: '#F97316',
      is_default: true,
    })
  }
  if (!checkHasCategory('Loan & Debt', 'income')) {
    missingCategories.push({
      user_id: targetUserId,
      name: 'Loan & Debt',
      type: 'income',
      icon: 'HandCoins',
      color: '#F97316',
      is_default: true,
    })
  }
  if (!checkHasCategory('Transfer Fee', 'expense')) {
    missingCategories.push({
      user_id: targetUserId,
      name: 'Transfer Fee',
      type: 'expense',
      icon: 'Send',
      color: '#6366F1',
      is_default: true,
    })
  }
  if (!checkHasCategory('Savings', 'expense')) {
    missingCategories.push({
      user_id: targetUserId,
      name: 'Savings',
      type: 'expense',
      icon: 'PiggyBank',
      color: '#0D9488',
      is_default: true,
    })
  }
  if (!checkHasCategory('Savings', 'income')) {
    missingCategories.push({
      user_id: targetUserId,
      name: 'Savings',
      type: 'income',
      icon: 'PiggyBank',
      color: '#0D9488',
      is_default: true,
    })
  }

  if (missingCategories.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('categories') as any).insert(missingCategories)
  }

  // Run deduplication in case duplicate defaults existed
  await deduplicateUserCategories(targetUserId)
}

export async function createCategory(formData: {
  name: string
  type: TransactionType
  icon: string
  color?: string
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('categories') as any).insert({
    user_id: user.id,
    name: formData.name.trim(),
    type: formData.type,
    icon: formData.icon || 'Tag',
    color: formData.color || '#3B82F6',
    is_default: false,
  }).select().single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/categories')
  revalidatePath('/')
  return { data }
}

export async function updateCategory(
  id: string,
  formData: {
    name: string
    type: TransactionType
    icon: string
    color?: string
  }
) {
  const supabase = await createServerSupabaseClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from('categories') as any)
    .select('id, name')
    .eq('id', id)
    .single()

  const canonicalName = getCanonicalCategoryName(existing?.name || '')
  const isProtectedSystem =
    canonicalName === 'Discrepancy' ||
    canonicalName === 'Loan & Debt' ||
    canonicalName === 'Transfer Fee' ||
    canonicalName === 'Savings'

  // If system category, preserve its canonical name
  const finalName = isProtectedSystem ? canonicalName : formData.name.trim()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('categories') as any)
    .update({
      name: finalName,
      type: formData.type,
      icon: formData.icon,
      color: formData.color,
    })
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/categories')
  revalidatePath('/')
  return { success: true }
}

export async function deleteCategory(id: string) {
  const supabase = await createServerSupabaseClient()

  // Check if system category
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from('categories') as any)
    .select('id, name')
    .eq('id', id)
    .single()

  const canonicalName = getCanonicalCategoryName(existing?.name || '')
  if (
    canonicalName === 'Discrepancy' ||
    canonicalName === 'Loan & Debt' ||
    canonicalName === 'Transfer Fee' ||
    canonicalName === 'Savings'
  ) {
    return {
      error: `Kategori sistem (${canonicalName || existing?.name}) diperlukan untuk operasional otomatis modul dan tidak dapat dihapus.`,
    }
  }

  const { count } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', id)

  if (count && count > 0) {
    return { error: `Kategori ini tidak dapat dihapus karena masih digunakan oleh ${count} catatan transaksi. Ubah atau hapus transaksi terkait terlebih dahulu.` }
  }

  const { error } = await supabase.from('categories').delete().eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/categories')
  revalidatePath('/')
  return { success: true }
}
