import Link from 'next/link'
import { rowLabel } from '@/lib/row-label'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { EmptyState } from '@/components/dashboard/empty-state'
import { LinkButton } from '@/components/dashboard/button'
import { urgencyOf, urgencyClass } from './urgency'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { localizedName } from '@/lib/localized-name'
import { formatDate } from '@/lib/format-date-time'
import { dashboardTitle } from '@/lib/page-title'

export default async function DeadlinesListPage() {
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.deadlines.list' })
  const tUrgency = await getTranslations({ locale, namespace: 'dashboard.deadlines.urgency' })

  // RLS already scopes this to what the signed-in user can see (owner,
  // cases_manage, court_dates_manage, or is_on_case) - no extra gate here,
  // same as Cases and Appointments.
  const [{ data: deadlines }, { data: canAdd }] = await Promise.all([
    supabase
      .from('deadlines')
      .select(
        'id, case_id, trigger_date, effective_due_date, extended_due_date, completed_at, cases(case_number, title), deadline_period_types(name, name_ar)'
      )
      .order('effective_due_date', { ascending: true, nullsFirst: false }),
    // "New deadline" is offered only to someone who could manage at least
    // one case's details - the same question /deadlines/new asks.
    supabase.rpc('can_manage_any_case_details'),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        action={
          canAdd === true ? (
            <LinkButton href="/dashboard/deadlines/new" variant="primary" data-testid="deadlines-new">
              {t('newDeadline')}
            </LinkButton>
          ) : undefined
        }
      />

      {!deadlines || deadlines.length === 0 ? (
        <EmptyState
          title={t('noneYet')}
          description={t('noneYetDescription')}
          action={
            canAdd === true ? (
              <LinkButton href="/dashboard/deadlines/new" variant="secondary">
                {t('newDeadline')}
              </LinkButton>
            ) : undefined
          }
        />
      ) : (
        <Panel className="p-0">
          <ul className="flex flex-col divide-y divide-line">
            {deadlines.map((d) => {
              const urgency = urgencyOf(d.effective_due_date, d.completed_at)
              return (
                <li key={d.id}>
                  <Link
                    href={`/dashboard/cases/${d.case_id}`}
                    aria-label={rowLabel(
                      d.deadline_period_types ? localizedName(d.deadline_period_types, locale) : null,
                      d.cases?.case_number,
                      d.cases?.title,
                      d.effective_due_date ? formatDate(d.effective_due_date, locale) : null,
                      tUrgency(urgency)
                    )}
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm transition-colors hover:bg-line/30"
                  >
                    <span>
                      <span className="font-medium text-fg">
                        {d.deadline_period_types ? localizedName(d.deadline_period_types, locale) : '—'}
                      </span>
                      <span className="text-fg-muted">
                        {' '}
                        — <bdi>{d.cases?.case_number}</bdi> · <bdi>{d.cases?.title}</bdi>
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-fg-muted">
                        {d.effective_due_date ? <bdi>{formatDate(d.effective_due_date, locale)}</bdi> : '—'}
                      </span>
                      {d.extended_due_date && (
                        <span className="text-xs text-fg-muted">{t('extendedTag')}</span>
                      )}
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${urgencyClass[urgency]}`}
                      >
                        {tUrgency(urgency)}
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

export const generateMetadata = () => dashboardTitle('deadlines')
