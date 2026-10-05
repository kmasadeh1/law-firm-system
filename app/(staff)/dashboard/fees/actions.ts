'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { FeesErrorCode } from './error-codes'

type ActionResult = { error?: FeesErrorCode }

const UNIQUE_VIOLATION = '23505'
const FOREIGN_KEY_VIOLATION = '23503'
const CHECK_VIOLATION = '23514'
const INSUFFICIENT_PRIVILEGE = '42501'

// Raised by the engagement_cases_client_match trigger (23514) when a linked
// case belongs to a different client than the engagement. Matched by the
// name it puts at the start of its message, like a CHECK's.
function isWrongClientLink(error: { code: string; message: string }) {
  return error.code === CHECK_VIOLATION && error.message.includes('engagement_case_matches_client')
}

// Amount parsing only - turning the form's text into a number. Whether the
// amount is acceptable (> 0) is the database's call: the
// *_amount_positive CHECKs reject it and are mapped by name below.
function parseAmount(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  const amount = Number(raw)
  return Number.isNaN(amount) ? null : amount
}

const FEES_PATH = '/dashboard/fees'

function engagementPath(engagementId: string) {
  return `${FEES_PATH}/${engagementId}`
}

// --- Client picker (create engagement) -------------------------------------

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

// --- Case picker (link cases, both at creation and on the detail page) -----

export type CaseOption = { id: string; case_number: string; title: string }

// Scoped to a single client, not a text search - an engagement can only link
// cases that already belong to the client it was written for.
export async function listClientCases(clientId: string): Promise<CaseOption[]> {
  if (!clientId) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('cases')
    .select('id, case_number, title')
    .eq('client_id', clientId)
    .order('case_number')

  return data ?? []
}

// --- Create engagement -------------------------------------------------

export async function createEngagement(
  formData: FormData
): Promise<ActionResult & { engagementId?: string }> {
  const client_id = formData.get('client_id')
  const fee_type = formData.get('fee_type')
  const fixed_amount_raw = formData.get('fixed_amount')
  const percentage_raw = formData.get('percentage')
  const case_ids = formData.getAll('case_ids').filter((v): v is string => typeof v === 'string')

  if (typeof client_id !== 'string' || !client_id) {
    return { error: 'select_client' }
  }
  if (fee_type !== 'fixed' && fee_type !== 'percentage') {
    return { error: 'select_fee_type' }
  }

  const fixed_amount =
    fee_type === 'fixed' && typeof fixed_amount_raw === 'string' && fixed_amount_raw.trim()
      ? Number(fixed_amount_raw)
      : null
  const percentage =
    fee_type === 'percentage' && typeof percentage_raw === 'string' && percentage_raw.trim()
      ? Number(percentage_raw)
      : null

  if (fee_type === 'fixed' && (fixed_amount === null || Number.isNaN(fixed_amount))) {
    return { error: 'enter_amount' }
  }
  if (fee_type === 'percentage' && (percentage === null || Number.isNaN(percentage))) {
    return { error: 'enter_percentage' }
  }

  const supabase = await createClient()
  const { data: user } = await supabase.auth.getClaims()

  const { data: inserted, error } = await supabase
    .from('engagements')
    .insert({
      client_id,
      fee_type,
      fixed_amount,
      percentage,
      created_by: user?.claims?.sub,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === CHECK_VIOLATION && error.message.includes('fee_amount_matches_type')) {
      return { error: 'invalid_fee_type_amount' }
    }
    return { error: 'create_failed' }
  }

  if (case_ids.length > 0) {
    const { error: linkError } = await supabase
      .from('engagement_cases')
      .insert(case_ids.map((case_id) => ({ engagement_id: inserted.id, case_id })))

    if (linkError) {
      // The engagement itself was created successfully - don't fail the
      // whole flow over the linked-cases step, just surface it and let the
      // user add the links from the detail page. The multi-row insert is
      // one statement, so a case from another client (rejected by the
      // engagement_cases_client_match trigger - this path used to link it
      // without any check) means none of the selected cases were linked.
      return {
        engagementId: inserted.id,
        error: isWrongClientLink(linkError) ? 'cases_link_wrong_client' : 'cases_link_failed',
      }
    }
  }

  revalidatePath(FEES_PATH)
  return { engagementId: inserted.id }
}

// --- Linked cases (engagement detail) ---------------------------------------

// The case-belongs-to-the-engagement's-client rule is the database's
// (engagement_cases_client_match trigger) - not re-checked here.
export async function linkCase(engagementId: string, caseId: string): Promise<ActionResult> {
  if (!caseId) {
    return { error: 'select_case' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('engagement_cases')
    .insert({ engagement_id: engagementId, case_id: caseId })

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: 'case_already_linked' }
    }
    if (isWrongClientLink(error)) {
      return { error: 'case_wrong_client' }
    }
    return { error: 'link_failed' }
  }

  revalidatePath(engagementPath(engagementId))
  return {}
}

export async function unlinkCase(engagementId: string, caseId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('engagement_cases')
    .delete()
    .eq('engagement_id', engagementId)
    .eq('case_id', caseId)
    .select('case_id')

  // Zero rows: refused by RLS (raises nothing) or already unlinked.
  if (error || !data || data.length === 0) {
    return { error: 'unlink_failed' }
  }

  revalidatePath(engagementPath(engagementId))
  return {}
}

// --- Signed agreement ----------------------------------------------------

// An engagement can span several cases (engagement_cases), while a document
// always belongs to exactly one. There's no single "right" case to file the
// agreement under, so the picker (built in the page from the engagement's
// already-fetched linked cases) draws from documents on any of them - the
// agreement was realistically uploaded to one. RLS on `documents`
// (documents_access/documents_view_all plus case membership) already limits
// what the caller sees, same as everywhere else documents are listed.
//
// Whether the document is on a linked case is the database's call (the
// engagements_agreement_document_in_scope trigger, mapped below) - not
// re-checked here. The page's picker only offers non-deleted documents on
// linked cases, which is the fail-fast version.

export async function setSignedAgreement(
  engagementId: string,
  documentId: string | null
): Promise<ActionResult> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('engagements')
    .update({ signed_agreement_document_id: documentId })
    .eq('id', engagementId)
    .select('id')

  if (error) {
    if (error.code === CHECK_VIOLATION && error.message.includes('engagement_agreement_document_in_scope')) {
      return { error: 'document_not_linked' }
    }
    return { error: 'save_failed' }
  }
  if (!data || data.length === 0) {
    return { error: 'no_permission_change' }
  }

  revalidatePath(engagementPath(engagementId))
  return {}
}

export async function getSignedAgreementUrl(
  engagementId: string,
  documentId: string
): Promise<{ url?: string; error?: FeesErrorCode }> {
  const supabase = await createClient()

  // Confirm it's still actually this engagement's attached agreement before
  // handing out a signed URL, rather than trusting the id the client sent.
  const { data: engagement } = await supabase
    .from('engagements')
    .select('signed_agreement_document_id')
    .eq('id', engagementId)
    .maybeSingle()
  if (!engagement || engagement.signed_agreement_document_id !== documentId) {
    return { error: 'document_not_found' }
  }

  const { data: doc } = await supabase.from('documents').select('storage_path').eq('id', documentId).maybeSingle()
  if (!doc) {
    return { error: 'document_not_found' }
  }

  const { data, error } = await supabase.storage.from('case-documents').createSignedUrl(doc.storage_path, 300)
  if (error || !data) {
    return { error: 'link_generation_failed' }
  }

  return { url: data.signedUrl }
}

// --- Instalments --------------------------------------------------------

type InstallmentFields = {
  description: string
  due_date: string | null
  amount: number
  payer_name: string | null
}

function readInstallmentFields(formData: FormData): InstallmentFields | { error: FeesErrorCode } {
  const description = formData.get('description')
  const due_date = formData.get('due_date')
  const amount_raw = formData.get('amount')
  const payer_name = formData.get('payer_name')

  if (typeof description !== 'string' || !description.trim()) {
    return { error: 'description_required' }
  }
  const amount = parseAmount(amount_raw)
  if (amount === null) {
    return { error: 'invalid_amount' }
  }

  return {
    description: description.trim(),
    due_date: typeof due_date === 'string' && due_date.trim() ? due_date.trim() : null,
    amount,
    payer_name: typeof payer_name === 'string' && payer_name.trim() ? payer_name.trim() : null,
  }
}

export async function createInstallment(
  engagementId: string,
  formData: FormData
): Promise<ActionResult> {
  const fields = readInstallmentFields(formData)
  if ('error' in fields) return fields

  const supabase = await createClient()
  const { error } = await supabase
    .from('engagement_installments')
    .insert({ engagement_id: engagementId, ...fields })

  if (error) {
    if (error.code === CHECK_VIOLATION && error.message.includes('engagement_installments_amount_positive')) {
      return { error: 'installment_amount_not_positive' }
    }
    if (error.code === CHECK_VIOLATION && error.message.includes('engagement_installments_description_not_blank')) {
      return { error: 'description_required' }
    }
    return { error: 'add_installment_failed' }
  }

  revalidatePath(engagementPath(engagementId))
  return {}
}

export async function updateInstallment(
  engagementId: string,
  installmentId: string,
  formData: FormData
): Promise<ActionResult> {
  const fields = readInstallmentFields(formData)
  if ('error' in fields) return fields

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('engagement_installments')
    .update(fields)
    .eq('id', installmentId)
    .select('id')

  if (error?.code === CHECK_VIOLATION && error.message.includes('engagement_installments_amount_positive')) {
    return { error: 'installment_amount_not_positive' }
  }
  if (error?.code === CHECK_VIOLATION && error.message.includes('engagement_installments_description_not_blank')) {
    return { error: 'description_required' }
  }
  // Zero rows: refused by RLS or the instalment was deleted.
  if (error || !data || data.length === 0) {
    return { error: 'save_installment_failed' }
  }

  revalidatePath(engagementPath(engagementId))
  return {}
}

export async function deleteInstallment(
  engagementId: string,
  installmentId: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('engagement_installments').delete().eq('id', installmentId).select('id')

  if (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return { error: 'installment_has_payments' }
    }
    return { error: 'delete_installment_failed' }
  }
  // Zero rows: refused by RLS or already deleted - not a success.
  if (!data || data.length === 0) {
    return { error: 'delete_installment_failed' }
  }

  revalidatePath(engagementPath(engagementId))
  return {}
}

// --- Payments (append-only) -------------------------------------------------

export async function recordPayment(
  engagementId: string,
  installmentId: string,
  formData: FormData
): Promise<ActionResult> {
  const amount_raw = formData.get('amount')
  const paid_at = formData.get('paid_at')
  const method = formData.get('method')

  const amount = parseAmount(amount_raw)
  if (amount === null) {
    return { error: 'invalid_amount' }
  }
  if (typeof paid_at !== 'string' || !paid_at.trim()) {
    return { error: 'date_required' }
  }

  const supabase = await createClient()
  const { data: user } = await supabase.auth.getClaims()

  const { error } = await supabase.from('payments').insert({
    installment_id: installmentId,
    amount,
    paid_at: paid_at.trim(),
    method: typeof method === 'string' && method.trim() ? method.trim() : null,
    recorded_by: user?.claims?.sub,
  })

  if (error) {
    if (error.code === CHECK_VIOLATION && error.message.includes('payments_amount_positive')) {
      return { error: 'payment_amount_not_positive' }
    }
    if (error.code === INSUFFICIENT_PRIVILEGE) {
      return { error: 'no_permission_record_payment' }
    }
    return { error: 'record_payment_failed' }
  }

  revalidatePath(engagementPath(engagementId))
  return {}
}
