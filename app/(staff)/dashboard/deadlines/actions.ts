'use server'

import { revalidatePath } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'

type ActionResult = { error?: string }

const CHECK_VIOLATION = '23514'
const INSUFFICIENT_PRIVILEGE = '42501'

const DEADLINES_PATH = '/dashboard/deadlines'

function casePath(caseId: string) {
  return `/dashboard/cases/${caseId}`
}

// --- Case picker ---------------------------------------------------------

export type CaseOption = { id: string; case_number: string; title: string }

// Offers only cases whose details this person may manage - the deadline
// insert policy is can_manage_case_details(case_id), so a case they can
// merely see would be refused on save. can_manage_details is a computed
// column on cases (a row-type function): named in the select because it is
// not part of '*', and filtered in the query so a case outside it never
// reaches the picker. The generated types don't add it to the cases Row,
// so the row shape is stated.
//
// Deadlines only: the appointments and tasks pickers have their own search
// actions and are not filtered this way - an appointment or task on a case
// doesn't require managing its details.
export async function searchCases(term: string): Promise<CaseOption[]> {
  const trimmed = term.trim()
  if (!trimmed) return []

  const supabase = await createClient()
  const safe = trimmed.replace(/[,()]/g, '')
  const { data } = await supabase
    .from('cases')
    .select('id, case_number, title, can_manage_details')
    .filter('can_manage_details', 'eq', true)
    .or(`case_number.ilike.%${safe}%,title.ilike.%${safe}%`)
    .order('case_number')
    .limit(10)
    .overrideTypes<(CaseOption & { can_manage_details: boolean | null })[], { merge: false }>()

  return (data ?? []).map(({ id, case_number, title }) => ({ id, case_number, title }))
}

// --- Period types (read-only picker; the admin CRUD lives under reference/)

export type PeriodTypeOption = {
  id: string
  name: string
  name_ar: string | null
  period_days: number
  description: string | null
}

export async function listPeriodTypes(): Promise<PeriodTypeOption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('deadline_period_types')
    .select('id, name, name_ar, period_days, description')
    .order('name')

  return data ?? []
}

// --- Create deadline ------------------------------------------------------

export type DeadlineRow = {
  id: string
  case_id: string
  period_type_id: string
  trigger_date: string
  due_date: string | null
  unadjusted_due_date: string | null
  effective_due_date: string | null
  description: string | null
}

export async function createDeadline(
  formData: FormData
): Promise<ActionResult & { deadline?: DeadlineRow }> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.deadlines.form.errors' })
  const case_id = formData.get('case_id')
  const period_type_id = formData.get('period_type_id')
  const trigger_date = formData.get('trigger_date')
  const description = formData.get('description')
  const source_hearing_id = formData.get('source_hearing_id')

  if (typeof case_id !== 'string' || !case_id) {
    return { error: t('selectCase') }
  }
  if (typeof period_type_id !== 'string' || !period_type_id) {
    return { error: t('selectPeriodType') }
  }
  if (typeof trigger_date !== 'string' || !trigger_date.trim()) {
    return { error: t('triggerDateRequired') }
  }

  const supabase = await createClient()

  // due_date, effective_due_date and unadjusted_due_date are computed by
  // the BEFORE INSERT trigger - never send them, and always read them back
  // from what Postgres returns rather than predicting them here.
  const { data: inserted, error } = await supabase
    .from('deadlines')
    .insert({
      case_id,
      period_type_id,
      trigger_date: trigger_date.trim(),
      description: typeof description === 'string' && description.trim() ? description.trim() : null,
      source_hearing_id: typeof source_hearing_id === 'string' && source_hearing_id ? source_hearing_id : null,
    })
    .select('id, case_id, period_type_id, trigger_date, due_date, unadjusted_due_date, effective_due_date, description')
    .single()

  if (error) {
    if (error.code === INSUFFICIENT_PRIVILEGE) {
      return { error: t('noPermissionAdd') }
    }
    return { error: t('addFailed') }
  }

  revalidatePath(DEADLINES_PATH)
  revalidatePath(casePath(case_id))
  return { deadline: inserted }
}

// --- Extend a deadline ------------------------------------------------------

export async function extendDeadline(
  caseId: string,
  deadlineId: string,
  formData: FormData
): Promise<ActionResult> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.deadlines.form.errors' })
  const extended_due_date = formData.get('extended_due_date')
  const extension_reason = formData.get('extension_reason')

  if (typeof extended_due_date !== 'string' || !extended_due_date.trim()) {
    return { error: t('extendedDateRequired') }
  }
  if (typeof extension_reason !== 'string' || !extension_reason.trim()) {
    return { error: t('extensionReasonRequired') }
  }

  const supabase = await createClient()

  // extended_by/extended_at populate automatically from a trigger - never
  // send them.
  const { data, error } = await supabase
    .from('deadlines')
    .update({
      extended_due_date: extended_due_date.trim(),
      extension_reason: extension_reason.trim(),
    })
    .eq('id', deadlineId)
    .select('id')

  // No 42501 branch: the update policy's USING and WITH CHECK are the same
  // can_manage_case_details(case_id), and this never changes case_id, so a
  // refusal can only show up as zero rows. Zero rows can also mean the
  // deadline is gone, so it's reported as a failed save, not as a
  // permissions problem.
  if (error) {
    if (error.code === CHECK_VIOLATION) {
      return { error: t('bothExtensionFieldsRequired') }
    }
    return { error: t('extendFailed') }
  }
  if (!data || data.length === 0) {
    return { error: t('extendFailed') }
  }

  revalidatePath(DEADLINES_PATH)
  revalidatePath(casePath(caseId))
  return {}
}

// --- Mark a deadline met ----------------------------------------------------

// Records a fact for everyone on the case - unlike dismissing the bell's
// alert, which only hides it for one person. Sets completed_at (null
// un-marks it); completed_by is stamped and cleared by a trigger, so it is
// never sent. A met deadline drops out of pending_alerts.
export async function setDeadlineMet(caseId: string, deadlineId: string, met: boolean): Promise<ActionResult> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.deadlines.form.errors' })
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('deadlines')
    .update({ completed_at: met ? new Date().toISOString() : null })
    .eq('id', deadlineId)
    .select('id')

  // Same policy as extending: a refusal is zero rows, not an error, and
  // zero rows can also mean the deadline is gone - a failed save either way.
  if (error || !data || data.length === 0) {
    return { error: t(met ? 'markMetFailed' : 'unmarkMetFailed') }
  }

  revalidatePath(DEADLINES_PATH)
  revalidatePath(casePath(caseId))
  return {}
}
