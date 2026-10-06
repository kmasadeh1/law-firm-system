// Shared entity+action -> event-title lookup for anything reading the
// activity log (case_timeline RPC, the owner "Recent activity" feed, the
// owner-wide activity log). Keep this the single source so the different
// views can't drift into inconsistent wording for the same underlying
// event. Labels themselves live in messages/{en,ar}.json under
// dashboard.activity.entities.<entity>.{filterLabel,insert,update,delete} -
// this only resolves which key to look up. Which tables are logged is not
// listed here: the activity log asks the database (logged_tables()).

export type ActivityAction = 'insert' | 'update' | 'delete'

// Hand-written, unlike the list of logged tables: a deleted_at column is a
// convention, not something a trigger records. These tables have no hard
// DELETE - "deleted" is a deleted_at flag set via UPDATE, so it shows up in
// the log as action 'update' like any other edit. Detect it from the row
// snapshot rather than mislabeling a removal as a plain edit, which would
// hide it from the one place meant to surface it.
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
