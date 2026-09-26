import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { LinkButton } from '@/components/dashboard/button'
import { FirmDetailsForm } from './firm-details-form'

export default async function FirmDetailsPage() {
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.admin.siteContent' })

  const { data: settings } = await supabase
    .from('firm_settings')
    .select('address_en, address_ar, phone, email, hours_en, hours_ar')
    .maybeSingle()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('cards.firmDetails.title')} />
      <Panel>
        <FirmDetailsForm settings={settings} />
      </Panel>
      <LinkButton href="/dashboard/owner/site-content" variant="secondary" className="self-start">
        {t('back')}
      </LinkButton>
    </div>
  )
}
