'use client'

import { useRef, useState, useTransition } from 'react'
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
import { formatAmount } from '../format'

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
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)
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

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      const result = await deleteInstallment(engagementId, installment.id)
      if (result.error) setError(result.error)
    })
  }

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
              placeholder="Description"
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
              placeholder="Payer (if not the client)"
              className={controlClass}
            />
          </div>
          {error && <FieldError>{error}</FieldError>}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={isPending}>
              Cancel
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
            {' '}
            · {formatAmount(installment.amount)}
            {installment.due_date && ` · due ${installment.due_date}`}
            {installment.payer_name && ` · payer: ${installment.payer_name}`}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="muted">Paid: {formatAmount(installment.paid_amount)}</Badge>
          <Badge variant={installment.balance_due > 0 ? 'accent' : 'muted'}>
            Balance: {formatAmount(installment.balance_due)}
          </Badge>
          <Button type="button" variant="ghost" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Hide payments' : 'Payments'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button type="button" variant="danger" disabled={isPending} onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>

      {error && !editing && <FieldError>{error}</FieldError>}

      {expanded && (
        <div className="flex flex-col gap-3 rounded-md border border-line bg-canvas p-3">
          {installment.payments.length === 0 ? (
            <p className="text-sm text-fg-muted">No payments recorded yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {installment.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="text-fg">{formatAmount(p.amount)}</span>
                  <span className="text-fg-muted">
                    {p.paid_at}
                    {p.method && ` · ${p.method}`}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {canRecordPayments ? (
            <form ref={paymentFormRef} onSubmit={handleRecordPayment} className="flex flex-col gap-2">
              <Banner kind="warning">
                Payments can&apos;t be edited or removed once recorded. A mistake is corrected with
                an offsetting entry, not by changing history.
              </Banner>
              <div className="flex flex-wrap items-end gap-2">
                <Field>
                  <Label htmlFor={`amount-${installment.id}`} required>
                    Amount
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
                    Date
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
                  <Label htmlFor={`method-${installment.id}`}>Method</Label>
                  <input id={`method-${installment.id}`} name="method" placeholder="e.g. cash, transfer" className={controlClass} />
                </Field>
                <Button type="submit" variant="primary" disabled={isPending}>
                  {isPending ? 'Recording…' : 'Record payment'}
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-xs text-fg-muted">
              You don&apos;t have permission to record payments.
            </p>
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
      <h2 className="font-heading text-lg text-fg">Instalments</h2>

      {installments.length === 0 ? (
        <p className="text-sm text-fg-muted">No instalments yet.</p>
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
            Description
          </Label>
          <input id="new-description" name="description" required placeholder="e.g. on signing" className={controlClass} />
        </Field>
        <Field>
          <Label htmlFor="new-due-date">Due date</Label>
          <input id="new-due-date" name="due_date" type="date" className={controlClass} />
        </Field>
        <Field>
          <Label htmlFor="new-amount" required>
            Amount
          </Label>
          <input id="new-amount" name="amount" type="number" min="0" step="0.01" required className={controlClass} />
        </Field>
        <Field>
          <Label htmlFor="new-payer">Payer</Label>
          <input id="new-payer" name="payer_name" placeholder="If not the client" className={controlClass} />
        </Field>
        <Button type="submit" variant="secondary" disabled={isPending}>
          {isPending ? 'Adding…' : 'Add instalment'}
        </Button>
      </form>

      {error && <FieldError>{error}</FieldError>}
    </Panel>
  )
}
