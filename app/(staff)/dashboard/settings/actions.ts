'use server'

import { revalidatePath } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'

type ActionResult = { error?: string }

// The staff UPDATE policy allows id = auth.uid(), and guard_staff_columns
// deliberately permits full_name and phone (unlike role_id/user_type/
// is_active) - the database decides what's writable here, this just posts
// the two fields and lets RLS/the trigger accept or reject them.
export async function updateOwnProfile(formData: FormData): Promise<ActionResult> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.settings.errors' })

  const fullName = formData.get('full_name')
  const phone = formData.get('phone')

  if (typeof fullName !== 'string' || !fullName.trim()) {
    return { error: t('fullNameRequired') }
  }

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims
  if (!user) {
    return { error: t('updateFailed') }
  }

  const { error } = await supabase
    .from('staff')
    .update({
      full_name: fullName.trim(),
      phone: typeof phone === 'string' && phone.trim() ? phone.trim() : null,
    })
    .eq('id', user.sub as string)

  if (error) {
    return { error: t('updateFailed') }
  }

  // Re-renders the whole staff route tree, including the root layout that
  // reads the signed-in name into the header - same reasoning as setLocale.
  revalidatePath('/dashboard', 'layout')
  return {}
}
