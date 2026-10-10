import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { Badge } from '@/components/dashboard/badge'
import { formatAmount, formatPercentage } from '@/lib/format-money'
import { formatFeeType } from '../format'
import { CasesSection } from './cases-section'
import { AgreementSection } from './agreement-section'
import { InstallmentsSection, type WriteOff } from './installments-section'
import { dashboardTitle } from '@/lib/page-title'

export default async function EngagementDetailPage({ params }: PageProps<'/dashboard/fees/[id]'>) {
  const { id } = await params
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.fees.detail' })
  const tType = await getTranslations({ locale, namespace: 'dashboard.fees.type' })

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
        <BackLink href="/dashboard/fees" label={t('backToFees')} />
        <p className="text-sm text-fg-muted">
          <bdi>{t('notFound')}</bdi>
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
    { data: isOwner },
    { data: staffDirectory },
  ] = await Promise.all([
    supabase
      .from('engagement_balances')
      .select(
        'agreed_fixed_fee, agreed_percentage, scheduled_total, paid_total, scheduled_outstanding, unscheduled_amount, written_off_total'
      )
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
    // Every per-instalment figure comes from this view - amount, paid,
    // written off and balance due. Nothing is added or subtracted here.
    supabase
      .from('installment_balances')
      .select('installment_id, installment_amount, paid_amount, written_off_amount, balance_due')
      .eq('engagement_id', id),
    supabase.rpc('has_permission', { p_key: 'payments_record' }),
    // Write-offs (and their reversals) are owner-only to record - the
    // INSERT policy is is_owner() - so the controls are gated on the same
    // question, asked once here.
    supabase.rpc('is_owner'),
    // Unfiltered - who recorded a write-off should still show after they
    // leave the firm.
    supabase.from('staff_directory').select('id, full_name'),
  ])

  const installmentIds = (installments ?? []).map((i) => i.id)
  const [{ data: payments }, { data: writeOffRows }] =
    installmentIds.length > 0
      ? await Promise.all([
          supabase
            .from('payments')
            .select('id, installment_id, amount, paid_at, method')
            .in('installment_id', installmentIds)
            .order('paid_at', { ascending: false }),
          supabase
            .from('write_offs')
            .select('id, installment_id, amount, reason, written_off_on, reverses_write_off_id, created_by, created_at')
            .in('installment_id', installmentIds)
            .order('created_at', { ascending: true }),
        ])
      : [{ data: [] }, { data: [] }]

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
  const nameById = new Map(
    (staffDirectory ?? [])
      .filter((s): s is { id: string; full_name: string } => s.id !== null && s.full_name !== null)
      .map((s) => [s.id, s.full_name])
  )

  // Display pairing only: each original write-off is shown with the row
  // that reverses it (if any) directly beneath it. Whether a write-off
  // counts is already decided by installment_balances.
  const reversalByOriginal = new Map(
    (writeOffRows ?? []).filter((w) => w.reverses_write_off_id).map((w) => [w.reverses_write_off_id as string, w])
  )
  const writeOffsByInstallment = new Map<string, WriteOff[]>()
  for (const w of writeOffRows ?? []) {
    if (w.reverses_write_off_id) continue
    const reversal = reversalByOriginal.get(w.id) ?? null
    const list = writeOffsByInstallment.get(w.installment_id) ?? []
    list.push({
      id: w.id,
      amount: w.amount,
      reason: w.reason,
      written_off_on: w.written_off_on,
      recorded_by_name: nameById.get(w.created_by) ?? null,
      reversal: reversal
        ? {
            id: reversal.id,
            reason: reversal.reason,
            written_off_on: reversal.written_off_on,
            recorded_by_name: nameById.get(reversal.created_by) ?? null,
          }
        : null,
    })
    writeOffsByInstallment.set(w.installment_id, list)
  }

  const paymentsByInstallment = new Map<string, typeof payments>()
  for (const p of payments ?? []) {
    const list = paymentsByInstallment.get(p.installment_id) ?? []
    list.push(p)
    paymentsByInstallment.set(p.installment_id, list)
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <BackLink href="/dashboard/fees" label={t('backToFees')} />
        <PageHeader
          title={engagement.clients?.full_name ?? <bdi>{t('engagementFallback')}</bdi>}
          description={
            <>
              {tType(engagement.fee_type)}
              {': '}
              <bdi>{formatFeeType(engagement.fee_type, engagement.fixed_amount, engagement.percentage, locale)}</bdi>
            </>
          }
        />
      </div>

      <Panel className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {engagement.fee_type === 'fixed' ? (
            <Badge variant="neutral">
              {t.rich('agreedFixed', {
                amount: formatAmount(balance?.agreed_fixed_fee ?? null, locale),
                bdi: (chunks) => <bdi>{chunks}</bdi>,
              })}
            </Badge>
          ) : (
            <Badge variant="neutral">
              {t.rich('agreedPercentage', {
                percentage: formatPercentage(balance?.agreed_percentage ?? engagement.percentage ?? null, locale),
                bdi: (chunks) => <bdi>{chunks}</bdi>,
              })}
            </Badge>
          )}
          <Badge variant="neutral">
            {t.rich('scheduled', { amount: formatAmount(balance?.scheduled_total ?? 0, locale), bdi: (chunks) => <bdi>{chunks}</bdi> })}
          </Badge>
          <Badge variant="neutral">
            {t.rich('paid', { amount: formatAmount(balance?.paid_total ?? 0, locale), bdi: (chunks) => <bdi>{chunks}</bdi> })}
          </Badge>
          {/* Its own figure - money forgiven is never added to money paid. */}
          <Badge variant="neutral" data-testid="engagement-written-off-total">
            {t.rich('writtenOff', { amount: formatAmount(balance?.written_off_total ?? 0, locale), bdi: (chunks) => <bdi>{chunks}</bdi> })}
          </Badge>
          <Badge variant={(balance?.scheduled_outstanding ?? 0) > 0 ? 'accent' : 'muted'}>
            {t.rich('outstandingScheduled', {
              amount: formatAmount(balance?.scheduled_outstanding ?? 0, locale),
              bdi: (chunks) => <bdi>{chunks}</bdi>,
            })}
          </Badge>
        </div>
        {engagement.fee_type === 'fixed' &&
          balance?.unscheduled_amount !== null &&
          balance?.unscheduled_amount !== undefined &&
          balance.unscheduled_amount !== 0 && (
            <p className="text-sm text-fg-muted">
              {balance.unscheduled_amount > 0
                ? t.rich('unscheduledPositive', {
                    amount: formatAmount(balance.unscheduled_amount, locale),
                    bdi: (chunks) => <bdi>{chunks}</bdi>,
                  })
                : t.rich('unscheduledNegative', {
                    amount: formatAmount(Math.abs(balance.unscheduled_amount), locale),
                    bdi: (chunks) => <bdi>{chunks}</bdi>,
                  })}
            </p>
          )}
      </Panel>

      <CasesSection
        engagementId={engagement.id}
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
          // Straight from installment_balances; null (rendered as a dash) if
          // the view returned no row, never a figure derived here.
          balance: balanceByInstallment.get(i.id) ?? null,
          payments: paymentsByInstallment.get(i.id) ?? [],
          writeOffs: writeOffsByInstallment.get(i.id) ?? [],
        }))}
        canRecordPayments={Boolean(canRecordPayments)}
        canWriteOff={isOwner === true}
      />
    </div>
  )
}

export const generateMetadata = () => dashboardTitle('feeEngagement')
