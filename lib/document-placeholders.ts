// The placeholders a document template may use, written {{key}} in a
// template body. Shared by the templates admin screen (which lists them
// beside the editor) and the server-side resolver (which fills them from a
// case). Labels live in messages under dashboard.documentPlaceholders.<key>.
//
// Each resolves to exactly one value or to nothing - never a guess:
//   court_* / judge   the case's single current filing (one per case is a
//                     unique index)
//   opposing_*        the case's primary opposing party (one per case)
//   poa_number        case_covering_poa() - case-specific before general,
//                     never revoked or expired
// Nothing is resolved here; this is the list, not the logic.
export const DOCUMENT_PLACEHOLDERS = [
  'case_number',
  'case_title',
  'client_name',
  'client_national_id',
  'lead_lawyer',
  'court_name',
  'court_case_number',
  'court_chamber',
  'judge',
  'opposing_party',
  'opposing_counsel',
  'poa_number',
  'firm_name',
  'today',
] as const

export type DocumentPlaceholder = (typeof DOCUMENT_PLACEHOLDERS)[number]

export type DraftLanguage = 'en' | 'ar'
