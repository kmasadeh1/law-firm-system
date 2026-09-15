import { createClient } from '@/lib/supabase/server'
import { ClientForm } from '../client-form'
import { BackLink } from '../../back-link'

export default async function EditClientPage({ params }: PageProps<'/dashboard/clients/[id]'>) {
  const { id } = await params
  const supabase = await createClient()

  const { data: client } = await supabase
    .from('clients')
    .select('id, full_name, national_id, phone, email, notes')
    .eq('id', id)
    .maybeSingle()

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 dark:bg-black sm:px-8">
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <div>
          <BackLink />
          <h1 className="mt-1 text-2xl font-semibold text-black dark:text-zinc-50">
            {client ? client.full_name : 'Client not found'}
          </h1>
        </div>

        {client ? (
          <ClientForm mode="edit" client={client} />
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            This client doesn&apos;t exist, or you don&apos;t have access to it.
          </p>
        )}
      </div>
    </div>
  )
}
