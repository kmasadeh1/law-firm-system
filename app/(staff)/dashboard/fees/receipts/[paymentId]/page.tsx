import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { formatAmount } from '@/lib/format-money'
import { formatDate } from '@/lib/format-date-time'
import { amountInWords } from '@/lib/amount-in-words'
import { localizedField } from '@/lib/localized-field'
import { isPlaceholderEmail } from '@/lib/public-site'
import { BackLink } from '@/components/dashboard/back-link'
import { PrintButton } from '@/components/dashboard/print-button'
import { dashboardTitle } from '@/lib/page-title'

// A payment receipt (سند قبض), printed from the browser - the same pattern
// as the hearing calendar: Ctrl+P / the Print button gives an A4 page (and
// a PDF, if the reader prints to one) with the browser doing all Arabic
// shaping and RTL. The dashboard shell's sidebar and top bar are already
// print:hidden; this page hides its own controls the same way.
//
// No access check of its own: the /dashboard/fees layout requires
// fees_view, and the payments SELECT policy decides whether this payment is
// visible at all. Not visible and not found are the same "not found" here.
//
// Renders in the signed-in staff member's language, like every dashboard
// page - a client who wants Arabic gets it from a staff member working in
// Arabic. Every figure is the stored payment as-is.
export default async function PaymentReceiptPage({ params }: PageProps<'/dashboard/fees/receipts/[paymentId]'>) {
  const { paymentId } = await params
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.fees.receipt' })
  const tShell = await getTranslations({ locale, namespace: 'dashboard.shell' })
  const tAuth = await getTranslations({ locale, namespace: 'staffAuth' })

  const [{ data: payment }, { data: firm }] = await Promise.all([
    supabase
      .from('payments')
      .select(
        'id, receipt_number, amount, paid_at, method, engagement_installments(description, description_ar, due_date, engagement_id, engagements(clients(full_name)))'
      )
      .eq('id', paymentId)
      .maybeSingle(),
    supabase.from('firm_settings').select('address_en, address_ar, phone, email').maybeSingle(),
  ])

  if (!payment) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink href="/dashboard/fees" label={t('backToFees')} />
        <p className="text-sm text-fg-muted" data-testid="receipt-not-found">
          {t('notFound')}
        </p>
      </div>
    )
  }

  const installment = payment.engagement_installments
  // Null when RLS hides the client from this reader while the payment
  // itself is visible - said plainly rather than left blank.
  const clientName = installment?.engagements?.clients?.full_name ?? null
  const address = firm ? localizedField(firm, 'address', locale) : null
  const phone = firm?.phone ?? null
  // The seeded email is info@example.com; a receipt handed to a client must
  // not print a placeholder as the firm's address.
  const email = firm?.email && !isPlaceholderEmail(firm.email) ? firm.email : null
  const words = amountInWords(payment.amount, locale)

  return (
    <div className="flex flex-col gap-6" data-testid="payment-receipt-page">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BackLink
          href={installment ? `/dashboard/fees/${installment.engagement_id}` : '/dashboard/fees'}
          label={t('backToEngagement')}
        />
        <PrintButton label={t('print')} testId="receipt-print" />
      </div>

      <article
        className="mx-auto w-full max-w-2xl rounded-lg border border-line bg-surface p-8 text-fg print:max-w-none print:rounded-none print:border-0 print:p-0"
        data-testid="payment-receipt"
      >
        {/* Letterhead */}
        <header className="flex flex-col gap-1 border-b-2 border-fg pb-4 text-center">
          <p className="font-heading text-2xl">{tShell('firmName')}</p>
          <p className="text-sm text-fg-muted">{tAuth('firmTagline')}</p>
          <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-0.5 text-xs text-fg-muted">
            {address && <span>{address}</span>}
            {phone && <span dir="ltr">{phone}</span>}
            {email && <span dir="ltr">{email}</span>}
          </div>
        </header>

        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="font-heading text-xl">{t('title')}</h1>
          <dl className="flex flex-col gap-0.5 text-sm">
            <div className="flex gap-2">
              <dt className="text-fg-muted">{t('receiptNumber')}</dt>
              <dd className="font-medium" dir="ltr" data-testid="receipt-number">
                {payment.receipt_number}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-fg-muted">{t('date')}</dt>
              <dd className="font-medium" data-testid="receipt-date">
                {formatDate(payment.paid_at, locale)}
              </dd>
            </div>
          </dl>
        </div>

        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          <dt className="text-fg-muted">{t('receivedFrom')}</dt>
          <dd className="font-medium" data-testid="receipt-client">
            {clientName ?? <span className="font-normal italic text-fg-muted">{t('clientHidden')}</span>}
          </dd>

          <dt className="text-fg-muted">{t('for')}</dt>
          <dd data-testid="receipt-for">
            {(locale === 'ar' ? installment?.description_ar || installment?.description : installment?.description) ?? '—'}
            {installment?.due_date && (
              <span className="block text-xs text-fg-muted">
                {t.rich('dueDate', {
                  date: formatDate(installment.due_date, locale),
                  bdi: (chunks) => <bdi>{chunks}</bdi>,
                })}
              </span>
            )}
          </dd>

          <dt className="text-fg-muted">{t('method')}</dt>
          <dd data-testid="receipt-method">{payment.method ?? '—'}</dd>
        </dl>

        {/* The amount, boxed so it reads as the receipt's one figure, with
            the words beneath it - the line that stops the figure being
            altered after the receipt is handed over. */}
        <div className="mt-6 border-2 border-fg p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <span className="text-sm text-fg-muted">{t('amount')}</span>
            <span className="text-2xl font-semibold" data-testid="receipt-amount">
              <bdi>{formatAmount(payment.amount, locale)}</bdi>
            </span>
          </div>
          {words && (
            <p className="mt-2 border-t border-line pt-2 text-sm" data-testid="receipt-amount-words">
              <span className="text-fg-muted">{t('amountInWords')}</span> <span className="font-medium">{words}</span>
            </p>
          )}
        </div>

        {/* Signature and stamp - lines to sign on, kept together on the page. */}
        <div className="mt-16 grid grid-cols-2 gap-10 break-inside-avoid text-sm" data-testid="receipt-signature">
          <div>
            <div className="h-12 border-b border-fg" />
            <p className="mt-1 text-fg-muted">{t('receivedBy')}</p>
          </div>
          <div>
            <div className="h-12 border-b border-fg" />
            <p className="mt-1 text-fg-muted">{t('stamp')}</p>
          </div>
        </div>
      </article>
    </div>
  )
}

export const generateMetadata = () => dashboardTitle('receipt')
