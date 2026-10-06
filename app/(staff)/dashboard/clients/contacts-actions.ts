'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { Constants, type Database } from '@/lib/supabase/database.types'
import { fromFirmDateTimeInput } from '@/lib/format-date-time'

type ContactDirection = Database['public']['Enums']['contact_direction']
type ContactChannel = Database['public']['Enums']['contact_channel']

// Closed set the server can return - the render site validates against a
// whitelist before calling t(), same convention as PoaErrorCode in
// clients/actions.ts. The blank-summary CHECK and the case-must-belong-to-
// this-client trigger both raise 23514 and are told apart by constraint
// name in the message - two different mistakes, never one slot.
export type ContactErrorCode =
  | 'summaryRequired'
  | 'caseMismatch'
  | 'invalidChoice'
  | 'invalidOccurredAt'
  | 'noPermission'
  | 'addFailed'
  | 'updateFailed'
  | 'deleteFailed'

type ActionResult = { error?: ContactErrorCode }

function mapCheckViolation(message: string): ContactErrorCode | null {
  if (message.includes('client_contacts_summary_not_blank')) return 'summaryRequired'
  if (message.includes('client_contacts_case_matches_client')) return 'caseMismatch'
  return null
}

type ContactFields = {
  direction: ContactDirection
  channel: ContactChannel
  occurred_at?: string
  summary: string
  case_id: string | null
  handled_by: string | null
  follow_up_needed: boolean
}

// Shape-only parsing of the form. No rule about what makes a contact valid
// lives here: a blank summary or a case from another client is sent as-is
// and the database's CHECK/trigger rejects it. The enum membership test
// only narrows the type - an unknown value would be refused by Postgres
// anyway.
function readFields(formData: FormData): ContactFields | { error: ContactErrorCode } {
  const text = (key: string) => {
    const value = formData.get(key)
    return typeof value === 'string' ? value : ''
  }
  const optional = (key: string) => text(key).trim() || null

  const direction = text('direction')
  const channel = text('channel')
  if (
    !(Constants.public.Enums.contact_direction as readonly string[]).includes(direction) ||
    !(Constants.public.Enums.contact_channel as readonly string[]).includes(channel)
  ) {
    return { error: 'invalidChoice' }
  }

  const fields: ContactFields = {
    direction: direction as ContactDirection,
    channel: channel as ContactChannel,
    summary: text('summary'),
    case_id: optional('case_id'),
    handled_by: optional('handled_by'),
    follow_up_needed: formData.get('follow_up_needed') === 'on',
  }

  // Left out entirely when blank, so an insert takes the column's now()
  // default rather than this server's idea of the time.
  const occurredAt = text('occurred_at').trim()
  if (occurredAt) {
    const iso = fromFirmDateTimeInput(occurredAt)
    if (!iso) return { error: 'invalidOccurredAt' }
    fields.occurred_at = iso
  }

  return fields
}

function revalidateContactPages(clientId: string, caseIds: (string | null)[]) {
  revalidatePath(`/dashboard/clients/${clientId}`)
  for (const caseId of new Set(caseIds)) {
    if (caseId) revalidatePath(`/dashboard/cases/${caseId}`)
  }
}

export async function logClientContact(clientId: string, formData: FormData): Promise<ActionResult> {
  const fields = readFields(formData)
  if ('error' in fields) return fields

  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()

  // created_by is the signed-in user, never a form field - and the insert
  // policy rejects any other value with 42501 regardless.
  const { error } = await supabase
    .from('client_contacts')
    .insert({ client_id: clientId, ...fields, created_by: claims?.claims?.sub as string })

  if (error) {
    if (error.code === '23514') return { error: mapCheckViolation(error.message) ?? 'addFailed' }
    if (error.code === '42501') return { error: 'noPermission' }
    return { error: 'addFailed' }
  }

  revalidateContactPages(clientId, [fields.case_id])
  return {}
}

// The update policy is can_edit_client_contact(row) - author or owner. A
// row it refuses comes back as zero rows updated, not as an error, so an
// empty result is reported as noPermission. Deleted rows are excluded so
// this never edits an entry the UI no longer shows.
export async function editClientContact(
  clientId: string,
  contactId: string,
  previousCaseId: string | null,
  formData: FormData
): Promise<ActionResult> {
  const fields = readFields(formData)
  if ('error' in fields) return fields

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_contacts')
    .update({ ...fields, edited_at: new Date().toISOString() })
    .eq('id', contactId)
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .select('id')

  if (error) {
    if (error.code === '23514') return { error: mapCheckViolation(error.message) ?? 'updateFailed' }
    return { error: 'updateFailed' }
  }
  if (!data || data.length === 0) return { error: 'noPermission' }

  revalidateContactPages(clientId, [previousCaseId, fields.case_id])
  return {}
}

// Soft delete only - there is no DELETE grant on client_contacts. The row
// stays readable under RLS; every list filters deleted_at in its query.
// deleted_by is stamped by the client_contacts_stamp_delete trigger and is
// never sent from here.
export async function deleteClientContact(
  clientId: string,
  contactId: string,
  caseId: string | null
): Promise<ActionResult> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('client_contacts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', contactId)
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .select('id')

  if (error) return { error: 'deleteFailed' }
  if (!data || data.length === 0) return { error: 'noPermission' }

  revalidateContactPages(clientId, [caseId])
  return {}
}
