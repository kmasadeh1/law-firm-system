'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function loginError(message: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}`)
}

export async function login(formData: FormData) {
  const email = formData.get('email')
  const password = formData.get('password')

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    loginError('Email and password are required.')
  }

  const supabase = await createClient()

  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({ email, password })

  if (signInError || !signInData.user) {
    loginError('Invalid email or password.')
  }

  // Read the staff row for the account we just authenticated. RLS governs
  // what's visible here, so a row hidden by policy and a row that doesn't
  // exist are indistinguishable - both correctly fall into the "no staff
  // account" branch below.
  const { data: staffRow } = await supabase
    .from('staff')
    .select('user_type, is_active')
    .eq('id', signInData.user.id)
    .maybeSingle()

  if (!staffRow) {
    await supabase.auth.signOut()
    loginError('No staff account exists for this login.')
  }

  if (!staffRow.is_active) {
    await supabase.auth.signOut()
    loginError('This account has been deactivated.')
  }

  redirect(staffRow.user_type === 'owner' ? '/dashboard/owner' : '/dashboard/staff')
}
