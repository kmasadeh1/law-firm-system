import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { Badge } from '@/components/dashboard/badge'
import { formatAmount, formatFeeType } from '../format'
import { CasesSection } from './cases-section'
import { AgreementSection } from './agreement-section'
import { InstallmentsSection } from './installments-section'

export default async function EngagementDetailPage({ params }: PageProps<'/dashboard/fees/[id]'>) {
  const { id } = await params
  const supabase = await createClient()

  const { data: engagement } = await supabase
    .from('engagements')
    .select(
      'id, fee_type, fixed_amount, percentage, created_at, client_id, signed_agreement_document_id, clients(full_name)'
    )
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
      .select('agreed_fixed_fee, agreed_percentage, scheduled_total, paid_total, scheduled_outstanding, unscheduled_amount')
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

  // Fetched separately from the engagement row (rather than joined) so an
  // attached-but-invisible-to-me document is distinguishable: the FK on
  // `engagements` is non-null but this comes back empty because RLS hid the
  // document row, versus genuinely nothing attached.
  const { data: attachedDocument } = engagement.signed_agreement_document_id
    ? await supabase
        .from('documents')
        .select('id, filename, deleted_at')
        .eq('id', engagement.signed_agreement_document_id)
        .maybeSingle()
    : { data: null }

  const linkedCaseIds = linkedCases.map((c) => c.id)
  const { data: signableDocuments } =
    linkedCaseIds.length > 0
      ? await supabase
          .from('documents')
          .select('id, filename, case_id')
          .in('case_id', linkedCaseIds)
          .is('deleted_at', null)
          .order('filename')
      : { data: [] }

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

      <Panel className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {engagement.fee_type === 'fixed' ? (
            <Badge variant="neutral">Agreed: {formatAmount(balance?.agreed_fixed_fee ?? null)}</Badge>
          ) : (
            <Badge variant="neutral">Agreed: {balance?.agreed_percentage ?? engagement.percentage ?? '—'}% of award</Badge>
          )}
          <Badge variant="neutral">Scheduled: {formatAmount(balance?.scheduled_total ?? 0)}</Badge>
          <Badge variant="neutral">Paid: {formatAmount(balance?.paid_total ?? 0)}</Badge>
          <Badge variant={(balance?.scheduled_outstanding ?? 0) > 0 ? 'accent' : 'muted'}>
            Outstanding (scheduled): {formatAmount(balance?.scheduled_outstanding ?? 0)}
          </Badge>
        </div>
        {engagement.fee_type === 'fixed' &&
          balance?.unscheduled_amount !== null &&
          balance?.unscheduled_amount !== undefined &&
          balance.unscheduled_amount !== 0 && (
            <p className="text-sm text-fg-muted">
              {balance.unscheduled_amount > 0
                ? `${formatAmount(balance.unscheduled_amount)} of the agreed fee is not scheduled yet.`
                : `The schedule exceeds the agreed fee by ${formatAmount(Math.abs(balance.unscheduled_amount))}.`}
            </p>
          )}
      </Panel>

      <CasesSection
        engagementId={engagement.id}
        clientId={engagement.client_id}
        linkedCases={linkedCases}
        clientCases={clientCases ?? []}
      />

      <AgreementSection
        engagementId={engagement.id}
        hasAttached={Boolean(engagement.signed_agreement_document_id)}
        attachedDocument={attachedDocument ?? null}
        hasLinkedCases={linkedCases.length > 0}
        candidates={signableDocuments ?? []}
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
