'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { createDeadline, extendDeadline, type PeriodTypeOption } from '../../deadlines/actions'
import { urgencyOf, urgencyClass, urgencyLabel } from '../../deadlines/urgency'
import { Panel } from '@/components/dashboard/panel'
import { Button } from '@/components/dashboard/button'
import { Banner } from '@/components/dashboard/banner'
import { Field, Label, HelpText, FieldError, controlClass } from '@/components/dashboard/form'
import { localizedName } from '@/lib/localized-name'

type Deadline = {
  id: string
  trigger_date: string
  due_date: string | null
  unadjusted_due_date: string | null
  effective_due_date: string | null
  extended_due_date: string | null
  extension_reason: string | null
  extended_by_name: string | null
  extended_at: string | null
  description: string | null
  period_type_name: string
  period_days: number
}

function DeadlineRow({ caseId, deadline }: { caseId: string; deadline: Deadline }) {
  const [extending, setExtending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  const urgency = urgencyOf(deadline.effective_due_date)
  const rolledForward =
    deadline.unadjusted_due_date !== null &&
    deadline.due_date !== null &&
    deadline.unadjusted_due_date !== deadline.due_date

  function handleExtend(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await extendDeadline(caseId, deadline.id, formData)
      if (result.error) {
        setError(result.error)
        return
      }
      setExtending(false)
    })
  }

  return (
    <li className="flex flex-col gap-2 px-3 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium text-fg">{deadline.period_type_name}</span>
          <span className="text-fg-muted"> ({deadline.period_days} days) · trigger {deadline.trigger_date}</span>
        </div>
        <span className="flex items-center gap-2">
          <span className="text-fg-muted">{deadline.effective_due_date ?? '—'}</span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${urgencyClass[urgency]}`}
          >
            {urgencyLabel[urgency]}
          </span>
        </span>
      </div>

      {rolledForward && (
        <p className="text-xs text-fg-muted">
          Falls on a weekend ({deadline.unadjusted_due_date}) — moved to {deadline.due_date}.
        </p>
      )}

      {deadline.description && <p className="text-fg-muted">{deadline.description}</p>}

      {deadline.extended_due_date ? (
        <div className="rounded-md border border-accent-border/50 bg-accent-border/10 p-2 text-xs text-fg">
          <p>
            Extended to <strong>{deadline.extended_due_date}</strong> (originally {deadline.due_date})
          </p>
          <p className="mt-1 text-fg-muted">
            Reason: {deadline.extension_reason}
            {deadline.extended_by_name && ` · granted by ${deadline.extended_by_name}`}
            {deadline.extended_at && ` on ${deadline.extended_at.slice(0, 10)}`}
          </p>
        </div>
      ) : null}

      {extending ? (
        <form ref={formRef} onSubmit={handleExtend} className="flex flex-wrap items-end gap-2">
          <Field>
            <Label htmlFor={`extended-${deadline.id}`} required>
              New due date
            </Label>
            <input
              id={`extended-${deadline.id}`}
              name="extended_due_date"
              type="date"
              required
              className={controlClass}
            />
          </Field>
          <Field>
            <Label htmlFor={`reason-${deadline.id}`} required>
              Reason
            </Label>
            <input id={`reason-${deadline.id}`} name="extension_reason" required className={controlClass} />
          </Field>
          <Button type="submit" variant="secondary" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save extension'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setExtending(false)} disabled={isPending}>
            Cancel
          </Button>
        </form>
      ) : (
        <Button type="button" variant="ghost" onClick={() => setExtending(true)} className="self-start">
          {deadline.extended_due_date ? 'Change extension' : 'Extend'}
        </Button>
      )}

      {error && <FieldError>{error}</FieldError>}
    </li>
  )
}

export function DeadlinesSection({
  caseId,
  deadlines,
  periodTypes,
}: {
  caseId: string
  deadlines: Deadline[]
  periodTypes: PeriodTypeOption[]
}) {
  const locale = useLocale()
  const addFormRef = useRef<HTMLFormElement>(null)
  const [periodTypeId, setPeriodTypeId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectedPeriod = periodTypes.find((p) => p.id === periodTypeId) ?? null

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(addFormRef.current!)
    startTransition(async () => {
      const result = await createDeadline(formData)
      if (result.error) {
        setError(result.error)
        return
      }
      addFormRef.current?.reset()
      setPeriodTypeId('')
    })
  }

  return (
    <Panel className="flex flex-col gap-3" data-testid="case-deadlines-section">
      <h2 className="font-heading text-lg text-fg">Deadlines</h2>

      {deadlines.length === 0 ? (
        <p className="text-sm text-fg-muted">No deadlines yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {deadlines.map((d) => (
            <DeadlineRow key={d.id} caseId={caseId} deadline={d} />
          ))}
        </ul>
      )}

      <form ref={addFormRef} onSubmit={handleAdd} className="flex flex-col gap-3">
        <input type="hidden" name="case_id" value={caseId} />
        <div className="flex flex-wrap items-end gap-2">
          <Field>
            <Label htmlFor="dl-period" required>
              Period type
            </Label>
            <select
              id="dl-period"
              name="period_type_id"
              required
              value={periodTypeId}
              onChange={(e) => setPeriodTypeId(e.target.value)}
              className={controlClass}
            >
              <option value="">Select…</option>
              {periodTypes.map((p) => (
                <option key={p.id} value={p.id}>
                  {localizedName(p, locale)} ({p.period_days} days)
                </option>
              ))}
            </select>
          </Field>
          <Field>
            <Label htmlFor="dl-trigger" required>
              Trigger date
            </Label>
            <input id="dl-trigger" name="trigger_date" type="date" required className={controlClass} />
          </Field>
          <Button type="submit" variant="secondary" disabled={isPending}>
            {isPending ? 'Adding…' : 'Add deadline'}
          </Button>
        </div>
        {selectedPeriod?.description && <Banner kind="warning">{selectedPeriod.description}</Banner>}
        <HelpText>Due date is computed from the trigger date and period type - not entered directly.</HelpText>
      </form>

      {error && <FieldError>{error}</FieldError>}

      <Link href="/dashboard/deadlines" className="text-xs text-fg-muted underline-offset-2 hover:underline">
        View all deadlines
      </Link>
    </Panel>
  )
}
