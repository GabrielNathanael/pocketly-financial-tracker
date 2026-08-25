'use server'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function login(input: FormData | { email: string; password: string }) {
  let email = ''
  let password = ''

  if (input instanceof FormData) {
    email = input.get('email') as string
    password = input.get('password') as string
  } else {
    email = input.email
    password = input.password
  }

  if (!email || !password) {
    return { error: 'Email dan kata sandi wajib diisi' }
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function register(input: FormData | { email: string; password: string }) {
  let email = ''
  let password = ''

  if (input instanceof FormData) {
    email = input.get('email') as string
    password = input.get('password') as string
  } else {
    email = input.email
    password = input.password
  }

  if (!email || !password) {
    return { error: 'Email dan kata sandi wajib diisi' }
  }

  if (password.length < 6) {
    return { error: 'Kata sandi minimal 6 karakter' }
  }

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  // Ensure default categories are seeded for this user
  if (data.user?.id) {
    try {
      const { seedUserDefaultCategories } = await import('@/actions/categories')
      await seedUserDefaultCategories(data.user.id)
    } catch {
      // Ignored if handled by SQL trigger
    }
  }

  return { success: true }
}

export async function logout() {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function getCurrentUser() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}
