import 'server-only'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { formatFullDate, todayInFirmZone } from '@/lib/format-date-time'
import { localizedName } from '@/lib/localized-name'
import { DOCUMENT_PLACEHOLDERS, type DocumentPlaceholder, type DraftLanguage } from '@/lib/document-placeholders'

const TOKEN = /\{\{\s*([A-Za-z_]+)\s*\}\}/g

// FIRST STRONG ISOLATE ... POP DIRECTIONAL ISOLATE. The body is plain text,
// so <bdi> can't be used: every resolved value is isolated with these two
// invisible characters instead, here, where it enters the text. An Arabic
// name in an English sentence (or an English one in an Arabic sentence)
// then takes its own direction without dragging the punctuation around it
// - "we act for <name>," keeps its comma after the name. Stored in the
// draft, so the editor and the printout both get it.
const FSI = '\u2068'
const PDI = '\u2069'

function present(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

// Fills a template body from one case, server-side, in the draft's
// language. Every placeholder resolves to its value or, when there is none
// (not recorded, or not visible to this reader under RLS), to a visible
// marker - "[Judge: not available]" - so the lawyer sees the gap before
// printing. A placeholder the system doesn't know (a typo) becomes its own
// marker. Nothing is ever replaced with an empty string or left raw.
//
// Returns the placeholders that could not be filled alongside the text:
// `missing` keys known but without a value, `unknown` keys the system
// doesn't have. The draft page shows the same gaps from the stored text
// (lib/draft-markers.ts), since the list itself isn't stored.
export type ResolvedDraft = { text: string; unresolved: { key: string; kind: 'missing' | 'unknown' }[] }

export async function resolvePlaceholders(caseId: string, body: string, language: DraftLanguage): Promise<ResolvedDraft> {
  const supabase = await createClient()
  const tLabels = await getTranslations({ locale: language, namespace: 'dashboard.documentPlaceholders' })
  const tMarker = await getTranslations({ locale: language, namespace: 'dashboard.cases.detail.drafts.marker' })
  const tShell = await getTranslations({ locale: language, namespace: 'dashboard.shell' })

  const [{ data: caseRow }, { data: lead }, { data: filing }, { data: opposing }, { data: poaId }] = await Promise.all([
    supabase
      .from('cases')
      .select('case_number, title, clients(full_name, national_id)')
      .eq('id', caseId)
      .maybeSingle(),
    supabase.from('case_lawyers').select('staff_id').eq('case_id', caseId).eq('is_lead', true).maybeSingle(),
    supabase
      .from('case_court_filings')
      .select('court_case_number, chamber, judge_name, courts(name_en, name_ar)')
      .eq('case_id', caseId)
      .eq('is_current', true)
      .maybeSingle(),
    supabase
      .from('case_opposing_parties')
      .select('name, counsel_name')
      .eq('case_id', caseId)
      .eq('is_primary', true)
      .maybeSingle(),
    supabase.rpc('case_covering_poa', { p_case_id: caseId }),
  ])

  const [{ data: leadStaff }, { data: poa }] = await Promise.all([
    lead?.staff_id
      ? supabase.from('staff_directory').select('full_name').eq('id', lead.staff_id).maybeSingle()
      : Promise.resolve({ data: null }),
    poaId ? supabase.from('powers_of_attorney').select('poa_number').eq('id', poaId).maybeSingle() : Promise.resolve({ data: null }),
  ])

  const court = filing?.courts
  const values: Record<DocumentPlaceholder, string | null> = {
    case_number: present(caseRow?.case_number),
    case_title: present(caseRow?.title),
    client_name: present(caseRow?.clients?.full_name),
    client_national_id: present(caseRow?.clients?.national_id),
    lead_lawyer: present(leadStaff?.full_name),
    court_name: court
      ? present(localizedName({ name: court.name_en ?? court.name_ar ?? '', name_ar: court.name_ar }, language))
      : null,
    court_case_number: present(filing?.court_case_number),
    court_chamber: present(filing?.chamber),
    judge: present(filing?.judge_name),
    opposing_party: present(opposing?.name),
    opposing_counsel: present(opposing?.counsel_name),
    poa_number: present(poa?.poa_number),
    firm_name: tShell('firmName'),
    today: formatFullDate(todayInFirmZone(), language),
  }

  const unresolved: ResolvedDraft['unresolved'] = []
  const text = body.replace(TOKEN, (_match, rawKey: string) => {
    const key = rawKey.toLowerCase()
    if (!(DOCUMENT_PLACEHOLDERS as readonly string[]).includes(key)) {
      unresolved.push({ key: rawKey, kind: 'unknown' })
      return tMarker('unknown', { name: rawKey })
    }
    const value = values[key as DocumentPlaceholder]
    if (value === null) unresolved.push({ key, kind: 'missing' })
    // Markers are not isolated: they are written in the draft's own
    // language, so they belong to the sentence around them.
    return value !== null ? `${FSI}${value}${PDI}` : tMarker('missing', { label: tLabels(key) })
  })
  return { text, unresolved }
}
