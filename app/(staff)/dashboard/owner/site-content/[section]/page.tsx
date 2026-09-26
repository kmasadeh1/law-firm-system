import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { LinkButton } from '@/components/dashboard/button'
import { isSectionTextSlug, SECTION_TEXT_KEY, type SectionTextSlug } from '../section-config'
import { SectionTextForm } from './section-text-form'

const CARD_KEY: Record<SectionTextSlug, string> = {
  'practice-areas': 'practiceAreas',
  lawyers: 'lawyers',
  contact: 'contact',
}

export default async function SectionTextPage({ params }: PageProps<'/dashboard/owner/site-content/[section]'>) {
  const { section } = await params
  if (!isSectionTextSlug(section)) {
    notFound()
  }

  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.admin.siteContent' })

  const { data: sectionRow } = await supabase
    .from('site_sections')
    .select('title_en, title_ar, intro_en, intro_ar')
    .eq('key', SECTION_TEXT_KEY[section])
    .maybeSingle()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t(`cards.${CARD_KEY[section]}.title`)} />
      <Panel>
        <SectionTextForm slug={section} section={sectionRow} />
      </Panel>
      <LinkButton href="/dashboard/owner/site-content" variant="secondary" className="self-start">
        {t('back')}
      </LinkButton>
    </div>
  )
}
