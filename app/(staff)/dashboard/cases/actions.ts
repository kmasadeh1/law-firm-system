'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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

  if (typeof client_id !== 'string' || !client_id) {
    return { error: 'Select a client.' }
  }
  if (typeof title !== 'string' || !title.trim()) {
    return { error: 'Title is required.' }
  }
  if (typeof case_number !== 'string' || !case_number.trim()) {
    return { error: 'Case number is required.' }
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
    return { error: 'Could not determine the starting status. Please try again.' }
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
      return { error: 'That case number is already in use.' }
    }
    return { error: 'Could not create the case. Please try again.' }
  }

  revalidatePath('/dashboard/cases')
  return { caseId: inserted.id }
}

// --- Status --------------------------------------------------------------

export async function setCaseStatus(caseId: string, statusId: string): Promise<ActionResult> {
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
    return { error: 'Could not update the status. Please try again.' }
  }

  revalidatePath(casePath(caseId))
  return {}
}

// --- Team ------------------------------------------------------------------

export async function addTeamMember(
  caseId: string,
  staffId: string,
  isLead: boolean
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('case_lawyers')
    .insert({ case_id: caseId, staff_id: staffId, is_lead: isLead })

  if (error) {
    if (error.code === '23505' && error.message.includes('case_lawyers_one_lead')) {
      return {
        error:
          'This case already has a lead lawyer. Remove them as lead first, then promote someone else.',
      }
    }
    if (error.code === '23505') {
      return { error: 'That person is already on this case.' }
    }
    if (error.code === '42501') {
      return { error: "You don't have permission to change this case's team." }
    }
    return { error: 'Could not add them to the case. Please try again.' }
  }

  revalidatePath(casePath(caseId))
  return {}
}

export async function setTeamMemberLead(
  caseId: string,
  staffId: string,
  isLead: boolean
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('case_lawyers')
    .update({ is_lead: isLead })
    .eq('case_id', caseId)
    .eq('staff_id', staffId)
    .select('staff_id')

  if (error) {
    if (error.code === '23505' && error.message.includes('case_lawyers_one_lead')) {
      return {
        error:
          'This case already has a lead lawyer. Remove them as lead first, then promote someone else.',
      }
    }
    return { error: 'Could not update the team. Please try again.' }
  }

  // UPDATE blocked by RLS matches zero rows rather than erroring - treat
  // that the same as a denial rather than silently doing nothing.
  if (!data || data.length === 0) {
    return { error: "You don't have permission to change this case's team." }
  }

  revalidatePath(casePath(caseId))
  return {}
}

export async function removeTeamMember(caseId: string, staffId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('case_lawyers')
    .delete()
    .eq('case_id', caseId)
    .eq('staff_id', staffId)
    .select('staff_id')

  if (error) {
    return { error: 'Could not remove them from the case. Please try again.' }
  }

  if (!data || data.length === 0) {
    return { error: "You don't have permission to change this case's team, or they're already off it." }
  }

  revalidatePath(casePath(caseId))
  return {}
}

// --- Opposing parties ------------------------------------------------------

export async function addOpposingParty(
  caseId: string,
  formData: FormData,
  confirmed: boolean
): Promise<ActionResult & { matches?: ConflictMatch[] }> {
  const name = formData.get('name')
  const national_id = formData.get('national_id')

  if (typeof name !== 'string' || !name.trim()) {
    return { error: 'Name is required.' }
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
      return { error: 'Could not run the conflict check. Please try again.' }
    }
    if (matches && matches.length > 0) {
      return { matches }
    }
  }

  const { error } = await supabase
    .from('case_opposing_parties')
    .insert({ case_id: caseId, name: trimmedName, national_id: trimmedNationalId })

  if (error) {
    return { error: 'Could not add the opposing party. Please try again.' }
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
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_case_share_link', {
    p_case_id: caseId,
    p_expires_days: expiresDays,
    p_label: label ?? undefined,
  })

  if (error) {
    if (error.code === '42501') {
      return { error: "You don't have permission to share this case." }
    }
    return { error: 'Could not generate a share link. Please try again.' }
  }

  revalidatePath(casePath(caseId))
  return { token: data }
}

// --- Notes ---------------------------------------------------------------

export async function addCaseNote(caseId: string, formData: FormData): Promise<ActionResult> {
  const note = formData.get('note')
  if (typeof note !== 'string' || !note.trim()) {
    return { error: 'Write something before adding the note.' }
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
      return { error: "You don't have permission to add notes to this case." }
    }
    return { error: 'Could not add the note. Please try again.' }
  }

  revalidatePath(casePath(caseId))
  return {}
}

export async function editCaseNote(
  caseId: string,
  noteId: string,
  formData: FormData
): Promise<ActionResult> {
  const note = formData.get('note')
  if (typeof note !== 'string' || !note.trim()) {
    return { error: 'A note cannot be empty.' }
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
    return { error: 'Could not save the note. Please try again.' }
  }
  if (!data || data.length === 0) {
    return { error: "You don't have permission to edit this note." }
  }

  revalidatePath(casePath(caseId))
  return {}
}

export async function deleteCaseNote(caseId: string, noteId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('case_notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', noteId)
    .eq('case_id', caseId)
    .select('id')

  if (error) {
    return { error: 'Could not delete the note. Please try again.' }
  }
  if (!data || data.length === 0) {
    return { error: "You don't have permission to delete this note." }
  }

  revalidatePath(casePath(caseId))
  return {}
}

export async function restoreCaseNote(caseId: string, noteId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('case_notes')
    .update({ deleted_at: null })
    .eq('id', noteId)
    .eq('case_id', caseId)
    .select('id')

  if (error) {
    return { error: 'Could not restore the note. Please try again.' }
  }
  if (!data || data.length === 0) {
    return { error: "You don't have permission to restore this note." }
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
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose a file to upload.' }
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return { error: 'That file is larger than the 25 MB limit.' }
  }
  const contentType = resolveContentType(file)
  if (!contentType || !ALLOWED_MIME_TYPES.has(contentType)) {
    return {
      error:
        "That file type isn't supported. Allowed: PDF, Word, Excel, plain text, or common image formats (including HEIC).",
    }
  }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getClaims()
  const path = `${caseId}/${crypto.randomUUID()}-${file.name}`

  const { error: uploadError } = await supabase.storage
    .from('case-documents')
    .upload(path, file, { contentType })

  if (uploadError) {
    return { error: "Could not upload the file - you may not have permission to add documents to this case." }
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
    return { error: 'Could not save the document record. Please try again.' }
  }

  revalidatePath(casePath(caseId))
  return {}
}

export async function getDocumentSignedUrl(
  caseId: string,
  documentId: string
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient()
  const { data: doc, error: fetchError } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('id', documentId)
    .eq('case_id', caseId)
    .maybeSingle()

  if (fetchError || !doc) {
    return { error: "Could not find that document, or you don't have permission to view it." }
  }

  const { data, error } = await supabase.storage
    .from('case-documents')
    .createSignedUrl(doc.storage_path, 300)

  if (error || !data) {
    return { error: 'Could not generate a link to that file. Please try again.' }
  }

  return { url: data.signedUrl }
}

export async function deleteDocument(caseId: string, documentId: string): Promise<ActionResult> {
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
    return { error: 'Could not remove the document. Please try again.' }
  }
  if (!data || data.length === 0) {
    return { error: "You don't have permission to remove this document." }
  }

  revalidatePath(casePath(caseId))
  return {}
}

export async function restoreDocument(caseId: string, documentId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documents')
    .update({ deleted_at: null })
    .eq('id', documentId)
    .eq('case_id', caseId)
    .select('id')

  if (error) {
    return { error: 'Could not restore the document. Please try again.' }
  }
  if (!data || data.length === 0) {
    return { error: "You don't have permission to restore this document." }
  }

  revalidatePath(casePath(caseId))
  return {}
}

export async function revokeShareLink(caseId: string, linkId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('case_share_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', linkId)
    .eq('case_id', caseId)
    .select('id')

  if (error) {
    return { error: 'Could not revoke the link. Please try again.' }
  }

  // UPDATE blocked by RLS matches zero rows rather than erroring - treat
  // that the same as a denial rather than silently doing nothing.
  if (!data || data.length === 0) {
    return { error: "You don't have permission to revoke this link." }
  }

  revalidatePath(casePath(caseId))
  return {}
}
