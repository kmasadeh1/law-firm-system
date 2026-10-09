'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const PATH = '/dashboard/reference/checklists'

// Closed set the server can return - the render site validates against a
// whitelist before calling t(), same convention as the other reference
// lists. 'noName' maps the checklist_item_has_a_name CHECK (23514) by
// constraint name.
export type ChecklistItemErrorCode =
  | 'noName'
  | 'noPermission'
  | 'createFailed'
  | 'saveFailed'
  | 'reorderFailed'

type ActionResult = { error?: ChecklistItemErrorCode }

export type ChecklistItemRow = {
  id: string
  case_type_id: string
  name_en: string | null
  name_ar: string | null
  is_required: boolean
  sort_order: number
  is_active: boolean
}

const ROW = 'id, case_type_id, name_en, name_ar, is_required, sort_order, is_active'

function readNames(formData: FormData) {
  const name_en = formData.get('name_en')
  const name_ar = formData.get('name_ar')
  return {
    name_en: typeof name_en === 'string' && name_en.trim() ? name_en.trim() : null,
    // Sent as-is: a trigger stores a blank Arabic name as NULL.
    name_ar: typeof name_ar === 'string' ? name_ar : '',
  }
}

function mapWriteError(code: string, message: string, fallback: ChecklistItemErrorCode): ChecklistItemErrorCode {
  if (code === '23514' && message.includes('checklist_item_has_a_name')) return 'noName'
  return fallback
}

// Every item in a case type's list - active or not, since a deactivated
// item must stay visible here to be reactivated - in display order.
async function listForType(supabase: Awaited<ReturnType<typeof createClient>>, caseTypeId: string) {
  return supabase
    .from('document_checklist_items')
    .select('id, sort_order')
    .eq('case_type_id', caseTypeId)
    .order('sort_order')
    .order('created_at')
}

export async function createChecklistItem(caseTypeId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient()

  // New items go to the end of their case type's list.
  const { data: existing } = await listForType(supabase, caseTypeId)
  const last = existing?.[existing.length - 1]
  const sort_order = last ? last.sort_order + 1 : 0

  const { error } = await supabase.from('document_checklist_items').insert({
    case_type_id: caseTypeId,
    ...readNames(formData),
    is_required: formData.get('is_required') === 'on',
    sort_order,
  })

  if (error) {
    if (error.code === '42501') return { error: 'noPermission' }
    return { error: mapWriteError(error.code, error.message, 'createFailed') }
  }

  revalidatePath(PATH)
  return {}
}

// An UPDATE refused by RLS matches zero rows rather than raising, so every
// update checks it got a row back and reports noPermission otherwise.
async function updateItem(
  id: string,
  patch: Partial<Pick<ChecklistItemRow, 'name_en' | 'name_ar' | 'is_required' | 'is_active'>>
): Promise<ActionResult & { item?: ChecklistItemRow }> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('document_checklist_items').update(patch).eq('id', id).select(ROW)

  if (error) return { error: mapWriteError(error.code, error.message, 'saveFailed') }
  if (!data || data.length === 0) return { error: 'noPermission' }

  revalidatePath(PATH)
  return { item: data[0] }
}

export async function renameChecklistItem(id: string, formData: FormData) {
  return updateItem(id, readNames(formData))
}

export async function setChecklistItemRequired(id: string, required: boolean) {
  return updateItem(id, { is_required: required })
}

// No delete, by design and by the database: document_checklist_items has
// no DELETE policy or grant (42501), because a deleted item would cascade
// away every case's record of it. Deactivating hides the item from every
// case's checklist while keeping those statuses.
export async function setChecklistItemActive(id: string, active: boolean) {
  return updateItem(id, { is_active: active })
}

// Swaps sort_order with the neighbour inside the same case type - the same
// approach (and the same caveat) as the site-content lists: two separate
// statements, so not atomic, and both results are checked so a half-done
// move is reported rather than passed off as success.
export async function moveChecklistItem(
  caseTypeId: string,
  id: string,
  direction: 'up' | 'down'
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: rows, error: readError } = await listForType(supabase, caseTypeId)
  if (readError || !rows) return { error: 'reorderFailed' }

  const index = rows.findIndex((row) => row.id === id)
  const neighborIndex = direction === 'up' ? index - 1 : index + 1
  // The controls are disabled at either edge; reaching here means a stale
  // page, and doing nothing is the right answer.
  if (index === -1 || neighborIndex < 0 || neighborIndex >= rows.length) return {}

  const current = rows[index]
  const neighbor = rows[neighborIndex]
  const [first, second] = await Promise.all([
    supabase.from('document_checklist_items').update({ sort_order: neighbor.sort_order }).eq('id', current.id).select('id'),
    supabase.from('document_checklist_items').update({ sort_order: current.sort_order }).eq('id', neighbor.id).select('id'),
  ])
  if (first.error || second.error || !first.data?.length || !second.data?.length) {
    return { error: 'reorderFailed' }
  }

  revalidatePath(PATH)
  return {}
}
