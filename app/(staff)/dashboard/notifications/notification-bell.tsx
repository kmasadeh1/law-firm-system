'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { BellIcon, CloseIcon } from '@/components/dashboard/icons'
import { formatAmount } from '@/lib/format-money'
import { formatDate, formatDateTime } from '@/lib/format-date-time'
import { localizedName } from '@/lib/localized-name'
import { dismissAlert, markNotificationsRead, refreshBell } from './actions'
import type { BellAlert, BellData, BellNotification } from './data'

// The bell merges two sources that behave differently, and keeps them in
// two sections so the difference stays visible:
//   Needs attention - derived alerts (pending_alerts). Computed on every
//     read; leaving one means dismissing it (alert_dismissals). "Mark all
//     read" never touches these.
//   Notifications - stored events (notifications). Opening one, or "Mark
//     all read", marks it read (mark_notifications_read).
//
// Every figure (the badge count, days_away) and every name comes from the
// server; this renders them. Sentences are built here from message files,
// never stored. A disclosure like the account drawer: aria-expanded on
// the trigger, plain links and buttons inside, Escape / outside click /
// focus leaving closes it.
export function NotificationBell({ initial }: { initial: BellData }) {
  const t = useTranslations('dashboard.notifications')
  const pathname = usePathname()
  const [data, setData] = useState(initial)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(false)
  const [isPending, startTransition] = useTransition()
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  // The dashboard layout (which supplies `initial`) doesn't re-render on
  // client-side navigation, so the bell refreshes itself on each one - a
  // new page is the natural moment for "anything new?".
  useEffect(() => {
    let cancelled = false
    refreshBell().then((fresh) => {
      if (!cancelled) setData(fresh)
    })
    return () => {
      cancelled = true
    }
  }, [pathname])

  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    function handleFocusOut(e: FocusEvent) {
      const next = e.relatedTarget as Node | null
      if (!next || (containerRef.current && !containerRef.current.contains(next))) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    const container = containerRef.current
    container?.addEventListener('focusout', handleFocusOut)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      container?.removeEventListener('focusout', handleFocusOut)
    }
  }, [open])

  function apply(action: () => Promise<{ data: BellData; error?: string }>) {
    setError(false)
    startTransition(async () => {
      const result = await action()
      setData(result.data)
      if (result.error) setError(true)
    })
  }

  // Opening a stored notification marks it read; navigation goes ahead
  // either way. The bell stays mounted (it lives in the layout), so the
  // result still lands.
  function openNotification(n: BellNotification) {
    setOpen(false)
    if (!n.read) apply(() => markNotificationsRead([n.id]))
  }

  const isEmpty = data.alerts.length === 0 && data.notifications.length === 0

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        data-testid="notification-bell"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={data.badgeCount > 0 ? t('openWithCount', { count: data.badgeCount }) : t('open')}
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-fg transition-colors hover:bg-line/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <BellIcon className="h-5 w-5" />
        {data.badgeCount > 0 && (
          <span
            aria-hidden="true"
            data-testid="notification-bell-count"
            className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-text px-1 text-[10px] font-semibold leading-none text-surface"
          >
            {data.badgeCount > 99 ? t('countOverflow') : data.badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          data-testid="notification-panel"
          className="absolute end-0 top-full z-50 mt-2 flex max-h-[70vh] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-md border border-line bg-surface shadow-lg"
        >
          {isEmpty ? (
            <div className="px-4 py-6 text-center" data-testid="notification-empty">
              <p className="text-sm font-medium text-fg">{t('emptyTitle')}</p>
              <p className="mt-1 text-xs text-fg-muted">{t('emptyDescription')}</p>
            </div>
          ) : (
            <div className="overflow-y-auto">
              {data.alerts.length > 0 && (
                <section data-testid="notification-alerts">
                  <h2 className="px-3 pb-1 pt-3 text-xs font-semibold text-fg-muted">{t('alertsHeading')}</h2>
                  <ul className="flex flex-col">
                    {data.alerts.map((a) => (
                      <AlertItem
                        key={`${a.kind}:${a.subjectId}`}
                        alert={a}
                        disabled={isPending}
                        onNavigate={() => setOpen(false)}
                        onDismiss={() => apply(() => dismissAlert(a.kind, a.subjectId))}
                      />
                    ))}
                  </ul>
                </section>
              )}

              {data.notifications.length > 0 && (
                <section data-testid="notification-list" className={data.alerts.length > 0 ? 'border-t border-line' : ''}>
                  <div className="flex items-center justify-between gap-2 px-3 pb-1 pt-3">
                    <h2 className="text-xs font-semibold text-fg-muted">{t('notificationsHeading')}</h2>
                    {data.unreadCount > 0 && (
                      <button
                        type="button"
                        data-testid="notification-mark-all-read"
                        disabled={isPending}
                        onClick={() => apply(() => markNotificationsRead(null))}
                        className="text-xs font-medium text-fg underline-offset-2 hover:underline disabled:opacity-50"
                      >
                        {t('markAllRead')}
                      </button>
                    )}
                  </div>
                  <ul className="flex flex-col">
                    {data.notifications.map((n) => (
                      <NotificationItem key={n.id} notification={n} onOpen={() => openNotification(n)} />
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}

          {error && (
            <p className="border-t border-line px-3 py-2 text-xs text-danger-text" data-testid="notification-error">
              {t('updateFailed')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// A deadline alert opens the deadline itself on its case page (the row
// carries id="deadline-<id>"), where it can be marked met - a fact for
// everyone, unlike Dismiss here, which only hides the alert for this
// reader. A hearing alert opens the case.
function alertHref(alert: BellAlert, caseId: string) {
  return alert.kind === 'deadline_approaching'
    ? `/dashboard/cases/${caseId}#deadline-${alert.subjectId}`
    : `/dashboard/cases/${caseId}`
}

// Urgency from the view's days_away - a reading of a number already
// computed, not date arithmetic. The view returns overdue deadlines however
// old, so all four states occur.
function urgencyOf(daysAway: number | null): 'overdue' | 'today' | 'week' | 'later' {
  if (daysAway === null) return 'later'
  if (daysAway < 0) return 'overdue'
  if (daysAway === 0) return 'today'
  if (daysAway <= 7) return 'week'
  return 'later'
}

// Overdue and today read as urgent (danger colour, heavy), this week as
// prominent, later as quiet - in the start-edge bar and the "when" line.
// Weight and bar, not colour alone, so it survives greyscale.
const URGENCY_BAR = {
  overdue: 'border-danger-text',
  today: 'border-danger-text',
  week: 'border-fg',
  later: 'border-line',
} as const

const URGENCY_TEXT = {
  overdue: 'text-danger-text font-semibold',
  today: 'text-danger-text font-semibold',
  week: 'text-fg font-medium',
  later: 'text-fg-muted',
} as const

function AlertItem({
  alert,
  disabled,
  onNavigate,
  onDismiss,
}: {
  alert: BellAlert
  disabled: boolean
  onNavigate: () => void
  onDismiss: () => void
}) {
  const t = useTranslations('dashboard.notifications')
  const locale = useLocale()
  const urgency = urgencyOf(alert.daysAway)
  const caseNumber = alert.caseNumber ?? t('unknownCase')
  const detail = alert.detailEn || alert.detailAr ? localizedName({ name: alert.detailEn ?? alert.detailAr ?? '', name_ar: alert.detailAr }, locale) : null
  const bdi = (chunks: React.ReactNode) => <bdi>{chunks}</bdi>

  const sentence =
    alert.kind === 'deadline_approaching'
      ? detail
        ? t.rich('alert.deadlineWithType', { type: detail, caseNumber, bdi })
        : t.rich('alert.deadline', { caseNumber, bdi })
      : detail
        ? t.rich('alert.hearingWithCourt', { court: detail, caseNumber, bdi })
        : t.rich('alert.hearing', { caseNumber, bdi })

  const days = alert.daysAway ?? 0
  const when =
    urgency === 'overdue'
      ? t('when.overdue', { days: -days })
      : urgency === 'today'
        ? t('when.today')
        : days === 1
          ? t('when.tomorrow')
          : t('when.inDays', { days })

  const body = (
    <>
      <span className="block text-sm text-fg">{sentence}</span>
      <span className={`mt-0.5 block text-xs ${URGENCY_TEXT[urgency]}`}>
        {when}
        {alert.dueOn && (
          <span className="font-normal text-fg-muted">
            {' · '}
            <bdi>{formatDate(alert.dueOn, locale)}</bdi>
          </span>
        )}
      </span>
    </>
  )

  return (
    <li
      className={`flex items-start gap-2 border-s-4 px-3 py-2 ${URGENCY_BAR[urgency]}`}
      data-testid="notification-alert"
      data-kind={alert.kind}
      data-urgency={urgency}
    >
      {alert.caseId ? (
        <Link href={alertHref(alert, alert.caseId)} onClick={onNavigate} className="min-w-0 flex-1 hover:underline">
          {body}
        </Link>
      ) : (
        <div className="min-w-0 flex-1">{body}</div>
      )}
      <button
        type="button"
        data-testid="notification-alert-dismiss"
        disabled={disabled}
        onClick={onDismiss}
        aria-label={t('dismiss')}
        title={t('dismiss')}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-fg-muted hover:bg-line/40 hover:text-fg disabled:opacity-50"
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </button>
    </li>
  )
}

function NotificationItem({ notification: n, onOpen }: { notification: BellNotification; onOpen: () => void }) {
  const t = useTranslations('dashboard.notifications')
  const locale = useLocale()
  const bdi = (chunks: React.ReactNode) => <bdi>{chunks}</bdi>
  const actor = n.actorName ?? t('someone')

  // A subject the reader can no longer see still happened - say so, with
  // no link and no name.
  const sentence = !n.subject
    ? t.rich(`type.${n.type}.unavailable`, { actor, bdi })
    : n.type === 'payment_recorded'
      ? n.subject.label
        ? t.rich('type.payment_recorded.withClient', {
            actor,
            amount: formatAmount(n.subject.amount ?? null, locale),
            client: n.subject.label,
            bdi,
          })
        : t.rich('type.payment_recorded.default', { actor, amount: formatAmount(n.subject.amount ?? null, locale), bdi })
      : t.rich(`type.${n.type}.default`, { actor, subject: n.subject.label ?? '', bdi })

  const body = (
    <>
      <span className={`block text-sm ${n.read ? 'text-fg-muted' : 'font-medium text-fg'}`}>{sentence}</span>
      <span className="mt-0.5 block text-xs text-fg-muted">
        <bdi>{formatDateTime(n.createdAt, locale)}</bdi>
      </span>
    </>
  )

  return (
    <li className="flex items-start gap-2 px-3 py-2" data-testid="notification-item" data-read={n.read}>
      <span
        aria-hidden="true"
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-danger-text'}`}
      />
      {n.subject ? (
        <Link href={n.subject.href} onClick={onOpen} className="min-w-0 flex-1 hover:underline">
          {body}
        </Link>
      ) : (
        <div className="min-w-0 flex-1">{body}</div>
      )}
      {!n.read && <span className="sr-only">{t('unread')}</span>}
    </li>
  )
}
