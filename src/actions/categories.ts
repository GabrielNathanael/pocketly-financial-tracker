'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Category, TransactionType } from '@/types/database'
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '@/lib/constants/default-categories'

export async function getCategories(type?: TransactionType): Promise<Category[]> {
  const supabase = await createServerSupabaseClient()
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

export async function seedUserDefaultCategories(userId?: string) {
  const supabase = await createServerSupabaseClient()
  let targetUserId = userId

  if (!targetUserId) {
    const { data: { user } } = await supabase.auth.getUser()
    targetUserId = user?.id
  }

  if (!targetUserId) return

  const { count } = await supabase
    .from('categories')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', targetUserId)

  if (count && count > 0) return

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
  const { error } = await (supabase.from('categories') as any)
    .update({
      name: formData.name.trim(),
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
