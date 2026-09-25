'use server'

import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'

type ActionResult = { error?: string; expired?: boolean }

export async function changePassword(formData: FormData): Promise<ActionResult> {
  const password = formData.get('password')
  const confirm = formData.get('confirm')

  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'staffAuth.changePassword.errors' })

  if (typeof password !== 'string' || password.length < 8) {
    return { error: t('tooShort') }
  }
  if (password !== confirm) {
    return { error: t('mismatch') }
  }

  const supabase = await createClient()

  const { error: updateError } = await supabase.auth.updateUser({ password })
  if (updateError) {
    // Supabase's own validation message (e.g. a weak-password rule) - raw
    // and English by construction, same structural limit as other
    // server-generated error text on this project; not routed through t().
    return { error: updateError.message }
  }

  const { error: completeError } = await supabase.rpc('complete_password_change')
  if (completeError) {
    // The RPC raises a distinct message when the temporary password has
    // expired - surface our own translated copy instead of the raw
    // Postgres message, since the fix (ask the owner for a new one) is
    // different from "try again" and this one case we can fully translate.
    if (completeError.message.toLowerCase().includes('expired')) {
      return { error: t('expired'), expired: true }
    }
    return { error: completeError.message }
  }

  return {}
}
