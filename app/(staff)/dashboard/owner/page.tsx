import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { formatRelativeTime } from '@/lib/format-relative-time'
import { formatTime, formatDateTime } from '@/lib/format-date-time'
import { formatNumber } from '@/lib/format-number'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { EmptyState } from '@/components/dashboard/empty-state'
import { activityEventTitle } from '@/lib/activity-labels'

const OVERDUE_APPOINTMENTS_LIMIT = 5
const ACTIVITY_LIMIT = 8
const CASES_NEEDING_LEAD_LIMIT = 5

export default async function OwnerDashboardPage() {
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.overview' })
  const tType = await getTranslations({ locale, namespace: 'dashboard.appointments.type' })
  const tActivity = await getTranslations({ locale, namespace: 'dashboard.activity' })

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const startOfTomorrow = new Date(startOfDay)
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)
  const nowIso = new Date().toISOString()

  const [
    { data: todayAppointments },
    { data: activity, count: activityTotal },
    { data: staffDirectory },
    { data: allCases },
    { data: leadRows },
    { data: overdueAppointments, count: overdueTotal },
  ] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, type, starts_at, status, clients(full_name), staff_id')
      .gte('starts_at', startOfDay.toISOString())
      .lt('starts_at', startOfTomorrow.toISOString())
      .order('starts_at', { ascending: true }),
    // count: 'exact' alongside the same unfiltered order/limit - the
    // RLS-scoped total, not a client-side count, so "+N more" always
    // reflects what this same query would return without the cap.
    supabase
      .from('activity_log')
      .select('id, action, table_name, created_at, actor_id, new_data, old_data', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(ACTIVITY_LIMIT),
    supabase.from('staff_directory').select('id, full_name').eq('is_active', true),
    supabase.from('cases').select('id, case_number, title, case_statuses(name, is_terminal)'),
    supabase.from('case_lawyers').select('case_id').eq('is_lead', true),
    // Oldest-first: on a "needing attention" panel, the most overdue item -
    // the one ignored longest - is the one most worth seeing, and is
    // exactly the one a newest-first order with a cap would cut first.
    // count: 'exact' with the same two filters as the row query, so "+N
    // more" is the same RLS-scoped, filtered total the rows themselves
    // come from, never a global count.
    supabase
      .from('appointments')
      .select('id, type, starts_at, clients(full_name)', { count: 'exact' })
      .lt('starts_at', nowIso)
      .eq('status', 'scheduled')
      .order('starts_at', { ascending: true })
      .limit(OVERDUE_APPOINTMENTS_LIMIT),
  ])

  const nameById = new Map((staffDirectory ?? []).map((s) => [s.id, s.full_name]))
  const leadCaseIds = new Set((leadRows ?? []).map((r) => r.case_id))
  const casesNeedingLead = (allCases ?? []).filter(
    (c) => c.case_statuses?.is_terminal === false && !leadCaseIds.has(c.id)
  )
  const visibleCasesNeedingLead = casesNeedingLead.slice(0, CASES_NEEDING_LEAD_LIMIT)
  const hiddenCasesNeedingLead = casesNeedingLead.length - visibleCasesNeedingLead.length
  const hiddenOverdueAppointments = (overdueTotal ?? 0) - (overdueAppointments?.length ?? 0)
  const hiddenActivity = (activityTotal ?? 0) - (activity?.length ?? 0)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t('title')} description={t('description')} />

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg text-fg">{t('todaysSchedule')}</h2>
        {!todayAppointments || todayAppointments.length === 0 ? (
          <EmptyState title={t('nothingToday')} />
        ) : (
          <Panel className="p-0">
            <ul className="flex flex-col divide-y divide-line">
              {todayAppointments.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/dashboard/appointments/${a.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm transition-colors hover:bg-line/30"
                  >
                    <span className="font-medium text-fg">
                      <bdi>{formatTime(a.starts_at, locale)}</bdi>
                    </span>
                    <span className="text-fg-muted">
                      {tType(a.type)}
                      {a.clients?.full_name && (
                        <>
                          {' · '}
                          <bdi>{a.clients.full_name}</bdi>
                        </>
                      )}
                      {' · '}
                      <bdi>{a.staff_id ? (nameById.get(a.staff_id) ?? t('unassigned')) : t('unassigned')}</bdi>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg text-fg">{t('needingAttention')}</h2>
        {casesNeedingLead.length === 0 && (!overdueAppointments || overdueAppointments.length === 0) ? (
          <EmptyState title={t('nothingNeedsAttention')} />
        ) : (
          <Panel className="flex flex-col gap-4">
            {casesNeedingLead.length > 0 && (
              <div>
                <p className="text-sm font-medium text-fg">
                  <bdi>{t('openCasesNoLead', { count: casesNeedingLead.length })}</bdi>
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {visibleCasesNeedingLead.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/dashboard/cases/${c.id}`}
                        className="text-sm text-fg-muted underline-offset-2 hover:text-fg hover:underline"
                      >
                        <bdi>{c.case_number}</bdi> — <bdi>{c.title}</bdi>
                      </Link>
                    </li>
                  ))}
                </ul>
                {hiddenCasesNeedingLead > 0 && (
                  // No filtered view of "cases with no lead" exists to link
                  // to (the cases list only supports q/status/page) - plain
                  // disclosure, not a link that would only be partly right.
                  <p
                    className="mt-1 text-xs text-fg-muted"
                    data-testid="cases-no-lead-more"
                  >
                    {t('moreCount', { count: formatNumber(hiddenCasesNeedingLead, locale) })}
                  </p>
                )}
              </div>
            )}
            {overdueAppointments && overdueAppointments.length > 0 && (
              <div>
                <p className="text-sm font-medium text-fg">
                  {t('appointmentsPastTime', { count: overdueTotal ?? overdueAppointments.length })}
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {overdueAppointments.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/dashboard/appointments/${a.id}`}
                        className="text-sm text-fg-muted underline-offset-2 hover:text-fg hover:underline"
                      >
                        <bdi>{formatDateTime(a.starts_at, locale)}</bdi> · <bdi>{a.clients?.full_name ?? t('unknownClient')}</bdi>
                      </Link>
                    </li>
                  ))}
                </ul>
                {hiddenOverdueAppointments > 0 && (
                  // No filtered view of "overdue scheduled appointments"
                  // exists to link to (the appointments list has no status
                  // filter) - plain disclosure, not a link that would only
                  // be partly right.
                  <p
                    className="mt-1 text-xs text-fg-muted"
                    data-testid="overdue-appointments-more"
                  >
                    {t('moreCount', { count: formatNumber(hiddenOverdueAppointments, locale) })}
                  </p>
                )}
              </div>
            )}
          </Panel>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg text-fg">{t('recentActivity')}</h2>
        {!activity || activity.length === 0 ? (
          <EmptyState title={t('noActivityYet')} />
        ) : (
          <Panel className="p-0">
            <ul className="flex flex-col divide-y divide-line">
              {activity.map((entry) => {
                const detail = (entry.new_data ?? entry.old_data) as Record<string, unknown> | null
                return (
                  <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                    <span className="text-fg">
                      {activityEventTitle(tActivity, entry.table_name, entry.action, detail)}
                      {entry.actor_id && (
                        <span className="text-fg-muted">
                          {' · '}
                          <bdi>{nameById.get(entry.actor_id) ?? t('unknownStaff')}</bdi>
                        </span>
                      )}
                    </span>
                    <span className="text-fg-muted">
                      <bdi>{formatRelativeTime(entry.created_at, locale)}</bdi>
                    </span>
                  </li>
                )
              })}
            </ul>
            {hiddenActivity > 0 && (
              // /dashboard/owner/activity has no required filters, so
              // visiting it plain reproduces this same unfiltered,
              // newest-first query without the cap - a real link, unlike
              // the other two "+N more" rows on this page.
              <Link
                href="/dashboard/owner/activity"
                className="border-t border-line px-5 py-3 text-xs text-fg-muted underline-offset-2 hover:text-fg hover:underline"
                data-testid="activity-more"
              >
                {t('moreCount', { count: formatNumber(hiddenActivity, locale) })}
              </Link>
            )}
          </Panel>
        )}
      </section>
    </div>
  )
}
