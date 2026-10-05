'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { markReminderSent, type ReminderErrorCode } from './actions'
import { Panel } from '@/components/dashboard/panel'
import { Badge } from '@/components/dashboard/badge'
import { Button } from '@/components/dashboard/button'
import { FieldError } from '@/components/dashboard/form'
import type { Database } from '@/lib/supabase/database.types'

type ReminderKind = Database['public']['Enums']['reminder_kind']

// Everything here is prepared by the page: labels, formatted dates and
// amounts, and the wa.me link with its message. This only renders it.
export type ReminderRow = {
  key: string
  kind: ReminderKind
  subjectId: string
  clientId: string
  clientName: string
  phone: string | null
  about: React.ReactNode
  date: string | null
  time: string | null
  amount: string | null
  lastReminded: string | null
  recent: boolean
  whatsappHref: string | null
}

const ERROR_CODES: ReminderErrorCode[] = ['noPermission', 'recordFailed']

export function ReminderGroup({ title, kind, rows }: { title: string; kind: ReminderKind; rows: ReminderRow[] }) {
  return (
    <Panel className="flex flex-col gap-3" data-testid="reminder-group" data-kind={kind}>
      <h2 className="font-heading text-lg text-fg">{title}</h2>
      <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
        {rows.map((row) => (
          <ReminderItem key={row.key} row={row} />
        ))}
      </ul>
    </Panel>
  )
}

// One reminder, worked one at a time. Opening WhatsApp records nothing -
// the person may not send it. "Mark as sent" is their explicit statement
// that they did.
function ReminderItem({ row }: { row: ReminderRow }) {
  const t = useTranslations('dashboard.reminders')
  const tErrors = useTranslations('dashboard.reminders.errors')
  const [opened, setOpened] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleMarkSent() {
    if (!row.phone) return
    setError(null)
    startTransition(async () => {
      const result = await markReminderSent(row.kind, row.subjectId, row.clientId, row.phone!)
      if (result.error) {
        setError(tErrors(ERROR_CODES.includes(result.error) ? result.error : 'recordFailed'))
      }
    })
  }

  return (
    <li
      // Reminded in the last 24 hours: dampened and placed below the rest
      // (by the page's queries), never hidden.
      className={`flex flex-col gap-2 px-3 py-3 text-sm ${row.recent ? 'bg-line/20 opacity-70' : ''}`}
      data-testid="reminder-row"
      data-recent={row.recent}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link href={`/dashboard/clients/${row.clientId}`} className="font-medium text-fg hover:underline">
            {row.clientName}
          </Link>
          <span className="text-fg">{row.about}</span>
          <span className="text-xs text-fg-muted">
            {row.date && <bdi>{row.date}</bdi>}
            {row.time && (
              <>
                {' · '}
                <bdi>{row.time}</bdi>
              </>
            )}
            {row.amount && (
              <>
                {' · '}
                <bdi className="font-medium text-fg">{row.amount}</bdi>
              </>
            )}
          </span>
          {row.phone && (
            <span className="text-xs text-fg-muted" dir="ltr">
              {row.phone}
            </span>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 text-xs">
          {row.recent && <Badge variant="muted">{t('recentlyReminded')}</Badge>}
          <span className="text-fg-muted" data-testid="reminder-last">
            {row.lastReminded ? t.rich('lastReminded', { date: row.lastReminded, bdi: (c) => <bdi>{c}</bdi> }) : t('neverReminded')}
          </span>
        </div>
      </div>

      {row.whatsappHref ? (
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={row.whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpened(true)}
            data-testid="reminder-whatsapp"
            className="inline-flex items-center rounded-md border border-line px-3 py-1.5 text-sm font-medium text-fg transition-colors hover:bg-line/40"
          >
            {t('openWhatsApp')}
          </a>
          <Button
            type="button"
            variant={opened ? 'primary' : 'secondary'}
            onClick={handleMarkSent}
            disabled={isPending}
            data-testid="reminder-mark-sent"
          >
            {isPending ? t('recording') : t('markSent')}
          </Button>
          <span className="text-xs text-fg-muted">{t('markSentHelp')}</span>
        </div>
      ) : (
        // Missing data, not missing permission: the row stays, the action
        // is disabled, and the reason is said plainly.
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" disabled data-testid="reminder-whatsapp-disabled">
            {t('openWhatsApp')}
          </Button>
          <span className="text-xs text-fg-muted" data-testid="reminder-no-phone">
            {t('noPhone')}
          </span>
        </div>
      )}

      {error && <FieldError>{error}</FieldError>}
    </li>
  )
}
