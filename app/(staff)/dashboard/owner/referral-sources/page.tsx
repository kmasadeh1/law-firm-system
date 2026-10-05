import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { ReferralSourcesAdmin } from './referral-sources-admin'
import { PageHeader } from '@/components/dashboard/page-header'

export default async function ReferralSourcesPage() {
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.admin.referralSources' })

  // Every source, active or not - a deactivated one must stay visible here
  // to be reactivated, unlike the client form's picker. The order is the
  // query's; the admin component renders it as given and never re-sorts.
  const { data: sources } = await supabase
    .from('referral_sources')
    .select('id, name_en, name_ar, is_active')
    .order('sort_order', { nullsFirst: false })
    .order('name_en', { nullsFirst: false })
    .order('name_ar')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} description={t('description')} />
      <ReferralSourcesAdmin sources={sources ?? []} />
    </div>
  )
}
