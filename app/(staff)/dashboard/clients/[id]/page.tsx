import { createClient } from '@/lib/supabase/server'
import { ClientForm } from '../client-form'
import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'
import { BalanceSection } from './balance-section'

export default async function EditClientPage({ params }: PageProps<'/dashboard/clients/[id]'>) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: client }, { data: balance }] = await Promise.all([
    supabase.from('clients').select('id, full_name, national_id, phone, email, notes').eq('id', id).maybeSingle(),
    supabase
      .from('client_balances')
      .select('total_agreed, total_paid, total_outstanding')
      .eq('client_id', id)
      .maybeSingle(),
  ])

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <BackLink href="/dashboard/clients" label="Clients" />
        <PageHeader title={client ? client.full_name : 'Client not found'} />
      </div>

      {client ? (
        <>
          <ClientForm mode="edit" client={client} />
          <BalanceSection balance={balance} />
        </>
      ) : (
        <p className="text-sm text-fg-muted">
          This client doesn&apos;t exist, or you don&apos;t have access to it.
        </p>
      )}
    </div>
  )
}
