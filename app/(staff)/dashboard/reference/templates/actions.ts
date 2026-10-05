'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const PATH = '/dashboard/reference/templates'

// Closed set the server can return - the render site validates against a
// whitelist before calling t(). Both CHECKs map by constraint name.
export type TemplateErrorCode = 'noName' | 'noBody' | 'noPermission' | 'createFailed' | 'saveFailed'

type ActionResult = { error?: TemplateErrorCode }

export type TemplateRow = {
  id: string
  case_type_id: string | null
  name_en: string | null
  name_ar: string | null
  body_en: string | null
  body_ar: string | null
  is_active: boolean
}

const ROW = 'id, case_type_id, name_en, name_ar, body_en, body_ar, is_active'

// Shape-only parsing. English name/body blank -> NULL here; Arabic ones are
// sent as typed, and a trigger stores a blank as NULL. Whether a template
// has a name and a body is the CHECKs' decision, not this code's. Bodies
// are plain text and kept exactly as typed (line breaks included).
function readFields(formData: FormData) {
  const text = (key: string) => {
    const value = formData.get(key)
    return typeof value === 'string' ? value : ''
  }
  const caseTypeId = text('case_type_id')
  return {
    name_en: text('name_en').trim() || null,
    name_ar: text('name_ar'),
    body_en: text('body_en').trim() ? text('body_en') : null,
    body_ar: text('body_ar'),
    // Blank means "any case type".
    case_type_id: caseTypeId || null,
  }
}

function mapWriteError(code: string, message: string, fallback: TemplateErrorCode): TemplateErrorCode {
  if (code === '23514' && message.includes('document_template_has_a_name')) return 'noName'
  if (code === '23514' && message.includes('document_template_has_a_body')) return 'noBody'
  return fallback
}

export async function createTemplate(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('document_templates').insert(readFields(formData))

  if (error) {
    if (error.code === '42501') return { error: 'noPermission' }
    return { error: mapWriteError(error.code, error.message, 'createFailed') }
  }

  revalidatePath(PATH)
  return {}
}

// An UPDATE refused by RLS matches zero rows rather than raising, so the
// row is selected back and an empty result is reported as noPermission.
export async function updateTemplate(id: string, formData: FormData): Promise<ActionResult & { template?: TemplateRow }> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('document_templates').update(readFields(formData)).eq('id', id).select(ROW)

  if (error) return { error: mapWriteError(error.code, error.message, 'saveFailed') }
  if (!data || data.length === 0) return { error: 'noPermission' }

  revalidatePath(PATH)
  return { template: data[0] }
}

// No delete - there is no DELETE grant. Deactivating hides a template from
// the case page's picker; drafts already made from it are untouched.
export async function setTemplateActive(id: string, active: boolean): Promise<ActionResult & { template?: TemplateRow }> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('document_templates').update({ is_active: active }).eq('id', id).select(ROW)

  if (error) return { error: 'saveFailed' }
  if (!data || data.length === 0) return { error: 'noPermission' }

  revalidatePath(PATH)
  return { template: data[0] }
}
