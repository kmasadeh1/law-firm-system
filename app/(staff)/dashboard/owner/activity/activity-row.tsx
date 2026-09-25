'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { activityEventTitle, type ActivityAction } from '@/lib/activity-labels'
import { formatTime } from '@/lib/format-date-time'
import { ChevronLeftIcon } from '@/components/dashboard/icons'
import { diffFields, formatFieldValue } from './diff'

export type ActivityLogRow = {
  id: number
  action: ActivityAction
  table_name: string
  actor_id: string | null
  created_at: string
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
}

export function ActivityRow({
  row,
  actorName,
  locale,
}: {
  row: ActivityLogRow
  actorName: string
  locale: string
}) {
  const [expanded, setExpanded] = useState(false)
  const t = useTranslations('dashboard.activity.list')
  const tActivity = useTranslations('dashboard.activity')
  const diffs = diffFields(row.action, row.old_data, row.new_data)
  const hasDetail = diffs.length > 0
  const yesNo = { yes: t('yes'), no: t('no') }

  return (
    <li className="py-2.5 text-sm">
      <button
        type="button"
        onClick={() => hasDetail && setExpanded((e) => !e)}
        disabled={!hasDetail}
        className="flex w-full items-start gap-3 text-start disabled:cursor-default"
      >
        <span className="w-14 shrink-0 pt-0.5 text-xs text-fg-muted">
          <bdi>{formatTime(row.created_at, locale)}</bdi>
        </span>
        <span className="min-w-0 flex-1 text-fg">
          {activityEventTitle(tActivity, row.table_name, row.action, row.new_data ?? row.old_data)}
          <span className="text-fg-muted"> · {actorName}</span>
        </span>
        {hasDetail && (
          <span className="shrink-0 text-xs text-fg-muted underline-offset-2 hover:underline">
            {expanded ? t('hide') : t('details')}
          </span>
        )}
      </button>

      {expanded && hasDetail && (
        <ul className="ms-[4.25rem] mt-1.5 flex flex-col gap-1 rounded-md border border-line bg-canvas px-3 py-2 text-xs">
          {diffs.map((d) => (
            <li key={d.field} className="text-fg-muted">
              <span className="font-medium text-fg">{d.field.replace(/_/g, ' ')}</span>:{' '}
              {row.action === 'update' ? (
                <span className="inline-flex items-center gap-1">
                  <bdi>{formatFieldValue(d.before, locale, yesNo)}</bdi>
                  {/* Forward/progression, same direction as the "Older"
                      pagination chevron - rotated by default (points right
                      under ltr) and unrotated under rtl (points left). */}
                  <ChevronLeftIcon className="h-3 w-3 rotate-180 rtl:rotate-0" />
                  <bdi>{formatFieldValue(d.after, locale, yesNo)}</bdi>
                </span>
              ) : (
                formatFieldValue(d.after ?? d.before, locale, yesNo)
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
