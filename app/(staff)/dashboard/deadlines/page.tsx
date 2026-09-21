import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { EmptyState } from '@/components/dashboard/empty-state'
import { LinkButton } from '@/components/dashboard/button'
import { urgencyOf, urgencyClass, urgencyLabel } from './urgency'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { localizedName } from '@/lib/localized-name'

export default async function DeadlinesListPage() {
  const supabase = await createClient()
  const locale = await getStaffLocale()

  // RLS already scopes this to what the signed-in user can see (owner,
  // cases_manage, court_dates_manage, or is_on_case) - no extra gate here,
  // same as Cases and Appointments.
  const { data: deadlines } = await supabase
    .from('deadlines')
    .select(
      'id, case_id, trigger_date, effective_due_date, extended_due_date, cases(case_number, title), deadline_period_types(name, name_ar)'
    )
    .order('effective_due_date', { ascending: true, nullsFirst: false })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Deadlines"
        action={
          <LinkButton href="/dashboard/deadlines/new" variant="primary">
            New deadline
          </LinkButton>
        }
      />

      {!deadlines || deadlines.length === 0 ? (
        <EmptyState
          title="No deadlines yet"
          description="Add a deadline against a case to start tracking it."
          action={
            <LinkButton href="/dashboard/deadlines/new" variant="secondary">
              New deadline
            </LinkButton>
          }
        />
      ) : (
        <Panel className="p-0">
          <ul className="flex flex-col divide-y divide-line">
            {deadlines.map((d) => {
              const urgency = urgencyOf(d.effective_due_date)
              return (
                <li key={d.id}>
                  <Link
                    href={`/dashboard/cases/${d.case_id}`}
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm transition-colors hover:bg-line/30"
                  >
                    <span>
                      <span className="font-medium text-fg">
                        {d.deadline_period_types ? localizedName(d.deadline_period_types, locale) : '—'}
                      </span>
                      <span className="text-fg-muted">
                        {' '}
                        — <bdi>{d.cases?.case_number}</bdi> · {d.cases?.title}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-fg-muted">
                        {d.effective_due_date ? <bdi>{d.effective_due_date}</bdi> : '—'}
                      </span>
                      {d.extended_due_date && (
                        <span className="text-xs text-fg-muted">(extended)</span>
                      )}
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${urgencyClass[urgency]}`}
                      >
                        {urgencyLabel[urgency]}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </Panel>
      )}
    </div>
  )
}
