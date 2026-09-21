import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { EmptyState } from '@/components/dashboard/empty-state'
import { Badge } from '@/components/dashboard/badge'

type ConflictMatch = {
  source: string
  matched_id: string
  matched_name: string
  case_id: string | null
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export default async function ConflictCheckHistoryPage() {
  const supabase = await createClient()

  const [{ data: checks }, { data: staffDirectory }] = await Promise.all([
    supabase
      .from('conflict_checks')
      .select('id, searched_name, searched_national_id, match_count, results, ran_by, ran_at')
      .order('ran_at', { ascending: false }),
    // Not filtered to is_active - a check run by staff who has since left
    // should still show a name, not "Unknown staff".
    supabase.from('staff_directory').select('id, full_name'),
  ])

  // staff_directory is a view, so its columns come back nullable in the
  // generated types even though the underlying staff.id/full_name are not -
  // filter defensively rather than loosen the types everywhere else.
  const nameById = new Map(
    (staffDirectory ?? [])
      .filter((s): s is { id: string; full_name: string } => s.id !== null && s.full_name !== null)
      .map((s) => [s.id, s.full_name])
  )

  const caseIds = new Set<string>()
  for (const check of checks ?? []) {
    const results = (check.results as ConflictMatch[] | null) ?? []
    for (const match of results) {
      if (match.case_id) caseIds.add(match.case_id)
    }
  }

  const { data: caseRows } =
    caseIds.size > 0
      ? await supabase.from('cases').select('id, case_number, title').in('id', Array.from(caseIds))
      : { data: [] as { id: string; case_number: string; title: string }[] }

  const caseById = new Map((caseRows ?? []).map((c) => [c.id, c]))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href="/dashboard/clients" label="Clients" />
        <PageHeader
          title="Conflict-check history"
          description="Every conflict check run at intake, most recent first."
        />
      </div>

      {!checks || checks.length === 0 ? (
        <EmptyState
          title="No conflict checks yet"
          description="Checks run automatically when a client or opposing party is created."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {checks.map((check) => {
            const results = (check.results as ConflictMatch[] | null) ?? []
            return (
              <Panel key={check.id} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-fg">
                      {check.searched_name}
                      {check.searched_national_id && (
                        <span className="text-fg-muted">
                          {' '}
                          · <bdi>{check.searched_national_id}</bdi>
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-fg-muted">
                      <bdi>{formatDateTime(check.ran_at)}</bdi> ·{' '}
                      {(check.ran_by && nameById.get(check.ran_by)) ?? 'Unknown staff'}
                    </p>
                  </div>
                  <Badge variant={check.match_count > 0 ? 'accent' : 'muted'}>
                    {check.match_count > 0
                      ? `${check.match_count} match${check.match_count === 1 ? '' : 'es'}`
                      : 'No conflicts found'}
                  </Badge>
                </div>

                {results.length > 0 && (
                  <ul className="mt-1 flex flex-col gap-1 border-t border-line pt-2 text-sm">
                    {results.map((match, i) => (
                      <li key={i} className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-fg">
                          {match.matched_name}{' '}
                          <span className="text-fg-muted">
                            ({match.source === 'client' ? 'existing client' : 'opposing party'})
                          </span>
                        </span>
                        {match.case_id && caseById.get(match.case_id) && (
                          <Link
                            href={`/dashboard/cases/${match.case_id}`}
                            className="text-fg-muted underline-offset-2 hover:underline"
                          >
                            <bdi>{caseById.get(match.case_id)!.case_number}</bdi>
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )
          })}
        </div>
      )}
    </div>
  )
}
