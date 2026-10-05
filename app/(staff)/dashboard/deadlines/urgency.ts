import { todayInFirmZone } from '@/lib/format-date-time'

// "Overdue" / "due soon" is a display-only comparison against today's
// date - it is never stored, and it never decides which date wins
// (Postgres already resolved that into effective_due_date). Purely for
// badge styling.
//
// A met deadline (completed_at set) is 'met' whatever its date: it stays
// visible as a record that it was met, but no longer reads as urgent.
export type Urgency = 'met' | 'overdue' | 'soon' | 'later'

const DUE_SOON_DAYS = 7

export function urgencyOf(effectiveDueDate: string | null, completedAt: string | null): Urgency {
  if (completedAt) return 'met'
  if (!effectiveDueDate) return 'later'
  // Whole calendar days between today in Amman and the date - both as
  // UTC-midnight instants, so no host zone or DST enters the arithmetic.
  const diffDays = Math.round((Date.parse(effectiveDueDate) - Date.parse(todayInFirmZone())) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'overdue'
  if (diffDays <= DUE_SOON_DAYS) return 'soon'
  return 'later'
}

export const urgencyClass: Record<Urgency, string> = {
  met: 'border border-line bg-line/40 text-fg-muted',
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
