import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { EmptyState } from '@/components/dashboard/empty-state'
import { LinkButton, Button } from '@/components/dashboard/button'
import { controlClass } from '@/components/dashboard/form'
import { Badge } from '@/components/dashboard/badge'
import { formatDateTime } from '@/lib/format-date-time'
import { getStaffLocale } from '@/lib/get-staff-locale'

export default async function AppointmentsListPage({
  searchParams,
}: PageProps<'/dashboard/appointments'>) {
  const { from, to, type } = (await searchParams) as { from?: string; to?: string; type?: string }
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.appointments.list' })
  const tType = await getTranslations({ locale, namespace: 'dashboard.appointments.type' })
  const tStatus = await getTranslations({ locale, namespace: 'dashboard.appointments.status' })

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
        title={t('title')}
        action={
          <LinkButton href="/dashboard/appointments/new" variant="primary">
            {t('newAppointment')}
          </LinkButton>
        }
      />

      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="from" className="text-xs text-fg-muted">
            {t('fromLabel')}
          </label>
          <input id="from" type="date" name="from" defaultValue={from ?? ''} className={controlClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="to" className="text-xs text-fg-muted">
            {t('toLabel')}
          </label>
          <input id="to" type="date" name="to" defaultValue={to ?? ''} className={controlClass} />
        </div>
        <select name="type" defaultValue={type ?? ''} className={controlClass}>
          <option value="">{t('allTypes')}</option>
          <option value="consultation">{tType('consultation')}</option>
          <option value="court_date">{tType('court_date')}</option>
        </select>
        <Button type="submit" variant="secondary">
          {t('filter')}
        </Button>
        {hasFilters && (
          <Link
            href="/dashboard/appointments"
            className="flex items-center text-sm text-fg-muted underline-offset-2 hover:underline"
          >
            {t('clear')}
          </Link>
        )}
      </form>

      {!appointments || appointments.length === 0 ? (
        <EmptyState
          title={hasFilters ? t('noneMatchFilters') : t('noneYet')}
          description={hasFilters ? undefined : t('noneYetDescription')}
          action={
            !hasFilters && (
              <LinkButton href="/dashboard/appointments/new" variant="secondary">
                {t('newAppointment')}
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
                      <bdi>{formatDateTime(a.starts_at, locale)}</bdi>
                    </span>
                    <span className="text-fg-muted"> — {tType(a.type)}</span>
                  </span>
                  <span className="flex items-center gap-2 text-fg-muted">
                    <bdi>{a.clients?.full_name ?? '—'}</bdi>
                    {a.cases?.case_number && (
                      <>
                        {' '}
                        · <bdi>{a.cases.case_number}</bdi>
                      </>
                    )}
                    <Badge variant={a.status === 'scheduled' ? 'neutral' : 'muted'}>{tStatus(a.status)}</Badge>
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
