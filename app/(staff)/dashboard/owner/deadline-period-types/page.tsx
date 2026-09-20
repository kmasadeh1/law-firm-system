import { createClient } from '@/lib/supabase/server'
import { PeriodTypesAdmin } from './period-types-admin'
import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'
import { Banner } from '@/components/dashboard/banner'

export default async function DeadlinePeriodTypesPage() {
  const supabase = await createClient()
  const { data: periodTypes } = await supabase
    .from('deadline_period_types')
    .select('id, name, name_ar, period_days, description, description_ar')
    .order('name')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href="/dashboard/owner" label="Firm overview" />
        <PageHeader title="Deadline period types" />
      </div>

      <Banner kind="warning">
        These periods came from secondary research, not the primary Official Gazette text with
        current amendments. Every row marked &quot;DRAFT — unverified&quot; needs your verification
        before the firm relies on it for a real deadline.
      </Banner>

      <PeriodTypesAdmin periodTypes={periodTypes ?? []} />
    </div>
  )
}
