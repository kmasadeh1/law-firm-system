'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const PATH = '/dashboard/owner/courts'

// Closed set the server can return - the render site validates against a
// whitelist before calling t(), same convention as TeamErrorCode /
// OpposingPartyErrorCode in cases/actions.ts. 'noName' maps the
// courts_has_a_name CHECK (23514) by constraint name, never by passing
// Postgres's own message text through to the UI.
export type CourtErrorCode = 'selectType' | 'noName' | 'noPermission' | 'createFailed' | 'saveFailed'

type ActionResult = { error?: CourtErrorCode }

export type CourtType =
  | 'conciliation'
  | 'first_instance'
  | 'appeal'
  | 'cassation'
  | 'administrative'
  | 'sharia'
  | 'execution'
  | 'other'

const COURT_TYPES: CourtType[] = [
  'conciliation',
  'first_instance',
  'appeal',
  'cassation',
  'administrative',
  'sharia',
  'execution',
  'other',
]

export type CourtRow = {
  id: string
  name_en: string | null
  name_ar: string | null
  city_en: string | null
  city_ar: string | null
  court_type: CourtType
  is_active: boolean
}

type Fields = {
  name_en: string | null
  name_ar: string
  city_en: string | null
  city_ar: string
  court_type: CourtType
}

function readFields(formData: FormData): Fields | { error: CourtErrorCode } {
  const name_en = formData.get('name_en')
  const name_ar = formData.get('name_ar')
  const city_en = formData.get('city_en')
  const city_ar = formData.get('city_ar')
  const court_type = formData.get('court_type')

  if (typeof court_type !== 'string' || !(COURT_TYPES as string[]).includes(court_type)) {
    return { error: 'selectType' }
  }

  return {
    name_en: typeof name_en === 'string' && name_en.trim() ? name_en.trim() : null,
    // name_ar/city_ar are sent as-is, untrimmed - a database trigger
    // converts '' and whitespace-only input to NULL on insert/update.
    name_ar: typeof name_ar === 'string' ? name_ar : '',
    city_en: typeof city_en === 'string' && city_en.trim() ? city_en.trim() : null,
    city_ar: typeof city_ar === 'string' ? city_ar : '',
    court_type: court_type as CourtType,
  }
}

const ROW = 'id, name_en, name_ar, city_en, city_ar, court_type, is_active'

// Only the CHECK is mapped here. 42501 is handled at the insert call alone:
// the owner-only INSERT policy refusing raises it, but an UPDATE refused by
// RLS raises nothing (zero rows, checked at each update call), so a 42501
// branch on the update paths could never run.
function mapWriteError(code: string, message: string, fallback: CourtErrorCode): CourtErrorCode {
  if (code === '23514' && message.includes('courts_has_a_name')) return 'noName'
  return fallback
}

export async function createCourt(formData: FormData): Promise<ActionResult & { court?: CourtRow }> {
  const fields = readFields(formData)
  if ('error' in fields) return fields

  const supabase = await createClient()
  const { data, error } = await supabase.from('courts').insert(fields).select(ROW).single()

  if (error) {
    if (error.code === '42501') return { error: 'noPermission' }
    return { error: mapWriteError(error.code, error.message, 'createFailed') }
  }

  revalidatePath(PATH)
  return { court: data }
}

// An UPDATE that RLS refuses is not an error - it matches zero rows and
// PostgREST returns an empty result. So the row is selected back and an
// empty result is reported as noPermission, never as "Saved". The returned
// row is what the database kept (blank Arabic stored as NULL by trigger).
export async function updateCourt(id: string, formData: FormData): Promise<ActionResult & { court?: CourtRow }> {
  const fields = readFields(formData)
  if ('error' in fields) return fields

  const supabase = await createClient()
  const { data, error } = await supabase.from('courts').update(fields).eq('id', id).select(ROW)

  if (error) return { error: mapWriteError(error.code, error.message, 'saveFailed') }
  if (!data || data.length === 0) return { error: 'noPermission' }

  revalidatePath(PATH)
  return { court: data[0] }
}

export async function setCourtActive(id: string, isActive: boolean): Promise<ActionResult & { court?: CourtRow }> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('courts').update({ is_active: isActive }).eq('id', id).select(ROW)

  if (error) return { error: mapWriteError(error.code, error.message, 'saveFailed') }
  if (!data || data.length === 0) return { error: 'noPermission' }

  revalidatePath(PATH)
  return { court: data[0] }
}
