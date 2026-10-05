'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const PATH = '/dashboard/reference/referral-sources'
const ROW = 'id, name_en, name_ar, is_active'

// Closed set the server can return - the render site validates against a
// whitelist before calling t(). 'noName' is the referral_sources_has_a_name
// CHECK (23514), matched by constraint name, never Postgres's own text.
export type ReferralSourceErrorCode = 'noName' | 'noPermission' | 'createFailed' | 'saveFailed'

export type ReferralSourceRow = {
  id: string
  name_en: string | null
  name_ar: string | null
  is_active: boolean
}

type ActionResult = { error?: ReferralSourceErrorCode; source?: ReferralSourceRow }

type Fields = {
  name_en: string | null
  name_ar: string
}

function readFields(formData: FormData): Fields {
  const name_en = formData.get('name_en')
  const name_ar = formData.get('name_ar')

  return {
    name_en: typeof name_en === 'string' && name_en.trim() ? name_en.trim() : null,
    // name_ar is sent as-is - a database trigger stores '' and
    // whitespace-only input as NULL. The row returned below is what the
    // database actually kept, so the UI never re-derives that rule.
    name_ar: typeof name_ar === 'string' ? name_ar : '',
  }
}

// Only the CHECK is mapped here. 42501 is handled at the insert call alone:
// the INSERT policy (can_manage_reference_data) refusing raises it, but an UPDATE refused by
// RLS raises nothing (zero rows, checked at each update call), so a 42501
// branch on the update paths could never run.
function mapWriteError(code: string, message: string, fallback: ReferralSourceErrorCode): ReferralSourceErrorCode {
  if (code === '23514' && message.includes('referral_sources_has_a_name')) return 'noName'
  return fallback
}

export async function createReferralSource(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('referral_sources').insert(readFields(formData)).select(ROW).single()

  if (error) {
    if (error.code === '42501') return { error: 'noPermission' }
    return { error: mapWriteError(error.code, error.message, 'createFailed') }
  }

  revalidatePath(PATH)
  return { source: data }
}

// An UPDATE that RLS refuses is not an error - it matches zero rows and
// PostgREST returns an empty result. So the result is selected back and an
// empty one is reported as noPermission, never as "Saved".
export async function updateReferralSource(id: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('referral_sources')
    .update(readFields(formData))
    .eq('id', id)
    .select(ROW)

  if (error) return { error: mapWriteError(error.code, error.message, 'saveFailed') }
  if (!data || data.length === 0) return { error: 'noPermission' }

  revalidatePath(PATH)
  return { source: data[0] }
}

export async function setReferralSourceActive(id: string, isActive: boolean): Promise<ActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('referral_sources')
    .update({ is_active: isActive })
    .eq('id', id)
    .select(ROW)

  if (error) return { error: mapWriteError(error.code, error.message, 'saveFailed') }
  if (!data || data.length === 0) return { error: 'noPermission' }

  revalidatePath(PATH)
  return { source: data[0] }
}
