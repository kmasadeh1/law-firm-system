import { Panel } from '@/components/dashboard/panel'
import { Badge } from '@/components/dashboard/badge'
import { formatAmount } from '../../fees/format'

type Balance = { total_agreed: number | null; total_paid: number | null; total_outstanding: number | null }

export function BalanceSection({ balance }: { balance: Balance | null }) {
  if (!balance || balance.total_agreed === null) {
    return (
      <Panel className="flex flex-col gap-2">
        <h2 className="font-heading text-lg text-fg">Fees position</h2>
        <p className="text-sm text-fg-muted">No fee engagements for this client yet.</p>
      </Panel>
    )
  }

  return (
    <Panel className="flex flex-col gap-3">
      <h2 className="font-heading text-lg text-fg">Fees position</h2>
      <div className="flex flex-wrap gap-2">
        <Badge variant="neutral">Agreed: {formatAmount(balance.total_agreed)}</Badge>
        <Badge variant="neutral">Paid: {formatAmount(balance.total_paid)}</Badge>
        <Badge variant={(balance.total_outstanding ?? 0) > 0 ? 'accent' : 'muted'}>
          Outstanding: {formatAmount(balance.total_outstanding)}
        </Badge>
      </div>
    </Panel>
  )
}
