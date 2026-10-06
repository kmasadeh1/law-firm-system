// Shared entity+action -> event-title lookup for anything reading the
// activity log (case_timeline RPC, the owner "Recent activity" feed, the
// owner-wide activity log). Keep this the single source so the different
// views can't drift into inconsistent wording for the same underlying
// event. Labels themselves live in messages/{en,ar}.json under
// dashboard.activity.entities.<entity>.{filterLabel,insert,update,delete} -
// this only resolves which key to look up.

export type ActivityAction = 'insert' | 'update' | 'delete'

// Every table that has an activity-logging trigger in the database
// (log_activity, plus case_lawyers' and engagement_cases' own triggers).
// Builds the owner activity log's entity filter. A table listed here must
// have a trigger - a filter that can never match anything is worse than no
// filter - and a newly logged table must be added here and to both message
// files. A logged table that is missing its labels does not fail quietly:
// see activityEntityLabel/activityEventTitle.
export const ENTITY_NAMES = [
  'case_checklist_status',
  'case_court_filings',
  'case_lawyers',
  'case_notes',
  'case_opposing_parties',
  'case_types',
  'cases',
  'client_contacts',
  'client_fund_entries',
  'clients',
  'courts',
  'deadlines',
  'document_checklist_items',
  'document_drafts',
  'document_templates',
  'documents',
  'engagement_cases',
  'engagement_installments',
  'engagements',
  'enquiries',
  'enquiry_notes',
  'expenses',
  'firm_settings',
  'hearings',
  'lawyer_profiles',
  'leave_requests',
  'payments',
  'powers_of_attorney',
  'practice_areas',
  'referral_sources',
  'reminders_sent',
  'site_sections',
  'staff',
  'tasks',
  'working_hours',
  'write_offs',
]

// These tables have no hard DELETE - "deleted" is a deleted_at flag set via
// UPDATE, so it shows up in the log as action 'update' like any other edit.
// Detect it from the row snapshot rather than mislabeling a removal as a
// plain edit, which would hide it from the one place meant to surface it.
const SOFT_DELETE_ENTITIES = new Set(['case_notes', 'client_contacts', 'document_drafts', 'documents', 'enquiry_notes'])

type ActivityTranslator = {
  (key: string): string
  has(key: string): boolean
}

// t is scoped to the 'dashboard.activity' namespace.
//
// A missing label falls back to the raw key ("write_offs", or
// "write_offs.insert" for an event) - deliberately, so a table that gained
// a logging trigger without labels reads as unfinished, and names exactly
// which message key to add, instead of a generic phrase that looks
// intentional.
export function activityEntityLabel(t: ActivityTranslator, entity: string): string {
  const key = `entities.${entity}.filterLabel`
  return t.has(key) ? t(key) : entity
}

export function activityEventTitle(
  t: ActivityTranslator,
  entity: string,
  action: ActivityAction,
  detail: Record<string, unknown> | null
): string {
  const effectiveAction: ActivityAction =
    SOFT_DELETE_ENTITIES.has(entity) &&
    action === 'update' &&
    detail &&
    typeof detail.deleted_at === 'string' &&
    detail.deleted_at
      ? 'delete'
      : action

  const key = `entities.${entity}.${effectiveAction}`
  return t.has(key) ? t(key) : `${entity}.${effectiveAction}`
}
