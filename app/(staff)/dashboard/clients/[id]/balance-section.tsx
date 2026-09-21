import { Panel } from '@/components/dashboard/panel'
import { Badge } from '@/components/dashboard/badge'
import { formatAmount } from '../../fees/format'

type Balance = {
  agreed_fixed_fee_total: number | null
  percentage_engagement_count: number | null
  scheduled_total: number | null
  paid_total: number | null
  scheduled_outstanding: number | null
}

export function BalanceSection({ balance }: { balance: Balance | null }) {
  // No row at all means no engagements for this client - not the same
  // thing as agreed_fixed_fee_total being null, which is the normal,
  // expected state for a client whose only engagement is percentage-based.
  if (!balance) {
    return (
      <Panel className="flex flex-col gap-2">
        <h2 className="font-heading text-lg text-fg">Fees position</h2>
        <p className="text-sm text-fg-muted">No fee engagements for this client yet.</p>
      </Panel>
    )
  }

  const hasPercentageEngagements = (balance.percentage_engagement_count ?? 0) > 0

  return (
    <Panel className="flex flex-col gap-3">
      <h2 className="font-heading text-lg text-fg">Fees position</h2>
      <div className="flex flex-wrap gap-2">
        {balance.agreed_fixed_fee_total !== null && (
          <Badge variant="neutral">
            Agreed (fixed fees): <bdi>{formatAmount(balance.agreed_fixed_fee_total)}</bdi>
          </Badge>
        )}
        <Badge variant="neutral">
          Scheduled: <bdi>{formatAmount(balance.scheduled_total)}</bdi>
        </Badge>
        <Badge variant="neutral">
          Paid: <bdi>{formatAmount(balance.paid_total)}</bdi>
        </Badge>
        <Badge variant={(balance.scheduled_outstanding ?? 0) > 0 ? 'accent' : 'muted'}>
          Outstanding (scheduled): <bdi>{formatAmount(balance.scheduled_outstanding)}</bdi>
        </Badge>
      </div>
      {hasPercentageEngagements && (
        <p className="text-xs text-fg-muted">
          Also has {balance.percentage_engagement_count} percentage-fee agreement
          {balance.percentage_engagement_count === 1 ? '' : 's'} — the agreed total above covers
          fixed-fee agreements only.
        </p>
      )}
    </Panel>
  )
}
