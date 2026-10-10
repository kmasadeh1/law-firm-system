// One row of check_conflict_detailed. match_on tells an identity match
// ('both' / 'national_id': same person, near-certainly) from a name-only
// match (could be a different person who shares a name). The database
// returns rows already sorted with identity matches first.
export type ConflictMatchOn = 'both' | 'national_id' | 'name'

export type ConflictMatch = {
  source: string
  matched_id: string
  matched_name: string
  matched_national_id: string | null
  matched_phone: string | null
  case_id: string | null
  case_number: string | null
  match_on: ConflictMatchOn
}

// Display-only classification of the database's match_on value.
export function isIdentityMatch(match: Pick<ConflictMatch, 'match_on'>): boolean {
  return match.match_on === 'both' || match.match_on === 'national_id'
}
