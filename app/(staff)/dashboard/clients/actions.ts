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

type ClientFields = {
  full_name: string
  national_id: string | null
  phone: string | null
  email: string | null
  notes: string | null
  referral_source_id: string | null
  referral_notes: string | null
}

async function readFields(formData: FormData): Promise<ClientFields | { error: string }> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.clients.form.errors' })

  const full_name = formData.get('full_name')
  if (typeof full_name !== 'string' || !full_name.trim()) {
    return { error: t('fullNameRequired') }
  }

  const optional = (key: string) => {
    const value = formData.get(key)
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }

  return {
    full_name: full_name.trim(),
    national_id: optional('national_id'),
    phone: optional('phone'),
    email: optional('email'),
    notes: optional('notes'),
    // Blank = "not recorded". Whether the id names a real source is the
    // foreign key's call, not this function's.
    referral_source_id: optional('referral_source_id'),
    referral_notes: optional('referral_notes'),
  }
}

export async function createClientRecord(
  formData: FormData,
  confirmed: boolean
): Promise<{ error?: string; matches?: ConflictMatch[]; clientId?: string }> {
  const fields = await readFields(formData)
  if ('error' in fields) return fields

  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.clients.form.errors' })
  const supabase = await createClient()

  if (!confirmed) {
    const { data: matches, error: conflictError } = await supabase.rpc('check_conflict', {
      p_name: fields.full_name,
      p_national_id: fields.national_id ?? undefined,
    })

    if (conflictError) {
      return { error: t('conflictCheckFailed') }
    }
    if (matches && matches.length > 0) {
      return { matches }
    }
  }

  const { data: user } = await supabase.auth.getClaims()

  const { data: inserted, error } = await supabase
    .from('clients')
    .insert({ ...fields, created_by: user?.claims?.sub })
    .select('id')
    .single()

  if (error) {
    return { error: t('createFailed') }
  }

  revalidatePath('/dashboard/clients')
  return { clientId: inserted.id }
}

export async function updateClientRecord(
  clientId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const fields = await readFields(formData)
  if ('error' in fields) return fields

  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.clients.form.errors' })
  const supabase = await createClient()
  const { error } = await supabase.from('clients').update(fields).eq('id', clientId)

  if (error) {
    return { error: t('saveFailed') }
  }

  revalidatePath('/dashboard/clients')
  revalidatePath(`/dashboard/clients/${clientId}`)
  return {}
}

// --- Power of attorney -----------------------------------------------------

// Closed set the server can return - the render site validates against a
// whitelist before calling t(), same convention as TeamErrorCode /
// CourtFilingErrorCode in cases/actions.ts. The three CHECK constraints and
// the one trigger all raise 23514 and are disambiguated by constraint name
// in the message - they're four different mistakes and must never share a
// slot. A duplicate lawyer assignment (23505, the composite primary key)
// gets its own code rather than a generic "add failed".
export type PoaErrorCode =
  | 'expiryBeforeIssue'
  | 'revokedBeforeIssue'
  | 'revokedDateMismatch'
  | 'caseMismatch'
  | 'noPermission'
  | 'addFailed'
  | 'updateFailed'
  | 'revokeFailed'
  | 'alreadyAssigned'
  | 'assignFailed'
  | 'unassignFailed'

type PoaActionResult = { error?: PoaErrorCode }

function mapPoaCheckViolation(message: string): PoaErrorCode | null {
  if (message.includes('poa_expiry_after_issue')) return 'expiryBeforeIssue'
  if (message.includes('poa_revoked_after_issue')) return 'revokedBeforeIssue'
  if (message.includes('poa_revoked_has_date')) return 'revokedDateMismatch'
  if (message.includes('poa_case_matches_client')) return 'caseMismatch'
  return null
}

type PoaFields = {
  case_id: string | null
  poa_number: string | null
  issued_at: string | null
  expires_at: string | null
  scope: string | null
  registered_at_office: string | null
  notes: string | null
}

function readPoaFields(formData: FormData): PoaFields {
  const optional = (key: string) => {
    const value = formData.get(key)
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }
  return {
    case_id: optional('case_id'),
    poa_number: optional('poa_number'),
    // issued_at is nullable in the schema - a blank value is a real,
    // allowed state, not a validation error this form invents.
    issued_at: optional('issued_at'),
    expires_at: optional('expires_at'),
    scope: optional('scope'),
    registered_at_office: optional('registered_at_office'),
    notes: optional('notes'),
  }
}

function clientPath(clientId: string) {
  return `/dashboard/clients/${clientId}`
}

export async function createPowerOfAttorney(
  clientId: string,
  formData: FormData
): Promise<PoaActionResult & { poaId?: string }> {
  const fields = readPoaFields(formData)
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getClaims()

  const { data, error } = await supabase
    .from('powers_of_attorney')
    .insert({ client_id: clientId, ...fields, created_by: user?.claims?.sub })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23514') {
      return { error: mapPoaCheckViolation(error.message) ?? 'addFailed' }
    }
    if (error.code === '42501') {
      return { error: 'noPermission' }
    }
    return { error: 'addFailed' }
  }

  revalidatePath(clientPath(clientId))
  return { poaId: data.id }
}

export async function updatePowerOfAttorney(
  clientId: string,
  poaId: string,
  formData: FormData
): Promise<PoaActionResult> {
  const fields = readPoaFields(formData)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('powers_of_attorney')
    .update(fields)
    .eq('id', poaId)
    .eq('client_id', clientId)
    .select('id')

  if (error) {
    if (error.code === '23514') {
      return { error: mapPoaCheckViolation(error.message) ?? 'updateFailed' }
    }
    return { error: 'updateFailed' }
  }
  if (!data || data.length === 0) {
    return { error: 'noPermission' }
  }

  revalidatePath(clientPath(clientId))
  return {}
}

// Revoking is an update, never a delete - a revoked وكالة stays on the
// record as evidence of what the lawyer was authorised to do and when.
// revoked_at is a real date the caller supplies (not always "today" -
// someone may log a dismissal after the fact), so the server only enforces
// the CHECK constraints, never invents or defaults the date itself.
export async function revokePowerOfAttorney(
  clientId: string,
  poaId: string,
  revokedAt: string
): Promise<PoaActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('powers_of_attorney')
    .update({ is_revoked: true, revoked_at: revokedAt })
    .eq('id', poaId)
    .eq('client_id', clientId)
    .select('id')

  if (error) {
    if (error.code === '23514') {
      return { error: mapPoaCheckViolation(error.message) ?? 'revokeFailed' }
    }
    return { error: 'revokeFailed' }
  }
  if (!data || data.length === 0) {
    return { error: 'noPermission' }
  }

  revalidatePath(clientPath(clientId))
  return {}
}

export async function assignPowerOfAttorneyLawyer(
  clientId: string,
  poaId: string,
  staffId: string
): Promise<PoaActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('power_of_attorney_lawyers').insert({ poa_id: poaId, staff_id: staffId })

  if (error) {
    if (error.code === '23505') {
      return { error: 'alreadyAssigned' }
    }
    if (error.code === '42501') {
      return { error: 'noPermission' }
    }
    return { error: 'assignFailed' }
  }

  revalidatePath(clientPath(clientId))
  return {}
}

export async function unassignPowerOfAttorneyLawyer(
  clientId: string,
  poaId: string,
  staffId: string
): Promise<PoaActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('power_of_attorney_lawyers')
    .delete()
    .eq('poa_id', poaId)
    .eq('staff_id', staffId)
    .select('poa_id')

  if (error) {
    return { error: 'unassignFailed' }
  }
  if (!data || data.length === 0) {
    return { error: 'noPermission' }
  }

  revalidatePath(clientPath(clientId))
  return {}
}
