import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { EmptyState } from '@/components/dashboard/empty-state'
import { Badge } from '@/components/dashboard/badge'
import type { Database } from '@/lib/supabase/database.types'
import { formatDateTime } from '@/lib/format-date-time'
import { getStaffLocale } from '@/lib/get-staff-locale'

type EnquiryStatus = Database['public']['Enums']['enquiry_status']

const statusVariant: Record<EnquiryStatus, 'accent' | 'muted' | 'neutral'> = {
  new: 'accent',
  assigned: 'neutral',
  resolved: 'muted',
}

const statusLabel: Record<EnquiryStatus, string> = {
  new: 'New',
  assigned: 'Assigned',
  resolved: 'Resolved',
}

export default async function EnquiriesListPage() {
  const supabase = await createClient()
  const locale = await getStaffLocale()

  const [{ data: enquiries }, { data: staffDirectory }] = await Promise.all([
    supabase
      .from('enquiries')
      .select('id, name, phone, email, status, assigned_to, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('staff_directory').select('id, full_name'),
  ])

  const nameById = new Map(
    (staffDirectory ?? [])
      .filter((s): s is { id: string; full_name: string } => s.id !== null && s.full_name !== null)
      .map((s) => [s.id, s.full_name])
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Enquiries" description="Messages submitted through the public site's contact form." />

      {!enquiries || enquiries.length === 0 ? (
        <EmptyState title="No enquiries yet" description="Submissions from the public contact form will show up here." />
      ) : (
        <Panel className="p-0">
          <ul className="flex flex-col divide-y divide-line">
            {enquiries.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/dashboard/enquiries/${e.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm transition-colors hover:bg-line/30"
                >
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-fg">{e.name}</span>
                    <Badge variant={statusVariant[e.status]}>{statusLabel[e.status]}</Badge>
                  </span>
                  <span className="text-fg-muted">
                    {e.phone || e.email ? (
                      <>
                        {e.phone && <bdi>{e.phone}</bdi>}
                        {e.phone && e.email && ' · '}
                        {e.email && <bdi>{e.email}</bdi>}
                      </>
                    ) : (
                      '—'
                    )}
                    {' · '}
                    {e.assigned_to ? (nameById.get(e.assigned_to) ?? 'Unknown staff') : 'Unassigned'}
                    {' · '}
                    <bdi>{formatDateTime(e.created_at, locale)}</bdi>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
