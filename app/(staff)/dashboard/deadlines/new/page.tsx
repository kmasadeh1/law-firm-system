import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'
import { DeadlineForm } from './deadline-form'

export default async function NewDeadlinePage() {
  const supabase = await createClient()
  const { data: periodTypes } = await supabase
    .from('deadline_period_types')
    .select('id, name, name_ar, period_days, description')
    .order('name')

  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.deadlines.new' })

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <BackLink href="/dashboard/deadlines" label={t('backToDeadlines')} />
        <PageHeader title={t('title')} />
      </div>
      <DeadlineForm periodTypes={periodTypes ?? []} />
    </div>
  )
}
