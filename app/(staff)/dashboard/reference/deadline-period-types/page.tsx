import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { PeriodTypesAdmin } from './period-types-admin'
import { PageHeader } from '@/components/dashboard/page-header'
import { Banner } from '@/components/dashboard/banner'
import { dashboardTitle } from '@/lib/page-title'

export default async function DeadlinePeriodTypesPage() {
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.admin.periodTypes' })
  const { data: isOwner } = await supabase.rpc('is_owner')
  const { data: periodTypes } = await supabase
    .from('deadline_period_types')
    .select('id, name, name_ar, period_days, description, description_ar, is_verified, verified_at')
    .order('name')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} />

      <Banner kind="warning">
        <span className="block">{t('sourceWarning')}</span>
        <span className="mt-1 block font-medium">{t('unverifiedWarning')}</span>
      </Banner>

      <PeriodTypesAdmin periodTypes={periodTypes ?? []} canVerify={isOwner === true} />
    </div>
  )
}

export const generateMetadata = () => dashboardTitle('deadlinePeriodTypes')
