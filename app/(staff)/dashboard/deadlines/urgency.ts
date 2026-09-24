// "Overdue" / "due soon" is a display-only comparison against today's
// date - it is never stored, and it never decides which date wins
// (Postgres already resolved that into effective_due_date). Purely for
// badge styling.
export type Urgency = 'overdue' | 'soon' | 'later'

const DUE_SOON_DAYS = 7

export function urgencyOf(effectiveDueDate: string | null): Urgency {
  if (!effectiveDueDate) return 'later'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(effectiveDueDate + 'T00:00:00')
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'overdue'
  if (diffDays <= DUE_SOON_DAYS) return 'soon'
  return 'later'
}

export const urgencyClass: Record<Urgency, string> = {
  overdue: 'border border-accent-border bg-accent text-accent-fg',
  soon: 'border border-accent-border text-danger-text',
  later: 'border border-line text-fg-muted',
}

// Text lives in messages/en.json under dashboard.deadlines.urgency.<value> -
// look it up with a translator scoped to that namespace and call it with the
// urgency value as the key (tUrgency(urgency)), same convention as the
// appointment_type/appointment_status enum lookups. This isn't a Postgres
// enum (it's derived client-side from a date comparison, never stored), but
// it's the same shape of problem - a small fixed set of values rendered as
// text in more than one file (the deadlines list and the case-detail
// deadlines section) - so it gets the same treatment rather than a second
// hardcoded label map.
