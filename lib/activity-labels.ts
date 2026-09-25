// Shared entity+action -> event-title lookup for anything reading the
// activity log (case_timeline RPC, the owner "Recent activity" feed, the
// owner-wide activity log). Keep this the single source so the different
// views can't drift into inconsistent wording for the same underlying
// event. Labels themselves live in messages/{en,ar}.json under
// dashboard.activity.entities.<entity>.<action> - this only resolves which
// key to look up.

export type ActivityAction = 'insert' | 'update' | 'delete'

// Single source for both "which entities have a logging trigger" (used to
// build the owner activity log's filter) and "how do we label an event for
// one" (activityEventTitle below, via the message keys named after these).
export const ENTITY_NAMES = [
  'cases',
  'case_lawyers',
  'deadlines',
  'case_notes',
  'documents',
  'engagements',
  'engagement_installments',
  'engagement_cases',
  'payments',
  'expenses',
  'case_opposing_parties',
  'clients',
  'roles',
  'role_permissions',
  'appointments',
  'staff',
].sort()

// case_notes and documents have no hard DELETE - "deleted" is a soft flag
// set via UPDATE, so it shows up in the log as action 'update' like any
// other edit. Detect it from the row snapshot rather than mislabeling a
// removal as a plain edit, which would hide it from the one place meant to
// surface it.
const SOFT_DELETE_ENTITIES = new Set(['case_notes', 'documents'])

type ActivityTranslator = {
  (key: string): string
  has(key: string): boolean
}

// t is scoped to the 'dashboard.activity' namespace: entities.<entity>.<action>
// for each label, with 'fallback' for a table that gets a logging trigger
// later and hasn't had its label added here yet - that should read as an
// obvious gap to fill in, not as broken grammar mistaken for the real label.
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
  return t.has(key) ? t(key) : t('fallback')
}
