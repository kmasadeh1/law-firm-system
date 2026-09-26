import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { Badge } from '@/components/dashboard/badge'
import { LinkButton } from '@/components/dashboard/button'

type Pair = [string | null, string | null]

// True only for the one direction with no graceful fallback: Arabic filled,
// English left blank renders empty for English visitors (see
// bilingual-field.tsx). Missing Arabic isn't flagged - it falls back to
// English on the Arabic page instead of going blank.
function isMissingEnglish(pairs: Pair[]) {
  return pairs.some(([ar, en]) => !!ar && !en)
}

export default async function SiteContentPage() {
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.admin.siteContent' })

  const [{ data: firmSettings }, { data: sections }] = await Promise.all([
    supabase.from('firm_settings').select('address_en, address_ar, hours_en, hours_ar').maybeSingle(),
    supabase
      .from('site_sections')
      .select('key, eyebrow_en, eyebrow_ar, title_en, title_ar, intro_en, intro_ar, body_en, body_ar'),
  ])

  const sectionByKey = new Map((sections ?? []).map((row) => [row.key, row]))
  const hero = sectionByKey.get('hero') ?? null
  const practiceAreas = sectionByKey.get('practice_areas') ?? null
  const lawyers = sectionByKey.get('lawyers') ?? null
  const contact = sectionByKey.get('contact') ?? null

  // Part two adds two more cards here (practice-area items, lawyer
  // profiles) - this list and the grid below are already built to take
  // more entries.
  const cards = [
    {
      key: 'firmDetails',
      href: '/dashboard/owner/site-content/firm-details',
      missingEnglish: isMissingEnglish([
        [firmSettings?.address_ar ?? null, firmSettings?.address_en ?? null],
        [firmSettings?.hours_ar ?? null, firmSettings?.hours_en ?? null],
      ]),
    },
    {
      key: 'hero',
      href: '/dashboard/owner/site-content/hero',
      missingEnglish: isMissingEnglish([
        [hero?.eyebrow_ar ?? null, hero?.eyebrow_en ?? null],
        [hero?.title_ar ?? null, hero?.title_en ?? null],
        [hero?.intro_ar ?? null, hero?.intro_en ?? null],
        [hero?.body_ar ?? null, hero?.body_en ?? null],
      ]),
    },
    {
      key: 'practiceAreas',
      href: '/dashboard/owner/site-content/practice-areas',
      missingEnglish: isMissingEnglish([
        [practiceAreas?.title_ar ?? null, practiceAreas?.title_en ?? null],
        [practiceAreas?.intro_ar ?? null, practiceAreas?.intro_en ?? null],
      ]),
    },
    {
      key: 'lawyers',
      href: '/dashboard/owner/site-content/lawyers',
      missingEnglish: isMissingEnglish([
        [lawyers?.title_ar ?? null, lawyers?.title_en ?? null],
        [lawyers?.intro_ar ?? null, lawyers?.intro_en ?? null],
      ]),
    },
    {
      key: 'contact',
      href: '/dashboard/owner/site-content/contact',
      missingEnglish: isMissingEnglish([
        [contact?.title_ar ?? null, contact?.title_en ?? null],
        [contact?.intro_ar ?? null, contact?.intro_en ?? null],
      ]),
    },
  ] as const

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} description={t('description')} />

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <Panel key={card.key} className="flex flex-col gap-3" data-testid={`site-content-card-${card.key}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-heading text-lg text-fg">{t(`cards.${card.key}.title`)}</h2>
                <p className="mt-1 text-sm text-fg-muted">{t(`cards.${card.key}.description`)}</p>
              </div>
              <Badge
                variant={card.missingEnglish ? 'accent' : 'muted'}
                data-testid={`site-content-status-${card.key}`}
              >
                {card.missingEnglish ? t('statusMissingEnglish') : t('statusComplete')}
              </Badge>
            </div>
            <LinkButton href={card.href} variant="secondary" className="self-start" data-testid={`site-content-edit-${card.key}`}>
              {t('edit')}
            </LinkButton>
          </Panel>
        ))}
      </div>
    </div>
  )
}
