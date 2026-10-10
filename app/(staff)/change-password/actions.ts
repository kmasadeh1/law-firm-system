'use server'

import { revalidatePath } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getChangePasswordLocale, setStaffLocaleCookie } from '@/lib/get-staff-locale'
import { MIN_PASSWORD_LENGTH } from '@/lib/password-policy'
import { formatNumber } from '@/lib/format-number'

type ActionResult = { error?: string; expired?: boolean }

// Cookie-only, same mechanism as /login's setLoginLocale - picks which
// message file this screen renders, never staff.locale, never auth/session.
// See getChangePasswordLocale for why this page can't use the dashboard's
// setLocale (which writes the DB column): is_owner()/has_permission() are
// both false mid-forced-password-change, and the whole point is that this
// switch must work independent of that gate.
export async function setChangePasswordLocale(locale: 'en' | 'ar') {
  await setStaffLocaleCookie(locale)
  revalidatePath('/change-password')
}

export async function changePassword(formData: FormData): Promise<ActionResult> {
  const password = formData.get('password')
  const confirm = formData.get('confirm')
  const currentPassword = formData.get('current_password')

  const locale = await getChangePasswordLocale()
  const t = await getTranslations({ locale, namespace: 'staffAuth.changePassword.errors' })

  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return { error: t('tooShort', { min: formatNumber(MIN_PASSWORD_LENGTH, locale) }) }
  }
  if (password !== confirm) {
    return { error: t('mismatch') }
  }

  const supabase = await createClient()

  // Whether this is the forced first-login flow is read from the database,
  // never from the form - a client claiming "forced" must not be able to
  // skip the current-password check.
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims
  if (!claims) {
    return { error: t('updateFailed') }
  }
  const { data: staffRow } = await supabase
    .from('staff')
    .select('must_change_password')
    .eq('id', claims.sub)
    .maybeSingle()

  if (!staffRow?.must_change_password) {
    // Voluntary change: prove the person at the keyboard knows the current
    // password (Supabase's own re-authentication pattern) before touching it.
    // A forced change has no current password to give - theirs is the
    // temporary one they were just handed.
    if (typeof currentPassword !== 'string' || !currentPassword) {
      return { error: t('currentRequired') }
    }
    const email = typeof claims.email === 'string' ? claims.email : null
    if (!email) {
      return { error: t('updateFailed') }
    }
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    })
    if (reauthError) {
      return { error: reauthError.code === 'invalid_credentials' ? t('currentWrong') : t('updateFailed') }
    }
  }

  const { error: updateError } = await supabase.auth.updateUser({ password })
  if (updateError) {
    // Supabase's own password-policy rejection is raw English text, not
    // routed through our messages - rendered directly it broke bidi on the
    // Arabic page (a trailing "." is bidi-neutral and lands at the left
    // edge). Map the closed set of Auth error codes we can name to our own
    // copy instead of ever passing error.message through.
    if (updateError.code === 'weak_password') {
      return { error: t('weakPassword') }
    }
    if (updateError.code === 'same_password') {
      return { error: t('samePassword') }
    }
    return { error: t('updateFailed') }
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
    return { error: t('completeFailed') }
  }

  return {}
}
