import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { Badge } from '@/components/dashboard/badge'
import { EmptyState } from '@/components/dashboard/empty-state'
import { formatAmount } from '@/app/(staff)/dashboard/fees/format'

function formatPercent(value: number | null) {
  if (value === null) return 'Not yet available'
  return `${value.toFixed(1)}%`
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

export default async function ReportsPage({ searchParams }: PageProps<'/dashboard/reports'>) {
  const { showInactive } = (await searchParams) as { showInactive?: string }
  const includeInactive = showInactive === '1'

  const supabase = await createClient()

  let workloadQuery = supabase.from('lawyer_workload').select('*').order('full_name')
  if (!includeInactive) {
    workloadQuery = workloadQuery.eq('is_active', true)
  }

  const [{ data: summary }, { data: overdue }, { data: workload }] = await Promise.all([
    supabase.from('collection_summary').select('*').maybeSingle(),
    supabase.from('overdue_installments').select('*').order('days_overdue', { ascending: false }),
    workloadQuery,
  ])

  return (
    <div className="flex flex-col gap-8">
      <div>
        <BackLink href="/dashboard/owner" label="Firm overview" />
        <PageHeader title="Reports" description="Firm-wide collection, overdue instalments, and lawyer workload." />
      </div>

      <Panel className="flex flex-col gap-4">
        <h2 className="font-heading text-lg text-fg">Collection summary</h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-fg-muted">Total scheduled</dt>
            <dd className="mt-1 text-xl font-medium text-fg">{formatAmount(summary?.total_scheduled ?? null)}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">Total paid</dt>
            <dd className="mt-1 text-xl font-medium text-fg">{formatAmount(summary?.total_paid ?? null)}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">Total outstanding</dt>
            <dd className="mt-1 text-xl font-medium text-fg">{formatAmount(summary?.total_outstanding ?? null)}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">Collection rate</dt>
            <dd className="mt-1 text-xl font-medium text-fg">{formatPercent(summary?.collection_rate_percent ?? null)}</dd>
          </div>
        </dl>
      </Panel>

      <Panel className="flex flex-col gap-4">
        <h2 className="font-heading text-lg text-fg">Overdue instalments</h2>
        {!overdue || overdue.length === 0 ? (
          <EmptyState title="No overdue instalments" description="Every scheduled instalment is either not yet due or fully paid." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-fg-muted">
                  <th className="py-2 pe-4 font-medium">Client</th>
                  <th className="py-2 pe-4 font-medium">Description</th>
                  <th className="py-2 pe-4 font-medium">Payer</th>
                  <th className="py-2 pe-4 font-medium">Due date</th>
                  <th className="py-2 pe-4 font-medium">Amount</th>
                  <th className="py-2 pe-4 font-medium">Paid</th>
                  <th className="py-2 pe-4 font-medium">Balance due</th>
                  <th className="py-2 pe-4 font-medium">Days overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {overdue.map((row) => (
                  <tr key={row.installment_id}>
                    <td className="py-2 pe-4 text-fg">
                      {row.client_name ?? <span className="text-fg-muted italic">Client name not visible</span>}
                    </td>
                    <td className="py-2 pe-4 text-fg-muted">{row.description ?? '—'}</td>
                    <td className="py-2 pe-4 text-fg-muted">{row.payer_name ?? '—'}</td>
                    <td className="py-2 pe-4 text-fg-muted">{formatDate(row.due_date)}</td>
                    <td className="py-2 pe-4 text-fg">{formatAmount(row.installment_amount)}</td>
                    <td className="py-2 pe-4 text-fg">{formatAmount(row.paid_amount)}</td>
                    <td className="py-2 pe-4 font-medium text-fg">{formatAmount(row.balance_due)}</td>
                    <td className="py-2 pe-4 text-fg">{row.days_overdue ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg text-fg">Lawyer workload</h2>
          <Link
            href={includeInactive ? '/dashboard/reports' : '/dashboard/reports?showInactive=1'}
            className="text-sm text-accent-fg underline-offset-2 hover:underline"
          >
            {includeInactive ? 'Hide deactivated staff' : 'Show deactivated staff'}
          </Link>
        </div>
        {!workload || workload.length === 0 ? (
          <EmptyState title="No staff to show" description="No lawyers match the current filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-fg-muted">
                  <th className="py-2 pe-4 font-medium">Lawyer</th>
                  <th className="py-2 pe-4 font-medium">Status</th>
                  <th className="py-2 pe-4 font-medium">Open cases</th>
                  <th className="py-2 pe-4 font-medium">Lead cases</th>
                  <th className="py-2 pe-4 font-medium">Upcoming deadlines</th>
                  <th className="py-2 pe-4 font-medium">Overdue deadlines</th>
                  <th className="py-2 pe-4 font-medium">Next deadline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {workload.map((row) => (
                  <tr key={row.staff_id}>
                    <td className="py-2 pe-4 text-fg">{row.full_name ?? '—'}</td>
                    <td className="py-2 pe-4">
                      <Badge variant={row.is_active ? 'neutral' : 'muted'}>{row.is_active ? 'Active' : 'Deactivated'}</Badge>
                    </td>
                    <td className="py-2 pe-4 text-fg">{row.open_cases ?? 0}</td>
                    <td className="py-2 pe-4 text-fg">{row.lead_cases ?? 0}</td>
                    <td className="py-2 pe-4 text-fg">{row.upcoming_deadlines ?? 0}</td>
                    <td className="py-2 pe-4 text-fg">{row.overdue_deadlines ?? 0}</td>
                    <td className="py-2 pe-4 text-fg-muted">{formatDate(row.next_deadline)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
