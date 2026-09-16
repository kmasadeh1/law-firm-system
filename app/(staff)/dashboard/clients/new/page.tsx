import { ClientForm } from '../client-form'
import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'

export default function NewClientPage() {
  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <BackLink href="/dashboard/clients" label="Clients" />
        <PageHeader title="Add client" />
      </div>

      <ClientForm mode="create" />
    </div>
  )
}
