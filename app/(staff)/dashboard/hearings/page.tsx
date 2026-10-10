import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { EmptyState } from '@/components/dashboard/empty-state'
import { LinkButton, Button } from '@/components/dashboard/button'
import { controlClass } from '@/components/dashboard/form'
import { addDaysToDate, formatFullDate, formatTimeOfDay, todayInFirmZone } from '@/lib/format-date-time'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { localizedName } from '@/lib/localized-name'
import { PrintButton } from '@/components/dashboard/print-button'
import { dashboardTitle } from '@/lib/page-title'

// Parses ?date= defensively: anything that isn't a real YYYY-MM-DD calendar
// date (typo'd URL, 2026-02-30) falls back to today rather than erroring.
function parseDateParam(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.toISOString().slice(0, 10) === value ? value : null
}

function dayHref(value: string) {
  return `/dashboard/hearings?date=${value}`
}

export default async function HearingCalendarPage({ searchParams }: PageProps<'/dashboard/hearings'>) {
  const { date: dateParam } = (await searchParams) as { date?: string }
  // The firm's own calendar day, not the server's - on a UTC host the
  // server's "today" would still be yesterday in Amman until 03:00.
  const today = todayInFirmZone()
  const date = parseDateParam(dateParam) ?? today

  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.hearings' })
  const tColumns = await getTranslations({ locale, namespace: 'dashboard.hearings.columns' })
  const tCourtType = await getTranslations({ locale, namespace: 'dashboard.admin.courts.type' })
  const tOutcome = await getTranslations({ locale, namespace: 'dashboard.cases.detail.hearings.outcome' })
  const tShell = await getTranslations({ locale, namespace: 'dashboard.shell' })

  // No access gate and no permission filter here: firm_hearing_schedule is
  // security_invoker, so it already returns only the hearings this user may
  // see. An empty result is a normal state for a role that can't see other
  // people's cases, and is rendered as an empty day, never as "no access".
  //
  // Filtering and ordering both happen in the query. Courts are ordered by
  // name in the reader's language (falling back to the English name, then
  // court_id, so each court's rows stay contiguous); within a court, by
  // session time, with untimed sessions last.
  const courtNameOrder = locale === 'ar' ? ['court_name_ar', 'court_name_en'] : ['court_name_en']
  let query = supabase
    .from('firm_hearing_schedule')
    .select(
      'hearing_id, session_time, outcome, court_id, court_name_en, court_name_ar, court_city_en, court_city_ar, court_type, court_case_number, chamber, judge_name, case_id, case_number, case_title, client_name, lead_lawyer_name'
    )
    .eq('session_date', date)
  for (const column of courtNameOrder) {
    query = query.order(column, { ascending: true, nullsFirst: false })
  }
  const { data: hearings } = await query
    .order('court_id', { ascending: true })
    .order('session_time', { ascending: true, nullsFirst: false })
    .order('case_number', { ascending: true })

  // Display grouping only: rows already arrive court by court, so this just
  // cuts the ordered list wherever court_id changes.
  type Row = NonNullable<typeof hearings>[number]
  const groups: { courtId: string; rows: Row[] }[] = []
  for (const row of hearings ?? []) {
    const courtId = row.court_id ?? ''
    const last = groups[groups.length - 1]
    if (last && last.courtId === courtId) {
      last.rows.push(row)
    } else {
      groups.push({ courtId, rows: [row] })
    }
  }

  const fullDate = formatFullDate(date, locale)
  const total = hearings?.length ?? 0

  return (
    <div className="hearing-calendar flex flex-col gap-6" data-testid="hearing-calendar">
      {/* Print-only letterhead: firm name, title and the day. On screen the
          PageHeader below carries the same title and date. */}
      <div className="hidden print:block" data-testid="hearing-calendar-print-header">
        <p className="text-base font-semibold text-fg">{tShell('firmName')}</p>
        <h1 className="mt-1 text-lg text-fg">
          {t('printTitle')} — <bdi>{fullDate}</bdi>
        </h1>
        <p className="mt-0.5 text-xs text-fg-muted">{t('count', { count: total })}</p>
      </div>

      <div className="print:hidden">
        <PageHeader title={t('title')} description={fullDate} action={<PrintButton label={t('print')} testId="hearing-calendar-print" />} />
      </div>

      <div className="flex flex-col gap-3 print:hidden" data-testid="hearing-calendar-controls">
        <div className="flex flex-wrap items-end gap-2">
          <LinkButton href={dayHref(addDaysToDate(date, -1))} variant="secondary" data-testid="hearing-calendar-previous">
            {t('previousDay')}
          </LinkButton>
          {date !== today && (
            <LinkButton href={dayHref(today)} variant="secondary" data-testid="hearing-calendar-today">
              {t('today')}
            </LinkButton>
          )}
          <LinkButton href={dayHref(addDaysToDate(date, 1))} variant="secondary" data-testid="hearing-calendar-next">
            {t('nextDay')}
          </LinkButton>

          <form method="get" action="/dashboard/hearings" className="flex items-end gap-2 sm:ms-auto">
            <div className="flex flex-col gap-1">
              <label htmlFor="hearing-date" className="text-xs text-fg-muted">
                {t('dateLabel')}
              </label>
              <input
                id="hearing-date"
                type="date"
                name="date"
                defaultValue={date}
                required
                className={controlClass}
                data-testid="hearing-calendar-date"
              />
            </div>
            <Button type="submit" variant="secondary" data-testid="hearing-calendar-show">
              {t('show')}
            </Button>
          </form>
        </div>
      </div>

      {groups.length === 0 ? (
        <>
          <div className="print:hidden">
            <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
          </div>
          <p className="hidden text-sm text-fg print:block">{t('emptyTitle')}</p>
        </>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface print:overflow-visible print:rounded-none print:border-0">
          <table className="w-full border-collapse text-start text-sm print:text-[9pt] print:leading-snug" data-testid="hearing-calendar-table">
            <thead>
              <tr className="border-b border-line text-xs text-fg-muted print:text-[8pt] print:text-fg">
                <th scope="col" className="px-3 py-2 text-start font-medium">{tColumns('time')}</th>
                <th scope="col" className="px-3 py-2 text-start font-medium">{tColumns('courtCaseNumber')}</th>
                <th scope="col" className="px-3 py-2 text-start font-medium">{tColumns('chamber')}</th>
                <th scope="col" className="px-3 py-2 text-start font-medium">{tColumns('judge')}</th>
                <th scope="col" className="px-3 py-2 text-start font-medium">{tColumns('firmCase')}</th>
                <th scope="col" className="px-3 py-2 text-start font-medium">{tColumns('client')}</th>
                <th scope="col" className="px-3 py-2 text-start font-medium">{tColumns('leadLawyer')}</th>
              </tr>
            </thead>
            {groups.map((group) => {
              const first = group.rows[0]
              const courtName = localizedName({ name: first.court_name_en ?? '', name_ar: first.court_name_ar }, locale)
              const city = localizedName({ name: first.court_city_en ?? '', name_ar: first.court_city_ar }, locale)
              return (
                <tbody key={group.courtId} data-testid="hearing-calendar-court">
                  <tr className="break-after-avoid border-b border-line bg-line/30 print:bg-transparent">
                    <th
                      scope="colgroup"
                      colSpan={7}
                      className="px-3 py-2 text-start font-semibold text-fg print:border-t-2 print:border-fg print:pt-2"
                    >
                      <bdi>{courtName || '—'}</bdi>
                      {city && (
                        <span className="font-normal text-fg-muted">
                          {' '}
                          · <bdi>{city}</bdi>
                        </span>
                      )}
                      {first.court_type && (
                        <span className="font-normal text-fg-muted"> · {tCourtType(first.court_type)}</span>
                      )}
                    </th>
                  </tr>
                  {group.rows.map((h) => (
                    <tr
                      key={h.hearing_id}
                      className="break-inside-avoid border-b border-line align-top last:border-b-0 print:last:border-b"
                      data-testid="hearing-calendar-row"
                    >
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-fg">
                        {h.session_time ? formatTimeOfDay(h.session_time, locale) : '—'}
                        {h.outcome && (
                          <span className="block text-xs font-normal text-fg-muted">{tOutcome(h.outcome)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span dir="ltr">{h.court_case_number ?? '—'}</span>
                      </td>
                      <td className="px-3 py-2">{h.chamber ?? '—'}</td>
                      <td className="px-3 py-2">{h.judge_name ?? '—'}</td>
                      <td className="px-3 py-2">
                        {h.case_id ? (
                          <Link
                            href={`/dashboard/cases/${h.case_id}`}
                            className="font-medium text-fg underline-offset-2 hover:underline print:no-underline"
                          >
                            <span dir="ltr">{h.case_number ?? '—'}</span>
                          </Link>
                        ) : (
                          <span dir="ltr" className="font-medium">
                            {h.case_number ?? '—'}
                          </span>
                        )}
                        {h.case_title && <span className="block text-fg-muted">{h.case_title}</span>}
                      </td>
                      <td className="px-3 py-2">{h.client_name ?? '—'}</td>
                      <td className="px-3 py-2">{h.lead_lawyer_name ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              )
            })}
          </table>
        </div>
      )}
    </div>
  )
}

export const generateMetadata = () => dashboardTitle('hearings')
