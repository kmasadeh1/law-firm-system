'use client'

import Link from 'next/link'
import { useRef, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  createInstallment,
  deleteInstallment,
  recordPayment,
  reverseWriteOff,
  updateInstallment,
  writeOffInstallment,
} from '../actions'
import { resolveFeesError } from '../error-codes'
import { Panel } from '@/components/dashboard/panel'
import { Button } from '@/components/dashboard/button'
import { Badge } from '@/components/dashboard/badge'
import { Banner } from '@/components/dashboard/banner'
import { Field, Label, FieldError, controlClass } from '@/components/dashboard/form'
import { DeleteConfirmDialog } from '@/components/dashboard/delete-confirm-dialog'
import { formatAmount } from '@/lib/format-money'
import { formatDate, todayInFirmZone } from '@/lib/format-date-time'
import { FreeText } from '@/components/free-text'

type Payment = { id: string; amount: number; paid_at: string; method: string | null }

// One write-off as recorded, paired for display with the row that reverses
// it, if there is one. Both stay visible - neither is ever edited away.
export type WriteOff = {
  id: string
  amount: number
  reason: string
  written_off_on: string
  recorded_by_name: string | null
  reversal: {
    id: string
    reason: string
    written_off_on: string
    recorded_by_name: string | null
  } | null
}

// The installment_balances row for this instalment - every figure shown on
// the row comes from here, none is computed in this file.
type InstallmentBalance = {
  installment_amount: number | null
  paid_amount: number | null
  written_off_amount: number | null
  balance_due: number | null
}

type Installment = {
  id: string
  description: string
  due_date: string | null
  amount: number
  payer_name: string | null
  balance: InstallmentBalance | null
  payments: Payment[]
  writeOffs: WriteOff[]
}

function ReverseWriteOffForm({
  engagementId,
  writeOffId,
  onDone,
}: {
  engagementId: string
  writeOffId: string
  onDone: () => void
}) {
  const t = useTranslations('dashboard.fees.detail.installments.writeOffs')
  const tErrors = useTranslations('dashboard.fees.errors')
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await reverseWriteOff(engagementId, writeOffId, formData)
      if (result.error) {
        setError(resolveFeesError(result.error, tErrors))
        return
      }
      onDone()
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mt-2 flex flex-col gap-2" data-testid="write-off-reverse-form">
      <div className="flex flex-wrap items-end gap-2">
        <Field>
          <Label htmlFor={`reverse-reason-${writeOffId}`} required>
            {t('reverseReasonLabel')}
          </Label>
          <input id={`reverse-reason-${writeOffId}`} name="reason" required className={controlClass} />
        </Field>
        <Field>
          <Label htmlFor={`reverse-date-${writeOffId}`} required>
            {t('dateLabel')}
          </Label>
          <input
            id={`reverse-date-${writeOffId}`}
            name="written_off_on"
            type="date"
            required
            defaultValue={todayInFirmZone()}
            className={controlClass}
          />
        </Field>
        <Button type="submit" variant="secondary" disabled={isPending} data-testid="write-off-reverse-submit">
          {isPending ? t('reversing') : t('confirmReverse')}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone} disabled={isPending}>
          {t('cancel')}
        </Button>
      </div>
      {error && (
        <FieldError>
          <bdi>{error}</bdi>
        </FieldError>
      )}
    </form>
  )
}

function WriteOffItem({
  engagementId,
  writeOff,
  canWriteOff,
}: {
  engagementId: string
  writeOff: WriteOff
  canWriteOff: boolean
}) {
  const locale = useLocale()
  const t = useTranslations('dashboard.fees.detail.installments.writeOffs')
  const [reversing, setReversing] = useState(false)
  const reversed = writeOff.reversal !== null

  return (
    <li className="flex flex-col gap-1 py-2 text-sm" data-testid="write-off-row" data-reversed={reversed ? 'true' : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={reversed ? 'text-fg-muted line-through' : 'font-medium text-fg'}>
          <bdi>{formatAmount(writeOff.amount, locale)}</bdi>
        </span>
        <span className="text-xs text-fg-muted">
          {t.rich(writeOff.recorded_by_name ? 'recordedLine' : 'recordedLineNoName', {
            date: formatDate(writeOff.written_off_on, locale),
            name: writeOff.recorded_by_name ?? '',
            bdi: (chunks) => <bdi>{chunks}</bdi>,
          })}
        </span>
      </div>
      <FreeText as="p" className="whitespace-pre-wrap text-fg">{writeOff.reason}</FreeText>

      {writeOff.reversal ? (
        <div className="ms-4 flex flex-col gap-0.5 border-s-2 border-line ps-3" data-testid="write-off-reversal">
          <Badge variant="muted">{t('reversedBadge')}</Badge>
          <span className="text-xs text-fg-muted">
            {t.rich(writeOff.reversal.recorded_by_name ? 'recordedLine' : 'recordedLineNoName', {
              date: formatDate(writeOff.reversal.written_off_on, locale),
              name: writeOff.reversal.recorded_by_name ?? '',
              bdi: (chunks) => <bdi>{chunks}</bdi>,
            })}
          </span>
          <FreeText as="p" className="whitespace-pre-wrap text-fg">{writeOff.reversal.reason}</FreeText>
        </div>
      ) : (
        canWriteOff &&
        (reversing ? (
          <ReverseWriteOffForm engagementId={engagementId} writeOffId={writeOff.id} onDone={() => setReversing(false)} />
        ) : (
          <div>
            <Button type="button" variant="ghost" onClick={() => setReversing(true)} data-testid="write-off-reverse">
              {t('reverse')}
            </Button>
          </div>
        ))
      )}
    </li>
  )
}

function WriteOffForm({
  engagementId,
  installmentId,
  outstanding,
  onDone,
}: {
  engagementId: string
  installmentId: string
  outstanding: number
  onDone: () => void
}) {
  const t = useTranslations('dashboard.fees.detail.installments.writeOffs')
  const tErrors = useTranslations('dashboard.fees.errors')
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await writeOffInstallment(engagementId, installmentId, formData)
      if (result.error) {
        setError(resolveFeesError(result.error, tErrors))
        return
      }
      onDone()
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-2" data-testid="write-off-form">
      <Banner kind="warning">{t('immutableBanner')}</Banner>
      <div className="flex flex-wrap items-end gap-2">
        <Field>
          <Label htmlFor={`write-off-amount-${installmentId}`} required>
            {t('amountLabel')}
          </Label>
          {/* Pre-filled with the view's balance_due - forgiving the
              remainder is the common case - but editable. */}
          <input
            id={`write-off-amount-${installmentId}`}
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            defaultValue={outstanding}
            className={controlClass}
          />
        </Field>
        <Field>
          <Label htmlFor={`write-off-date-${installmentId}`} required>
            {t('dateLabel')}
          </Label>
          <input
            id={`write-off-date-${installmentId}`}
            name="written_off_on"
            type="date"
            required
            defaultValue={todayInFirmZone()}
            className={controlClass}
          />
        </Field>
      </div>
      <Field>
        <Label htmlFor={`write-off-reason-${installmentId}`} required>
          {t('reasonLabel')}
        </Label>
        <textarea
          id={`write-off-reason-${installmentId}`}
          name="reason"
          rows={2}
          required
          placeholder={t('reasonPlaceholder')}
          className={`${controlClass} resize-y`}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={isPending} data-testid="write-off-submit">
          {isPending ? t('recording') : t('submit')}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone} disabled={isPending}>
          {t('cancel')}
        </Button>
      </div>
      {error && (
        <FieldError>
          <bdi>{error}</bdi>
        </FieldError>
      )}
    </form>
  )
}

function InstallmentRow({
  engagementId,
  installment,
  canRecordPayments,
  canWriteOff,
}: {
  engagementId: string
  installment: Installment
  canRecordPayments: boolean
  canWriteOff: boolean
}) {
  const locale = useLocale()
  const t = useTranslations('dashboard.fees.detail.installments')
  const tErrors = useTranslations('dashboard.fees.errors')
  const tWriteOffs = useTranslations('dashboard.fees.detail.installments.writeOffs')
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [writingOff, setWritingOff] = useState(false)
  const [isPending, startTransition] = useTransition()
  const balance = installment.balance
  const money = (value: number | null | undefined) => (value === null || value === undefined ? '—' : formatAmount(value, locale))
  const editFormRef = useRef<HTMLFormElement>(null)
  const paymentFormRef = useRef<HTMLFormElement>(null)

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(editFormRef.current!)
    startTransition(async () => {
      const result = await updateInstallment(engagementId, installment.id, formData)
      if (result.error) {
        setError(resolveFeesError(result.error, tErrors))
        return
      }
      setEditing(false)
    })
  }

  function handleConfirmDelete() {
    setError(null)
    startTransition(async () => {
      const result = await deleteInstallment(engagementId, installment.id)
      setConfirmingDelete(false)
      if (result.error) setError(resolveFeesError(result.error, tErrors))
    })
  }

  const hasPayments = installment.payments.length > 0
  // Amount and date each get their own <bdi>, matching the row display
  // above - bundling them into one string first would isolate the whole
  // run together instead of each value from its neighbour.
  const installmentLabel = installment.due_date
    ? t.rich('deleteItemDue', {
        amount: formatAmount(installment.amount, locale),
        date: formatDate(installment.due_date, locale),
        bdi: (chunks) => <bdi>{chunks}</bdi>,
      })
    : t.rich('deleteItemNoDueDate', {
        amount: formatAmount(installment.amount, locale),
        bdi: (chunks) => <bdi>{chunks}</bdi>,
      })

  function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(paymentFormRef.current!)
    startTransition(async () => {
      const result = await recordPayment(engagementId, installment.id, formData)
      if (result.error) {
        setError(resolveFeesError(result.error, tErrors))
        return
      }
      paymentFormRef.current?.reset()
    })
  }

  if (editing) {
    return (
      <li className="px-3 py-3">
        <form ref={editFormRef} onSubmit={handleSaveEdit} className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <input
              name="description"
              defaultValue={installment.description}
              required
              placeholder={t('descriptionPlaceholder')}
              className={`flex-1 ${controlClass}`}
            />
            <input
              name="due_date"
              type="date"
              defaultValue={installment.due_date ?? ''}
              className={controlClass}
            />
            <input
              name="amount"
              type="number"
              min="0"
              step="0.01"
              defaultValue={installment.amount}
              required
              className={controlClass}
            />
            <input
              name="payer_name"
              defaultValue={installment.payer_name ?? ''}
              placeholder={t('payerPlaceholder')}
              className={controlClass}
            />
          </div>
          {error && (
            <FieldError>
              <bdi>{error}</bdi>
            </FieldError>
          )}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? t('saving') : t('save')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={isPending}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className="flex flex-col gap-3 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-medium text-fg">{installment.description}</span>
          <span className="text-fg-muted">
            {t.rich('amountLine', { amount: money(balance?.installment_amount), bdi: (chunks) => <bdi>{chunks}</bdi> })}
            {installment.due_date &&
              t.rich('dueDateFragment', {
                date: formatDate(installment.due_date, locale),
                bdi: (chunks) => <bdi>{chunks}</bdi>,
              })}
            {installment.payer_name &&
              t.rich('payerFragment', { name: installment.payer_name, bdi: (chunks) => <bdi>{chunks}</bdi> })}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="muted">
            {t.rich('paidBadge', { amount: money(balance?.paid_amount), bdi: (chunks) => <bdi>{chunks}</bdi> })}
          </Badge>
          {/* Its own figure, never folded into paid. */}
          <Badge variant="muted" data-testid="installment-written-off">
            {t.rich('writtenOffBadge', { amount: money(balance?.written_off_amount), bdi: (chunks) => <bdi>{chunks}</bdi> })}
          </Badge>
          <Badge variant={(balance?.balance_due ?? 0) > 0 ? 'accent' : 'muted'}>
            {t.rich('balanceBadge', { amount: money(balance?.balance_due), bdi: (chunks) => <bdi>{chunks}</bdi> })}
          </Badge>
          <Button type="button" variant="ghost" onClick={() => setExpanded((v) => !v)}>
            {expanded ? t('hidePayments') : t('showPayments')}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(true)}>
            {t('edit')}
          </Button>
          <Button type="button" variant="danger" disabled={isPending} onClick={() => setConfirmingDelete(true)}>
            {t('delete')}
          </Button>
        </div>
      </div>

      {error && !editing && (
        <FieldError>
          <bdi>{error}</bdi>
        </FieldError>
      )}

      {(installment.writeOffs.length > 0 || canWriteOff) && (
        <div className="flex flex-col gap-2 rounded-md border border-line p-3" data-testid="installment-write-offs">
          <p className="text-xs font-medium text-fg-muted">{tWriteOffs('heading')}</p>
          {installment.writeOffs.length > 0 && (
            <ul className="flex flex-col divide-y divide-line">
              {installment.writeOffs.map((w) => (
                <WriteOffItem key={w.id} engagementId={engagementId} writeOff={w} canWriteOff={canWriteOff} />
              ))}
            </ul>
          )}
          {/* Owner only (the INSERT policy), and only while the view says
              something is still due - a write-off of anything against a
              zero balance would be refused. */}
          {canWriteOff &&
            balance?.balance_due !== null &&
            balance?.balance_due !== undefined &&
            balance.balance_due > 0 &&
            (writingOff ? (
              <WriteOffForm
                engagementId={engagementId}
                installmentId={installment.id}
                outstanding={balance.balance_due}
                onDone={() => setWritingOff(false)}
              />
            ) : (
              <div>
                <Button type="button" variant="secondary" onClick={() => setWritingOff(true)} data-testid="write-off-open">
                  {tWriteOffs('open')}
                </Button>
              </div>
            ))}
        </div>
      )}

      <DeleteConfirmDialog
        open={confirmingDelete}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={handleConfirmDelete}
        kind="hard"
        itemLabel={installmentLabel}
        confirmLabel={t('delete')}
        pendingLabel={t('deleting')}
        pending={isPending}
        note={<bdi>{hasPayments ? t('deleteNoteHasPayments') : t('deleteNoteNoPayments')}</bdi>}
      />

      {expanded && (
        <div className="flex flex-col gap-3 rounded-md border border-line bg-canvas p-3">
          {installment.payments.length === 0 ? (
            <p className="text-sm text-fg-muted">{t('noPaymentsYet')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {installment.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-1.5 text-sm" data-testid="payment-row">
                  <span className="text-fg">
                    <bdi>{formatAmount(p.amount, locale)}</bdi>
                  </span>
                  <span className="flex items-center gap-3 text-fg-muted">
                    <span>
                      <bdi>{formatDate(p.paid_at, locale)}</bdi>
                      {p.method && t.rich('paymentMethodFragment', { method: p.method, bdi: (chunks) => <bdi>{chunks}</bdi> })}
                    </span>
                    <Link
                      href={`/dashboard/fees/receipts/${p.id}`}
                      className="font-medium text-fg underline underline-offset-2"
                      data-testid="payment-receipt-link"
                    >
                      {t('receipt')}
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {canRecordPayments ? (
            <form ref={paymentFormRef} onSubmit={handleRecordPayment} className="flex flex-col gap-2">
              <Banner kind="warning">{t('paymentsImmutableBanner')}</Banner>
              <div className="flex flex-wrap items-end gap-2">
                <Field>
                  <Label htmlFor={`amount-${installment.id}`} required>
                    {t('amountLabel')}
                  </Label>
                  <input
                    id={`amount-${installment.id}`}
                    name="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    className={controlClass}
                  />
                </Field>
                <Field>
                  <Label htmlFor={`paid_at-${installment.id}`} required>
                    {t('dateLabel')}
                  </Label>
                  <input
                    id={`paid_at-${installment.id}`}
                    name="paid_at"
                    type="date"
                    required
                    defaultValue={todayInFirmZone()}
                    className={controlClass}
                  />
                </Field>
                <Field>
                  <Label htmlFor={`method-${installment.id}`}>{t('methodLabel')}</Label>
                  <input
                    id={`method-${installment.id}`}
                    name="method"
                    placeholder={t('methodPlaceholder')}
                    className={controlClass}
                  />
                </Field>
                <Button type="submit" variant="primary" disabled={isPending}>
                  {isPending ? t('recording') : t('recordPayment')}
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-xs text-fg-muted">{t('noPermissionRecordPayments')}</p>
          )}
        </div>
      )}
    </li>
  )
}

export function InstallmentsSection({
  engagementId,
  installments,
  canRecordPayments,
  canWriteOff,
}: {
  engagementId: string
  installments: Installment[]
  canRecordPayments: boolean
  /** is_owner() - write-offs and reversals are owner-only to record. */
  canWriteOff: boolean
}) {
  const t = useTranslations('dashboard.fees.detail.installments')
  const tErrors = useTranslations('dashboard.fees.errors')
  const addFormRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(addFormRef.current!)
    startTransition(async () => {
      const result = await createInstallment(engagementId, formData)
      if (result.error) {
        setError(resolveFeesError(result.error, tErrors))
        return
      }
      addFormRef.current?.reset()
    })
  }

  return (
    <Panel className="flex flex-col gap-3">
      <h2 className="font-heading text-lg text-fg">
        <bdi>{t('heading')}</bdi>
      </h2>

      {installments.length === 0 ? (
        <p className="text-sm text-fg-muted">
          <bdi>{t('noneYet')}</bdi>
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {installments.map((i) => (
            <InstallmentRow
              key={i.id}
              engagementId={engagementId}
              installment={i}
              canRecordPayments={canRecordPayments}
              canWriteOff={canWriteOff}
            />
          ))}
        </ul>
      )}

      <form ref={addFormRef} onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
        <Field>
          <Label htmlFor="new-description" required>
            {t('descriptionLabel')}
          </Label>
          <input
            id="new-description"
            name="description"
            required
            placeholder={t('descriptionAddPlaceholder')}
            className={controlClass}
          />
        </Field>
        <Field>
          <Label htmlFor="new-due-date">{t('dueDateLabel')}</Label>
          <input id="new-due-date" name="due_date" type="date" className={controlClass} />
        </Field>
        <Field>
          <Label htmlFor="new-amount" required>
            {t('amountLabel')}
          </Label>
          <input id="new-amount" name="amount" type="number" min="0" step="0.01" required className={controlClass} />
        </Field>
        <Field>
          <Label htmlFor="new-payer">{t('payerLabel')}</Label>
          <input id="new-payer" name="payer_name" placeholder={t('payerAddPlaceholder')} className={controlClass} />
        </Field>
        <Button type="submit" variant="secondary" disabled={isPending}>
          {isPending ? t('adding') : <bdi>{t('addInstallment')}</bdi>}
        </Button>
      </form>

      {error && (
        <FieldError>
          <bdi>{error}</bdi>
        </FieldError>
      )}
    </Panel>
  )
}
