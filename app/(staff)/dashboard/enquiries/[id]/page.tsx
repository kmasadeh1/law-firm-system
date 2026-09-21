import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { AssignSection } from './assign-section'
import { StatusSection } from './status-section'
import { formatDateTime } from '@/lib/format-date-time'
import { getStaffLocale } from '@/lib/get-staff-locale'

export default async function EnquiryDetailPage({ params }: PageProps<'/dashboard/enquiries/[id]'>) {
  const { id } = await params
  const supabase = await createClient()
  const locale = await getStaffLocale()

  const { data: enquiry } = await supabase
    .from('enquiries')
    .select('id, name, phone, email, message, status, assigned_to, created_at')
    .eq('id', id)
    .maybeSingle()

  if (!enquiry) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink href="/dashboard/enquiries" label="Enquiries" />
        <p className="text-sm text-fg-muted">
          This enquiry doesn&apos;t exist, or you don&apos;t have access to it.
        </p>
      </div>
    )
  }

  // Active only, matching the case team-assignment convention - you
  // wouldn't assign new work to someone who's left the firm.
  const { data: staffDirectory } = await supabase
    .from('staff_directory')
    .select('id, full_name')
    .eq('is_active', true)
    .order('full_name')

  const staffOptions = (staffDirectory ?? []).filter(
    (s): s is { id: string; full_name: string } => s.id !== null && s.full_name !== null
  )

  return (
    <div className="flex flex-col gap-8">
      <div>
        <BackLink href="/dashboard/enquiries" label="Enquiries" />
        <PageHeader
          title={enquiry.name}
          description={
            <>
              Received <bdi>{formatDateTime(enquiry.created_at, locale)}</bdi>
            </>
          }
        />
      </div>

      <Panel className="flex flex-col gap-3">
        <h2 className="font-heading text-lg text-fg">Message</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {enquiry.phone && (
            <>
              <dt className="text-fg-muted">Phone</dt>
              <dd className="text-fg" dir="ltr">
                {enquiry.phone}
              </dd>
            </>
          )}
          {enquiry.email && (
            <>
              <dt className="text-fg-muted">Email</dt>
              <dd className="text-fg" dir="ltr">
                {enquiry.email}
              </dd>
            </>
          )}
        </dl>
        <p className="whitespace-pre-wrap text-sm text-fg">{enquiry.message}</p>
      </Panel>

      <AssignSection enquiryId={enquiry.id} currentAssignedTo={enquiry.assigned_to} staffOptions={staffOptions} />

      <StatusSection enquiryId={enquiry.id} currentStatus={enquiry.status} />
    </div>
  )
}
