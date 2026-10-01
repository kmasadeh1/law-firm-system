import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'
import { EmptyState } from '@/components/dashboard/empty-state'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { CaseForm } from './case-form'

export default async function NewCasePage() {
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.cases.new' })

  // Asked here, not inferred from anything - has_permission already returns
  // true for the owner internally, so this is never OR'd with is_owner().
  const { data: canCreate } = await supabase.rpc('has_permission', { p_key: 'cases_manage' })

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <BackLink href="/dashboard/cases" label={t('backToCases')} />
        <PageHeader title={t('title')} />
      </div>

      {canCreate === true ? <CaseForm /> : <EmptyState title={t('noAccess')} />}
    </div>
  )
}
