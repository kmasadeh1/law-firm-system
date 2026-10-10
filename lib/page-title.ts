import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getStaffLocale } from '@/lib/get-staff-locale'

// Per-page tab title for the staff area. The "<firm> - " prefix comes from
// the title template in app/(staff)/layout.tsx; this supplies the page part,
// translated into the signed-in staff member's language.
export async function dashboardTitle(key: string): Promise<Metadata> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.pageTitles' })
  return { title: t(key) }
}
