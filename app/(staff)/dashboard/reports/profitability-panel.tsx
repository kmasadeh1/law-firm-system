import { getTranslations } from 'next-intl/server'
import { Panel } from '@/components/dashboard/panel'
import { EmptyState } from '@/components/dashboard/empty-state'
import { formatAmount } from '@/lib/format-money'
import { localizedName } from '@/lib/localized-name'
import type { Database } from '@/lib/supabase/database.types'

// expenses_reimbursed isn't selected: the panel shows total and unreimbursed.
export type ProfitabilityRow = Omit<Database['public']['Views']['case_type_profitability']['Row'], 'expenses_reimbursed'>

// Renders case_type_profitability exactly as the query returns it: every
// figure, including net_received, comes from the view, and the order
// (mixed row last) is the query's. Nothing here adds, subtracts or re-sorts.
//
// The mixed row is the view's honest answer to an engagement covering cases
// of more than one type - its money can't be split between types, so it
// carries fee figures and nothing else. Its case counts and expenses are
// shown as a dash (not applicable) rather than the view's 0, which would
// read as "no cases". A type row's 0 is real information and stays a 0.
export async function ProfitabilityPanel({ rows, locale }: { rows: ProfitabilityRow[]; locale: string }) {
  const t = await getTranslations({ locale, namespace: 'dashboard.reports.profitability' })
  const money = (value: number | null) => <bdi>{formatAmount(value, locale)}</bdi>
  const bdi = (chunks: React.ReactNode) => <bdi>{chunks}</bdi>

  return (
    <Panel className="flex flex-col gap-4" data-testid="report-profitability">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg text-fg">{t('heading')}</h2>
        <p className="text-sm text-fg-muted">{t('description')}</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={t('noneTitle')} description={t('noneDescription')} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm" data-testid="profitability-table">
            <thead>
              <tr className="border-b border-line text-xs text-fg-muted">
                <th className="py-2 pe-4 font-medium">{t('caseTypeHeader')}</th>
                <th className="py-2 pe-4 font-medium">{t('casesHeader')}</th>
                <th className="py-2 pe-4 font-medium">{t('scheduledHeader')}</th>
                <th className="py-2 pe-4 font-medium">{t('paidHeader')}</th>
                <th className="py-2 pe-4 font-medium">{t('writtenOffHeader')}</th>
                <th className="py-2 pe-4 font-medium">{t('outstandingHeader')}</th>
                <th className="py-2 pe-4 font-medium">{t('expensesHeader')}</th>
                <th className="py-2 pe-4 font-medium">{t('netReceivedHeader')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) =>
                row.is_mixed ? (
                  <tr
                    key="mixed"
                    className="border-t-2 border-dashed border-line bg-line/30 align-top"
                    data-testid="profitability-mixed-row"
                  >
                    <td className="py-2 pe-4">
                      <span className="font-medium text-fg">{t('mixedLabel')}</span>
                      <span className="mt-0.5 block max-w-xs text-xs text-fg-muted">{t('mixedExplanation')}</span>
                    </td>
                    <td className="py-2 pe-4 text-fg-muted">—</td>
                    <td className="py-2 pe-4 text-fg">{money(row.scheduled_total)}</td>
                    <td className="py-2 pe-4 text-fg">{money(row.paid_total)}</td>
                    <td className="py-2 pe-4 text-fg">{money(row.written_off_total)}</td>
                    <td className="py-2 pe-4 text-fg">{money(row.outstanding_total)}</td>
                    <td className="py-2 pe-4 text-fg-muted">—</td>
                    <td className="py-2 pe-4 font-medium text-fg">{money(row.net_received)}</td>
                  </tr>
                ) : (
                  <tr key={row.case_type_id} className="align-top" data-testid="profitability-row">
                    <td className="py-2 pe-4 text-fg">
                      {localizedName({ name: row.name_en ?? row.name_ar ?? '', name_ar: row.name_ar }, locale)}
                    </td>
                    <td className="py-2 pe-4 text-fg">
                      {row.case_count ?? 0}
                      <span className="block text-xs text-fg-muted">
                        {t('openClosed', { open: row.open_cases ?? 0, closed: row.closed_cases ?? 0 })}
                      </span>
                    </td>
                    <td className="py-2 pe-4 text-fg">{money(row.scheduled_total)}</td>
                    <td className="py-2 pe-4 text-fg">{money(row.paid_total)}</td>
                    <td className="py-2 pe-4 text-fg">{money(row.written_off_total)}</td>
                    <td className="py-2 pe-4 text-fg">{money(row.outstanding_total)}</td>
                    <td className="py-2 pe-4 text-fg">
                      {money(row.expenses_total)}
                      <span className="block text-xs text-fg-muted">
                        {t.rich('unreimbursed', { amount: formatAmount(row.expenses_unreimbursed, locale), bdi })}
                      </span>
                    </td>
                    <td className="py-2 pe-4 font-medium text-fg">{money(row.net_received)}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && <p className="text-xs text-fg-muted">{t('netReceivedNote')}</p>}
    </Panel>
  )
}
