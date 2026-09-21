'use client'

import { Fragment, useState, type ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Panel } from '@/components/dashboard/panel'
import { EmptyState } from '@/components/dashboard/empty-state'
import { formatAmount, formatFeeType } from '../../fees/format'
import { activityEventTitle, type ActivityAction } from '@/lib/activity-labels'
import { formatTime, formatFullDate, formatDate } from '@/lib/format-date-time'

export type TimelineRow = {
  id: number
  occurred_at: string
  action: ActivityAction
  entity: string
  actor_name: string | null
  detail: Record<string, unknown> | null
  detail_redacted: boolean
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text
}

function formatDueDate(value: unknown, locale: string) {
  if (typeof value !== 'string') return null
  return formatDate(value, locale)
}

// The couple of fields that actually matter per entity, not the raw jsonb -
// resolved from the row snapshot the RPC already redacts server-side. This
// only ever runs on rows the caller is allowed to see the detail of. Money
// and date values are individually <bdi>-wrapped rather than baked into a
// joined string, so each stays LTR inside an RTL line.
//
// Each branch resolves to its own complete message, never a fragment glued
// to the next - "a payment was recorded" and "a deadline was added" are
// different sentences in Arabic, not the same template with a swapped noun,
// so there is deliberately no generic "{entity} detail" message here.
function eventDetail(
  entity: string,
  detail: Record<string, unknown>,
  staffNameById: Record<string, string>,
  locale: string,
  t: ReturnType<typeof useTranslations>
): ReactNode {
  const bdi = (chunks: ReactNode) => <bdi>{chunks}</bdi>
  switch (entity) {
    case 'case_lawyers': {
      const staffId = typeof detail.staff_id === 'string' ? detail.staff_id : null
      const name = staffId ? (staffNameById[staffId] ?? t('unknownStaffMember')) : null
      if (!name) return null
      return detail.is_lead ? t('caseLawyerLead', { name }) : name
    }
    case 'case_notes':
      return typeof detail.note === 'string' ? truncate(detail.note, 120) : null
    case 'documents':
      return typeof detail.filename === 'string' ? detail.filename : null
    case 'payments': {
      const amount = typeof detail.amount === 'number' ? formatAmount(detail.amount) : null
      const method = typeof detail.method === 'string' ? detail.method : null
      if (!amount) return null
      return method ? t.rich('paymentWithMethod', { amount, method, bdi }) : <bdi>{amount}</bdi>
    }
    case 'expenses': {
      const amount = typeof detail.amount === 'number' ? formatAmount(detail.amount) : null
      const description = typeof detail.description === 'string' ? detail.description : null
      if (description && amount) {
        return t.rich('expenseWithAmount', { description, amount, bdi })
      }
      return description ?? (amount ? <bdi>{amount}</bdi> : null)
    }
    case 'engagement_installments': {
      const amount = typeof detail.amount === 'number' ? formatAmount(detail.amount) : null
      const description = typeof detail.description === 'string' ? detail.description : null
      const due = formatDueDate(detail.due_date, locale)
      const parts: ReactNode[] = []
      if (description) parts.push(description)
      if (amount) parts.push(<bdi key="amount">{amount}</bdi>)
      if (due) {
        parts.push(<Fragment key="due">{t.rich('dueDate', { date: due, bdi })}</Fragment>)
      }
      if (parts.length === 0) return null
      return parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && ' — '}
          {part}
        </Fragment>
      ))
    }
    case 'engagements': {
      const feeType = detail.fee_type
      if (feeType !== 'fixed' && feeType !== 'percentage') return null
      return (
        <bdi>
          {formatFeeType(
            feeType,
            typeof detail.fixed_amount === 'number' ? detail.fixed_amount : null,
            typeof detail.percentage === 'number' ? detail.percentage : null
          )}
        </bdi>
      )
    }
    case 'case_opposing_parties':
      return typeof detail.name === 'string' ? detail.name : null
    case 'deadlines': {
      const description = typeof detail.description === 'string' ? detail.description : null
      const due = formatDueDate(detail.effective_due_date ?? detail.due_date, locale)
      if (description && due) {
        return t.rich('descriptionDueDate', { description, date: due, bdi })
      }
      return description ?? (due ? t.rich('dueDate', { date: due, bdi }) : null)
    }
    case 'cases':
      return typeof detail.closed_at === 'string' && detail.closed_at ? t('caseMarkedClosed') : null
    default:
      return null
  }
}

function groupByDay(rows: TimelineRow[], locale: string) {
  const groups: { day: string; rows: TimelineRow[] }[] = []
  for (const row of rows) {
    const key = formatFullDate(row.occurred_at, locale)
    const last = groups[groups.length - 1]
    if (last && last.day === key) {
      last.rows.push(row)
    } else {
      groups.push({ day: key, rows: [row] })
    }
  }
  return groups
}

function TimelineEntry({
  row,
  staffNameById,
  locale,
}: {
  row: TimelineRow
  staffNameById: Record<string, string>
  locale: string
}) {
  const t = useTranslations('dashboard.cases.detail.timeline')
  const detail =
    row.detail && !row.detail_redacted ? eventDetail(row.entity, row.detail, staffNameById, locale, t) : null

  return (
    <li className="flex gap-3 py-2.5 text-sm">
      <span className="w-14 shrink-0 pt-0.5 text-xs text-fg-muted">
        <bdi>{formatTime(row.occurred_at, locale)}</bdi>
      </span>
      <div className="min-w-0">
        <p className="text-fg">
          {activityEventTitle(row.entity, row.action, row.detail)}
          <span className="text-fg-muted"> · {row.actor_name ?? t('systemFallback')}</span>
        </p>
        {row.detail_redacted ? (
          <p className="mt-0.5 text-xs italic text-fg-muted">{t('detailsHidden')}</p>
        ) : (
          detail && <p className="mt-0.5 truncate text-xs text-fg-muted">{detail}</p>
        )}
      </div>
    </li>
  )
}

const INITIAL_COUNT = 20

export function TimelineSection({
  rows,
  staffNameById,
}: {
  rows: TimelineRow[]
  staffNameById: Record<string, string>
}) {
  const [expanded, setExpanded] = useState(false)
  const locale = useLocale()
  const t = useTranslations('dashboard.cases.detail.timeline')

  if (rows.length === 0) {
    return (
      <Panel className="flex flex-col gap-3" data-testid="case-timeline-section">
        <h2 className="font-heading text-lg text-fg">{t('heading')}</h2>
        <EmptyState title={t('noHistoryTitle')} description={t('noHistoryDescription')} />
      </Panel>
    )
  }

  const visibleRows = expanded ? rows : rows.slice(0, INITIAL_COUNT)
  const groups = groupByDay(visibleRows, locale)
  const hiddenCount = rows.length - visibleRows.length

  return (
    <Panel className="flex flex-col gap-3" data-testid="case-timeline-section">
      <h2 className="font-heading text-lg text-fg">{t('heading')}</h2>

      <div className="flex flex-col divide-y divide-line">
        {groups.map((group) => (
          <div key={group.day} className="py-2 first:pt-0">
            <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">
              <bdi>{group.day}</bdi>
            </p>
            <ul className="flex flex-col divide-y divide-line/60">
              {group.rows.map((row) => (
                <TimelineEntry key={row.id} row={row} staffNameById={staffNameById} locale={locale} />
              ))}
            </ul>
          </div>
        ))}
      </div>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="self-start text-sm text-fg-muted underline-offset-2 hover:text-fg hover:underline"
        >
          {t('showMore', { count: hiddenCount })}
        </button>
      )}
    </Panel>
  )
}
