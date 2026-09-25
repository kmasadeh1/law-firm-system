'use client'

import { useRef, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  createInstallment,
  deleteInstallment,
  recordPayment,
  updateInstallment,
} from '../actions'
import { Panel } from '@/components/dashboard/panel'
import { Button } from '@/components/dashboard/button'
import { Badge } from '@/components/dashboard/badge'
import { Banner } from '@/components/dashboard/banner'
import { Field, Label, FieldError, controlClass } from '@/components/dashboard/form'
import { DeleteConfirmDialog } from '@/components/dashboard/delete-confirm-dialog'
import { formatAmount } from '@/lib/format-money'
import { formatDate } from '@/lib/format-date-time'

type Payment = { id: string; amount: number; paid_at: string; method: string | null }

type Installment = {
  id: string
  description: string
  due_date: string | null
  amount: number
  payer_name: string | null
  paid_amount: number
  balance_due: number
  payments: Payment[]
}

function InstallmentRow({
  engagementId,
  installment,
  canRecordPayments,
}: {
  engagementId: string
  installment: Installment
  canRecordPayments: boolean
}) {
  const locale = useLocale()
  const t = useTranslations('dashboard.fees.detail.installments')
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [isPending, startTransition] = useTransition()
  const editFormRef = useRef<HTMLFormElement>(null)
  const paymentFormRef = useRef<HTMLFormElement>(null)

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(editFormRef.current!)
    startTransition(async () => {
      const result = await updateInstallment(engagementId, installment.id, formData)
      if (result.error) {
        setError(result.error)
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
      if (result.error) setError(result.error)
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
        setError(result.error)
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
          {error && <FieldError>{error}</FieldError>}
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
            {t.rich('amountLine', { amount: formatAmount(installment.amount, locale), bdi: (chunks) => <bdi>{chunks}</bdi> })}
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
            {t.rich('paidBadge', { amount: formatAmount(installment.paid_amount, locale), bdi: (chunks) => <bdi>{chunks}</bdi> })}
          </Badge>
          <Badge variant={installment.balance_due > 0 ? 'accent' : 'muted'}>
            {t.rich('balanceBadge', { amount: formatAmount(installment.balance_due, locale), bdi: (chunks) => <bdi>{chunks}</bdi> })}
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

      {error && !editing && <FieldError>{error}</FieldError>}

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
                <li key={p.id} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="text-fg">
                    <bdi>{formatAmount(p.amount, locale)}</bdi>
                  </span>
                  <span className="text-fg-muted">
                    <bdi>{formatDate(p.paid_at, locale)}</bdi>
                    {p.method && t.rich('paymentMethodFragment', { method: p.method, bdi: (chunks) => <bdi>{chunks}</bdi> })}
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
                    defaultValue={new Date().toISOString().slice(0, 10)}
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
}: {
  engagementId: string
  installments: Installment[]
  canRecordPayments: boolean
}) {
  const t = useTranslations('dashboard.fees.detail.installments')
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
        setError(result.error)
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

      {error && <FieldError>{error}</FieldError>}
    </Panel>
  )
}
