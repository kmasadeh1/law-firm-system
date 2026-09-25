import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { Badge } from '@/components/dashboard/badge'
import { EmptyState } from '@/components/dashboard/empty-state'
import { formatAmount } from '@/lib/format-money'
import { formatDate as formatDateWithLocale } from '@/lib/format-date-time'
import { getStaffLocale } from '@/lib/get-staff-locale'

function formatPercent(value: number | null, notYetAvailable: string) {
  if (value === null) return notYetAvailable
  return `${value.toFixed(1)}%`
}

export default async function ReportsPage({ searchParams }: PageProps<'/dashboard/reports'>) {
  const { showInactive } = (await searchParams) as { showInactive?: string }
  const includeInactive = showInactive === '1'

  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.reports' })
  const formatDate = (iso: string | null) => (iso ? formatDateWithLocale(iso, locale) : '—')

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
      <PageHeader title={t('title')} description={t('description')} />

      <Panel className="flex flex-col gap-4">
        <h2 className="font-heading text-lg text-fg">{t('collection.heading')}</h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-fg-muted">{t('collection.totalScheduled')}</dt>
            <dd className="mt-1 text-xl font-medium text-fg">
              <bdi>{formatAmount(summary?.total_scheduled ?? null, locale)}</bdi>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">{t('collection.totalPaid')}</dt>
            <dd className="mt-1 text-xl font-medium text-fg">
              <bdi>{formatAmount(summary?.total_paid ?? null, locale)}</bdi>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">{t('collection.totalOutstanding')}</dt>
            <dd className="mt-1 text-xl font-medium text-fg">
              <bdi>{formatAmount(summary?.total_outstanding ?? null, locale)}</bdi>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">{t('collection.collectionRate')}</dt>
            <dd className="mt-1 text-xl font-medium text-fg">
              <bdi>{formatPercent(summary?.collection_rate_percent ?? null, t('notYetAvailable'))}</bdi>
            </dd>
          </div>
        </dl>
      </Panel>

      <Panel className="flex flex-col gap-4">
        <h2 className="font-heading text-lg text-fg">{t('overdue.heading')}</h2>
        {!overdue || overdue.length === 0 ? (
          <EmptyState title={t('overdue.noneTitle')} description={t('overdue.noneDescription')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-fg-muted">
                  <th className="py-2 pe-4 font-medium">{t('overdue.clientHeader')}</th>
                  <th className="py-2 pe-4 font-medium">{t('overdue.descriptionHeader')}</th>
                  <th className="py-2 pe-4 font-medium">{t('overdue.payerHeader')}</th>
                  <th className="py-2 pe-4 font-medium">{t('overdue.dueDateHeader')}</th>
                  <th className="py-2 pe-4 font-medium">{t('overdue.amountHeader')}</th>
                  <th className="py-2 pe-4 font-medium">{t('overdue.paidHeader')}</th>
                  <th className="py-2 pe-4 font-medium">{t('overdue.balanceDueHeader')}</th>
                  <th className="py-2 pe-4 font-medium">{t('overdue.daysOverdueHeader')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {overdue.map((row) => (
                  <tr key={row.installment_id}>
                    <td className="py-2 pe-4 text-fg">
                      {row.client_name ?? <span className="text-fg-muted italic">{t('overdue.clientNameHidden')}</span>}
                    </td>
                    <td className="py-2 pe-4 text-fg-muted">{row.description ?? '—'}</td>
                    <td className="py-2 pe-4 text-fg-muted">{row.payer_name ?? '—'}</td>
                    <td className="py-2 pe-4 text-fg-muted">
                      <bdi>{formatDate(row.due_date)}</bdi>
                    </td>
                    <td className="py-2 pe-4 text-fg">
                      <bdi>{formatAmount(row.installment_amount, locale)}</bdi>
                    </td>
                    <td className="py-2 pe-4 text-fg">
                      <bdi>{formatAmount(row.paid_amount, locale)}</bdi>
                    </td>
                    <td className="py-2 pe-4 font-medium text-fg">
                      <bdi>{formatAmount(row.balance_due, locale)}</bdi>
                    </td>
                    <td className="py-2 pe-4 text-fg">
                      <bdi>{row.days_overdue ?? '—'}</bdi>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg text-fg">{t('workload.heading')}</h2>
          <Link
            href={includeInactive ? '/dashboard/reports' : '/dashboard/reports?showInactive=1'}
            className="text-sm text-fg-muted underline-offset-2 hover:underline"
          >
            {includeInactive ? t('workload.hideDeactivated') : t('workload.showDeactivated')}
          </Link>
        </div>
        {!workload || workload.length === 0 ? (
          <EmptyState title={t('workload.noneTitle')} description={t('workload.noneDescription')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-fg-muted">
                  <th className="py-2 pe-4 font-medium">{t('workload.lawyerHeader')}</th>
                  <th className="py-2 pe-4 font-medium">{t('workload.statusHeader')}</th>
                  <th className="py-2 pe-4 font-medium">{t('workload.openCasesHeader')}</th>
                  <th className="py-2 pe-4 font-medium">{t('workload.leadCasesHeader')}</th>
                  <th className="py-2 pe-4 font-medium">{t('workload.upcomingDeadlinesHeader')}</th>
                  <th className="py-2 pe-4 font-medium">{t('workload.overdueDeadlinesHeader')}</th>
                  <th className="py-2 pe-4 font-medium">{t('workload.nextDeadlineHeader')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {workload.map((row) => (
                  <tr key={row.staff_id}>
                    <td className="py-2 pe-4 text-fg">{row.full_name ?? '—'}</td>
                    <td className="py-2 pe-4">
                      <Badge variant={row.is_active ? 'neutral' : 'muted'}>
                        {row.is_active ? t('workload.activeText') : t('workload.deactivatedText')}
                      </Badge>
                    </td>
                    <td className="py-2 pe-4 text-fg">{row.open_cases ?? 0}</td>
                    <td className="py-2 pe-4 text-fg">{row.lead_cases ?? 0}</td>
                    <td className="py-2 pe-4 text-fg">{row.upcoming_deadlines ?? 0}</td>
                    <td className="py-2 pe-4 text-fg">{row.overdue_deadlines ?? 0}</td>
                    <td className="py-2 pe-4 text-fg-muted">
                      <bdi>{formatDate(row.next_deadline)}</bdi>
                    </td>
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
