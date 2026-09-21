import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { EmptyState } from '@/components/dashboard/empty-state'
import { LinkButton, Button } from '@/components/dashboard/button'
import { controlClass } from '@/components/dashboard/form'
import { Badge } from '@/components/dashboard/badge'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default async function AppointmentsListPage({
  searchParams,
}: PageProps<'/dashboard/appointments'>) {
  const { from, to, type } = (await searchParams) as { from?: string; to?: string; type?: string }
  const supabase = await createClient()

  // No access gate here - this just renders whatever RLS returns for the
  // signed-in user (owner, appointments_view_all, court_dates_manage for
  // court dates, or their own appointments), including a legitimately
  // narrow or empty list.
  let query = supabase
    .from('appointments')
    .select('id, type, status, starts_at, ends_at, clients(full_name), cases(case_number)')
    .order('starts_at', { ascending: true })

  if (from) {
    query = query.gte('starts_at', new Date(from).toISOString())
  }
  if (to) {
    query = query.lte('starts_at', new Date(to).toISOString())
  }
  if (type === 'consultation' || type === 'court_date') {
    query = query.eq('type', type)
  }

  const { data: appointments } = await query
  const hasFilters = Boolean(from || to || type)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Appointments"
        action={
          <LinkButton href="/dashboard/appointments/new" variant="primary">
            New appointment
          </LinkButton>
        }
      />

      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="from" className="text-xs text-fg-muted">
            From
          </label>
          <input id="from" type="date" name="from" defaultValue={from ?? ''} className={controlClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="to" className="text-xs text-fg-muted">
            To
          </label>
          <input id="to" type="date" name="to" defaultValue={to ?? ''} className={controlClass} />
        </div>
        <select name="type" defaultValue={type ?? ''} className={controlClass}>
          <option value="">All types</option>
          <option value="consultation">Consultation</option>
          <option value="court_date">Court date</option>
        </select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        {hasFilters && (
          <Link
            href="/dashboard/appointments"
            className="flex items-center text-sm text-fg-muted underline-offset-2 hover:underline"
          >
            Clear
          </Link>
        )}
      </form>

      {!appointments || appointments.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No appointments match those filters.' : 'No appointments yet'}
          description={hasFilters ? undefined : 'Schedule a consultation or court date to get started.'}
          action={
            !hasFilters && (
              <LinkButton href="/dashboard/appointments/new" variant="secondary">
                New appointment
              </LinkButton>
            )
          }
        />
      ) : (
        <Panel className="p-0">
          <ul className="flex flex-col divide-y divide-line">
            {appointments.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/dashboard/appointments/${a.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm transition-colors hover:bg-line/30"
                >
                  <span>
                    <span className="font-medium text-fg">
                      <bdi>{formatDateTime(a.starts_at)}</bdi>
                    </span>
                    <span className="text-fg-muted"> — {a.type === 'court_date' ? 'Court date' : 'Consultation'}</span>
                  </span>
                  <span className="flex items-center gap-2 text-fg-muted">
                    {a.clients?.full_name ?? '—'}
                    {a.cases?.case_number && (
                      <>
                        {' '}
                        · <bdi>{a.cases.case_number}</bdi>
                      </>
                    )}
                    <Badge variant={a.status === 'scheduled' ? 'neutral' : 'muted'}>{a.status}</Badge>
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
