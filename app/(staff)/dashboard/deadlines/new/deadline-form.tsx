'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { createDeadline, type DeadlineRow, type PeriodTypeOption } from '../actions'
import { CasePicker } from '../case-picker'
import { Field, Label, HelpText, FieldError, controlClass } from '@/components/dashboard/form'
import { Button } from '@/components/dashboard/button'
import { Banner } from '@/components/dashboard/banner'
import { Panel } from '@/components/dashboard/panel'
import { ChevronLeftIcon } from '@/components/dashboard/icons'
import { localizedName } from '@/lib/localized-name'
import { formatDate } from '@/lib/format-date-time'

export function DeadlineForm({ periodTypes }: { periodTypes: PeriodTypeOption[] }) {
  const locale = useLocale()
  const t = useTranslations('dashboard.deadlines.new')
  const tForm = useTranslations('dashboard.deadlines.form')
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
        <h2 className="font-heading text-lg text-fg">{t('resultHeading')}</h2>
        <p className="flex flex-wrap items-center gap-1 text-sm text-fg">
          {t.rich('resultLine', {
            trigger: formatDate(result.trigger_date, locale),
            due: formatDate(result.due_date!, locale),
            bdi: (chunks) => <bdi>{chunks}</bdi>,
            strong: (chunks) => <strong>{chunks}</strong>,
            // Forward/progression, same direction as the "Older" pagination
            // chevron - rotated by default (points right under ltr) and
            // unrotated under rtl (points left).
            icon: () => <ChevronLeftIcon className="h-3 w-3 rotate-180 rtl:rotate-0" />,
          })}
        </p>
        {rolledForward && (
          <Banner kind="warning">
            {tForm.rich('weekendRollover', {
              unadjustedDate: formatDate(result.unadjusted_due_date!, locale),
              dueDate: formatDate(result.due_date!, locale),
              bdi: (chunks) => <bdi>{chunks}</bdi>,
            })}
          </Banner>
        )}
        {result.effective_due_date !== result.due_date && (
          <p className="text-sm text-fg-muted">
            {t.rich('effectiveDueDateLine', {
              date: formatDate(result.effective_due_date!, locale),
              bdi: (chunks) => <bdi>{chunks}</bdi>,
            })}
          </p>
        )}
        <div className="flex gap-3">
          <Link
            href={`/dashboard/cases/${result.case_id}`}
            className="text-sm text-accent underline-offset-2 hover:underline"
          >
            {t('goToCase')}
          </Link>
          <button
            type="button"
            onClick={() => setResult(null)}
            className="text-sm text-fg-muted underline-offset-2 hover:underline"
          >
            {t('addAnother')}
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
          {tForm('periodTypeLabel')}
        </Label>
        <select
          id="period_type_id"
          name="period_type_id"
          required
          value={periodTypeId}
          onChange={(e) => setPeriodTypeId(e.target.value)}
          className={controlClass}
        >
          <option value="">{tForm('selectPeriodTypePlaceholder')}</option>
          {periodTypes.map((p) => (
            <option key={p.id} value={p.id}>
              {tForm('periodOptionLabel', { name: localizedName(p, locale), days: p.period_days })}
            </option>
          ))}
        </select>
      </Field>

      {selectedPeriod?.description && (
        <Banner kind="warning">{selectedPeriod.description}</Banner>
      )}

      <Field>
        <Label htmlFor="trigger_date" required>
          {tForm('triggerDateLabel')}
        </Label>
        <input id="trigger_date" name="trigger_date" type="date" required className={controlClass} />
        <HelpText>{tForm('triggerDateHelp')}</HelpText>
      </Field>

      <Field>
        <Label htmlFor="description">{tForm('notesLabel')}</Label>
        <textarea id="description" name="description" rows={2} className={controlClass} />
      </Field>

      {error && <FieldError>{error}</FieldError>}

      <Button type="submit" variant="primary" disabled={isPending} className="mt-2 self-start">
        {isPending ? tForm('adding') : tForm('addDeadline')}
      </Button>
    </form>
  )
}
