'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const PATH = '/dashboard/owner/case-types'

// Closed set the server can return - the render site validates against a
// whitelist before calling t(), same convention as CourtErrorCode in
// owner/courts/actions.ts. 'noName' maps the case_types_has_a_name CHECK
// (23514) by constraint name, never by passing Postgres's own message text
// through to the UI.
export type CaseTypeErrorCode = 'noName' | 'noPermission' | 'createFailed' | 'saveFailed'

type ActionResult = { error?: CaseTypeErrorCode }

export type CaseTypeRow = {
  id: string
  name_en: string | null
  name_ar: string | null
  is_active: boolean
}

type Fields = {
  name_en: string | null
  name_ar: string
}

function readFields(formData: FormData): Fields {
  const name_en = formData.get('name_en')
  const name_ar = formData.get('name_ar')

  return {
    name_en: typeof name_en === 'string' && name_en.trim() ? name_en.trim() : null,
    // name_ar is sent as-is, untrimmed - a database trigger converts ''
    // and whitespace-only input to NULL on insert/update.
    name_ar: typeof name_ar === 'string' ? name_ar : '',
  }
}

const ROW = 'id, name_en, name_ar, is_active'

function mapWriteError(code: string, message: string, fallback: CaseTypeErrorCode): CaseTypeErrorCode {
  if (code === '23514' && message.includes('case_types_has_a_name')) return 'noName'
  if (code === '42501') return 'noPermission'
  return fallback
}

export async function createCaseType(formData: FormData): Promise<ActionResult & { caseType?: CaseTypeRow }> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('case_types').insert(readFields(formData)).select(ROW).single()

  // An insert the owner-only policy refuses is a real 42501.
  if (error) return { error: mapWriteError(error.code, error.message, 'createFailed') }

  revalidatePath(PATH)
  return { caseType: data }
}

// An UPDATE that RLS refuses is not an error - it matches zero rows and
// PostgREST returns an empty result. So the row is selected back and an
// empty result is reported as noPermission, never as "Saved". The returned
// row is what the database kept (blank Arabic stored as NULL by trigger).
export async function updateCaseType(id: string, formData: FormData): Promise<ActionResult & { caseType?: CaseTypeRow }> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('case_types').update(readFields(formData)).eq('id', id).select(ROW)

  if (error) return { error: mapWriteError(error.code, error.message, 'saveFailed') }
  if (!data || data.length === 0) return { error: 'noPermission' }

  revalidatePath(PATH)
  return { caseType: data[0] }
}

export async function setCaseTypeActive(
  id: string,
  isActive: boolean
): Promise<ActionResult & { caseType?: CaseTypeRow }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('case_types')
    .update({ is_active: isActive })
    .eq('id', id)
    .select(ROW)

  if (error) return { error: mapWriteError(error.code, error.message, 'saveFailed') }
  if (!data || data.length === 0) return { error: 'noPermission' }

  revalidatePath(PATH)
  return { caseType: data[0] }
}
