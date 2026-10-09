'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolvePlaceholders } from './resolve-placeholders'
import type { DraftLanguage } from '@/lib/document-placeholders'

// Closed set the server can return; the draft UI validates against a
// whitelist before calling t(). The two CHECKs are told apart by name.
export type DraftErrorCode =
  | 'templateUnavailable'
  | 'titleRequired'
  | 'bodyRequired'
  | 'noPermission'
  | 'generateFailed'
  | 'saveFailed'
  | 'deleteFailed'

type DraftResult = { error?: DraftErrorCode }

// created_by, updated_at, updated_by and deleted_by are stamped by the
// document_drafts_stamp trigger and are never sent from here.

function mapCheck(message: string): DraftErrorCode | null {
  if (message.includes('document_draft_title_not_blank')) return 'titleRequired'
  if (message.includes('document_draft_body_not_blank')) return 'bodyRequired'
  return null
}

function revalidateDraft(caseId: string, draftId?: string) {
  revalidatePath(`/dashboard/cases/${caseId}`)
  if (draftId) revalidatePath(`/dashboard/cases/${caseId}/drafts/${draftId}`)
}

// Generates a draft from a template in the chosen language. Placeholders are
// resolved here, on the server, from the case; the draft stores the
// resulting plain text, which the lawyer then edits. The template text
// itself is never changed.
export async function generateDraft(
  caseId: string,
  templateId: string,
  language: DraftLanguage
): Promise<DraftResult & { draftId?: string }> {
  if (language !== 'en' && language !== 'ar') return { error: 'templateUnavailable' }

  const supabase = await createClient()
  const { data: template } = await supabase
    .from('document_templates')
    .select('name_en, name_ar, body_en, body_ar, is_active')
    .eq('id', templateId)
    .maybeSingle()

  const body = language === 'ar' ? template?.body_ar : template?.body_en
  if (!template || !template.is_active || !body) return { error: 'templateUnavailable' }

  // The title is the template's name in the draft's language, falling back
  // to the other one - a template need only have one name.
  const title = (language === 'ar' ? (template.name_ar ?? template.name_en) : (template.name_en ?? template.name_ar)) ?? ''

  const { data, error } = await supabase
    .from('document_drafts')
    .insert({
      case_id: caseId,
      template_id: templateId,
      title,
      body: await resolvePlaceholders(caseId, body, language),
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '42501') return { error: 'noPermission' }
    if (error.code === '23514') return { error: mapCheck(error.message) ?? 'generateFailed' }
    return { error: 'generateFailed' }
  }

  revalidateDraft(caseId)
  return { draftId: data.id }
}

export async function saveDraft(caseId: string, draftId: string, formData: FormData): Promise<DraftResult> {
  const title = formData.get('title')
  const body = formData.get('body')
  const supabase = await createClient()

  // Sent as typed; the CHECKs refuse a blank title or body.
  const { data, error } = await supabase
    .from('document_drafts')
    .update({
      title: typeof title === 'string' ? title.trim() : '',
      body: typeof body === 'string' ? body : '',
    })
    .eq('id', draftId)
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .select('id')

  if (error) {
    if (error.code === '23514') return { error: mapCheck(error.message) ?? 'saveFailed' }
    return { error: 'saveFailed' }
  }
  // An UPDATE refused by RLS matches zero rows rather than raising.
  if (!data || data.length === 0) return { error: 'noPermission' }

  revalidateDraft(caseId, draftId)
  return {}
}

// Soft delete only - there is no DELETE grant. deleted_by is stamped by the
// trigger.
export async function deleteDraft(caseId: string, draftId: string): Promise<DraftResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('document_drafts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', draftId)
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .select('id')

  if (error) return { error: 'deleteFailed' }
  if (!data || data.length === 0) return { error: 'noPermission' }

  revalidateDraft(caseId, draftId)
  return {}
}
