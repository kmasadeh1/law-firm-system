// Shared entity+action -> human sentence mapping for anything reading the
// activity log (case_timeline RPC, the owner "Recent activity" feed). Keep
// this the single source so the two views can't drift into inconsistent
// wording for the same underlying event.

export type ActivityAction = 'insert' | 'update' | 'delete'

const ENTITY_LABELS: Record<string, { insert: string; update: string; delete: string }> = {
  cases: { insert: 'Case opened', update: 'Case updated', delete: 'Case deleted' },
  case_lawyers: {
    insert: 'Lawyer assigned',
    update: 'Lawyer assignment updated',
    delete: 'Lawyer removed from case',
  },
  deadlines: { insert: 'Deadline added', update: 'Deadline updated', delete: 'Deadline removed' },
  case_notes: { insert: 'Note added', update: 'Note edited', delete: 'Note deleted' },
  documents: { insert: 'Document uploaded', update: 'Document updated', delete: 'Document removed' },
  engagements: { insert: 'Engagement created', update: 'Engagement updated', delete: 'Engagement deleted' },
  engagement_installments: {
    insert: 'Instalment scheduled',
    update: 'Instalment updated',
    delete: 'Instalment removed',
  },
  engagement_cases: {
    insert: 'Linked to a fee engagement',
    update: 'Engagement link updated',
    delete: 'Unlinked from a fee engagement',
  },
  payments: { insert: 'Payment recorded', update: 'Payment updated', delete: 'Payment removed' },
  expenses: { insert: 'Expense recorded', update: 'Expense updated', delete: 'Expense removed' },
  case_opposing_parties: {
    insert: 'Opposing party added',
    update: 'Opposing party updated',
    delete: 'Opposing party removed',
  },
  clients: { insert: 'Client added', update: 'Client updated', delete: 'Client deleted' },
  roles: { insert: 'Role added', update: 'Role updated', delete: 'Role deleted' },
  role_permissions: {
    insert: 'Permission granted',
    update: 'Permission updated',
    delete: 'Permission revoked',
  },
  appointments: { insert: 'Appointment booked', update: 'Appointment updated', delete: 'Appointment deleted' },
  staff: { insert: 'Staff member added', update: 'Staff account updated', delete: 'Staff account deleted' },
}

// The set of entities that actually have a logging trigger - single source
// for both "what to call an event" (above) and "what entities exist to
// filter by" (the owner-wide activity log), so the two can't drift apart.
export const ENTITY_NAMES = Object.keys(ENTITY_LABELS).sort()

// case_notes and documents have no hard DELETE - "deleted" is a soft flag
// set via UPDATE, so it shows up in the log as action 'update' like any
// other edit. Detect it from the row snapshot rather than mislabeling a
// removal as a plain edit, which would hide it from the one place meant to
// surface it.
const SOFT_DELETE_LABELS: Record<string, string> = {
  case_notes: 'Note deleted',
  documents: 'Document removed',
}

export function activityEventTitle(
  entity: string,
  action: ActivityAction,
  detail: Record<string, unknown> | null
): string {
  const softDeleteLabel = SOFT_DELETE_LABELS[entity]
  if (
    softDeleteLabel &&
    action === 'update' &&
    detail &&
    typeof detail.deleted_at === 'string' &&
    detail.deleted_at
  ) {
    return softDeleteLabel
  }
  // Every entity with a logging trigger has an explicit label above. This
  // fallback only exists for a table that gets one later and hasn't been
  // added here yet - it should read as an obvious gap to fill in, not as
  // broken grammar mistaken for the real label.
  return ENTITY_LABELS[entity]?.[action] ?? 'Activity recorded'
}
