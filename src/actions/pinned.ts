'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { TransactionType, CurrencyCode } from '@/types/database'

export interface PinnedTemplateItem {
  id: string
  name: string
  accountId: string
  accountName?: string
  categoryId: string
  categoryName?: string
  categoryIcon?: string
  type: TransactionType
  amount: number
  currency: CurrencyCode
  description?: string | null
}

export async function getDbPinnedTemplates(): Promise<PinnedTemplateItem[]> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('pinned_templates') as any)
    .select(`
      *,
      account:accounts(id, name, currency),
      category:categories(id, name, icon)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    // If table doesn't exist yet in remote instance, fail gracefully
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    accountId: row.account_id,
    accountName: row.account?.name,
    categoryId: row.category_id,
    categoryName: row.category?.name,
    categoryIcon: row.category?.icon,
    type: row.type as TransactionType,
    amount: Number(row.amount),
    currency: row.currency as CurrencyCode,
    description: row.description,
  }))
}

export async function createDbPinnedTemplate(input: {
  name: string
  accountId: string
  categoryId: string
  type: TransactionType
  amount: number
  currency: CurrencyCode
  description?: string | null
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('pinned_templates') as any)
    .insert({
      user_id: user.id,
      name: input.name,
      account_id: input.accountId,
      category_id: input.categoryId,
      type: input.type,
      amount: input.amount,
      currency: input.currency,
      description: input.description || null,
    })
    .select(`
      *,
      account:accounts(id, name, currency),
      category:categories(id, name, icon)
    `)
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/')
  return { data }
}

export async function deleteDbPinnedTemplate(id: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('pinned_templates') as any)
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/')
  return { success: true }
}
