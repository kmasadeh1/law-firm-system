'use client'

import { useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { withdrawLeaveRequest } from './actions'
import { resolveLeaveRequestError } from './error-codes'
import { Panel } from '@/components/dashboard/panel'
import { Badge } from '@/components/dashboard/badge'
import { Button } from '@/components/dashboard/button'
import { EmptyState } from '@/components/dashboard/empty-state'
import { FieldError } from '@/components/dashboard/form'
import { DeleteConfirmDialog } from '@/components/dashboard/delete-confirm-dialog'
import { formatDate } from '@/lib/format-date-time'
import type { Database } from '@/lib/supabase/database.types'

type LeaveStatus = Database['public']['Enums']['leave_status']

export type MyLeaveRequest = {
  id: string
  start_date: string
  end_date: string
  status: LeaveStatus
  approved_by_name: string | null
  can_withdraw: boolean
}

const statusVariant: Record<LeaveStatus, 'accent' | 'muted' | 'neutral'> = {
  pending: 'accent',
  approved: 'neutral',
  rejected: 'muted',
}

function RequestRow({ request }: { request: MyLeaveRequest }) {
  const locale = useLocale()
  const t = useTranslations('dashboard.leaveRequests')
  const tStatus = useTranslations('dashboard.leaveRequests.status')
  const tErrors = useTranslations('dashboard.leaveRequests.errors')
  const [confirmingWithdraw, setConfirmingWithdraw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleConfirmWithdraw() {
    setError(null)
    startTransition(async () => {
      const result = await withdrawLeaveRequest(request.id)
      setConfirmingWithdraw(false)
      if (result.error) setError(resolveLeaveRequestError(result.error, tErrors))
    })
  }

  const dateRange = t('dateRange', {
    start: formatDate(request.start_date, locale),
    end: formatDate(request.end_date, locale),
  })

  // Wording only, not the gate - can_withdraw (asked of the database via
  // the can_withdraw computed column, below) is what decides whether this
  // control renders at all. Once it's true, a pending row is being
  // withdrawn and an approved one is an owner removing his own block;
  // both are the same permanent delete, just described accurately for
  // what the row actually is.
  const removeLabel = request.status === 'pending' ? t('withdraw') : t('removeBlock')
  const removingLabel = request.status === 'pending' ? t('withdrawing') : t('removingBlock')

  return (
    <li className="flex flex-col gap-1.5 px-5 py-3 text-sm" data-testid="my-leave-request-row">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <bdi>{dateRange}</bdi>
          <Badge variant={statusVariant[request.status]}>{tStatus(request.status)}</Badge>
        </span>

        {request.can_withdraw && (
          <Button
            type="button"
            variant="danger"
            onClick={() => setConfirmingWithdraw(true)}
            disabled={isPending}
            data-testid="withdraw-leave-request"
          >
            {isPending ? removingLabel : removeLabel}
          </Button>
        )}
      </div>
      {request.status !== 'pending' && request.approved_by_name && (
        <p className="text-xs text-fg-muted">
          {t.rich('decidedByLine', {
            name: request.approved_by_name,
            bdi: (chunks) => <bdi>{chunks}</bdi>,
          })}
        </p>
      )}
      {error && <FieldError>{error}</FieldError>}

      <DeleteConfirmDialog
        open={confirmingWithdraw}
        onCancel={() => setConfirmingWithdraw(false)}
        onConfirm={handleConfirmWithdraw}
        kind="hard"
        itemLabel={dateRange}
        confirmLabel={removeLabel}
        pendingLabel={removingLabel}
        pending={isPending}
      />
    </li>
  )
}

export function MyRequestsList({ requests }: { requests: MyLeaveRequest[] }) {
  const t = useTranslations('dashboard.leaveRequests')

  if (requests.length === 0) {
    return <EmptyState title={t('noneYet')} description={t('noneYetDescription')} />
  }

  return (
    <Panel className="p-0" data-testid="my-leave-requests-section">
      <ul className="flex flex-col divide-y divide-line">
        {requests.map((request) => (
          <RequestRow key={request.id} request={request} />
        ))}
      </ul>
    </Panel>
  )
}
