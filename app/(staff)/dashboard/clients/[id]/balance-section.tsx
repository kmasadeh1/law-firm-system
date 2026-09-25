import { getTranslations } from 'next-intl/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { Panel } from '@/components/dashboard/panel'
import { Badge } from '@/components/dashboard/badge'
import { formatAmount } from '@/lib/format-money'

type Balance = {
  agreed_fixed_fee_total: number | null
  percentage_engagement_count: number | null
  scheduled_total: number | null
  paid_total: number | null
  scheduled_outstanding: number | null
}

export async function BalanceSection({ balance }: { balance: Balance | null }) {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.clients.detail.balance' })
  const bdi = (chunks: React.ReactNode) => <bdi>{chunks}</bdi>

  // No row at all means no engagements for this client - not the same
  // thing as agreed_fixed_fee_total being null, which is the normal,
  // expected state for a client whose only engagement is percentage-based.
  if (!balance) {
    return (
      <Panel className="flex flex-col gap-2">
        <h2 className="font-heading text-lg text-fg">{t('heading')}</h2>
        <p className="text-sm text-fg-muted">
          <bdi>{t('noEngagementsYet')}</bdi>
        </p>
      </Panel>
    )
  }

  const hasPercentageEngagements = (balance.percentage_engagement_count ?? 0) > 0

  return (
    <Panel className="flex flex-col gap-3">
      <h2 className="font-heading text-lg text-fg">{t('heading')}</h2>
      <div className="flex flex-wrap gap-2">
        {balance.agreed_fixed_fee_total !== null && (
          <Badge variant="neutral">
            {t.rich('agreedFixedFees', { amount: formatAmount(balance.agreed_fixed_fee_total, locale), bdi })}
          </Badge>
        )}
        <Badge variant="neutral">{t.rich('scheduled', { amount: formatAmount(balance.scheduled_total, locale), bdi })}</Badge>
        <Badge variant="neutral">{t.rich('paid', { amount: formatAmount(balance.paid_total, locale), bdi })}</Badge>
        <Badge variant={(balance.scheduled_outstanding ?? 0) > 0 ? 'accent' : 'muted'}>
          {t.rich('outstandingScheduled', { amount: formatAmount(balance.scheduled_outstanding, locale), bdi })}
        </Badge>
      </div>
      {hasPercentageEngagements && (
        <p className="text-xs text-fg-muted">
          <bdi>{t('alsoHasPercentageEngagements', { count: balance.percentage_engagement_count ?? 0 })}</bdi>
        </p>
      )}
    </Panel>
  )
}
