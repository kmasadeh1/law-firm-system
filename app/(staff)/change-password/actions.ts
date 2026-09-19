'use server'

import { createClient } from '@/lib/supabase/server'

type ActionResult = { error?: string; expired?: boolean }

export async function changePassword(formData: FormData): Promise<ActionResult> {
  const password = formData.get('password')
  const confirm = formData.get('confirm')

  if (typeof password !== 'string' || password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }
  if (password !== confirm) {
    return { error: "Passwords don't match." }
  }

  const supabase = await createClient()

  const { error: updateError } = await supabase.auth.updateUser({ password })
  if (updateError) {
    return { error: updateError.message }
  }

  const { error: completeError } = await supabase.rpc('complete_password_change')
  if (completeError) {
    // The RPC raises a distinct message when the temporary password has
    // expired - surface that plainly instead of a generic failure, since
    // the fix (ask the owner for a new one) is different from "try again".
    if (completeError.message.toLowerCase().includes('expired')) {
      return { error: completeError.message, expired: true }
    }
    return { error: completeError.message }
  }

  return {}
}
