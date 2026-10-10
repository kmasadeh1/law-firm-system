import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { ClientForm } from '../client-form'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'
import { EmptyState } from '@/components/dashboard/empty-state'
import { ACTIVE_REFERRAL_SOURCES_SELECT, referralSourceOptions } from '../referral-source-options'
import { dashboardTitle } from '@/lib/page-title'

export default async function NewClientPage() {
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.clients.new' })
  const tForm = await getTranslations({ locale, namespace: 'dashboard.clients.form' })

  // Asked here, not inferred from anything - has_permission already returns
  // true for the owner internally, so this is never OR'd with is_owner().
  const [{ data: canCreate }, { data: activeSources }] = await Promise.all([
    supabase.rpc('has_permission', { p_key: 'clients_manage' }),
    supabase
      .from('referral_sources')
      .select(ACTIVE_REFERRAL_SOURCES_SELECT)
      .eq('is_active', true)
      .order('sort_order', { nullsFirst: false })
      .order('name_en', { nullsFirst: false })
      .order('name_ar'),
  ])

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <BackLink href="/dashboard/clients" label={t('backToClients')} />
        <PageHeader title={t('title')} />
      </div>

      {canCreate === true ? <ClientForm mode="create" referralSources={referralSourceOptions(activeSources ?? [], null, locale)} /> : <EmptyState title={tForm('noAccess')} />}
    </div>
  )
}

export const generateMetadata = () => dashboardTitle('clientsNew')
