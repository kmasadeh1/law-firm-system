import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { LinkButton } from '@/components/dashboard/button'
import { HeroForm } from './hero-form'

export default async function HeroSectionPage() {
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.admin.siteContent' })

  const { data: section } = await supabase
    .from('site_sections')
    .select('eyebrow_en, eyebrow_ar, title_en, title_ar, intro_en, intro_ar, body_en, body_ar')
    .eq('key', 'hero')
    .maybeSingle()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('cards.hero.title')} />
      <Panel>
        <HeroForm section={section} />
      </Panel>
      <LinkButton href="/dashboard/owner/site-content" variant="secondary" className="self-start">
        {t('back')}
      </LinkButton>
    </div>
  )
}
