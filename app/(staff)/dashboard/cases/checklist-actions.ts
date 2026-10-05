'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { Constants, type Database } from '@/lib/supabase/database.types'

type ChecklistState = Database['public']['Enums']['checklist_state']

// Closed set the server can return; the section validates against a
// whitelist before calling t(). documentNotOnCase maps the
// checklist_document_on_case trigger (23514) by name.
export type ChecklistErrorCode = 'invalidState' | 'documentNotOnCase' | 'noPermission' | 'saveFailed' | 'clearFailed'

type ActionResult = { error?: ChecklistErrorCode }

// A case's checklist is derived from its case type's template; only an
// item's status is stored. Recording one is an upsert on the
// (case_id, item_id) unique constraint, so a second save updates rather
// than raising 23505.
export async function setChecklistStatus(caseId: string, itemId: string, formData: FormData): Promise<ActionResult> {
  const state = formData.get('state')
  // Narrows the type only - an unknown value would be refused by the enum.
  if (typeof state !== 'string' || !(Constants.public.Enums.checklist_state as readonly string[]).includes(state)) {
    return { error: 'invalidState' }
  }
  const note = formData.get('note')
  const documentId = formData.get('document_id')

  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()

  const { data, error } = await supabase
    .from('case_checklist_status')
    .upsert(
      {
        case_id: caseId,
        item_id: itemId,
        state: state as ChecklistState,
        note: typeof note === 'string' && note.trim() ? note.trim() : null,
        document_id: typeof documentId === 'string' && documentId ? documentId : null,
        // Who recorded it and when, refreshed on every change. The table
        // has no trigger stamping these, so they're set from the signed-in
        // user here.
        noted_by: claims?.claims?.sub as string,
        noted_at: new Date().toISOString(),
      },
      { onConflict: 'case_id,item_id' }
    )
    .select('id')

  if (error) {
    if (error.code === '23514' && error.message.includes('checklist_document_on_case')) {
      return { error: 'documentNotOnCase' }
    }
    if (error.code === '42501') return { error: 'noPermission' }
    return { error: 'saveFailed' }
  }
  // An update refused by RLS (the row exists) matches zero rows.
  if (!data || data.length === 0) return { error: 'noPermission' }

  revalidatePath(`/dashboard/cases/${caseId}`)
  return {}
}

// Back to outstanding: the status row is deleted - "outstanding" is the
// absence of a status, not a third state.
export async function clearChecklistStatus(caseId: string, itemId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('case_checklist_status')
    .delete()
    .eq('case_id', caseId)
    .eq('item_id', itemId)
    .select('id')

  if (error) return { error: 'clearFailed' }
  if (!data || data.length === 0) return { error: 'noPermission' }

  revalidatePath(`/dashboard/cases/${caseId}`)
  return {}
}
