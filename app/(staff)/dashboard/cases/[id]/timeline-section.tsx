'use client'

import { useState } from 'react'
import { Panel } from '@/components/dashboard/panel'
import { EmptyState } from '@/components/dashboard/empty-state'
import { formatAmount, formatFeeType } from '../../fees/format'

export type TimelineRow = {
  id: number
  occurred_at: string
  action: 'insert' | 'update' | 'delete'
  entity: string
  actor_name: string | null
  detail: Record<string, unknown> | null
  detail_redacted: boolean
}

const ENTITY_LABELS: Record<string, { insert: string; update: string; delete: string }> = {
  cases: { insert: 'Case opened', update: 'Case updated', delete: 'Case deleted' },
  case_lawyers: {
    insert: 'Lawyer assigned',
    update: 'Lawyer assignment updated',
    delete: 'Lawyer removed from case',
  },
  deadlines: { insert: 'Deadline added', update: 'Deadline updated', delete: 'Deadline removed' },
  case_notes: { insert: 'Note added', update: 'Note edited', delete: 'Note deleted' },
  documents: { insert: 'Document uploaded', update: 'Document updated', delete: 'Document removed' },
  engagements: { insert: 'Engagement created', update: 'Engagement updated', delete: 'Engagement deleted' },
  engagement_installments: {
    insert: 'Instalment scheduled',
    update: 'Instalment updated',
    delete: 'Instalment removed',
  },
  engagement_cases: {
    insert: 'Linked to a fee engagement',
    update: 'Engagement link updated',
    delete: 'Unlinked from a fee engagement',
  },
  payments: { insert: 'Payment recorded', update: 'Payment updated', delete: 'Payment removed' },
  expenses: { insert: 'Expense recorded', update: 'Expense updated', delete: 'Expense removed' },
  case_opposing_parties: {
    insert: 'Opposing party added',
    update: 'Opposing party updated',
    delete: 'Opposing party removed',
  },
}

function humanizeEntity(entity: string) {
  return entity.replace(/_/g, ' ')
}

// case_notes and documents have no hard DELETE - "deleted" is a soft flag
// set via UPDATE, so it shows up here as action 'update' like any other
// edit. Detect it from the row snapshot rather than mislabeling a removal
// as a plain edit, which would hide it from the one place meant to surface
// it.
function eventTitle(entity: string, action: TimelineRow['action'], detail: Record<string, unknown> | null) {
  if (
    (entity === 'case_notes' || entity === 'documents') &&
    action === 'update' &&
    detail &&
    typeof detail.deleted_at === 'string' &&
    detail.deleted_at
  ) {
    return entity === 'case_notes' ? 'Note deleted' : 'Document removed'
  }
  return ENTITY_LABELS[entity]?.[action] ?? `${humanizeEntity(entity)} ${action}d`
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text
}

function formatDueDate(value: unknown) {
  if (typeof value !== 'string') return null
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

// The couple of fields that actually matter per entity, not the raw jsonb -
// resolved from the row snapshot the RPC already redacts server-side. This
// only ever runs on rows the caller is allowed to see the detail of.
function eventDetail(
  entity: string,
  detail: Record<string, unknown>,
  staffNameById: Record<string, string>
): string | null {
  switch (entity) {
    case 'case_lawyers': {
      const staffId = typeof detail.staff_id === 'string' ? detail.staff_id : null
      const name = staffId ? (staffNameById[staffId] ?? 'a staff member') : null
      if (!name) return null
      return detail.is_lead ? `${name} — lead lawyer` : name
    }
    case 'case_notes':
      return typeof detail.note === 'string' ? truncate(detail.note, 120) : null
    case 'documents':
      return typeof detail.filename === 'string' ? detail.filename : null
    case 'payments': {
      const amount = typeof detail.amount === 'number' ? formatAmount(detail.amount) : null
      const method = typeof detail.method === 'string' ? detail.method : null
      if (!amount) return null
      return method ? `${amount} via ${method}` : amount
    }
    case 'expenses': {
      const amount = typeof detail.amount === 'number' ? formatAmount(detail.amount) : null
      const description = typeof detail.description === 'string' ? detail.description : null
      if (description && amount) return `${description} — ${amount}`
      return description ?? amount
    }
    case 'engagement_installments': {
      const amount = typeof detail.amount === 'number' ? formatAmount(detail.amount) : null
      const description = typeof detail.description === 'string' ? detail.description : null
      const due = formatDueDate(detail.due_date)
      const parts = [description, amount, due ? `due ${due}` : null].filter(Boolean)
      return parts.length > 0 ? parts.join(' — ') : null
    }
    case 'engagements': {
      const feeType = detail.fee_type
      if (feeType !== 'fixed' && feeType !== 'percentage') return null
      return formatFeeType(
        feeType,
        typeof detail.fixed_amount === 'number' ? detail.fixed_amount : null,
        typeof detail.percentage === 'number' ? detail.percentage : null
      )
    }
    case 'case_opposing_parties':
      return typeof detail.name === 'string' ? detail.name : null
    case 'deadlines': {
      const description = typeof detail.description === 'string' ? detail.description : null
      const due = formatDueDate(detail.effective_due_date ?? detail.due_date)
      if (description && due) return `${description} — due ${due}`
      return description ?? (due ? `Due ${due}` : null)
    }
    case 'cases':
      return typeof detail.closed_at === 'string' && detail.closed_at ? 'Case marked closed' : null
    default:
      return null
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { timeStyle: 'short' })
}

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'full' })
}

function groupByDay(rows: TimelineRow[]) {
  const groups: { day: string; rows: TimelineRow[] }[] = []
  for (const row of rows) {
    const key = dayKey(row.occurred_at)
    const last = groups[groups.length - 1]
    if (last && last.day === key) {
      last.rows.push(row)
    } else {
      groups.push({ day: key, rows: [row] })
    }
  }
  return groups
}

function TimelineEntry({ row, staffNameById }: { row: TimelineRow; staffNameById: Record<string, string> }) {
  const detail =
    row.detail && !row.detail_redacted ? eventDetail(row.entity, row.detail, staffNameById) : null

  return (
    <li className="flex gap-3 py-2.5 text-sm">
      <span className="w-14 shrink-0 pt-0.5 text-xs text-fg-muted">{formatTime(row.occurred_at)}</span>
      <div className="min-w-0">
        <p className="text-fg">
          {eventTitle(row.entity, row.action, row.detail)}
          <span className="text-fg-muted"> · {row.actor_name ?? 'System'}</span>
        </p>
        {row.detail_redacted ? (
          <p className="mt-0.5 text-xs italic text-fg-muted">Details hidden — you don&apos;t have permission to view this</p>
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

  if (rows.length === 0) {
    return (
      <Panel className="flex flex-col gap-3">
        <h2 className="font-heading text-lg text-fg">Timeline</h2>
        <EmptyState
          title="No history yet"
          description="Activity on this case will show up here as it happens."
        />
      </Panel>
    )
  }

  const visibleRows = expanded ? rows : rows.slice(0, INITIAL_COUNT)
  const groups = groupByDay(visibleRows)
  const hiddenCount = rows.length - visibleRows.length

  return (
    <Panel className="flex flex-col gap-3">
      <h2 className="font-heading text-lg text-fg">Timeline</h2>

      <div className="flex flex-col divide-y divide-line">
        {groups.map((group) => (
          <div key={group.day} className="py-2 first:pt-0">
            <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">{group.day}</p>
            <ul className="flex flex-col divide-y divide-line/60">
              {group.rows.map((row) => (
                <TimelineEntry key={row.id} row={row} staffNameById={staffNameById} />
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
          Show {hiddenCount} more
        </button>
      )}
    </Panel>
  )
}
