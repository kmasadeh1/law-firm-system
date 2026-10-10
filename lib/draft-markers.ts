// Finds the visible gap markers the placeholder resolver leaves in a
// generated draft ("[Judge: not available]", "[unknown placeholder: x]").
// The markers are plain text in the stored body (there is nowhere else to
// keep a list), so the draft page re-reads them from the text: the count
// also drops as the lawyer fills a gap in.
//
// The wording below mirrors messages dashboard.cases.detail.drafts.marker.*
// in en.json and ar.json - change one, change the other.
const MISSING = /\[([^\[\]\n]+?):\s*(?:not available|غير متوفر)\]/g
const UNKNOWN = /\[(?:unknown placeholder|حقل غير معروف):\s*([^\[\]\n]+?)\]/g

export type UnresolvedMarker = { kind: 'missing' | 'unknown'; label: string }

export function findUnresolvedMarkers(body: string): UnresolvedMarker[] {
  const found: UnresolvedMarker[] = []
  const seen = new Set<string>()
  const add = (kind: UnresolvedMarker['kind'], raw: string) => {
    // The resolver isolates nothing inside a marker, but strip any bidi
    // controls a copy-paste might have added so the same gap isn't listed twice.
    const label = raw.replace(/[⁦-⁩]/g, '').trim()
    const key = `${kind}:${label}`
    if (!seen.has(key)) {
      seen.add(key)
      found.push({ kind, label })
    }
  }
  for (const m of body.matchAll(MISSING)) add('missing', m[1])
  for (const m of body.matchAll(UNKNOWN)) add('unknown', m[1])
  return found
}
