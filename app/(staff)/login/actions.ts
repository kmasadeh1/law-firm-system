'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { setStaffLocaleCookie } from '@/lib/get-staff-locale'

// Query-string error codes, not literal messages - the page translates the
// code with staffAuth.login.errors.<code>. Keeps the redirect URL locale-
// agnostic and gives the page a closed set of keys to look up instead of
// echoing arbitrary text back into the DOM.
export type LoginErrorCode = 'missingFields' | 'invalidCredentials' | 'noStaffAccount' | 'deactivated'

function loginError(code: LoginErrorCode): never {
  redirect(`/login?error=${code}`)
}

// Sets the staff-locale cookie for a not-yet-authenticated visitor to
// /login - presentation only (picks which message file renders), never an
// auth decision. Used by the page's language switcher.
export async function setLoginLocale(locale: 'en' | 'ar') {
  await setStaffLocaleCookie(locale)
  revalidatePath('/login')
}

export async function login(formData: FormData) {
  const email = formData.get('email')
  const password = formData.get('password')

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    loginError('missingFields')
  }

  const supabase = await createClient()

  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({ email, password })

  if (signInError || !signInData.user) {
    loginError('invalidCredentials')
  }

  // Read the staff row for the account we just authenticated. RLS governs
  // what's visible here, so a row hidden by policy and a row that doesn't
  // exist are indistinguishable - both correctly fall into the "no staff
  // account" branch below.
  const { data: staffRow } = await supabase
    .from('staff')
    .select('user_type, is_active, must_change_password, locale')
    .eq('id', signInData.user.id)
    .maybeSingle()

  if (!staffRow) {
    await supabase.auth.signOut()
    loginError('noStaffAccount')
  }

  if (!staffRow.is_active) {
    await supabase.auth.signOut()
    loginError('deactivated')
  }

  // Refreshes the cookie to match the account that just signed in, so the
  // next signed-out visit to this machine (this person or someone else)
  // sees the right language before authenticating rather than whatever the
  // previous session left behind.
  await setStaffLocaleCookie(staffRow.locale === 'ar' ? 'ar' : 'en')

  // Redirect straight here rather than to the dashboard and relying on
  // proxy.ts to bounce them a second time - a Server Action's own redirect()
  // and a proxy-level redirect on the page it lands on don't compose cleanly
  // through Next's client router (the address bar can end up showing the
  // first hop). The dashboard is unusable anyway while this is true (see
  // the forced-password-change gate at the database layer); this just makes
  // the UX match that in one hop instead of two.
  if (staffRow.must_change_password) {
    redirect('/change-password')
  }

  redirect(staffRow.user_type === 'owner' ? '/dashboard/owner' : '/dashboard/staff')
}
