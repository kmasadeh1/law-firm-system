'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type ActionResult = { error?: string }

const UNIQUE_VIOLATION = '23505'
const FOREIGN_KEY_VIOLATION = '23503'
const CHECK_VIOLATION = '23514'
const INSUFFICIENT_PRIVILEGE = '42501'

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
    return { error: 'Select a client.' }
  }
  if (fee_type !== 'fixed' && fee_type !== 'percentage') {
    return { error: 'Select a fee type.' }
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
    return { error: 'Enter the agreed amount.' }
  }
  if (fee_type === 'percentage' && (percentage === null || Number.isNaN(percentage))) {
    return { error: 'Enter the agreed percentage.' }
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
    if (error.code === CHECK_VIOLATION) {
      return { error: 'That combination of fee type and amount/percentage is not valid.' }
    }
    return { error: 'Could not create the engagement. Please try again.' }
  }

  if (case_ids.length > 0) {
    const { error: linkError } = await supabase
      .from('engagement_cases')
      .insert(case_ids.map((case_id) => ({ engagement_id: inserted.id, case_id })))

    if (linkError) {
      // The engagement itself was created successfully - don't fail the
      // whole flow over the linked-cases step, just surface it and let the
      // user add the links from the detail page.
      return {
        engagementId: inserted.id,
        error: 'Engagement created, but the selected cases could not be linked. Add them from the engagement page.',
      }
    }
  }

  revalidatePath(FEES_PATH)
  return { engagementId: inserted.id }
}

// --- Linked cases (engagement detail) ---------------------------------------

export async function linkCase(engagementId: string, clientId: string, caseId: string): Promise<ActionResult> {
  if (!caseId) {
    return { error: 'Select a case.' }
  }

  const supabase = await createClient()

  // engagement_cases has no constraint tying a linked case's client to the
  // engagement's client - guard it here so a link can never point at a case
  // that belongs to someone else.
  const { data: caseRow } = await supabase.from('cases').select('client_id').eq('id', caseId).maybeSingle()
  if (!caseRow || caseRow.client_id !== clientId) {
    return { error: "That case doesn't belong to this engagement's client." }
  }

  const { error } = await supabase
    .from('engagement_cases')
    .insert({ engagement_id: engagementId, case_id: caseId })

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: 'That case is already linked to this engagement.' }
    }
    return { error: 'Could not link the case. Please try again.' }
  }

  revalidatePath(engagementPath(engagementId))
  return {}
}

export async function unlinkCase(engagementId: string, caseId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('engagement_cases')
    .delete()
    .eq('engagement_id', engagementId)
    .eq('case_id', caseId)

  if (error) {
    return { error: 'Could not unlink the case. Please try again.' }
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

export async function setSignedAgreement(
  engagementId: string,
  documentId: string | null
): Promise<ActionResult> {
  const supabase = await createClient()

  if (documentId) {
    // Guard against attaching a document from outside the engagement's
    // linked cases, the same way linkCase guards the client match - a
    // client-side picker built from the right list is a UX nicety, not a
    // security boundary, so this is re-checked server-side.
    const { data: doc } = await supabase.from('documents').select('case_id').eq('id', documentId).maybeSingle()
    if (!doc || !doc.case_id) {
      return { error: "Could not find that document, or you don't have permission to view it." }
    }
    const { data: linkedCase } = await supabase
      .from('engagement_cases')
      .select('case_id')
      .eq('engagement_id', engagementId)
      .eq('case_id', doc.case_id)
      .maybeSingle()
    if (!linkedCase) {
      return { error: "That document isn't on a case linked to this engagement." }
    }
  }

  const { data, error } = await supabase
    .from('engagements')
    .update({ signed_agreement_document_id: documentId })
    .eq('id', engagementId)
    .select('id')

  if (error) {
    return { error: 'Could not save the change. Please try again.' }
  }
  if (!data || data.length === 0) {
    return { error: "You don't have permission to change this engagement." }
  }

  revalidatePath(engagementPath(engagementId))
  return {}
}

export async function getSignedAgreementUrl(
  engagementId: string,
  documentId: string
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient()

  // Confirm it's still actually this engagement's attached agreement before
  // handing out a signed URL, rather than trusting the id the client sent.
  const { data: engagement } = await supabase
    .from('engagements')
    .select('signed_agreement_document_id')
    .eq('id', engagementId)
    .maybeSingle()
  if (!engagement || engagement.signed_agreement_document_id !== documentId) {
    return { error: "Could not find that document, or you don't have permission to view it." }
  }

  const { data: doc } = await supabase.from('documents').select('storage_path').eq('id', documentId).maybeSingle()
  if (!doc) {
    return { error: "Could not find that document, or you don't have permission to view it." }
  }

  const { data, error } = await supabase.storage.from('case-documents').createSignedUrl(doc.storage_path, 300)
  if (error || !data) {
    return { error: 'Could not generate a link to that file. Please try again.' }
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

function readInstallmentFields(formData: FormData): InstallmentFields | { error: string } {
  const description = formData.get('description')
  const due_date = formData.get('due_date')
  const amount_raw = formData.get('amount')
  const payer_name = formData.get('payer_name')

  if (typeof description !== 'string' || !description.trim()) {
    return { error: 'Description is required.' }
  }
  const amount = typeof amount_raw === 'string' ? Number(amount_raw) : NaN
  if (Number.isNaN(amount) || amount <= 0) {
    return { error: 'Enter a valid amount.' }
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
    return { error: 'Could not add the instalment. Please try again.' }
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
  const { error } = await supabase
    .from('engagement_installments')
    .update(fields)
    .eq('id', installmentId)

  if (error) {
    return { error: 'Could not save the changes. Please try again.' }
  }

  revalidatePath(engagementPath(engagementId))
  return {}
}

export async function deleteInstallment(
  engagementId: string,
  installmentId: string
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('engagement_installments').delete().eq('id', installmentId)

  if (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return { error: "Can't delete an instalment that has payments recorded against it." }
    }
    return { error: 'Could not delete the instalment. Please try again.' }
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

  const amount = typeof amount_raw === 'string' ? Number(amount_raw) : NaN
  if (Number.isNaN(amount) || amount <= 0) {
    return { error: 'Enter a valid amount.' }
  }
  if (typeof paid_at !== 'string' || !paid_at.trim()) {
    return { error: 'Date is required.' }
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
    if (error.code === INSUFFICIENT_PRIVILEGE) {
      return { error: "You don't have permission to record payments." }
    }
    return { error: 'Could not record the payment. Please try again.' }
  }

  revalidatePath(engagementPath(engagementId))
  return {}
}
