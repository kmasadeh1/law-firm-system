'use server'

import { revalidatePath } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'

type ActionResult = { error?: string }

function appointmentPath(id: string) {
  return `/dashboard/appointments/${id}`
}

// --- Case picker (court_date appointments) --------------------------------

export type CaseOption = { id: string; case_number: string; title: string }

export async function searchCases(term: string): Promise<CaseOption[]> {
  const trimmed = term.trim()
  if (!trimmed) return []

  const supabase = await createClient()
  const safe = trimmed.replace(/[,()]/g, '')
  // No separate access check needed - RLS already scopes this to cases the
  // signed-in user can see (owner, cases_manage, or on the case team).
  const { data } = await supabase
    .from('cases')
    .select('id, case_number, title')
    .or(`case_number.ilike.%${safe}%,title.ilike.%${safe}%`)
    .order('case_number')
    .limit(10)

  return data ?? []
}

// --- Create --------------------------------------------------------------

export async function createAppointment(
  formData: FormData
): Promise<ActionResult & { appointmentId?: string }> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.appointments.form.errors' })
  const type = formData.get('type')
  const client_id = formData.get('client_id')
  const case_id = formData.get('case_id')
  const staff_id = formData.get('staff_id')
  const starts_at = formData.get('starts_at')
  const ends_at = formData.get('ends_at')
  const notes = formData.get('notes')

  if (type !== 'consultation' && type !== 'court_date') {
    return { error: t('selectType') }
  }
  if (typeof client_id !== 'string' || !client_id) {
    return { error: t('selectClient') }
  }
  if (typeof starts_at !== 'string' || !starts_at) {
    return { error: t('startRequired') }
  }
  if (typeof ends_at !== 'string' || !ends_at) {
    return { error: t('endRequired') }
  }
  // case_id-required-for-court_date is a DB check constraint, not
  // reimplemented here - the required attribute on the case picker covers
  // the normal UX, and the insert below catches the DB's rejection if that
  // gets bypassed.

  const supabase = await createClient()
  const { data: user } = await supabase.auth.getClaims()
  const resolvedStaffId =
    typeof staff_id === 'string' && staff_id ? staff_id : user?.claims?.sub

  const { data: inserted, error } = await supabase
    .from('appointments')
    .insert({
      type,
      client_id,
      case_id: typeof case_id === 'string' && case_id ? case_id : null,
      staff_id: resolvedStaffId,
      starts_at: new Date(starts_at).toISOString(),
      ends_at: new Date(ends_at).toISOString(),
      notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
      created_by: user?.claims?.sub,
    })
    .select('id')
    .single()

  if (error) {
    // The DB check constraint (case_id required for court_date) surfaces as
    // a check-violation - the client already requires a case for that type,
    // so this only fires if that constraint is ever tightened further.
    if (error.code === '23514') {
      return { error: t('courtDateNeedsCase') }
    }
    if (error.code === '42501') {
      return { error: t('noPermissionCreate') }
    }
    return { error: t('createFailed') }
  }

  revalidatePath('/dashboard/appointments')
  return { appointmentId: inserted.id }
}

// --- Update ----------------------------------------------------------------

export async function updateAppointment(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.appointments.form.errors' })
  const type = formData.get('type')
  const client_id = formData.get('client_id')
  const case_id = formData.get('case_id')
  const staff_id = formData.get('staff_id')
  const starts_at = formData.get('starts_at')
  const ends_at = formData.get('ends_at')
  const notes = formData.get('notes')
  const status = formData.get('status')

  if (type !== 'consultation' && type !== 'court_date') {
    return { error: t('selectType') }
  }
  if (typeof client_id !== 'string' || !client_id) {
    return { error: t('selectClient') }
  }
  if (typeof starts_at !== 'string' || !starts_at) {
    return { error: t('startRequired') }
  }
  if (typeof ends_at !== 'string' || !ends_at) {
    return { error: t('endRequired') }
  }
  // Same as createAppointment - case_id-required-for-court_date is left to
  // the DB check constraint, not duplicated here.
  if (
    status !== 'scheduled' &&
    status !== 'completed' &&
    status !== 'cancelled' &&
    status !== 'no_show'
  ) {
    return { error: t('selectStatus') }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('appointments')
    .update({
      type,
      client_id,
      case_id: typeof case_id === 'string' && case_id ? case_id : null,
      staff_id: typeof staff_id === 'string' && staff_id ? staff_id : null,
      starts_at: new Date(starts_at).toISOString(),
      ends_at: new Date(ends_at).toISOString(),
      notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
      status,
    })
    .eq('id', id)
    .select('id')

  if (error) {
    if (error.code === '23514') {
      return { error: t('courtDateNeedsCase') }
    }
    return { error: t('updateFailed') }
  }

  // UPDATE blocked by RLS matches zero rows rather than erroring.
  if (!data || data.length === 0) {
    return { error: t('noPermissionUpdate') }
  }

  revalidatePath(appointmentPath(id))
  revalidatePath('/dashboard/appointments')
  return {}
}
