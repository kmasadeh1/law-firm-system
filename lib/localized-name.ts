// Shared English/Arabic display fallback for firm-defined reference data
// (case statuses, roles, deadline period types) whose Arabic translation is
// optional. A database trigger guarantees the _ar columns are never an
// empty string, so a plain null check is enough here - no .trim() defence.

export function localizedName(row: { name: string; name_ar?: string | null }, locale: string): string {
  if (locale === 'ar' && row.name_ar) {
    return row.name_ar
  }
  return row.name
}

export function localizedDescription(
  row: { description: string | null; description_ar?: string | null },
  locale: string
): string | null {
  if (locale === 'ar' && row.description_ar) {
    return row.description_ar
  }
  return row.description
}
