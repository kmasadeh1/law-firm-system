import { getTranslations } from 'next-intl/server'
import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { CaseForm } from './case-form'

export default async function NewCasePage() {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.cases.new' })

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <BackLink href="/dashboard/cases" label={t('backToCases')} />
        <PageHeader title={t('title')} />
      </div>

      <CaseForm />
    </div>
  )
}
