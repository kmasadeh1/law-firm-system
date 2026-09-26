import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { PageHeader } from '@/components/dashboard/page-header'
import { LinkButton } from '@/components/dashboard/button'
import { LawyerProfilesAdmin } from './lawyer-profiles-admin'

export default async function LawyerProfilesPage() {
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.admin.siteContent' })

  // No is_published filter - the owner needs to see hidden profiles
  // (dimmed, badged) too, not just what a visitor sees.
  const { data: items } = await supabase
    .from('lawyer_profiles')
    .select('id, name_en, name_ar, role_en, role_ar, bio_en, bio_ar, sort_order, is_published')
    .order('sort_order')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('cards.lawyerProfiles.title')} description={t('cards.lawyerProfiles.description')} />
      <LawyerProfilesAdmin items={items ?? []} />
      <LinkButton href="/dashboard/owner/site-content" variant="secondary" className="self-start">
        {t('back')}
      </LinkButton>
    </div>
  )
}
