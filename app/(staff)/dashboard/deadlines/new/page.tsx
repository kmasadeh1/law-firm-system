import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'
import { DeadlineForm } from './deadline-form'

export default async function NewDeadlinePage() {
  const supabase = await createClient()
  const { data: periodTypes } = await supabase
    .from('deadline_period_types')
    .select('id, name, period_days, description')
    .order('name')

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <BackLink href="/dashboard/deadlines" label="Deadlines" />
        <PageHeader title="New deadline" />
      </div>
      <DeadlineForm periodTypes={periodTypes ?? []} />
    </div>
  )
}
