'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// A caller-controlled value never reaches next-intl's t() directly - the
// render site validates against a whitelist, same as TeamErrorCode in
// cases/actions.ts. courtDateNeedsCase and endBeforeStart map to two
// distinct CHECK constraints (court_date_requires_case, ends_after_starts)
// and must never share a slot - matched by constraint name in the error
// message, never guessed from which field looks wrong.
export type AppointmentErrorCode =
  | 'selectType'
  | 'selectClient'
  | 'startRequired'
  | 'endRequired'
  | 'selectStatus'
  | 'courtDateNeedsCase'
  | 'endBeforeStart'
  | 'noPermissionCreate'
  | 'createFailed'
  | 'noPermissionUpdate'
  | 'updateFailed'

type ActionResult = { error?: AppointmentErrorCode }

// Both constraints raise the same SQLSTATE (23514) - Postgres's own message
// names the constraint it was ("violates check constraint \"<name>\""), so
// this reads that instead of guessing from form state which rule failed.
function mapCheckViolation(message: string): AppointmentErrorCode | null {
  if (message.includes('ends_after_starts')) return 'endBeforeStart'
  if (message.includes('court_date_requires_case')) return 'courtDateNeedsCase'
  return null
}

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
  const type = formData.get('type')
  const client_id = formData.get('client_id')
  const case_id = formData.get('case_id')
  const staff_id = formData.get('staff_id')
  const starts_at = formData.get('starts_at')
  const ends_at = formData.get('ends_at')
  const notes = formData.get('notes')

  if (type !== 'consultation' && type !== 'court_date') {
    return { error: 'selectType' }
  }
  if (typeof client_id !== 'string' || !client_id) {
    return { error: 'selectClient' }
  }
  if (typeof starts_at !== 'string' || !starts_at) {
    return { error: 'startRequired' }
  }
  if (typeof ends_at !== 'string' || !ends_at) {
    return { error: 'endRequired' }
  }
  // case_id-required-for-court_date and ends_after_starts are both DB check
  // constraints, not reimplemented here - the form's own client-side checks
  // cover the normal UX, and the insert below maps the DB's rejection by
  // constraint name if either gets bypassed.

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
    if (error.code === '23514') {
      return { error: mapCheckViolation(error.message) ?? 'createFailed' }
    }
    if (error.code === '42501') {
      return { error: 'noPermissionCreate' }
    }
    return { error: 'createFailed' }
  }

  revalidatePath('/dashboard/appointments')
  return { appointmentId: inserted.id }
}

// --- Update ----------------------------------------------------------------

export async function updateAppointment(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const type = formData.get('type')
  const client_id = formData.get('client_id')
  const case_id = formData.get('case_id')
  const staff_id = formData.get('staff_id')
  const starts_at = formData.get('starts_at')
  const ends_at = formData.get('ends_at')
  const notes = formData.get('notes')
  const status = formData.get('status')

  if (type !== 'consultation' && type !== 'court_date') {
    return { error: 'selectType' }
  }
  if (typeof client_id !== 'string' || !client_id) {
    return { error: 'selectClient' }
  }
  if (typeof starts_at !== 'string' || !starts_at) {
    return { error: 'startRequired' }
  }
  if (typeof ends_at !== 'string' || !ends_at) {
    return { error: 'endRequired' }
  }
  // Same as createAppointment - both check constraints are left to the DB,
  // not duplicated here.
  if (
    status !== 'scheduled' &&
    status !== 'completed' &&
    status !== 'cancelled' &&
    status !== 'no_show'
  ) {
    return { error: 'selectStatus' }
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
      return { error: mapCheckViolation(error.message) ?? 'updateFailed' }
    }
    return { error: 'updateFailed' }
  }

  // UPDATE blocked by RLS matches zero rows rather than erroring.
  if (!data || data.length === 0) {
    return { error: 'noPermissionUpdate' }
  }

  revalidatePath(appointmentPath(id))
  revalidatePath('/dashboard/appointments')
  return {}
}
