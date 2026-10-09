import type { Database } from '@/lib/supabase/database.types'
import type { ContactRow } from './contact-log-section'

// Shared by the client and case detail pages so both ask for exactly the
// same columns. can_edit_client_contact is a PostgREST computed column (it
// takes the client_contacts row type) - it is only returned when named
// here, never by select('*'), and it is the exact function the update
// policy enforces. The generated Database type lists it under Functions
// rather than on the Row, so callers type the result with
// .returns<ContactQueryRow[]>() - same approach as can_withdraw on the
// leave requests page; it doesn't change the request.
export const CONTACT_LOG_SELECT =
  'id, occurred_at, direction, channel, summary, follow_up_needed, case_id, handled_by, edited_at, cases(case_number, title), can_edit_client_contact'

export type ContactQueryRow = {
  id: string
  occurred_at: string
  direction: Database['public']['Enums']['contact_direction']
  channel: Database['public']['Enums']['contact_channel']
  summary: string
  follow_up_needed: boolean
  case_id: string | null
  handled_by: string | null
  edited_at: string | null
  cases: { case_number: string; title: string } | null
  can_edit_client_contact: boolean | null
}

export function toContactRow(
  row: ContactQueryRow,
  nameById: Map<string, string>,
  unknownStaffLabel: string
): ContactRow {
  return {
    id: row.id,
    occurred_at: row.occurred_at,
    direction: row.direction,
    channel: row.channel,
    summary: row.summary,
    follow_up_needed: row.follow_up_needed,
    case_id: row.case_id,
    case_number: row.cases?.case_number ?? null,
    case_title: row.cases?.title ?? null,
    handled_by: row.handled_by,
    handled_by_name: row.handled_by ? (nameById.get(row.handled_by) ?? unknownStaffLabel) : null,
    edited_at: row.edited_at,
    can_edit: row.can_edit_client_contact === true,
  }
}
