'use client'

import { useRef, useState, useTransition } from 'react'
import { useLocale } from 'next-intl'
import { addExpense, editExpense, setExpenseReimbursed, deleteExpense } from '../actions'
import { formatAmount } from '../../fees/format'
import { Panel } from '@/components/dashboard/panel'
import { Badge } from '@/components/dashboard/badge'
import { Button } from '@/components/dashboard/button'
import { Field, Label, FieldError, controlClass } from '@/components/dashboard/form'
import { formatDate } from '@/lib/format-date-time'

export type ExpenseTotals = {
  incurred: number
  reimbursed: number
  outstanding: number
}

export type Expense = {
  id: string
  description: string
  amount: number
  incurred_at: string
  reimbursed: boolean
  reimbursed_at: string | null
  recorded_by_name: string
}

function ExpenseRow({ caseId, expense }: { caseId: string; expense: Expense }) {
  const [isEditing, setIsEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const locale = useLocale()

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await editExpense(caseId, expense.id, formData)
      if (result.error) {
        setError(result.error)
        return
      }
      setIsEditing(false)
    })
  }

  function handleToggleReimbursed() {
    setError(null)
    startTransition(async () => {
      const result = await setExpenseReimbursed(caseId, expense.id, !expense.reimbursed)
      if (result.error) setError(result.error)
    })
  }

  function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await deleteExpense(caseId, expense.id)
      if (result.error) {
        setError(result.error)
        setConfirmingDelete(false)
      }
    })
  }

  if (isEditing) {
    return (
      <li className="px-3 py-3 text-sm">
        <form ref={formRef} onSubmit={handleSaveEdit} className="flex flex-col gap-3">
          <Field>
            <Label htmlFor={`edit-description-${expense.id}`} required>
              Description
            </Label>
            <input
              id={`edit-description-${expense.id}`}
              name="description"
              defaultValue={expense.description}
              className={controlClass}
            />
          </Field>
          <div className="flex flex-wrap gap-3">
            <Field>
              <Label htmlFor={`edit-amount-${expense.id}`} required>
                Amount (JD)
              </Label>
              <input
                id={`edit-amount-${expense.id}`}
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={expense.amount}
                className={controlClass}
              />
            </Field>
            <Field>
              <Label htmlFor={`edit-incurred-${expense.id}`} required>
                Date incurred
              </Label>
              <input
                id={`edit-incurred-${expense.id}`}
                name="incurred_at"
                type="date"
                defaultValue={expense.incurred_at}
                className={controlClass}
              />
            </Field>
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" variant="secondary" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setIsEditing(false)} disabled={isPending}>
              Cancel
            </Button>
          </div>
          {error && <FieldError>{error}</FieldError>}
        </form>
      </li>
    )
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-sm">
      <div>
        <p className="font-medium text-fg">
          {expense.description}{' '}
          <span className="text-fg-muted">
            · <bdi>{formatAmount(expense.amount)}</bdi>
          </span>
        </p>
        <p className="mt-0.5 text-xs text-fg-muted">
          Incurred <bdi>{formatDate(expense.incurred_at, locale)}</bdi> · recorded by {expense.recorded_by_name}
        </p>
        <p className="mt-0.5 text-xs">
          {expense.reimbursed ? (
            <span className="text-success-text">
              Reimbursed {expense.reimbursed_at && <bdi>{formatDate(expense.reimbursed_at, locale)}</bdi>}
            </span>
          ) : (
            <span className="text-fg-muted">Not yet reimbursed</span>
          )}
        </p>
        {error && <FieldError>{error}</FieldError>}
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" onClick={handleToggleReimbursed} disabled={isPending}>
          {isPending ? 'Saving…' : expense.reimbursed ? 'Mark unreimbursed' : 'Mark reimbursed'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setIsEditing(true)}>
          Edit
        </Button>
        <Button type="button" variant="danger" onClick={handleDelete} disabled={isPending}>
          {isPending ? 'Deleting…' : confirmingDelete ? 'Confirm delete?' : 'Delete'}
        </Button>
        {confirmingDelete && !isPending && (
          <Button type="button" variant="ghost" onClick={() => setConfirmingDelete(false)}>
            Cancel
          </Button>
        )}
      </div>
    </li>
  )
}

export function ExpensesSection({
  caseId,
  expenses,
  totals,
}: {
  caseId: string
  expenses: Expense[]
  totals: ExpenseTotals
}) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await addExpense(caseId, formData)
      if (result.error) {
        setError(result.error)
        return
      }
      formRef.current?.reset()
    })
  }

  return (
    <Panel className="flex flex-col gap-3" data-testid="case-expenses-section">
      <div>
        <h2 className="font-heading text-lg text-fg">Expenses</h2>
        <p className="text-sm text-fg-muted">
          Costs the firm has paid out on this case - court fees, translation, expert fees - tracked
          separately from the agreed fee and marked when the client reimburses them.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="neutral">
          Incurred: <bdi>{formatAmount(totals.incurred)}</bdi>
        </Badge>
        <Badge variant="neutral">
          Reimbursed: <bdi>{formatAmount(totals.reimbursed)}</bdi>
        </Badge>
        <Badge variant={totals.outstanding > 0 ? 'accent' : 'muted'}>
          Outstanding: <bdi>{formatAmount(totals.outstanding)}</bdi>
        </Badge>
      </div>

      {expenses.length === 0 ? (
        <p className="text-sm text-fg-muted">No expenses recorded yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {expenses.map((expense) => (
            <ExpenseRow key={expense.id} caseId={caseId} expense={expense} />
          ))}
        </ul>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field>
          <Label htmlFor="expense-description" required>
            Description
          </Label>
          <input
            id="expense-description"
            name="description"
            placeholder="e.g. Court filing fee"
            className={controlClass}
          />
        </Field>
        <div className="flex flex-wrap gap-3">
          <Field>
            <Label htmlFor="expense-amount" required>
              Amount (JD)
            </Label>
            <input
              id="expense-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              className={controlClass}
            />
          </Field>
          <Field>
            <Label htmlFor="expense-incurred" required>
              Date incurred
            </Label>
            <input id="expense-incurred" name="incurred_at" type="date" className={controlClass} />
          </Field>
        </div>
        <div>
          <Button type="submit" variant="secondary" disabled={isPending}>
            {isPending ? 'Adding…' : 'Add expense'}
          </Button>
        </div>
      </form>
      {error && <FieldError>{error}</FieldError>}
    </Panel>
  )
}
