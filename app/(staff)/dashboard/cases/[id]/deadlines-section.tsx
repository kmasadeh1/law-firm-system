'use client'

import { UnverifiedBadge } from '@/components/dashboard/unverified-badge'
import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { createDeadline, extendDeadline, setDeadlineMet, type PeriodTypeOption } from '../../deadlines/actions'
import { urgencyOf, urgencyClass } from '../../deadlines/urgency'
import { Panel } from '@/components/dashboard/panel'
import { Button } from '@/components/dashboard/button'
import { Banner } from '@/components/dashboard/banner'
import { Field, Label, HelpText, FieldError, controlClass } from '@/components/dashboard/form'
import { localizedName } from '@/lib/localized-name'
import { formatDate } from '@/lib/format-date-time'
import { FreeText } from '@/components/free-text'

export type Deadline = {
  id: string
  trigger_date: string
  due_date: string | null
  unadjusted_due_date: string | null
  effective_due_date: string | null
  extended_due_date: string | null
  extension_reason: string | null
  extended_by_name: string | null
  extended_at: string | null
  completed_at: string | null
  completed_by_name: string | null
  description: string | null
  period_type_name: string
  period_days: number
  period_unverified: boolean
}

function DeadlineRow({
  caseId,
  deadline,
  canManage,
}: {
  caseId: string
  deadline: Deadline
  canManage: boolean
}) {
  const locale = useLocale()
  const t = useTranslations('dashboard.deadlines.section')
  const tCommon = useTranslations('dashboard.common')
  const tUrgency = useTranslations('dashboard.deadlines.urgency')
  const tForm = useTranslations('dashboard.deadlines.form')
  const [extending, setExtending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  const urgency = urgencyOf(deadline.effective_due_date, deadline.completed_at)
  const met = deadline.completed_at !== null
  const [isMarking, startMarking] = useTransition()

  function handleMet(next: boolean) {
    setError(null)
    startMarking(async () => {
      const result = await setDeadlineMet(caseId, deadline.id, next)
      if (result.error) setError(result.error)
    })
  }
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
    // id is the bell's link target (#deadline-<id>); scroll-mt clears the
    // sticky header, and :target highlights the row it lands on.
    <li
      id={`deadline-${deadline.id}`}
      className={`flex scroll-mt-20 flex-col gap-2 px-3 py-3 text-sm target:bg-accent-border/10 ${met ? 'bg-line/20' : ''}`}
      data-testid="deadline-row"
      data-met={met}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className={`font-medium ${met ? 'text-fg-muted' : 'text-fg'}`}>{deadline.period_type_name}</span>
          {deadline.period_unverified && (
            <>
              {' '}
              <UnverifiedBadge label={tCommon('unverified')} />
            </>
          )}
          <span className="text-fg-muted">
            {' '}
            {t.rich('periodDaysLine', {
              days: deadline.period_days,
              date: formatDate(deadline.trigger_date, locale),
              bdi: (chunks) => <bdi>{chunks}</bdi>,
            })}
          </span>
        </div>
        <span className="flex items-center gap-2">
          <span className="text-fg-muted">
            {deadline.effective_due_date ? <bdi>{formatDate(deadline.effective_due_date, locale)}</bdi> : '—'}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${urgencyClass[urgency]}`}
          >
            {tUrgency(urgency)}
          </span>
        </span>
      </div>

      {rolledForward && (
        <p className="text-xs text-fg-muted">
          {tForm.rich('weekendRollover', {
            unadjustedDate: formatDate(deadline.unadjusted_due_date!, locale),
            dueDate: formatDate(deadline.due_date!, locale),
            bdi: (chunks) => <bdi>{chunks}</bdi>,
          })}
        </p>
      )}

      {deadline.description && <FreeText as="p" className="text-fg-muted">{deadline.description}</FreeText>}

      {deadline.extended_due_date ? (
        <div className="rounded-md border border-accent-border/50 bg-accent-border/10 p-2 text-xs text-fg">
          <p>
            {t.rich('extendedToLine', {
              date: formatDate(deadline.extended_due_date, locale),
              originalDate: deadline.due_date ? formatDate(deadline.due_date, locale) : '',
              bdi: (chunks) => <bdi>{chunks}</bdi>,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
          <p className="mt-1 text-fg-muted">
            {t.rich('reasonLine', {
              reason: deadline.extension_reason ?? '',
              bdi: (chunks) => <bdi>{chunks}</bdi>,
            })}
            {deadline.extended_by_name &&
              t.rich('grantedByFragment', { name: deadline.extended_by_name, bdi: (chunks) => <bdi>{chunks}</bdi> })}
            {deadline.extended_at &&
              t.rich('onDateFragment', {
                date: formatDate(deadline.extended_at, locale),
                bdi: (chunks) => <bdi>{chunks}</bdi>,
              })}
          </p>
        </div>
      ) : null}

      {met && (
        <p className="text-xs text-fg-muted" data-testid="deadline-met-line">
          {deadline.completed_by_name
            ? t.rich('metLine', {
                date: formatDate(deadline.completed_at!, locale),
                name: deadline.completed_by_name,
                bdi: (chunks) => <bdi>{chunks}</bdi>,
              })
            : t.rich('metLineNoName', {
                date: formatDate(deadline.completed_at!, locale),
                bdi: (chunks) => <bdi>{chunks}</bdi>,
              })}
        </p>
      )}

      {/* Marking met records a fact for everyone on the case - not the
          bell's Dismiss, which only hides an alert for one person. Same
          gate as the rest of this section: can_manage_case_details. */}
      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          {met ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleMet(false)}
              disabled={isMarking}
              data-testid="deadline-unmark-met"
            >
              {isMarking ? t('saving') : t('unmarkMet')}
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleMet(true)}
              disabled={isMarking || isPending}
              data-testid="deadline-mark-met"
            >
              {isMarking ? t('saving') : t('markMet')}
            </Button>
          )}
        </div>
      )}

      {/* Extending a deadline that's already been met means nothing, so
          the control is only offered while it's pending. */}
      {canManage &&
        !met &&
        (extending ? (
          <form ref={formRef} onSubmit={handleExtend} className="flex flex-wrap items-end gap-2">
            <Field>
              <Label htmlFor={`extended-${deadline.id}`} required>
                {t('newDueDateLabel')}
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
                {t('reasonLabel')}
              </Label>
              <input id={`reason-${deadline.id}`} name="extension_reason" required className={controlClass} />
            </Field>
            <Button type="submit" variant="secondary" disabled={isPending}>
              {isPending ? t('saving') : t('saveExtension')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setExtending(false)} disabled={isPending}>
              {t('cancel')}
            </Button>
          </form>
        ) : (
          <Button type="button" variant="ghost" onClick={() => setExtending(true)} className="self-start">
            {deadline.extended_due_date ? t('changeExtension') : t('extend')}
          </Button>
        ))}

      {error && <FieldError>{error}</FieldError>}
    </li>
  )
}

export function DeadlinesSection({
  caseId,
  deadlines,
  periodTypes,
  canManage,
  // Hearings' "create appeal deadline" action reuses this same form instead
  // of building a second one - the draft lives in the shared parent
  // (CourtAndDeadlines) because it's set from a different section
  // (CourtSection) after this one has already mounted, so it has to be a
  // controlled value from above rather than a defaultValue this component
  // could only read once.
  triggerDate,
  onTriggerDateChange,
  sourceHearingId,
  onSubmitted,
}: {
  caseId: string
  deadlines: Deadline[]
  periodTypes: PeriodTypeOption[]
  canManage: boolean
  triggerDate: string
  onTriggerDateChange: (value: string) => void
  sourceHearingId: string | null
  onSubmitted: () => void
}) {
  const locale = useLocale()
  const t = useTranslations('dashboard.deadlines.section')
  const tCommon = useTranslations('dashboard.common')
  const tForm = useTranslations('dashboard.deadlines.form')
  const addFormRef = useRef<HTMLFormElement>(null)
  const periodSelectRef = useRef<HTMLSelectElement>(null)
  const [periodTypeId, setPeriodTypeId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectedPeriod = periodTypes.find((p) => p.id === periodTypeId) ?? null

  // "Create appeal deadline" (CourtSection, via the shared parent) sets
  // sourceHearingId to hand this form a prefilled trigger date - this form
  // is further down the page than the hearing that triggered it, so without
  // this the only visible effect is off-screen and the button reads as
  // dead. Brings the one field still left to choose into view and focuses
  // it, rather than opening a dialog or relocating the section.
  useEffect(() => {
    if (!sourceHearingId) return
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    periodSelectRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' })
    periodSelectRef.current?.focus()
  }, [sourceHearingId])

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
      onSubmitted()
    })
  }

  return (
    <Panel className="flex flex-col gap-3" data-testid="case-deadlines-section">
      <h2 className="font-heading text-lg text-fg">{t('heading')}</h2>

      {deadlines.length === 0 ? (
        <p className="text-sm text-fg-muted">{t('noneYet')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {deadlines.map((d) => (
            <DeadlineRow key={d.id} caseId={caseId} deadline={d} canManage={canManage} />
          ))}
        </ul>
      )}

      {canManage && (
      <form ref={addFormRef} onSubmit={handleAdd} className="flex flex-col gap-3">
        <input type="hidden" name="case_id" value={caseId} />
        {sourceHearingId && <input type="hidden" name="source_hearing_id" value={sourceHearingId} />}
        {sourceHearingId && <p className="text-xs text-fg-muted">{tForm('fromHearingNote')}</p>}
        <div className="flex flex-wrap items-end gap-2">
          <Field>
            <Label htmlFor="dl-period" required>
              {tForm('periodTypeLabel')}
            </Label>
            <select
              ref={periodSelectRef}
              id="dl-period"
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
                  {p.is_verified ? '' : ` (${tCommon('unverified')})`}
                </option>
              ))}
            </select>
            {selectedPeriod && !selectedPeriod.is_verified && <UnverifiedBadge label={tCommon('unverified')} />}
          </Field>
          <Field>
            <Label htmlFor="dl-trigger" required>
              {tForm('triggerDateLabel')}
            </Label>
            <input
              id="dl-trigger"
              name="trigger_date"
              type="date"
              required
              value={triggerDate}
              onChange={(e) => onTriggerDateChange(e.target.value)}
              className={controlClass}
            />
          </Field>
          <Button type="submit" variant="secondary" disabled={isPending}>
            {isPending ? tForm('adding') : tForm('addDeadline')}
          </Button>
        </div>
        {selectedPeriod?.description && <Banner kind="warning">{selectedPeriod.description}</Banner>}
        <HelpText>{tForm('triggerDateHelp')}</HelpText>
      </form>
      )}

      {error && <FieldError>{error}</FieldError>}

      <Link href="/dashboard/deadlines" className="text-xs text-fg-muted underline-offset-2 hover:underline">
        {t('viewAllDeadlines')}
      </Link>
    </Panel>
  )
}
