import { todayInFirmZone } from './format-date-time'

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
  // Whole calendar days between today in Amman and the date - both as
  // UTC-midnight instants, so no host zone or DST enters the arithmetic.
  const diffDays = Math.round((Date.parse(poa.expires_at) - Date.parse(todayInFirmZone())) / (1000 * 60 * 60 * 24))
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
