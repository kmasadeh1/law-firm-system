import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
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

export default async function EnquiriesListPage() {
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.enquiries.list' })
  const tStatus = await getTranslations({ locale, namespace: 'dashboard.enquiries.status' })

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
      <PageHeader title={t('title')} description={t('description')} />

      {!enquiries || enquiries.length === 0 ? (
        <EmptyState title={t('noneYet')} description={t('noneYetDescription')} />
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
                    <Badge variant={statusVariant[e.status]}>{tStatus(e.status)}</Badge>
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
                    <bdi>{e.assigned_to ? (nameById.get(e.assigned_to) ?? t('unknownStaff')) : t('unassigned')}</bdi>
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
