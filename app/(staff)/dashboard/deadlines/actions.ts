'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type ActionResult = { error?: string }

const CHECK_VIOLATION = '23514'
const INSUFFICIENT_PRIVILEGE = '42501'

const DEADLINES_PATH = '/dashboard/deadlines'

function casePath(caseId: string) {
  return `/dashboard/cases/${caseId}`
}

// --- Case picker ---------------------------------------------------------

export type CaseOption = { id: string; case_number: string; title: string }

export async function searchCases(term: string): Promise<CaseOption[]> {
  const trimmed = term.trim()
  if (!trimmed) return []

  const supabase = await createClient()
  const safe = trimmed.replace(/[,()]/g, '')
  const { data } = await supabase
    .from('cases')
    .select('id, case_number, title')
    .or(`case_number.ilike.%${safe}%,title.ilike.%${safe}%`)
    .order('case_number')
    .limit(10)

  return data ?? []
}

// --- Period types (read-only picker; the admin CRUD lives under owner/) ----

export type PeriodTypeOption = {
  id: string
  name: string
  period_days: number
  description: string | null
}

export async function listPeriodTypes(): Promise<PeriodTypeOption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('deadline_period_types')
    .select('id, name, period_days, description')
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
  const case_id = formData.get('case_id')
  const period_type_id = formData.get('period_type_id')
  const trigger_date = formData.get('trigger_date')
  const description = formData.get('description')

  if (typeof case_id !== 'string' || !case_id) {
    return { error: 'Select a case.' }
  }
  if (typeof period_type_id !== 'string' || !period_type_id) {
    return { error: 'Select a period type.' }
  }
  if (typeof trigger_date !== 'string' || !trigger_date.trim()) {
    return { error: 'Trigger date is required.' }
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
    })
    .select('id, case_id, period_type_id, trigger_date, due_date, unadjusted_due_date, effective_due_date, description')
    .single()

  if (error) {
    if (error.code === INSUFFICIENT_PRIVILEGE) {
      return { error: "You don't have permission to add a deadline to this case." }
    }
    return { error: 'Could not add the deadline. Please try again.' }
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
  const extended_due_date = formData.get('extended_due_date')
  const extension_reason = formData.get('extension_reason')

  if (typeof extended_due_date !== 'string' || !extended_due_date.trim()) {
    return { error: 'Extended date is required.' }
  }
  if (typeof extension_reason !== 'string' || !extension_reason.trim()) {
    return { error: 'A reason is required for an extension.' }
  }

  const supabase = await createClient()

  // extended_by/extended_at populate automatically from a trigger - never
  // send them.
  const { error } = await supabase
    .from('deadlines')
    .update({
      extended_due_date: extended_due_date.trim(),
      extension_reason: extension_reason.trim(),
    })
    .eq('id', deadlineId)

  if (error) {
    if (error.code === CHECK_VIOLATION) {
      return { error: 'Both an extended date and a reason are required.' }
    }
    if (error.code === INSUFFICIENT_PRIVILEGE) {
      return { error: "You don't have permission to extend this deadline." }
    }
    return { error: 'Could not save the extension. Please try again.' }
  }

  revalidatePath(DEADLINES_PATH)
  revalidatePath(casePath(caseId))
  return {}
}
