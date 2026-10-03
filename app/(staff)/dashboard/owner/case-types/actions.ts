'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const PATH = '/dashboard/owner/case-types'

// Closed set the server can return - the render site validates against a
// whitelist before calling t(), same convention as CourtErrorCode in
// owner/courts/actions.ts. 'noName' maps the case_types_has_a_name CHECK
// (23514) by code, never by passing Postgres's own message text through to
// the UI.
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

export async function createCaseType(formData: FormData): Promise<ActionResult & { caseType?: CaseTypeRow }> {
  const fields = readFields(formData)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('case_types')
    .insert(fields)
    .select('id, name_en, name_ar, is_active')
    .single()

  if (error) {
    if (error.code === '23514') {
      return { error: 'noName' }
    }
    if (error.code === '42501') {
      return { error: 'noPermission' }
    }
    return { error: 'createFailed' }
  }

  revalidatePath(PATH)
  return { caseType: data }
}

export async function updateCaseType(id: string, formData: FormData): Promise<ActionResult> {
  const fields = readFields(formData)

  const supabase = await createClient()
  const { error } = await supabase.from('case_types').update(fields).eq('id', id)

  if (error) {
    if (error.code === '23514') {
      return { error: 'noName' }
    }
    if (error.code === '42501') {
      return { error: 'noPermission' }
    }
    return { error: 'saveFailed' }
  }

  revalidatePath(PATH)
  return {}
}

export async function setCaseTypeActive(id: string, isActive: boolean): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('case_types').update({ is_active: isActive }).eq('id', id)

  if (error) {
    if (error.code === '42501') {
      return { error: 'noPermission' }
    }
    return { error: 'saveFailed' }
  }

  revalidatePath(PATH)
  return {}
}
