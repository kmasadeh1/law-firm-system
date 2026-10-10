import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'
import { EmptyState } from '@/components/dashboard/empty-state'
import { DeadlineForm } from './deadline-form'
import { dashboardTitle } from '@/lib/page-title'

export default async function NewDeadlinePage() {
  const supabase = await createClient()
  const [{ data: canAdd }, { data: periodTypes }] = await Promise.all([
    // A deadline's insert policy is can_manage_case_details(case_id). There
    // is no case yet on this page, so it asks the case-less form of the same
    // question: could this person manage any case at all?
    supabase.rpc('can_manage_any_case_details'),
    supabase.from('deadline_period_types').select('id, name, name_ar, period_days, description, is_verified').order('name'),
  ])

  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.deadlines.new' })

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <BackLink href="/dashboard/deadlines" label={t('backToDeadlines')} />
        <PageHeader title={t('title')} />
      </div>
      {canAdd === true ? (
        <DeadlineForm periodTypes={periodTypes ?? []} />
      ) : (
        <div data-testid="deadline-new-no-access">
          <EmptyState title={t('noAccess')} />
        </div>
      )}
    </div>
  )
}

export const generateMetadata = () => dashboardTitle('deadlinesNew')
