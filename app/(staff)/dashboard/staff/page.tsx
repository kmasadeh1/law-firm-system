import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { EmptyState } from '@/components/dashboard/empty-state'
import { Badge } from '@/components/dashboard/badge'
import { LinkButton } from '@/components/dashboard/button'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export default async function StaffDashboardPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims
  const staffId = user?.sub as string

  const nowIso = new Date().toISOString()

  const [{ data: appointments }, { data: assignments }] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, type, starts_at, clients(full_name), cases(case_number)')
      .eq('staff_id', staffId)
      .gte('starts_at', nowIso)
      .order('starts_at', { ascending: true })
      .limit(5),
    supabase
      .from('case_lawyers')
      .select('is_lead, cases(id, case_number, title, case_statuses(name))')
      .eq('staff_id', staffId)
      .limit(8),
  ])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="What's on today" description="Your upcoming appointments and assigned cases." />

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg text-fg">Upcoming appointments</h2>
        {!appointments || appointments.length === 0 ? (
          <EmptyState
            title="Nothing scheduled"
            description="You have no upcoming appointments or court dates."
            action={
              <LinkButton href="/dashboard/appointments/new" variant="secondary">
                Schedule one
              </LinkButton>
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
                    <span className="font-medium text-fg">{formatDateTime(a.starts_at)}</span>
                    <span className="text-fg-muted">
                      {a.type === 'court_date' ? 'Court date' : 'Consultation'}
                      {a.clients?.full_name && <> · {a.clients.full_name}</>}
                      {a.cases?.case_number && <> · {a.cases.case_number}</>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg text-fg">Your cases</h2>
        {!assignments || assignments.length === 0 ? (
          <EmptyState
            title="No cases assigned yet"
            description="Cases you're added to as a team member will show up here."
          />
        ) : (
          <Panel className="p-0">
            <ul className="flex flex-col divide-y divide-line">
              {assignments
                .filter((a) => a.cases)
                .map((a) => (
                  <li key={a.cases!.id}>
                    <Link
                      href={`/dashboard/cases/${a.cases!.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm transition-colors hover:bg-line/30"
                    >
                      <span>
                        <span className="font-medium text-fg">{a.cases!.case_number}</span>
                        <span className="text-fg-muted"> — {a.cases!.title}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        {a.is_lead && <Badge variant="accent">Lead</Badge>}
                        <span className="text-fg-muted">{a.cases!.case_statuses?.name ?? '—'}</span>
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          </Panel>
        )}
      </section>
    </div>
  )
}
