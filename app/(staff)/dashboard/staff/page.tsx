import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { EmptyState } from '@/components/dashboard/empty-state'
import { Badge } from '@/components/dashboard/badge'
import { LinkButton } from '@/components/dashboard/button'
import { localizedName } from '@/lib/localized-name'
import { formatDateTime } from '@/lib/format-date-time'

export default async function StaffDashboardPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims
  const staffId = user?.sub as string

  const nowIso = new Date().toISOString()

  const [{ data: appointments }, { data: assignments }, { data: staffRow }] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, type, starts_at, clients(full_name), cases(case_number)')
      .eq('staff_id', staffId)
      .gte('starts_at', nowIso)
      .order('starts_at', { ascending: true })
      .limit(5),
    supabase
      .from('case_lawyers')
      .select('is_lead, cases(id, case_number, title, case_statuses(name, name_ar))')
      .eq('staff_id', staffId)
      .limit(8),
    supabase.from('staff').select('locale').eq('id', staffId).maybeSingle(),
  ])

  const locale = staffRow?.locale === 'ar' ? 'ar' : 'en'
  // Only the appointment-type enum lookup is extracted here - the rest of
  // this page is a pending extraction batch of its own, matching the
  // convention that a code-defined enum never gets a second copy of its
  // mapping just because the page around it isn't translated yet.
  const tType = await getTranslations({ locale, namespace: 'dashboard.appointments.type' })

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
                    <span className="font-medium text-fg">
                      <bdi>{formatDateTime(a.starts_at, locale)}</bdi>
                    </span>
                    <span className="text-fg-muted">
                      {tType(a.type)}
                      {a.clients?.full_name && (
                        <>
                          {' · '}
                          <bdi>{a.clients.full_name}</bdi>
                        </>
                      )}
                      {a.cases?.case_number && (
                        <>
                          {' '}
                          · <bdi>{a.cases.case_number}</bdi>
                        </>
                      )}
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
                        <span className="font-medium text-fg">
                          <bdi>{a.cases!.case_number}</bdi>
                        </span>
                        <span className="text-fg-muted"> — {a.cases!.title}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        {a.is_lead && <Badge variant="accent">Lead</Badge>}
                        <span className="text-fg-muted">
                          {a.cases!.case_statuses ? localizedName(a.cases!.case_statuses, locale) : '—'}
                        </span>
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
