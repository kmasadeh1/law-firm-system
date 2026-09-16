import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'
import { CaseForm } from './case-form'

export default function NewCasePage() {
  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <BackLink href="/dashboard/cases" label="Cases" />
        <PageHeader title="New case" />
      </div>

      <CaseForm />
    </div>
  )
}
