// Maps the URL-friendly section slugs used under /dashboard/owner/site-content
// to the site_sections table's `key` column. Kept as a single source of
// truth so the [section] route, its form, and the actions that write to it
// can't drift out of sync with each other.
export type SectionTextSlug = 'practice-areas' | 'lawyers' | 'contact'

export const SECTION_TEXT_KEY: Record<SectionTextSlug, string> = {
  'practice-areas': 'practice_areas',
  lawyers: 'lawyers',
  contact: 'contact',
}

export function isSectionTextSlug(value: string): value is SectionTextSlug {
  return value === 'practice-areas' || value === 'lawyers' || value === 'contact'
}
