import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { EmptyState } from '@/components/dashboard/empty-state'
import { Button } from '@/components/dashboard/button'
import { controlClass } from '@/components/dashboard/form'
import { ChevronLeftIcon } from '@/components/dashboard/icons'
import { activityEntityLabel } from '@/lib/activity-labels'
import { firmDayBounds, formatFullDate } from '@/lib/format-date-time'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { ActivityRow, type ActivityLogRow } from './activity-row'

const PAGE_SIZE = 50

function groupByDay(rows: ActivityLogRow[], locale: string) {
  const groups: { day: string; rows: ActivityLogRow[] }[] = []
  for (const row of rows) {
    const key = formatFullDate(row.created_at, locale)
    const last = groups[groups.length - 1]
    if (last && last.day === key) {
      last.rows.push(row)
    } else {
      groups.push({ day: key, rows: [row] })
    }
  }
  return groups
}

export default async function ActivityLogPage({ searchParams }: PageProps<'/dashboard/owner/activity'>) {
  const {
    entity,
    actor,
    from,
    to,
    page: pageParam,
  } = (await searchParams) as { entity?: string; actor?: string; from?: string; to?: string; page?: string }

  const page = Math.max(1, Number(pageParam) || 1)
  const offset = (page - 1) * PAGE_SIZE

  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.activity.list' })
  const tActivity = await getTranslations({ locale, namespace: 'dashboard.activity' })

  // Unfiltered, unlike active-staff pickers elsewhere - someone who's left
  // the firm should still be filterable by name in a firm-wide audit log,
  // arguably more so than anywhere else this convention already applies.
  //
  // logged_tables() is the database's own list of every table with a
  // trigger writing to activity_log, read from pg_trigger - so a newly
  // logged table appears in the entity filter at once (under its raw name
  // until it is labelled) and an unlogged one never does. Asked once per
  // page load.
  const [{ data: staffDirectory }, { data: loggedTables }] = await Promise.all([
    supabase.from('staff_directory').select('id, full_name'),
    supabase.rpc('logged_tables'),
  ])
  const staffOptions = (staffDirectory ?? [])
    .filter((s): s is { id: string; full_name: string } => s.id !== null && s.full_name !== null)
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
  const nameById = new Map(staffOptions.map((s) => [s.id, s.full_name]))

  let query = supabase
    .from('activity_log')
    .select('id, action, table_name, actor_id, created_at, old_data, new_data')
    .order('id', { ascending: false })

  if (entity) query = query.eq('table_name', entity)
  if (actor === 'system') query = query.is('actor_id', null)
  else if (actor) query = query.eq('actor_id', actor)
  // The filter's dates are Amman days. created_at is a timestamptz, so
  // each day is turned into its exact Amman bounds: on or after the start
  // of `from`, and strictly before the start of the day after `to` - lt,
  // not lte 23:59:59, which would lose the final second. A date that isn't
  // a valid YYYY-MM-DD gives no bounds and is ignored.
  const fromBounds = from ? firmDayBounds(from) : null
  const toBounds = to ? firmDayBounds(to) : null
  if (fromBounds) query = query.gte('created_at', fromBounds.start)
  if (toBounds) query = query.lt('created_at', toBounds.end)

  // One extra row tells us whether an Older page exists, without a separate
  // COUNT(*) over a table that only ever grows.
  const { data: rows } = await query.range(offset, offset + PAGE_SIZE)

  const hasNext = (rows ?? []).length > PAGE_SIZE
  const pageRows = (rows ?? []).slice(0, PAGE_SIZE) as ActivityLogRow[]
  const groups = groupByDay(pageRows, locale)

  // Listed in the reader's language order. A table with no label shows its
  // raw name (see activityEntityLabel) - an obvious gap, not a silent one.
  const entityOptions = (loggedTables ?? [])
    .map((e) => ({ value: e, label: activityEntityLabel(tActivity, e) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale))

  const filterParams = new URLSearchParams()
  if (entity) filterParams.set('entity', entity)
  if (actor) filterParams.set('actor', actor)
  if (from) filterParams.set('from', from)
  if (to) filterParams.set('to', to)
  const hasFilters = Boolean(entity || actor || from || to)

  function pageHref(target: number) {
    const params = new URLSearchParams(filterParams)
    if (target > 1) params.set('page', String(target))
    const qs = params.toString()
    return `/dashboard/owner/activity${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} description={t('description')} />

      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="activity-entity" className="text-sm text-fg-muted">
            {t('entityLabel')}
          </label>
          <select
            id="activity-entity"
            name="entity"
            defaultValue={entity ?? ''}
            className={controlClass}
            data-testid="activity-entity-filter"
          >
            <option value="">{t('allEntities')}</option>
            {entityOptions.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="activity-actor" className="text-sm text-fg-muted">
            {t('actorLabel')}
          </label>
          <select id="activity-actor" name="actor" defaultValue={actor ?? ''} className={controlClass}>
            <option value="">{t('everyone')}</option>
            <option value="system">{t('system')}</option>
            {staffOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="activity-from" className="text-sm text-fg-muted">
            {t('fromLabel')}
          </label>
          <input id="activity-from" type="date" name="from" defaultValue={from ?? ''} className={controlClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="activity-to" className="text-sm text-fg-muted">
            {t('toLabel')}
          </label>
          <input id="activity-to" type="date" name="to" defaultValue={to ?? ''} className={controlClass} />
        </div>
        <Button type="submit" variant="secondary">
          {t('filter')}
        </Button>
        {hasFilters && (
          <Link
            href="/dashboard/owner/activity"
            className="flex items-center text-sm text-fg-muted underline-offset-2 hover:underline"
          >
            {t('clear')}
          </Link>
        )}
      </form>

      {pageRows.length === 0 ? (
        <EmptyState title={hasFilters ? t('noneMatchFilters') : t('noneYet')} />
      ) : (
        <Panel className="flex flex-col gap-3">
          <div className="flex flex-col divide-y divide-line">
            {groups.map((group) => (
              <div key={group.day} className="py-2 first:pt-0">
                <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">
                  <bdi>{group.day}</bdi>
                </p>
                <ul className="flex flex-col divide-y divide-line/60">
                  {group.rows.map((row) => (
                    <ActivityRow
                      key={row.id}
                      row={row}
                      actorName={row.actor_id ? (nameById.get(row.actor_id) ?? t('unknownStaff')) : t('system')}
                      locale={locale}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-line pt-3">
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                className="flex items-center gap-1 text-sm text-fg-muted underline-offset-2 hover:text-fg hover:underline"
              >
                <ChevronLeftIcon className="h-3.5 w-3.5 rtl:rotate-180" />
                {t('newer')}
              </Link>
            ) : (
              <span />
            )}
            <span className="text-xs text-fg-muted">{t('page', { page })}</span>
            {hasNext ? (
              <Link
                href={pageHref(page + 1)}
                className="flex items-center gap-1 text-sm text-fg-muted underline-offset-2 hover:text-fg hover:underline"
              >
                {t('older')}
                {/* Points the opposite way from the "back" chevron above -
                    forward/next, so it's rotated 180deg by default (right
                    under ltr) and unrotated under rtl (left), rather than
                    reusing rtl:rotate-180 on top of no base rotation. */}
                <ChevronLeftIcon className="h-3.5 w-3.5 rotate-180 rtl:rotate-0" />
              </Link>
            ) : (
              <span />
            )}
          </div>
        </Panel>
      )}
    </div>
  )
}
