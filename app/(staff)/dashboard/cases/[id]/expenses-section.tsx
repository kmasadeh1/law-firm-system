'use client'

import { useRef, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
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
  const t = useTranslations('dashboard.cases.detail.expenses')

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
              {t('descriptionLabel')}
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
                {t('amountLabel')}
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
                {t('incurredLabel')}
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
              {isPending ? t('saving') : t('save')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setIsEditing(false)} disabled={isPending}>
              {t('cancel')}
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
          {t.rich('incurredLine', {
            date: formatDate(expense.incurred_at, locale),
            name: expense.recorded_by_name,
            bdi: (chunks) => <bdi>{chunks}</bdi>,
          })}
        </p>
        <p className="mt-0.5 text-xs">
          {expense.reimbursed ? (
            <span className="text-success-text">
              {expense.reimbursed_at &&
                t.rich('reimbursedOn', {
                  date: formatDate(expense.reimbursed_at, locale),
                  bdi: (chunks) => <bdi>{chunks}</bdi>,
                })}
            </span>
          ) : (
            <span className="text-fg-muted">{t('notYetReimbursed')}</span>
          )}
        </p>
        {error && <FieldError>{error}</FieldError>}
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" onClick={handleToggleReimbursed} disabled={isPending}>
          {isPending ? t('saving') : expense.reimbursed ? t('markUnreimbursed') : t('markReimbursed')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setIsEditing(true)}>
          {t('edit')}
        </Button>
        <Button type="button" variant="danger" onClick={handleDelete} disabled={isPending}>
          {isPending ? t('deleting') : confirmingDelete ? t('confirmDelete') : t('delete')}
        </Button>
        {confirmingDelete && !isPending && (
          <Button type="button" variant="ghost" onClick={() => setConfirmingDelete(false)}>
            {t('cancel')}
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
  const t = useTranslations('dashboard.cases.detail.expenses')

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
        <h2 className="font-heading text-lg text-fg">{t('heading')}</h2>
        <p className="text-sm text-fg-muted">{t('description')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="neutral">
          {t('incurredBadge')} <bdi>{formatAmount(totals.incurred)}</bdi>
        </Badge>
        <Badge variant="neutral">
          {t('reimbursedBadge')} <bdi>{formatAmount(totals.reimbursed)}</bdi>
        </Badge>
        <Badge variant={totals.outstanding > 0 ? 'accent' : 'muted'}>
          {t('outstandingBadge')} <bdi>{formatAmount(totals.outstanding)}</bdi>
        </Badge>
      </div>

      {expenses.length === 0 ? (
        <p className="text-sm text-fg-muted">{t('noExpensesYet')}</p>
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
            {t('descriptionLabel')}
          </Label>
          <input
            id="expense-description"
            name="description"
            placeholder={t('descriptionPlaceholder')}
            className={controlClass}
          />
        </Field>
        <div className="flex flex-wrap gap-3">
          <Field>
            <Label htmlFor="expense-amount" required>
              {t('amountLabel')}
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
              {t('incurredLabel')}
            </Label>
            <input id="expense-incurred" name="incurred_at" type="date" className={controlClass} />
          </Field>
        </div>
        <div>
          <Button type="submit" variant="secondary" disabled={isPending}>
            {isPending ? t('adding') : t('addExpense')}
          </Button>
        </div>
      </form>
      {error && <FieldError>{error}</FieldError>}
    </Panel>
  )
}
