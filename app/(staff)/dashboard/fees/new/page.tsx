import { getTranslations } from 'next-intl/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'
import { EngagementForm } from './engagement-form'

export default async function NewEngagementPage() {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.fees.new' })

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <BackLink href="/dashboard/fees" label={t('backToFees')} />
        <PageHeader title={t('title')} />
      </div>
      <EngagementForm />
    </div>
  )
}
