import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { EmptyState } from '@/components/dashboard/empty-state'
import { LinkButton, Button } from '@/components/dashboard/button'
import { controlClass } from '@/components/dashboard/form'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { localizedName } from '@/lib/localized-name'

export default async function CasesListPage({ searchParams }: PageProps<'/dashboard/cases'>) {
  const { q, status } = (await searchParams) as { q?: string; status?: string }
  const supabase = await createClient()
  const locale = await getStaffLocale()

  const { data: statuses } = await supabase
    .from('case_statuses')
    .select('id, name, name_ar, sort_order')
    .order('sort_order')

  // No access gate here - this just renders whatever RLS returns for the
  // signed-in user (owner, cases_manage, or their own case assignments),
  // including a legitimately empty list.
  let query = supabase
    .from('cases')
    .select('id, case_number, title, case_type, clients(full_name), case_statuses(name, name_ar)')
    .order('created_at', { ascending: false })

  const term = q?.trim()
  if (term) {
    const safe = term.replace(/[,()]/g, '')
    if (safe) {
      query = query.or(`case_number.ilike.%${safe}%,title.ilike.%${safe}%`)
    }
  }
  if (status) {
    query = query.eq('status_id', status)
  }

  const { data: cases } = await query

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Cases"
        action={
          <LinkButton href="/dashboard/cases/new" variant="primary">
            New case
          </LinkButton>
        }
      />

      <form method="get" className="flex flex-wrap gap-2">
        <input
          type="text"
          name="q"
          defaultValue={term ?? ''}
          placeholder="Search by case number or title"
          className={`w-full max-w-sm ${controlClass}`}
        />
        <select name="status" defaultValue={status ?? ''} className={controlClass}>
          <option value="">All statuses</option>
          {(statuses ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {localizedName(s, locale)}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        {(term || status) && (
          <Link
            href="/dashboard/cases"
            className="flex items-center text-sm text-fg-muted underline-offset-2 hover:underline"
          >
            Clear
          </Link>
        )}
      </form>

      {!cases || cases.length === 0 ? (
        <EmptyState
          title={term || status ? 'No cases match those filters.' : 'No cases yet'}
          description={term || status ? undefined : 'Open your first case to start tracking it.'}
          action={
            !term && !status && (
              <LinkButton href="/dashboard/cases/new" variant="secondary">
                New case
              </LinkButton>
            )
          }
        />
      ) : (
        <Panel className="p-0">
          <ul className="flex flex-col divide-y divide-line">
            {cases.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/dashboard/cases/${c.id}`}
                  className="flex flex-wrap items-center justify-between gap-1 px-5 py-3 text-sm transition-colors hover:bg-line/30"
                >
                  <span>
                    <span className="font-medium text-fg">{c.case_number}</span>
                    <span className="text-fg-muted"> — {c.title}</span>
                  </span>
                  <span className="text-fg-muted">
                    {c.clients?.full_name ?? '—'} ·{' '}
                    {c.case_statuses ? localizedName(c.case_statuses, locale) : '—'}
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
