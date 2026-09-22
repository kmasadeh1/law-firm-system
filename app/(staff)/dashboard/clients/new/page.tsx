import { getTranslations } from 'next-intl/server'
import { ClientForm } from '../client-form'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'

export default async function NewClientPage() {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.clients.new' })

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <BackLink href="/dashboard/clients" label={t('backToClients')} />
        <PageHeader title={t('title')} />
      </div>

      <ClientForm mode="create" />
    </div>
  )
}
