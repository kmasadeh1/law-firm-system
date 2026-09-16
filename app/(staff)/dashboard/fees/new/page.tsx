import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'
import { EngagementForm } from './engagement-form'

export default function NewEngagementPage() {
  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <BackLink href="/dashboard/fees" label="Fees & payments" />
        <PageHeader title="New engagement" />
      </div>
      <EngagementForm />
    </div>
  )
}
