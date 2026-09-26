// Sibling to lib/localized-name.ts, for a different column-naming scheme.
// localizedName/localizedDescription assume a bare English column (`name`)
// with an optional `name_ar` override; the public-site content tables
// (site_sections, practice_areas, lawyer_profiles) instead suffix BOTH
// languages (`name_en`/`name_ar`), with either allowed to be null - so
// neither existing helper fits without a rename that would break its
// current callers.
//
// Falls back to the `_en` column when the requested locale's column is
// null or empty (covers both "no Arabic translation yet" and "not this
// locale"). Returns null only when the `_en` column is also null - the
// caller decides what a missing value means (see the hero title's
// message-file fallback in app/[locale]/page.tsx).
export function localizedField<Field extends string>(
  row: Record<`${Field}_en` | `${Field}_ar`, string | null>,
  field: Field,
  locale: string
): string | null {
  const enValue = row[`${field}_en`]
  if (locale === 'ar') {
    const arValue = row[`${field}_ar`]
    if (arValue) return arValue
  }
  return enValue
}
