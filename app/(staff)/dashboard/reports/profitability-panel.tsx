import { getTranslations } from 'next-intl/server'
import { Panel } from '@/components/dashboard/panel'
import { EmptyState } from '@/components/dashboard/empty-state'
import { formatAmount } from '@/lib/format-money'
import { localizedName } from '@/lib/localized-name'
import type { Database } from '@/lib/supabase/database.types'

// expenses_reimbursed and is_mixed aren't selected: the panel shows total and
// unreimbursed expenses, and tells rows apart by row_kind.
export type ProfitabilityRow = Omit<
  Database['public']['Views']['case_type_profitability']['Row'],
  'expenses_reimbursed' | 'is_mixed'
>

// Renders case_type_profitability exactly as the queries return it: every
// figure, including net_received, comes from the view, and the type rows'
// order is the query's. Nothing here adds, subtracts or re-sorts, and there
// is no total row - the two extra rows are never summed into anything.
//
// Besides one row per case type, the view can return two rows that belong
// to no type, each at most once and each only when it has something in it:
//   untyped_cases       - cases with no type set: real case counts and
//                         expenses, but no fee money, since fees are
//                         attributed by type. Fee cells show a dash.
//   unattributable_fees - fee money that can't honestly be given to one
//                         type: fee figures only. Case-count and expense
//                         cells show a dash; those cases are already counted
//                         under their own type (or the untyped row) above.
// A dash there means "not applicable"; a type row's 0 is real information
// (no agreements for that type) and stays a 0.
export async function ProfitabilityPanel({
  typeRows,
  otherRows,
  locale,
}: {
  typeRows: ProfitabilityRow[]
  otherRows: ProfitabilityRow[]
  locale: string
}) {
  const t = await getTranslations({ locale, namespace: 'dashboard.reports.profitability' })
  const money = (value: number | null) => <bdi>{formatAmount(value, locale)}</bdi>
  const bdi = (chunks: React.ReactNode) => <bdi>{chunks}</bdi>
  const notApplicable = <span className="text-fg-muted">—</span>

  // Placement only, in a fixed order after the types - not a sort.
  const untyped = otherRows.find((row) => row.row_kind === 'untyped_cases')
  const unattributable = otherRows.find((row) => row.row_kind === 'unattributable_fees')

  const caseCounts = (row: ProfitabilityRow) => (
    <>
      {row.case_count ?? 0}
      <span className="block text-xs text-fg-muted">
        {t('openClosed', { open: row.open_cases ?? 0, closed: row.closed_cases ?? 0 })}
      </span>
    </>
  )
  const expenses = (row: ProfitabilityRow) => (
    <>
      {money(row.expenses_total)}
      <span className="block text-xs text-fg-muted">
        {t.rich('unreimbursed', { amount: formatAmount(row.expenses_unreimbursed, locale), bdi })}
      </span>
    </>
  )
  const label = (title: string, explanation: string) => (
    <>
      <span className="font-medium text-fg">{title}</span>
      <span className="mt-0.5 block max-w-xs text-xs text-fg-muted">{explanation}</span>
    </>
  )

  const isEmpty = typeRows.length === 0 && !untyped && !unattributable
  const extraRowClass = 'border-t-2 border-dashed border-line bg-line/30 align-top'

  return (
    <Panel className="flex flex-col gap-4" data-testid="report-profitability">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg text-fg">{t('heading')}</h2>
        <p className="text-sm text-fg-muted">{t('description')}</p>
      </div>

      {isEmpty ? (
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
              {typeRows.map((row) => (
                <tr key={row.case_type_id} className="align-top" data-testid="profitability-row">
                  <td className="py-2 pe-4 text-fg">
                    {localizedName({ name: row.name_en ?? row.name_ar ?? '', name_ar: row.name_ar }, locale)}
                  </td>
                  <td className="py-2 pe-4 text-fg">{caseCounts(row)}</td>
                  <td className="py-2 pe-4 text-fg">{money(row.scheduled_total)}</td>
                  <td className="py-2 pe-4 text-fg">{money(row.paid_total)}</td>
                  <td className="py-2 pe-4 text-fg">{money(row.written_off_total)}</td>
                  <td className="py-2 pe-4 text-fg">{money(row.outstanding_total)}</td>
                  <td className="py-2 pe-4 text-fg">{expenses(row)}</td>
                  <td className="py-2 pe-4 font-medium text-fg">{money(row.net_received)}</td>
                </tr>
              ))}

              {untyped && (
                <tr className={extraRowClass} data-testid="profitability-untyped-row">
                  <td className="py-2 pe-4">{label(t('untypedLabel'), t('untypedExplanation'))}</td>
                  <td className="py-2 pe-4 text-fg">{caseCounts(untyped)}</td>
                  <td className="py-2 pe-4">{notApplicable}</td>
                  <td className="py-2 pe-4">{notApplicable}</td>
                  <td className="py-2 pe-4">{notApplicable}</td>
                  <td className="py-2 pe-4">{notApplicable}</td>
                  <td className="py-2 pe-4 text-fg">{expenses(untyped)}</td>
                  <td className="py-2 pe-4 font-medium text-fg">{money(untyped.net_received)}</td>
                </tr>
              )}

              {unattributable && (
                <tr className={extraRowClass} data-testid="profitability-mixed-row">
                  <td className="py-2 pe-4">{label(t('mixedLabel'), t('mixedExplanation'))}</td>
                  <td className="py-2 pe-4">{notApplicable}</td>
                  <td className="py-2 pe-4 text-fg">{money(unattributable.scheduled_total)}</td>
                  <td className="py-2 pe-4 text-fg">{money(unattributable.paid_total)}</td>
                  <td className="py-2 pe-4 text-fg">{money(unattributable.written_off_total)}</td>
                  <td className="py-2 pe-4 text-fg">{money(unattributable.outstanding_total)}</td>
                  <td className="py-2 pe-4">{notApplicable}</td>
                  <td className="py-2 pe-4 font-medium text-fg">{money(unattributable.net_received)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!isEmpty && <p className="text-xs text-fg-muted">{t('netReceivedNote')}</p>}
    </Panel>
  )
}
