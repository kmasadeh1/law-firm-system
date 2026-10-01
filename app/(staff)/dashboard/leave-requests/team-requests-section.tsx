'use client'

import { useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { approveLeaveRequest, rejectLeaveRequest } from './actions'
import { resolveLeaveRequestError, type LeaveRequestErrorCode } from './error-codes'
import { Panel } from '@/components/dashboard/panel'
import { Badge } from '@/components/dashboard/badge'
import { Button } from '@/components/dashboard/button'
import { FieldError } from '@/components/dashboard/form'
import { formatDate } from '@/lib/format-date-time'
import type { Database } from '@/lib/supabase/database.types'

type LeaveStatus = Database['public']['Enums']['leave_status']

export type TeamLeaveRequest = {
  id: string
  start_date: string
  end_date: string
  status: LeaveStatus
  approved_by_name: string | null
  requester_name: string
}

const statusVariant: Record<LeaveStatus, 'accent' | 'muted' | 'neutral'> = {
  pending: 'accent',
  approved: 'neutral',
  rejected: 'muted',
}

function PendingRow({ request }: { request: TeamLeaveRequest }) {
  const locale = useLocale()
  const t = useTranslations('dashboard.leaveRequests')
  const tErrors = useTranslations('dashboard.leaveRequests.errors')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDecision(decide: (id: string) => Promise<{ error?: LeaveRequestErrorCode }>) {
    setError(null)
    startTransition(async () => {
      const result = await decide(request.id)
      if (result.error) setError(resolveLeaveRequestError(result.error, tErrors))
    })
  }

  return (
    <li className="flex flex-col gap-1.5 px-5 py-3 text-sm" data-testid="pending-leave-request-row">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <bdi className="font-medium text-fg">{request.requester_name}</bdi>{' '}
          <span className="text-fg-muted">
            —{' '}
            <bdi>
              {t('dateRange', {
                start: formatDate(request.start_date, locale),
                end: formatDate(request.end_date, locale),
              })}
            </bdi>
          </span>
        </span>
        <span className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleDecision(approveLeaveRequest)}
            disabled={isPending}
            data-testid="approve-leave-request"
          >
            {t('approve')}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => handleDecision(rejectLeaveRequest)}
            disabled={isPending}
            data-testid="reject-leave-request"
          >
            {t('reject')}
          </Button>
        </span>
      </div>
      {error && <FieldError>{error}</FieldError>}
    </li>
  )
}

function AnsweredRow({ request }: { request: TeamLeaveRequest }) {
  const locale = useLocale()
  const t = useTranslations('dashboard.leaveRequests')
  const tStatus = useTranslations('dashboard.leaveRequests.status')

  return (
    <li className="flex flex-col gap-1 px-5 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <bdi className="font-medium text-fg">{request.requester_name}</bdi>{' '}
          <span className="text-fg-muted">
            —{' '}
            <bdi>
              {t('dateRange', {
                start: formatDate(request.start_date, locale),
                end: formatDate(request.end_date, locale),
              })}
            </bdi>
          </span>
        </span>
        <Badge variant={statusVariant[request.status]}>{tStatus(request.status)}</Badge>
      </div>
      {request.approved_by_name && (
        <p className="text-xs text-fg-muted">
          {t.rich('decidedByLine', {
            name: request.approved_by_name,
            bdi: (chunks) => <bdi>{chunks}</bdi>,
          })}
        </p>
      )}
    </li>
  )
}

export function TeamRequestsSection({
  pendingRequests,
  answeredRequests,
}: {
  pendingRequests: TeamLeaveRequest[]
  answeredRequests: TeamLeaveRequest[]
}) {
  const t = useTranslations('dashboard.leaveRequests')

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg text-fg">{t('pendingHeading')}</h2>
        {pendingRequests.length === 0 ? (
          <p className="text-sm text-fg-muted">{t('noPendingRequests')}</p>
        ) : (
          <Panel className="p-0" data-testid="pending-leave-requests-section">
            <ul className="flex flex-col divide-y divide-line">
              {pendingRequests.map((request) => (
                <PendingRow key={request.id} request={request} />
              ))}
            </ul>
          </Panel>
        )}
      </section>

      {answeredRequests.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg text-fg">{t('answeredHeading')}</h2>
          <Panel className="p-0" data-testid="answered-leave-requests-section">
            <ul className="flex flex-col divide-y divide-line">
              {answeredRequests.map((request) => (
                <AnsweredRow key={request.id} request={request} />
              ))}
            </ul>
          </Panel>
        </section>
      )}
    </div>
  )
}
