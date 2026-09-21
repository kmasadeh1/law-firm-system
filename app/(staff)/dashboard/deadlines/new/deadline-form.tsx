'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { createDeadline, type DeadlineRow, type PeriodTypeOption } from '../actions'
import { CasePicker } from '../case-picker'
import { Field, Label, HelpText, FieldError, controlClass } from '@/components/dashboard/form'
import { Button } from '@/components/dashboard/button'
import { Banner } from '@/components/dashboard/banner'
import { Panel } from '@/components/dashboard/panel'
import { ChevronLeftIcon } from '@/components/dashboard/icons'

export function DeadlineForm({ periodTypes }: { periodTypes: PeriodTypeOption[] }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [periodTypeId, setPeriodTypeId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DeadlineRow | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectedPeriod = periodTypes.find((p) => p.id === periodTypeId) ?? null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)
    const formData = new FormData(formRef.current!)

    startTransition(async () => {
      const res = await createDeadline(formData)
      if (res.error) {
        setError(res.error)
        return
      }
      if (res.deadline) {
        setResult(res.deadline)
        formRef.current?.reset()
        setPeriodTypeId('')
      }
    })
  }

  if (result) {
    const rolledForward =
      result.unadjusted_due_date !== null &&
      result.due_date !== null &&
      result.unadjusted_due_date !== result.due_date

    return (
      <Panel className="flex flex-col gap-3">
        <h2 className="font-heading text-lg text-fg">Deadline added</h2>
        <p className="flex flex-wrap items-center gap-1 text-sm text-fg">
          Trigger date <bdi>{result.trigger_date}</bdi>
          {/* Forward/progression, same direction as the "Older" pagination
              chevron - rotated by default (points right under ltr) and
              unrotated under rtl (points left). */}
          <ChevronLeftIcon className="h-3 w-3 rotate-180 rtl:rotate-0" />
          due <bdi><strong>{result.due_date}</strong></bdi>
        </p>
        {rolledForward && (
          <Banner kind="warning">
            Falls on a weekend ({result.unadjusted_due_date}) — moved to {result.due_date}.
          </Banner>
        )}
        {result.effective_due_date !== result.due_date && (
          <p className="text-sm text-fg-muted">
            Effective due date (after any extension): {result.effective_due_date}
          </p>
        )}
        <div className="flex gap-3">
          <Link
            href={`/dashboard/cases/${result.case_id}`}
            className="text-sm text-accent underline-offset-2 hover:underline"
          >
            Go to case
          </Link>
          <button
            type="button"
            onClick={() => setResult(null)}
            className="text-sm text-fg-muted underline-offset-2 hover:underline"
          >
            Add another
          </button>
        </div>
      </Panel>
    )
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <CasePicker />

      <Field>
        <Label htmlFor="period_type_id" required>
          Period type
        </Label>
        <select
          id="period_type_id"
          name="period_type_id"
          required
          value={periodTypeId}
          onChange={(e) => setPeriodTypeId(e.target.value)}
          className={controlClass}
        >
          <option value="">Select a period type…</option>
          {periodTypes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.period_days} days)
            </option>
          ))}
        </select>
      </Field>

      {selectedPeriod?.description && (
        <Banner kind="warning">{selectedPeriod.description}</Banner>
      )}

      <Field>
        <Label htmlFor="trigger_date" required>
          Trigger date
        </Label>
        <input id="trigger_date" name="trigger_date" type="date" required className={controlClass} />
        <HelpText>
          The due date is computed by the database from this date and the period type - it isn&apos;t
          entered directly.
        </HelpText>
      </Field>

      <Field>
        <Label htmlFor="description">Notes</Label>
        <textarea id="description" name="description" rows={2} className={controlClass} />
      </Field>

      {error && <FieldError>{error}</FieldError>}

      <Button type="submit" variant="primary" disabled={isPending} className="mt-2 self-start">
        {isPending ? 'Adding…' : 'Add deadline'}
      </Button>
    </form>
  )
}
