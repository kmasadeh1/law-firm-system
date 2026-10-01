import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { ClientForm } from '../client-form'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'
import { BalanceSection } from './balance-section'

export default async function EditClientPage({ params }: PageProps<'/dashboard/clients/[id]'>) {
  const { id } = await params
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.clients.detail.page' })

  const [{ data: client }, { data: balance }, { data: canManage }] = await Promise.all([
    supabase.from('clients').select('id, full_name, national_id, phone, email, notes').eq('id', id).maybeSingle(),
    supabase
      .from('client_balances')
      .select('agreed_fixed_fee_total, percentage_engagement_count, scheduled_total, paid_total, scheduled_outstanding')
      .eq('client_id', id)
      .maybeSingle(),
    // Read is broader than write - a Lawyer can reach this page for a
    // client on their own case without clients_manage. Asked once here,
    // never OR'd with is_owner() (has_permission already covers the owner).
    supabase.rpc('has_permission', { p_key: 'clients_manage' }),
  ])

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <BackLink href="/dashboard/clients" label={t('backToClients')} />
        <PageHeader title={client ? client.full_name : t('clientNotFound')} />
      </div>

      {client ? (
        <>
          <ClientForm mode="edit" client={client} canManage={canManage === true} />
          <BalanceSection balance={balance} />
        </>
      ) : (
        <p className="text-sm text-fg-muted">{t('clientNotFoundDescription')}</p>
      )}
    </div>
  )
}
