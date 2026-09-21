import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { formatRelativeTime } from '@/lib/format-relative-time'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { EmptyState } from '@/components/dashboard/empty-state'
import { activityEventTitle } from '@/lib/activity-labels'

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { timeStyle: 'short' })
}

export default async function OwnerDashboardPage() {
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.overview' })

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const startOfTomorrow = new Date(startOfDay)
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)
  const nowIso = new Date().toISOString()

  const [
    { data: todayAppointments },
    { data: activity },
    { data: staffDirectory },
    { data: allCases },
    { data: leadRows },
    { data: overdueAppointments },
  ] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, type, starts_at, status, clients(full_name), staff_id')
      .gte('starts_at', startOfDay.toISOString())
      .lt('starts_at', startOfTomorrow.toISOString())
      .order('starts_at', { ascending: true }),
    supabase
      .from('activity_log')
      .select('id, action, table_name, created_at, actor_id, new_data, old_data')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase.from('staff_directory').select('id, full_name').eq('is_active', true),
    supabase.from('cases').select('id, case_number, title, case_statuses(name, is_terminal)'),
    supabase.from('case_lawyers').select('case_id').eq('is_lead', true),
    supabase
      .from('appointments')
      .select('id, type, starts_at, clients(full_name)')
      .lt('starts_at', nowIso)
      .eq('status', 'scheduled')
      .order('starts_at', { ascending: false })
      .limit(5),
  ])

  const nameById = new Map((staffDirectory ?? []).map((s) => [s.id, s.full_name]))
  const leadCaseIds = new Set((leadRows ?? []).map((r) => r.case_id))
  const casesNeedingLead = (allCases ?? []).filter(
    (c) => c.case_statuses?.is_terminal === false && !leadCaseIds.has(c.id)
  )

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
                      <bdi>{formatTime(a.starts_at)}</bdi>
                    </span>
                    <span className="text-fg-muted">
                      {a.type === 'court_date' ? t('courtDate') : t('consultation')}
                      {a.clients?.full_name && <> · {a.clients.full_name}</>}
                      {' · '}
                      {a.staff_id ? (nameById.get(a.staff_id) ?? t('unassigned')) : t('unassigned')}
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
                  {t('openCasesNoLead', { count: casesNeedingLead.length })}
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {casesNeedingLead.slice(0, 5).map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/dashboard/cases/${c.id}`}
                        className="text-sm text-fg-muted underline-offset-2 hover:text-fg hover:underline"
                      >
                        <bdi>{c.case_number}</bdi> — {c.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {overdueAppointments && overdueAppointments.length > 0 && (
              <div>
                <p className="text-sm font-medium text-fg">
                  {t('appointmentsPastTime', { count: overdueAppointments.length })}
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {overdueAppointments.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/dashboard/appointments/${a.id}`}
                        className="text-sm text-fg-muted underline-offset-2 hover:text-fg hover:underline"
                      >
                        <bdi>{formatTime(a.starts_at)}</bdi> · {a.clients?.full_name ?? t('unknownClient')}
                      </Link>
                    </li>
                  ))}
                </ul>
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
                      {activityEventTitle(entry.table_name, entry.action, detail)}
                      {entry.actor_id && (
                        <span className="text-fg-muted"> · {nameById.get(entry.actor_id) ?? t('unknownStaff')}</span>
                      )}
                    </span>
                    <span className="text-fg-muted">
                      <bdi>{formatRelativeTime(entry.created_at, locale)}</bdi>
                    </span>
                  </li>
                )
              })}
            </ul>
          </Panel>
        )}
      </section>
    </div>
  )
}
