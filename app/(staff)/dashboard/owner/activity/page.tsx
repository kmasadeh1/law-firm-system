import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { EmptyState } from '@/components/dashboard/empty-state'
import { Button } from '@/components/dashboard/button'
import { controlClass } from '@/components/dashboard/form'
import { ChevronLeftIcon } from '@/components/dashboard/icons'
import { ENTITY_NAMES } from '@/lib/activity-labels'
import { formatFullDate } from '@/lib/format-date-time'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { ActivityRow, type ActivityLogRow } from './activity-row'

const PAGE_SIZE = 50

function humanizeEntity(entity: string) {
  const spaced = entity.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

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

  // Unfiltered, unlike active-staff pickers elsewhere - someone who's left
  // the firm should still be filterable by name in a firm-wide audit log,
  // arguably more so than anywhere else this convention already applies.
  const { data: staffDirectory } = await supabase.from('staff_directory').select('id, full_name')
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
  if (from) query = query.gte('created_at', `${from}T00:00:00`)
  if (to) query = query.lte('created_at', `${to}T23:59:59`)

  // One extra row tells us whether an Older page exists, without a separate
  // COUNT(*) over a table that only ever grows.
  const { data: rows } = await query.range(offset, offset + PAGE_SIZE)

  const hasNext = (rows ?? []).length > PAGE_SIZE
  const pageRows = (rows ?? []).slice(0, PAGE_SIZE) as ActivityLogRow[]
  const groups = groupByDay(pageRows, locale)

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
      <div>
        <BackLink href="/dashboard/owner" label="Firm overview" />
        <PageHeader title="Activity log" description="Every recorded change across the firm, newest first." />
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="activity-entity" className="text-sm text-fg-muted">
            Entity
          </label>
          <select id="activity-entity" name="entity" defaultValue={entity ?? ''} className={controlClass}>
            <option value="">All entities</option>
            {ENTITY_NAMES.map((e) => (
              <option key={e} value={e}>
                {humanizeEntity(e)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="activity-actor" className="text-sm text-fg-muted">
            Actor
          </label>
          <select id="activity-actor" name="actor" defaultValue={actor ?? ''} className={controlClass}>
            <option value="">Everyone</option>
            <option value="system">System</option>
            {staffOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="activity-from" className="text-sm text-fg-muted">
            From
          </label>
          <input id="activity-from" type="date" name="from" defaultValue={from ?? ''} className={controlClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="activity-to" className="text-sm text-fg-muted">
            To
          </label>
          <input id="activity-to" type="date" name="to" defaultValue={to ?? ''} className={controlClass} />
        </div>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        {hasFilters && (
          <Link
            href="/dashboard/owner/activity"
            className="flex items-center text-sm text-fg-muted underline-offset-2 hover:underline"
          >
            Clear
          </Link>
        )}
      </form>

      {pageRows.length === 0 ? (
        <EmptyState title={hasFilters ? 'No activity matches those filters.' : 'No activity recorded yet'} />
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
                      actorName={row.actor_id ? (nameById.get(row.actor_id) ?? 'Unknown staff') : 'System'}
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
                Newer
              </Link>
            ) : (
              <span />
            )}
            <span className="text-xs text-fg-muted">Page {page}</span>
            {hasNext ? (
              <Link
                href={pageHref(page + 1)}
                className="flex items-center gap-1 text-sm text-fg-muted underline-offset-2 hover:text-fg hover:underline"
              >
                Older
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
