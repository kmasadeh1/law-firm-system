// "Active" / "Expiring soon" / "Expired" / "Revoked" is a display-only
// comparison against today's date (and the is_revoked flag) - it is never
// stored, and it never filters what a query returns. Same shape of problem
// as dashboard/deadlines/urgency.ts (a small fixed set of values rendered in
// more than one file - the client page's list and the case page's compact
// line), so it gets the same treatment: a type, a pure derive function, and
// a class map, rather than a second hardcoded label/style scheme.
export type PoaStatus = 'active' | 'expiringSoon' | 'expired' | 'revoked'

const EXPIRING_SOON_DAYS = 30

export function poaStatusOf(poa: { is_revoked: boolean; expires_at: string | null }): PoaStatus {
  if (poa.is_revoked) return 'revoked'
  if (!poa.expires_at) return 'active'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expires = new Date(poa.expires_at + 'T00:00:00')
  const diffDays = Math.round((expires.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'expired'
  if (diffDays <= EXPIRING_SOON_DAYS) return 'expiringSoon'
  return 'active'
}

export const poaStatusClass: Record<PoaStatus, string> = {
  active: 'border border-line text-fg-muted',
  expiringSoon: 'border border-accent-border text-danger-text',
  expired: 'border border-accent-border bg-accent text-accent-fg',
  revoked: 'border border-accent-border bg-accent text-accent-fg',
}

// Picks which of a client's powers of attorney is the one actually
// covering something right now, for display only - prefers a row that
// isn't revoked, then the most recently issued. Never used to decide what a
// query returns; the case page still reads every row RLS allows and chooses
// among what it already has.
export function mostRelevantPoa<T extends { is_revoked: boolean; issued_at: string | null }>(rows: T[]): T | null {
  if (rows.length === 0) return null
  const sorted = [...rows].sort((a, b) => {
    if (a.is_revoked !== b.is_revoked) return a.is_revoked ? 1 : -1
    return (b.issued_at ?? '').localeCompare(a.issued_at ?? '')
  })
  return sorted[0]
}
