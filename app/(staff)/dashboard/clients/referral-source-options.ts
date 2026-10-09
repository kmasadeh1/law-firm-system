import { localizedName } from '@/lib/localized-name'

export type ReferralSourceOption = { id: string; label: string; inactive: boolean }

type SourceRow = { id: string; name_en: string | null; name_ar: string | null; is_active: boolean }

// Picker options for the client form: the ACTIVE sources, in the query's
// order, plus the client's own current source when it has since been
// deactivated - so an existing client keeps showing (and keeps) where they
// came from, while nobody can newly pick a retired source. Names come from
// the database, localized here; either name may be the only one set.
export function referralSourceOptions(
  activeSources: SourceRow[],
  current: SourceRow | null,
  locale: string
): ReferralSourceOption[] {
  const label = (r: SourceRow) => localizedName({ name: r.name_en ?? r.name_ar ?? '', name_ar: r.name_ar }, locale)
  const options = activeSources.map((r) => ({ id: r.id, label: label(r), inactive: false }))
  if (current && !options.some((o) => o.id === current.id)) {
    options.push({ id: current.id, label: label(current), inactive: !current.is_active })
  }
  return options
}

export const ACTIVE_REFERRAL_SOURCES_SELECT = 'id, name_en, name_ar, is_active'
