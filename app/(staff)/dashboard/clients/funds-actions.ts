'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function clientPath(clientId: string) {
  return `/dashboard/clients/${clientId}`
}

export type ClientFundDirection = 'in' | 'out'

// reversal is deliberately excluded from the type the record-entry form
// offers - it is only ever created via the "Reverse" control on an existing
// entry (createReversalEntry below), never picked from this list.
export type RecordableClientFundEntryType = 'deposit' | 'disbursement' | 'fee_transfer' | 'refund'
export type ClientFundEntryType = RecordableClientFundEntryType | 'reversal'

const RECORDABLE_ENTRY_TYPES: RecordableClientFundEntryType[] = ['deposit', 'disbursement', 'fee_transfer', 'refund']

// direction follows from entry_type - the form never asks for it and never
// sends one, so the two can't disagree. A reversal's direction is the
// opposite of the entry it reverses (computed from that row, not trusted
// from the client) - see createReversalEntry.
function directionForType(entryType: RecordableClientFundEntryType): ClientFundDirection {
  return entryType === 'deposit' ? 'in' : 'out'
}

// Closed set the server can return - the render site validates against a
// whitelist before calling t(), same convention as PoaErrorCode in
// clients/actions.ts. The six CHECK/trigger violations are six different
// mistakes and must never share a slot - matched by constraint name in the
// error message, never guessed from form state.
export type ClientFundErrorCode =
  | 'typeRequired'
  | 'invalidAmount'
  | 'amountNotPositive'
  | 'directionMismatch'
  | 'paymentOnlyOnTransfer'
  | 'reversalNeedsTarget'
  | 'caseMismatch'
  | 'insufficientBalance'
  | 'reversalTargetNotFound'
  | 'noPermission'
  | 'addFailed'

type ActionResult = { error?: ClientFundErrorCode }

function mapCheckViolation(message: string): ClientFundErrorCode | null {
  if (message.includes('cfe_amount_positive')) return 'amountNotPositive'
  if (message.includes('cfe_direction_matches_type')) return 'directionMismatch'
  if (message.includes('cfe_payment_only_on_transfer')) return 'paymentOnlyOnTransfer'
  if (message.includes('cfe_reversal_points_at_an_entry')) return 'reversalNeedsTarget'
  if (message.includes('cfe_case_matches_client')) return 'caseMismatch'
  if (message.includes('cfe_balance_never_negative')) return 'insufficientBalance'
  return null
}

function readSharedFields(formData: FormData) {
  const optional = (key: string) => {
    const value = formData.get(key)
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }
  return {
    case_id: optional('case_id'),
    method: optional('method'),
    reference: optional('reference'),
    description: optional('description'),
    occurred_on: optional('occurred_on'),
  }
}

export async function createClientFundEntry(
  clientId: string,
  formData: FormData
): Promise<ActionResult & { entryId?: string }> {
  const entryTypeRaw = formData.get('entry_type')
  if (typeof entryTypeRaw !== 'string' || !(RECORDABLE_ENTRY_TYPES as string[]).includes(entryTypeRaw)) {
    return { error: 'typeRequired' }
  }
  const entry_type = entryTypeRaw as RecordableClientFundEntryType

  const amountRaw = formData.get('amount')
  const amount = typeof amountRaw === 'string' ? Number(amountRaw) : NaN
  if (!Number.isFinite(amount)) {
    return { error: 'invalidAmount' }
  }

  const shared = readSharedFields(formData)
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getClaims()

  const { data, error } = await supabase
    .from('client_fund_entries')
    .insert({
      client_id: clientId,
      entry_type,
      direction: directionForType(entry_type),
      amount,
      case_id: shared.case_id,
      method: shared.method,
      reference: shared.reference,
      description: shared.description,
      occurred_on: shared.occurred_on ?? undefined,
      recorded_by: user?.claims?.sub,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23514') {
      return { error: mapCheckViolation(error.message) ?? 'addFailed' }
    }
    if (error.code === '42501') {
      return { error: 'noPermission' }
    }
    return { error: 'addFailed' }
  }

  revalidatePath(clientPath(clientId))
  return { entryId: data.id }
}

// Reversal is a control on an existing entry, never a free-standing form -
// reverses_entry_id and direction both come from that entry, not from
// anything the caller sends. direction is the opposite of the reversed
// entry's own direction, read fresh from the database rather than trusted
// from whatever the form had pre-filled on screen.
export async function createReversalEntry(
  clientId: string,
  reversedEntryId: string,
  formData: FormData
): Promise<ActionResult & { entryId?: string }> {
  const amountRaw = formData.get('amount')
  const amount = typeof amountRaw === 'string' ? Number(amountRaw) : NaN
  if (!Number.isFinite(amount)) {
    return { error: 'invalidAmount' }
  }

  const shared = readSharedFields(formData)
  const supabase = await createClient()

  const { data: original, error: lookupError } = await supabase
    .from('client_fund_entries')
    .select('id, client_id, direction')
    .eq('id', reversedEntryId)
    .eq('client_id', clientId)
    .maybeSingle()

  if (lookupError || !original) {
    return { error: 'reversalTargetNotFound' }
  }

  const { data: user } = await supabase.auth.getClaims()

  const { data, error } = await supabase
    .from('client_fund_entries')
    .insert({
      client_id: clientId,
      entry_type: 'reversal',
      direction: original.direction === 'in' ? 'out' : 'in',
      amount,
      reverses_entry_id: original.id,
      case_id: shared.case_id,
      method: shared.method,
      reference: shared.reference,
      description: shared.description,
      occurred_on: shared.occurred_on ?? undefined,
      recorded_by: user?.claims?.sub,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23514') {
      return { error: mapCheckViolation(error.message) ?? 'addFailed' }
    }
    if (error.code === '42501') {
      return { error: 'noPermission' }
    }
    return { error: 'addFailed' }
  }

  revalidatePath(clientPath(clientId))
  return { entryId: data.id }
}
