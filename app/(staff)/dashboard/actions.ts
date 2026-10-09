'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { setStaffLocaleCookie } from '@/lib/get-staff-locale'

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// Updates the signed-in staff member's own locale. RLS already permits this
// (the staff UPDATE policy allows id = auth.uid(), and guard_staff_columns
// deliberately doesn't restrict locale, unlike role_id/user_type/is_active),
// and the `locale in ('en','ar')` check constraint rejects anything else -
// no application-side validation duplicates that. Revalidating '/dashboard'
// re-renders the whole staff route tree, including the root (staff) layout
// above it, which is what actually reads staff.locale into <html lang dir>
// and the messages passed to NextIntlClientProvider.
//
// Zero rows (or an error) means staff.locale didn't change, and that column
// is what every page reads - so the cookie and revalidation are skipped
// and the caller is told, rather than the toggle silently doing nothing.
export async function setLocale(locale: 'en' | 'ar'): Promise<{ error?: 'saveFailed' }> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims
  if (!user) return { error: 'saveFailed' }

  const { data: updated, error } = await supabase
    .from('staff')
    .update({ locale })
    .eq('id', user.sub as string)
    .select('id')
  if (error || !updated || updated.length === 0) {
    return { error: 'saveFailed' }
  }
  // Also written here (not just on login) so a mid-session switch is what
  // the next signed-out visit to /login remembers too, without waiting for
  // another successful login to refresh it.
  await setStaffLocaleCookie(locale)
  revalidatePath('/dashboard', 'layout')
  return {}
}
