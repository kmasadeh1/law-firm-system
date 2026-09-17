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

export const urgencyLabel: Record<Urgency, string> = {
  overdue: 'Overdue',
  soon: 'Due soon',
  later: 'Upcoming',
}
