import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { EmptyState } from '@/components/dashboard/empty-state'
import { LinkButton } from '@/components/dashboard/button'
import { Badge } from '@/components/dashboard/badge'
import { formatAmount, formatFeeType } from './format'

export default async function FeesListPage() {
  const supabase = await createClient()

  const { data: engagements } = await supabase
    .from('engagements')
    .select('id, fee_type, fixed_amount, percentage, clients(full_name)')
    .order('created_at', { ascending: false })

  const { data: balances } = await supabase
    .from('engagement_balances')
    .select('engagement_id, scheduled_outstanding')

  const outstandingById = new Map((balances ?? []).map((b) => [b.engagement_id, b.scheduled_outstanding]))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Fees & payments"
        action={
          <LinkButton href="/dashboard/fees/new" variant="primary">
            New engagement
          </LinkButton>
        }
      />

      {!engagements || engagements.length === 0 ? (
        <EmptyState
          title="No fee engagements yet"
          description="Record a fee agreement to start tracking instalments and payments."
          action={
            <LinkButton href="/dashboard/fees/new" variant="secondary">
              New engagement
            </LinkButton>
          }
        />
      ) : (
        <Panel className="p-0">
          <ul className="flex flex-col divide-y divide-line">
            {engagements.map((e) => {
              const outstanding = outstandingById.get(e.id) ?? null
              return (
                <li key={e.id}>
                  <Link
                    href={`/dashboard/fees/${e.id}`}
                    className="flex flex-wrap items-center justify-between gap-1 px-5 py-3 text-sm transition-colors hover:bg-line/30"
                  >
                    <span>
                      <span className="font-medium text-fg">{e.clients?.full_name ?? '—'}</span>
                      <span className="text-fg-muted">
                        {' '}
                        — {e.fee_type === 'fixed' ? 'Fixed' : 'Percentage'}:{' '}
                        <bdi>{formatFeeType(e.fee_type, e.fixed_amount, e.percentage)}</bdi>
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {outstanding !== null && outstanding > 0 ? (
                        <Badge variant="accent">
                          Outstanding (scheduled): <bdi>{formatAmount(outstanding)}</bdi>
                        </Badge>
                      ) : (
                        <Badge variant="muted">Settled</Badge>
                      )}
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
