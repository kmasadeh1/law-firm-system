'use server'

import { revalidatePath } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { todayInFirmZone } from '@/lib/format-date-time'

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

// A caller-controlled value never reaches next-intl's t() directly - the
// render site validates against a whitelist, same as TeamErrorCode above.
export type CreateCaseErrorCode =
  | 'selectClient'
  | 'titleRequired'
  | 'caseNumberRequired'
  | 'statusLookupFailed'
  | 'caseNumberInUse'
  | 'noPermission'
  | 'createFailed'

type CreateCaseActionResult = { error?: CreateCaseErrorCode; caseId?: string }

export async function createCase(formData: FormData): Promise<CreateCaseActionResult> {
  const client_id = formData.get('client_id')
  const title = formData.get('title')
  const case_number = formData.get('case_number')
  const case_type_id = formData.get('case_type_id')

  if (typeof client_id !== 'string' || !client_id) {
    return { error: 'selectClient' }
  }
  if (typeof title !== 'string' || !title.trim()) {
    return { error: 'titleRequired' }
  }
  if (typeof case_number !== 'string' || !case_number.trim()) {
    return { error: 'caseNumberRequired' }
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
    return { error: 'statusLookupFailed' }
  }

  const { data: user } = await supabase.auth.getClaims()

  const { data: inserted, error } = await supabase
    .from('cases')
    .insert({
      client_id,
      title: title.trim(),
      case_number: case_number.trim(),
      case_type_id: typeof case_type_id === 'string' && case_type_id ? case_type_id : null,
      status_id: firstStatus.id,
      created_by: user?.claims?.sub,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { error: 'caseNumberInUse' }
    }
    if (error.code === '42501') {
      return { error: 'noPermission' }
    }
    return { error: 'createFailed' }
  }

  revalidatePath('/dashboard/cases')
  return { caseId: inserted.id }
}

// --- Status --------------------------------------------------------------

export async function setCaseStatus(caseId: string, statusId: string): Promise<ActionResult> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.cases.detail.status.errors' })
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cases')
    .update({ status_id: statusId })
    .eq('id', caseId)
    .select('id')

  // Never error.message - it's English Postgres text. Two refusals, two
  // messages: the close-permission trigger (moving an open case INTO a
  // terminal status as anyone but the lead lawyer or the owner) raises
  // 42501 naming itself; the update policy refusing the change altogether
  // raises nothing and matches zero rows.
  if (error) {
    if (error.code === '42501' && error.message.includes('enforce_case_close_permission')) {
      return { error: t('noPermissionClose') }
    }
    return { error: t('updateFailed') }
  }
  if (!data || data.length === 0) {
    return { error: t('noPermissionChange') }
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
  const counsel_name = formData.get('counsel_name')
  const counsel_phone = formData.get('counsel_phone')

  if (typeof name !== 'string' || !name.trim()) {
    return { error: 'name_required' }
  }
  const trimmedName = name.trim()
  const trimmedNationalId =
    typeof national_id === 'string' && national_id.trim() ? national_id.trim() : null
  const trimmedCounselName =
    typeof counsel_name === 'string' && counsel_name.trim() ? counsel_name.trim() : null
  const trimmedCounselPhone =
    typeof counsel_phone === 'string' && counsel_phone.trim() ? counsel_phone.trim() : null

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

  const { error } = await supabase.from('case_opposing_parties').insert({
    case_id: caseId,
    name: trimmedName,
    national_id: trimmedNationalId,
    counsel_name: trimmedCounselName,
    counsel_phone: trimmedCounselPhone,
  })

  if (error) {
    return { error: 'add_failed' }
  }

  revalidatePath(casePath(caseId))
  return {}
}

// --- Court filings -----------------------------------------------------

// Closed set the server can return - same convention as TeamErrorCode /
// OpposingPartyErrorCode above. RLS write access is can_manage_case_details,
// the same function this page already resolves once for Team/Opposing
// parties/Deadlines - a denied write comes back as 42501 or (for
// update/delete) zero affected rows, never a thrown error the UI has to
// guess at.
export type CourtFilingErrorCode = 'selectCourt' | 'noPermission' | 'addFailed' | 'updateFailed' | 'removeFailed'

type CourtFilingActionResult = { error?: CourtFilingErrorCode }

type CourtFilingFields = {
  court_id: string
  court_case_number: string | null
  chamber: string | null
  judge_name: string | null
  filed_at: string | null
  is_current: boolean
  notes: string | null
}

function readCourtFilingFields(formData: FormData): CourtFilingFields | { error: CourtFilingErrorCode } {
  const court_id = formData.get('court_id')
  const court_case_number = formData.get('court_case_number')
  const chamber = formData.get('chamber')
  const judge_name = formData.get('judge_name')
  const filed_at = formData.get('filed_at')
  const notes = formData.get('notes')

  if (typeof court_id !== 'string' || !court_id) {
    return { error: 'selectCourt' }
  }

  return {
    court_id,
    court_case_number:
      typeof court_case_number === 'string' && court_case_number.trim() ? court_case_number.trim() : null,
    chamber: typeof chamber === 'string' && chamber.trim() ? chamber.trim() : null,
    judge_name: typeof judge_name === 'string' && judge_name.trim() ? judge_name.trim() : null,
    filed_at: typeof filed_at === 'string' && filed_at ? filed_at : null,
    is_current: formData.get('is_current') === 'on',
    notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
  }
}

export async function addCourtFiling(caseId: string, formData: FormData): Promise<CourtFilingActionResult> {
  const fields = readCourtFilingFields(formData)
  if ('error' in fields) return fields

  const supabase = await createClient()
  const { error } = await supabase.from('case_court_filings').insert({ case_id: caseId, ...fields })

  if (error) {
    if (error.code === '42501') {
      return { error: 'noPermission' }
    }
    return { error: 'addFailed' }
  }

  revalidatePath(casePath(caseId))
  return {}
}

export async function updateCourtFiling(
  caseId: string,
  filingId: string,
  formData: FormData
): Promise<CourtFilingActionResult> {
  const fields = readCourtFilingFields(formData)
  if ('error' in fields) return fields

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('case_court_filings')
    .update(fields)
    .eq('id', filingId)
    .eq('case_id', caseId)
    .select('id')

  if (error) {
    return { error: 'updateFailed' }
  }
  if (!data || data.length === 0) {
    return { error: 'noPermission' }
  }

  revalidatePath(casePath(caseId))
  return {}
}

export async function removeCourtFiling(caseId: string, filingId: string): Promise<CourtFilingActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('case_court_filings')
    .delete()
    .eq('id', filingId)
    .eq('case_id', caseId)
    .select('id')

  if (error) {
    return { error: 'removeFailed' }
  }
  if (!data || data.length === 0) {
    return { error: 'noPermission' }
  }

  revalidatePath(casePath(caseId))
  return {}
}

// --- Hearings ----------------------------------------------------------

// A hearing hangs off a court filing (hearings.filing_id), not off the case
// directly - a case at first instance and the same case on appeal are
// separate proceedings with separate session histories, so there's no
// single "hearings for this case" list, only "hearings for this filing".
export type HearingOutcome =
  | 'adjourned'
  | 'evidence'
  | 'pleadings'
  | 'reserved_for_judgment'
  | 'judgment'
  | 'settled'
  | 'withdrawn'
  | 'struck_out'
  | 'other'

const HEARING_OUTCOMES: HearingOutcome[] = [
  'adjourned',
  'evidence',
  'pleadings',
  'reserved_for_judgment',
  'judgment',
  'settled',
  'withdrawn',
  'struck_out',
  'other',
]

// Closed set the server can return - same convention as CourtFilingErrorCode
// above. hearings_notified_after_session and hearings_next_session_after_session
// both raise 23514 - they're different mistakes (a notification date before
// the session; a "next session" that isn't actually after this one) and are
// disambiguated by constraint name, never guessed from which field looks
// wrong, same as appointments/actions.ts's mapCheckViolation.
export type HearingErrorCode =
  | 'sessionDateRequired'
  | 'notifiedBeforeSession'
  | 'nextSessionNotAfterSession'
  | 'invalidAttendee'
  | 'noPermission'
  | 'addFailed'
  | 'updateFailed'
  | 'removeFailed'

type HearingActionResult = { error?: HearingErrorCode }

function mapHearingCheckViolation(message: string): HearingErrorCode | null {
  if (message.includes('hearings_notified_after_session')) return 'notifiedBeforeSession'
  if (message.includes('hearings_next_session_after_session')) return 'nextSessionNotAfterSession'
  return null
}

type HearingFields = {
  session_date: string
  session_time: string | null
  outcome: HearingOutcome | null
  what_happened: string | null
  decision: string | null
  next_session_date: string | null
  attended_by: string | null
  notified_at: string | null
}

function readHearingFields(formData: FormData): HearingFields | { error: HearingErrorCode } {
  const session_date = formData.get('session_date')
  const session_time = formData.get('session_time')
  const outcome = formData.get('outcome')
  const what_happened = formData.get('what_happened')
  const decision = formData.get('decision')
  const next_session_date = formData.get('next_session_date')
  const attended_by = formData.get('attended_by')
  const notified_at = formData.get('notified_at')

  if (typeof session_date !== 'string' || !session_date) {
    return { error: 'sessionDateRequired' }
  }

  return {
    session_date,
    session_time: typeof session_time === 'string' && session_time ? session_time : null,
    outcome:
      typeof outcome === 'string' && (HEARING_OUTCOMES as string[]).includes(outcome)
        ? (outcome as HearingOutcome)
        : null,
    what_happened: typeof what_happened === 'string' && what_happened.trim() ? what_happened.trim() : null,
    decision: typeof decision === 'string' && decision.trim() ? decision.trim() : null,
    next_session_date: typeof next_session_date === 'string' && next_session_date ? next_session_date : null,
    attended_by: typeof attended_by === 'string' && attended_by.trim() ? attended_by.trim() : null,
    notified_at: typeof notified_at === 'string' && notified_at ? notified_at : null,
  }
}

export async function addHearing(
  caseId: string,
  filingId: string,
  formData: FormData
): Promise<HearingActionResult> {
  const fields = readHearingFields(formData)
  if ('error' in fields) return fields

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getClaims()
  const { error } = await supabase
    .from('hearings')
    .insert({ filing_id: filingId, ...fields, created_by: userData?.claims?.sub })

  if (error) {
    if (error.code === '23514') {
      return { error: mapHearingCheckViolation(error.message) ?? 'addFailed' }
    }
    // attended_by is a uuid column - a stale client sending anything that
    // isn't one of the select's own option values (or empty) lands here.
    // The <select> built from active staff never produces this from normal
    // use; this is the defensive backstop, not the primary fix.
    if (error.code === '22P02') {
      return { error: 'invalidAttendee' }
    }
    if (error.code === '42501') {
      return { error: 'noPermission' }
    }
    return { error: 'addFailed' }
  }

  revalidatePath(casePath(caseId))
  return {}
}

export async function updateHearing(
  caseId: string,
  filingId: string,
  hearingId: string,
  formData: FormData
): Promise<HearingActionResult> {
  const fields = readHearingFields(formData)
  if ('error' in fields) return fields

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('hearings')
    .update(fields)
    .eq('id', hearingId)
    .eq('filing_id', filingId)
    .select('id')

  if (error) {
    if (error.code === '23514') {
      return { error: mapHearingCheckViolation(error.message) ?? 'updateFailed' }
    }
    if (error.code === '22P02') {
      return { error: 'invalidAttendee' }
    }
    return { error: 'updateFailed' }
  }
  if (!data || data.length === 0) {
    return { error: 'noPermission' }
  }

  revalidatePath(casePath(caseId))
  return {}
}

export async function removeHearing(
  caseId: string,
  filingId: string,
  hearingId: string
): Promise<HearingActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('hearings')
    .delete()
    .eq('id', hearingId)
    .eq('filing_id', filingId)
    .select('id')

  if (error) {
    return { error: 'removeFailed' }
  }
  if (!data || data.length === 0) {
    return { error: 'noPermission' }
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

// Parsing only - turning the field's text into a number. Whether the
// amount is acceptable (> 0) is the expenses_amount_positive CHECK's call,
// mapped by name where the insert/update fails.
function isAmountNotPositive(error: { code: string; message: string }) {
  return error.code === '23514' && error.message.includes('expenses_amount_positive')
}

async function parseAmount(
  formData: FormData,
  t: Awaited<ReturnType<typeof getTranslations>>
): Promise<number | { error: string }> {
  const raw = formData.get('amount')
  if (typeof raw !== 'string' || !raw.trim()) return { error: t('amountRequired') }
  const amount = Number(raw)
  if (!Number.isFinite(amount)) return { error: t('invalidAmount') }
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
    if (isAmountNotPositive(error)) {
      return { error: t('amountNotPositive') }
    }
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
    if (isAmountNotPositive(error)) {
      return { error: t('amountNotPositive') }
    }
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
  // reimbursed and reimbursed_at are written together; the
  // expenses_reimbursed_matches_date CHECK guarantees they agree, so this
  // can't leave them inconsistent even if it were wrong.
  const { data, error } = await supabase
    .from('expenses')
    .update({
      reimbursed,
      // Today in Amman - toISOString() would give the UTC date, which is
      // still yesterday until 03:00.
      reimbursed_at: reimbursed ? todayInFirmZone() : null,
    })
    .eq('id', expenseId)
    .eq('case_id', caseId)
    .select('id')

  if (error) {
    if (error.code === '23514' && error.message.includes('expenses_reimbursed_matches_date')) {
      return { error: t('reimbursedDateMismatch') }
    }
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
