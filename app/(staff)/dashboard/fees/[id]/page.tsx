import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { Badge } from '@/components/dashboard/badge'
import { formatAmount, formatFeeType } from '../format'
import { CasesSection } from './cases-section'
import { InstallmentsSection } from './installments-section'

export default async function EngagementDetailPage({ params }: PageProps<'/dashboard/fees/[id]'>) {
  const { id } = await params
  const supabase = await createClient()

  const { data: engagement } = await supabase
    .from('engagements')
    .select('id, fee_type, fixed_amount, percentage, created_at, client_id, clients(full_name)')
    .eq('id', id)
    .maybeSingle()

  if (!engagement) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink href="/dashboard/fees" label="Fees & payments" />
        <p className="text-sm text-fg-muted">
          This engagement doesn&apos;t exist, or you don&apos;t have access to it.
        </p>
      </div>
    )
  }

  const [
    { data: balance },
    { data: linkedCaseRows },
    { data: clientCases },
    { data: installments },
    { data: installmentBalances },
    { data: canRecordPayments },
  ] = await Promise.all([
    supabase
      .from('engagement_balances')
      .select('total_agreed, total_paid, total_outstanding')
      .eq('engagement_id', id)
      .maybeSingle(),
    supabase.from('engagement_cases').select('cases(id, case_number, title)').eq('engagement_id', id),
    supabase
      .from('cases')
      .select('id, case_number, title')
      .eq('client_id', engagement.client_id)
      .order('case_number'),
    supabase
      .from('engagement_installments')
      .select('id, description, due_date, amount, payer_name')
      .eq('engagement_id', id)
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase.from('installment_balances').select('installment_id, paid_amount, balance_due').eq('engagement_id', id),
    supabase.rpc('has_permission', { p_key: 'payments_record' }),
  ])

  const installmentIds = (installments ?? []).map((i) => i.id)
  const { data: payments } =
    installmentIds.length > 0
      ? await supabase
          .from('payments')
          .select('id, installment_id, amount, paid_at, method')
          .in('installment_id', installmentIds)
          .order('paid_at', { ascending: false })
      : { data: [] }

  const linkedCases = (linkedCaseRows ?? [])
    .map((r) => r.cases)
    .filter((c): c is { id: string; case_number: string; title: string } => c !== null)

  const balanceByInstallment = new Map(
    (installmentBalances ?? []).map((b) => [b.installment_id, b])
  )
  const paymentsByInstallment = new Map<string, typeof payments>()
  for (const p of payments ?? []) {
    const list = paymentsByInstallment.get(p.installment_id) ?? []
    list.push(p)
    paymentsByInstallment.set(p.installment_id, list)
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <BackLink href="/dashboard/fees" label="Fees & payments" />
        <PageHeader
          title={engagement.clients?.full_name ?? 'Engagement'}
          description={`${engagement.fee_type === 'fixed' ? 'Fixed fee' : 'Percentage fee'}: ${formatFeeType(engagement.fee_type, engagement.fixed_amount, engagement.percentage)}`}
        />
      </div>

      <Panel className="flex flex-wrap items-center gap-3">
        <Badge variant="neutral">Agreed: {formatAmount(balance?.total_agreed ?? 0)}</Badge>
        <Badge variant="neutral">Paid: {formatAmount(balance?.total_paid ?? 0)}</Badge>
        <Badge variant={(balance?.total_outstanding ?? 0) > 0 ? 'accent' : 'muted'}>
          Outstanding: {formatAmount(balance?.total_outstanding ?? 0)}
        </Badge>
      </Panel>

      <CasesSection
        engagementId={engagement.id}
        clientId={engagement.client_id}
        linkedCases={linkedCases}
        clientCases={clientCases ?? []}
      />

      <InstallmentsSection
        engagementId={engagement.id}
        installments={(installments ?? []).map((i) => ({
          ...i,
          paid_amount: balanceByInstallment.get(i.id)?.paid_amount ?? 0,
          balance_due: balanceByInstallment.get(i.id)?.balance_due ?? i.amount,
          payments: paymentsByInstallment.get(i.id) ?? [],
        }))}
        canRecordPayments={Boolean(canRecordPayments)}
      />
    </div>
  )
}
