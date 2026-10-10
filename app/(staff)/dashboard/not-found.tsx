import { getTranslations } from 'next-intl/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { EmptyState } from '@/components/dashboard/empty-state'
import { LinkButton } from '@/components/dashboard/button'

export default async function DashboardNotFound() {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.notFound' })

  return (
    <EmptyState
      title={t('title')}
      description={t('description')}
      action={
        <LinkButton href="/dashboard" variant="secondary">
          {t('backToDashboard')}
        </LinkButton>
      }
    />
  )
}
