'use server'

import { revalidatePath } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { isPhoneRefusal } from '@/lib/phone-error'

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

  const { data: updated, error } = await supabase
    .from('staff')
    .update({
      full_name: fullName.trim(),
      phone: typeof phone === 'string' && phone.trim() ? phone.trim() : null,
    })
    .eq('id', user.sub as string)
    .select('id')

  if (isPhoneRefusal(error)) {
    const tCommon = await getTranslations({ locale, namespace: 'dashboard.common' })
    return { error: tCommon('phoneInvalid') }
  }
  // Zero rows: the policy always allows your own row, so this would mean
  // the row is gone or the policy changed - either way, not saved.
  if (error || !updated || updated.length === 0) {
    return { error: t('updateFailed') }
  }

  // Re-renders the whole staff route tree, including the root layout that
  // reads the signed-in name into the header - same reasoning as setLocale.
  revalidatePath('/dashboard', 'layout')
  return {}
}

export type WorkingHoursDay = {
  day_of_week: number
  start_time: string | null
  end_time: string | null
}

const WORKING_HOURS_CHECK_VIOLATION = '23514'
const NO_MATCHING_UNIQUE_CONSTRAINT = '42P10'

// Closed code, not prose - the server decides what happened, the frontend
// (resolveWorkingHoursError, in working-hours-section.tsx) decides how to
// say it. Same reasoning as /login's error codes.
export type SaveWorkingHoursErrorCode = 'invalidTimes' | 'saveFailed'

// One upsert for the whole week, keyed on the working_hours unique index
// (staff_id, day_of_week, is_override). is_override is never sent as true -
// the insert/update policies refuse that for anyone but the owner, and this
// action is only ever called from the caller's own settings page, editing
// their own non-override rows. A day whose effective row came from an
// override never reaches here at all - the section renders it read-only
// and doesn't include it in the form that calls this.
export async function saveWorkingHours(
  days: WorkingHoursDay[]
): Promise<{ error?: SaveWorkingHoursErrorCode }> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims
  if (!user) {
    return { error: 'saveFailed' }
  }

  const { data: saved, error } = await supabase.from('working_hours').upsert(
    days.map((day) => ({
      staff_id: user.sub as string,
      day_of_week: day.day_of_week,
      start_time: day.start_time,
      end_time: day.end_time,
      is_override: false,
    })),
    { onConflict: 'staff_id,day_of_week,is_override' }
  ).select('id')

  if (error) {
    // working_hours_valid_times: rejects an end before/equal to the start,
    // and one time set without the other. Both-null (a day off) is fine -
    // the form already only ever sends that shape for a day marked off,
    // never equal times, so this is a real invalid range whenever it fires.
    if (error.code === WORKING_HOURS_CHECK_VIOLATION) {
      return { error: 'invalidTimes' }
    }
    // onConflict above already names all three unique columns, so this
    // shouldn't fire - but if it ever does (e.g. the constraint itself
    // changes shape), it's still mapped to a code explicitly rather than
    // falling through to the generic branch by accident.
    if (error.code === NO_MATCHING_UNIQUE_CONSTRAINT) {
      return { error: 'saveFailed' }
    }
    return { error: 'saveFailed' }
  }

  // A refused insert raises 42501, but a refused update - the day's row
  // already exists - matches zero rows and raises nothing. Every day sent
  // must come back, or the week wasn't saved.
  if (!saved || saved.length !== days.length) {
    return { error: 'saveFailed' }
  }

  revalidatePath('/dashboard/settings')
  return {}
}
