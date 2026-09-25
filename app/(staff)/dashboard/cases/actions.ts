'use server'

import { revalidatePath } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'

export type ConflictMatch = {
  source: string
  matched_id: string
  matched_name: string
  case_id: string | null
}

type ActionResult = { error?: string }

function casePath(caseId: string) {
  return `/dashboard/cases/${caseId}`
}

// --- Client picker (create case) -----------------------------------------

export type ClientOption = { id: string; full_name: string; national_id: string | null }

export async function searchClients(term: string): Promise<ClientOption[]> {
  const trimmed = term.trim()
  if (!trimmed) return []

  const supabase = await createClient()
  const { data } = await supabase
    .rpc('search_clients', { p_query: trimmed })
    .select('id, full_name, national_id')
    .limit(10)

  return data ?? []
}

// --- Create case --------------------------------------------------------

export async function createCase(
  formData: FormData
): Promise<ActionResult & { caseId?: string }> {
  const client_id = formData.get('client_id')
  const title = formData.get('title')
  const case_number = formData.get('case_number')
  const case_type = formData.get('case_type')

  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.cases.new.errors' })

  if (typeof client_id !== 'string' || !client_id) {
    return { error: t('selectClient') }
  }
  if (typeof title !== 'string' || !title.trim()) {
    return { error: t('titleRequired') }
  }
  if (typeof case_number !== 'string' || !case_number.trim()) {
    return { error: t('caseNumberRequired') }
  }

  const supabase = await createClient()

  // Default status is the first non-terminal stage by sort_order - never a
  // status picker at creation time.
  const { data: firstStatus, error: statusError } = await supabase
    .from('case_statuses')
    .select('id')
    .eq('is_terminal', false)
    .order('sort_order')
    .limit(1)
    .single()

  if (statusError || !firstStatus) {
    return { error: t('statusLookupFailed') }
  }

  const { data: user } = await supabase.auth.getClaims()

  const { data: inserted, error } = await supabase
    .from('cases')
    .insert({
      client_id,
      title: title.trim(),
      case_number: case_number.trim(),
      case_type: typeof case_type === 'string' && case_type.trim() ? case_type.trim() : null,
      status_id: firstStatus.id,
      created_by: user?.claims?.sub,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { error: t('caseNumberInUse') }
    }
    return { error: t('createFailed') }
  }

  revalidatePath('/dashboard/cases')
  return { caseId: inserted.id }
}

// --- Status --------------------------------------------------------------

export async function setCaseStatus(caseId: string, statusId: string): Promise<ActionResult> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.cases.detail.status.errors' })
  const supabase = await createClient()
  const { error } = await supabase
    .from('cases')
    .update({ status_id: statusId })
    .eq('id', caseId)

  if (error) {
    // The close-permission trigger raises a plain exception whose message
    // is already the friendly text we want - just surface it.
    if (error.code === 'P0001') {
      return { error: error.message }
    }
    return { error: t('updateFailed') }
  }

  revalidatePath(casePath(caseId))
  return {}
}

// --- Team ------------------------------------------------------------------

// Closed sets of codes, not translated strings - the server decides WHAT
// HAPPENED, the render site (team-section.tsx) decides HOW TO SAY IT. See
// TeamErrorCode/OpposingPartyErrorCode for the full sets these functions can
// return; a caller-controlled value never reaches next-intl's t() directly.
export type TeamErrorCode =
  | 'already_has_lead'
  | 'already_on_case'
  | 'no_permission_change'
  | 'add_failed'
  | 'update_failed'
  | 'remove_failed'
  | 'no_permission_remove'

type TeamActionResult = { error?: TeamErrorCode }

export async function addTeamMember(
  caseId: string,
  staffId: string,
  isLead: boolean
): Promise<TeamActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('case_lawyers')
    .insert({ case_id: caseId, staff_id: staffId, is_lead: isLead })

  if (error) {
    if (error.code === '23505' && error.message.includes('case_lawyers_one_lead')) {
      return { error: 'already_has_lead' }
    }
    if (error.code === '23505') {
      return { error: 'already_on_case' }
    }
    if (error.code === '42501') {
      return { error: 'no_permission_change' }
    }
    return { error: 'add_failed' }
  }

  revalidatePath(casePath(caseId))
  return {}
}

export async function setTeamMemberLead(
  caseId: string,
  staffId: string,
  isLead: boolean
): Promise<TeamActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('case_lawyers')
    .update({ is_lead: isLead })
    .eq('case_id', caseId)
    .eq('staff_id', staffId)
    .select('staff_id')

  if (error) {
    if (error.code === '23505' && error.message.includes('case_lawyers_one_lead')) {
      return { error: 'already_has_lead' }
    }
    return { error: 'update_failed' }
  }

  // UPDATE blocked by RLS matches zero rows rather than erroring - treat
  // that the same as a denial rather than silently doing nothing.
  if (!data || data.length === 0) {
    return { error: 'no_permission_change' }
  }

  revalidatePath(casePath(caseId))
  return {}
}

export async function removeTeamMember(caseId: string, staffId: string): Promise<TeamActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('case_lawyers')
    .delete()
    .eq('case_id', caseId)
    .eq('staff_id', staffId)
    .select('staff_id')

  if (error) {
    return { error: 'remove_failed' }
  }

  if (!data || data.length === 0) {
    return { error: 'no_permission_remove' }
  }

  revalidatePath(casePath(caseId))
  return {}
}

// --- Opposing parties ------------------------------------------------------

export type OpposingPartyErrorCode = 'name_required' | 'conflict_check_failed' | 'add_failed'

type OpposingPartyActionResult = { error?: OpposingPartyErrorCode }

export async function addOpposingParty(
  caseId: string,
  formData: FormData,
  confirmed: boolean
): Promise<OpposingPartyActionResult & { matches?: ConflictMatch[] }> {
  const name = formData.get('name')
  const national_id = formData.get('national_id')

  if (typeof name !== 'string' || !name.trim()) {
    return { error: 'name_required' }
  }
  const trimmedName = name.trim()
  const trimmedNationalId =
    typeof national_id === 'string' && national_id.trim() ? national_id.trim() : null

  const supabase = await createClient()

  if (!confirmed) {
    const { data: matches, error: conflictError } = await supabase.rpc('check_conflict', {
      p_name: trimmedName,
      p_national_id: trimmedNationalId ?? undefined,
    })

    if (conflictError) {
      return { error: 'conflict_check_failed' }
    }
    if (matches && matches.length > 0) {
      return { matches }
    }
  }

  const { error } = await supabase
    .from('case_opposing_parties')
    .insert({ case_id: caseId, name: trimmedName, national_id: trimmedNationalId })

  if (error) {
    return { error: 'add_failed' }
  }

  revalidatePath(casePath(caseId))
  return {}
}

// --- Share links -------------------------------------------------------

export async function createShareLink(
  caseId: string,
  expiresDays: number,
  label: string | null
): Promise<ActionResult & { token?: string }> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.cases.detail.shareLinks.errors' })
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_case_share_link', {
    p_case_id: caseId,
    p_expires_days: expiresDays,
    p_label: label ?? undefined,
  })

  if (error) {
    if (error.code === '42501') {
      return { error: t('noPermissionShare') }
    }
    return { error: t('generateFailed') }
  }

  revalidatePath(casePath(caseId))
  return { token: data }
}

// --- Notes ---------------------------------------------------------------

export async function addCaseNote(caseId: string, formData: FormData): Promise<ActionResult> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.cases.detail.notes.errors' })
  const note = formData.get('note')
  if (typeof note !== 'string' || !note.trim()) {
    return { error: t('writeSomething') }
  }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getClaims()

  const { error } = await supabase.from('case_notes').insert({
    case_id: caseId,
    staff_id: userData?.claims?.sub,
    note: note.trim(),
  })

  if (error) {
    if (error.code === '42501') {
      return { error: t('noPermissionAdd') }
    }
    return { error: t('addFailed') }
  }

  revalidatePath(casePath(caseId))
  return {}
}

export async function editCaseNote(
  caseId: string,
  noteId: string,
  formData: FormData
): Promise<ActionResult> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.cases.detail.notes.errors' })
  const note = formData.get('note')
  if (typeof note !== 'string' || !note.trim()) {
    return { error: t('cannotBeEmpty') }
  }

  const supabase = await createClient()
  // case_id, staff_id, and created_at are trigger-guarded against change -
  // only ever send the field being edited.
  const { data, error } = await supabase
    .from('case_notes')
    .update({ note: note.trim() })
    .eq('id', noteId)
    .eq('case_id', caseId)
    .select('id')

  if (error) {
    return { error: t('saveFailed') }
  }
  if (!data || data.length === 0) {
    return { error: t('noPermissionEdit') }
  }

  revalidatePath(casePath(caseId))
  return {}
}

export async function deleteCaseNote(caseId: string, noteId: string): Promise<ActionResult> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.cases.detail.notes.errors' })
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('case_notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', noteId)
    .eq('case_id', caseId)
    .select('id')

  if (error) {
    return { error: t('deleteFailed') }
  }
  if (!data || data.length === 0) {
    return { error: t('noPermissionDelete') }
  }

  revalidatePath(casePath(caseId))
  return {}
}

export async function restoreCaseNote(caseId: string, noteId: string): Promise<ActionResult> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.cases.detail.notes.errors' })
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('case_notes')
    .update({ deleted_at: null })
    .eq('id', noteId)
    .eq('case_id', caseId)
    .select('id')

  if (error) {
    return { error: t('restoreFailed') }
  }
  if (!data || data.length === 0) {
    return { error: t('noPermissionRestore') }
  }

  revalidatePath(casePath(caseId))
  return {}
}

// --- Documents ---------------------------------------------------------

const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024

// Mirrors the case-documents bucket's allowed_mime_types exactly - this is
// user feedback so a rejected upload gets a clear reason instead of an
// opaque storage error. The real enforcement is the bucket config itself.
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/tiff',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
])

const EXTENSION_MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
}

// Some browsers (notably HEIC uploads from an Android share sheet) report an
// empty or generic file.type despite the file being a supported format -
// fall back to the extension so those aren't rejected on a technicality.
function resolveContentType(file: File): string | undefined {
  if (file.type) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase()
  return ext ? EXTENSION_MIME_TYPES[ext] : undefined
}

export async function uploadDocument(caseId: string, formData: FormData): Promise<ActionResult> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.cases.detail.documents.errors' })
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { error: t('chooseFile') }
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return { error: t('fileTooLarge') }
  }
  const contentType = resolveContentType(file)
  if (!contentType || !ALLOWED_MIME_TYPES.has(contentType)) {
    return { error: t('fileTypeNotSupported') }
  }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getClaims()
  const path = `${caseId}/${crypto.randomUUID()}-${file.name}`

  const { error: uploadError } = await supabase.storage
    .from('case-documents')
    .upload(path, file, { contentType })

  if (uploadError) {
    return { error: t('uploadFailed') }
  }

  const { error: insertError } = await supabase.from('documents').insert({
    case_id: caseId,
    storage_path: path,
    filename: file.name,
    uploaded_by: userData?.claims?.sub,
  })

  if (insertError) {
    // A storage object with no metadata row is invisible and orphaned -
    // clean it up rather than leaving it behind.
    await supabase.storage.from('case-documents').remove([path])
    return { error: t('saveRecordFailed') }
  }

  revalidatePath(casePath(caseId))
  return {}
}

export async function getDocumentSignedUrl(
  caseId: string,
  documentId: string
): Promise<{ url?: string; error?: string }> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.cases.detail.documents.errors' })
  const supabase = await createClient()
  const { data: doc, error: fetchError } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('id', documentId)
    .eq('case_id', caseId)
    .maybeSingle()

  if (fetchError || !doc) {
    return { error: t('notFound') }
  }

  const { data, error } = await supabase.storage
    .from('case-documents')
    .createSignedUrl(doc.storage_path, 300)

  if (error || !data) {
    return { error: t('linkGenerationFailed') }
  }

  return { url: data.signedUrl }
}

export async function deleteDocument(caseId: string, documentId: string): Promise<ActionResult> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.cases.detail.documents.errors' })
  const supabase = await createClient()
  // Soft delete only - the storage object is deliberately left in place.
  // Only the metadata row is hidden (RLS), same reasoning as case notes.
  const { data, error } = await supabase
    .from('documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', documentId)
    .eq('case_id', caseId)
    .select('id')

  if (error) {
    return { error: t('removeFailed') }
  }
  if (!data || data.length === 0) {
    return { error: t('noPermissionRemove') }
  }

  revalidatePath(casePath(caseId))
  return {}
}

export async function restoreDocument(caseId: string, documentId: string): Promise<ActionResult> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.cases.detail.documents.errors' })
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documents')
    .update({ deleted_at: null })
    .eq('id', documentId)
    .eq('case_id', caseId)
    .select('id')

  if (error) {
    return { error: t('restoreFailed') }
  }
  if (!data || data.length === 0) {
    return { error: t('noPermissionRestore') }
  }

  revalidatePath(casePath(caseId))
  return {}
}

// --- Expenses ------------------------------------------------------------

async function parseAmount(
  formData: FormData,
  t: Awaited<ReturnType<typeof getTranslations>>
): Promise<number | { error: string }> {
  const raw = formData.get('amount')
  if (typeof raw !== 'string' || !raw.trim()) return { error: t('amountRequired') }
  const amount = Number(raw)
  if (!Number.isFinite(amount) || amount <= 0) return { error: t('invalidAmount') }
  return amount
}

export async function addExpense(caseId: string, formData: FormData): Promise<ActionResult> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.cases.detail.expenses.errors' })
  const description = formData.get('description')
  const incurredAt = formData.get('incurred_at')

  if (typeof description !== 'string' || !description.trim()) {
    return { error: t('descriptionRequired') }
  }
  if (typeof incurredAt !== 'string' || !incurredAt) {
    return { error: t('incurredRequired') }
  }
  const amount = await parseAmount(formData, t)
  if (typeof amount !== 'number') return amount

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getClaims()

  const { error } = await supabase.from('expenses').insert({
    case_id: caseId,
    description: description.trim(),
    amount,
    incurred_at: incurredAt,
    recorded_by: userData?.claims?.sub,
  })

  if (error) {
    if (error.code === '42501') {
      return { error: t('noPermissionRecord') }
    }
    return { error: t('recordFailed') }
  }

  revalidatePath(casePath(caseId))
  return {}
}

export async function editExpense(
  caseId: string,
  expenseId: string,
  formData: FormData
): Promise<ActionResult> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.cases.detail.expenses.errors' })
  const description = formData.get('description')
  const incurredAt = formData.get('incurred_at')

  if (typeof description !== 'string' || !description.trim()) {
    return { error: t('descriptionRequired') }
  }
  if (typeof incurredAt !== 'string' || !incurredAt) {
    return { error: t('incurredRequired') }
  }
  const amount = await parseAmount(formData, t)
  if (typeof amount !== 'number') return amount

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('expenses')
    .update({ description: description.trim(), amount, incurred_at: incurredAt })
    .eq('id', expenseId)
    .eq('case_id', caseId)
    .select('id')

  if (error) {
    return { error: t('saveFailed') }
  }
  if (!data || data.length === 0) {
    return { error: t('noPermissionEdit') }
  }

  revalidatePath(casePath(caseId))
  return {}
}

export async function setExpenseReimbursed(
  caseId: string,
  expenseId: string,
  reimbursed: boolean
): Promise<ActionResult> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.cases.detail.expenses.errors' })
  const supabase = await createClient()
  // reimbursed and reimbursed_at are set together so they can never
  // disagree - there's no database constraint enforcing that pairing, so
  // this is the only place either field is ever written.
  const { data, error } = await supabase
    .from('expenses')
    .update({
      reimbursed,
      reimbursed_at: reimbursed ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq('id', expenseId)
    .eq('case_id', caseId)
    .select('id')

  if (error) {
    return { error: t('reimbursedUpdateFailed') }
  }
  if (!data || data.length === 0) {
    return { error: t('noPermissionUpdate') }
  }

  revalidatePath(casePath(caseId))
  return {}
}

export async function deleteExpense(caseId: string, expenseId: string): Promise<ActionResult> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.cases.detail.expenses.errors' })
  const supabase = await createClient()
  // Expenses allow a real DELETE (unlike case_notes/documents) - existing
  // schema, not something to soften into a soft delete here.
  const { data, error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', expenseId)
    .eq('case_id', caseId)
    .select('id')

  if (error) {
    return { error: t('deleteFailed') }
  }
  if (!data || data.length === 0) {
    return { error: t('noPermissionDelete') }
  }

  revalidatePath(casePath(caseId))
  return {}
}

export async function revokeShareLink(caseId: string, linkId: string): Promise<ActionResult> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.cases.detail.shareLinks.errors' })
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('case_share_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', linkId)
    .eq('case_id', caseId)
    .select('id')

  if (error) {
    return { error: t('revokeFailed') }
  }

  // UPDATE blocked by RLS matches zero rows rather than erroring - treat
  // that the same as a denial rather than silently doing nothing.
  if (!data || data.length === 0) {
    return { error: t('noPermissionRevoke') }
  }

  revalidatePath(casePath(caseId))
  return {}
}
