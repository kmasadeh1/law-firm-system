'use client'

import { useRef, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { addHearing, removeHearing, updateHearing, type HearingErrorCode, type HearingOutcome } from '../actions'
import { Button } from '@/components/dashboard/button'
import { Field, Label, FieldError, FieldSuccess, controlClass } from '@/components/dashboard/form'
import { Badge } from '@/components/dashboard/badge'
import { DeleteConfirmDialog } from '@/components/dashboard/delete-confirm-dialog'
import { formatDate, formatTimeOfDay } from '@/lib/format-date-time'

export type Hearing = {
  id: string
  session_date: string
  session_time: string | null
  outcome: HearingOutcome | null
  what_happened: string | null
  decision: string | null
  next_session_date: string | null
  attended_by: string | null
  notified_at: string | null
}

type StaffOption = { id: string; full_name: string }

const HEARING_OUTCOMES: HearingOutcome[] = [
  'adjourned',
  'evidence',
  'pleadings',
  'reserved_for_judgment',
  'judgment',
  'settled',
  'withdrawn',
  'struck_out',
  'other',
]

// Closed set the server can return - anything else falls back to a generic
// translated message rather than passing an arbitrary value to t() as a key.
const HEARING_ERROR_CODES: HearingErrorCode[] = [
  'sessionDateRequired',
  'notifiedBeforeSession',
  'nextSessionNotAfterSession',
  'invalidAttendee',
  'noPermission',
  'addFailed',
  'updateFailed',
  'removeFailed',
]

// notified_at (التبليغ - the notification date) is only meaningful once a
// judgment exists or is pending - the field is display logic, not a rule the
// database enforces (it accepts notified_at on any row), so this list is
// just what this form chooses to show, never validated server-side.
const OUTCOMES_NEEDING_NOTIFICATION: HearingOutcome[] = ['judgment', 'reserved_for_judgment']

function OutcomeSelect({
  id,
  value,
  onChange,
  tOutcome,
  placeholder,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  tOutcome: ReturnType<typeof useTranslations>
  placeholder: string
}) {
  return (
    <select id={id} name="outcome" value={value} onChange={(e) => onChange(e.target.value)} className={controlClass}>
      <option value="">{placeholder}</option>
      {HEARING_OUTCOMES.map((o) => (
        <option key={o} value={o}>
          {tOutcome(o)}
        </option>
      ))}
    </select>
  )
}

// Same shape as the Team section's own staff <select> (team-section.tsx) -
// a real empty option, since attended_by is nullable and optional, rather
// than a free-text box a user could type an unrelated name into. Mirrors
// OutcomeSelect above.
function AttendedBySelect({
  id,
  staffOptions,
  defaultValue,
  placeholder,
}: {
  id: string
  staffOptions: StaffOption[]
  defaultValue?: string
  placeholder: string
}) {
  return (
    <select id={id} name="attended_by" defaultValue={defaultValue ?? ''} className={controlClass}>
      <option value="">{placeholder}</option>
      {staffOptions.map((s) => (
        <option key={s.id} value={s.id}>
          {s.full_name}
        </option>
      ))}
    </select>
  )
}

function HearingRow({
  caseId,
  filingId,
  hearing,
  canManage,
  staffOptions,
  onCreateAppealDeadline,
  onAddNextHearing,
}: {
  caseId: string
  filingId: string
  hearing: Hearing
  canManage: boolean
  staffOptions: StaffOption[]
  onCreateAppealDeadline: (prefill: { trigger_date: string; source_hearing_id: string }) => void
  onAddNextHearing: (sessionDate: string) => void
}) {
  const locale = useLocale()
  const t = useTranslations('dashboard.cases.detail.hearings')
  const tOutcome = useTranslations('dashboard.cases.detail.hearings.outcome')
  const tErrors = useTranslations('dashboard.cases.detail.hearings.errors')
  const formRef = useRef<HTMLFormElement>(null)
  const [outcome, setOutcome] = useState(hearing.outcome ?? '')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, startSave] = useTransition()
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [isRemoving, startRemove] = useTransition()
  const [removeError, setRemoveError] = useState<string | null>(null)

  function resolveError(code: HearingErrorCode) {
    return (HEARING_ERROR_CODES as string[]).includes(code) ? tErrors(code) : tErrors('generic')
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    const formData = new FormData(formRef.current!)
    startSave(async () => {
      const result = await updateHearing(caseId, filingId, hearing.id, formData)
      if (result.error) {
        setError(resolveError(result.error))
        return
      }
      setSaved(true)
    })
  }

  function handleRemove() {
    setConfirmingRemove(false)
    startRemove(async () => {
      const result = await removeHearing(caseId, filingId, hearing.id)
      if (result.error) {
        setRemoveError(resolveError(result.error))
      }
    })
  }

  const showNotifiedField = OUTCOMES_NEEDING_NOTIFICATION.includes(outcome as HearingOutcome)
  const isJudgment = hearing.outcome === 'judgment'

  if (!canManage) {
    return (
      <li className="flex flex-col gap-1 px-3 py-2 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-fg">{formatDate(hearing.session_date, locale)}</span>
          {hearing.session_time && <span className="text-fg-muted">{formatTimeOfDay(hearing.session_time, locale)}</span>}
          {hearing.outcome && <Badge variant="neutral">{tOutcome(hearing.outcome)}</Badge>}
        </div>
        {hearing.what_happened && <p className="text-fg-muted">{hearing.what_happened}</p>}
        {hearing.decision && (
          <p className="text-fg-muted">
            {t.rich('decisionLine', { decision: hearing.decision, bdi: (chunks) => <bdi>{chunks}</bdi> })}
          </p>
        )}
        {hearing.next_session_date && (
          <p className="text-xs text-fg-muted" data-testid="hearing-next-session">
            {t.rich('nextSessionLine', {
              date: formatDate(hearing.next_session_date, locale),
              bdi: (chunks) => <bdi>{chunks}</bdi>,
            })}
          </p>
        )}
        {isJudgment && !hearing.notified_at && (
          <p className="text-xs text-fg-muted">{t('notificationNeededPrompt')}</p>
        )}
      </li>
    )
  }

  return (
    <li className="flex flex-col gap-3 px-3 py-3 text-sm">
      <form ref={formRef} onSubmit={handleSave} className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <Field>
            <Label htmlFor={`h-date-${hearing.id}`} required>
              {t('sessionDateLabel')}
            </Label>
            <input
              id={`h-date-${hearing.id}`}
              name="session_date"
              type="date"
              required
              defaultValue={hearing.session_date}
              className={controlClass}
            />
          </Field>
          <Field>
            <Label htmlFor={`h-time-${hearing.id}`}>{t('sessionTimeLabel')}</Label>
            <input
              id={`h-time-${hearing.id}`}
              name="session_time"
              type="time"
              defaultValue={hearing.session_time ?? ''}
              className={controlClass}
            />
          </Field>
          <Field>
            <Label htmlFor={`h-outcome-${hearing.id}`}>{t('outcomeLabel')}</Label>
            <OutcomeSelect
              id={`h-outcome-${hearing.id}`}
              value={outcome}
              onChange={setOutcome}
              tOutcome={tOutcome}
              placeholder={t('outcomeNotYetPlaceholder')}
            />
          </Field>
        </div>
        <Field>
          <Label htmlFor={`h-what-${hearing.id}`}>{t('whatHappenedLabel')}</Label>
          <textarea
            id={`h-what-${hearing.id}`}
            name="what_happened"
            rows={2}
            defaultValue={hearing.what_happened ?? ''}
            className={controlClass}
          />
        </Field>
        <Field>
          <Label htmlFor={`h-decision-${hearing.id}`}>{t('decisionLabel')}</Label>
          <textarea
            id={`h-decision-${hearing.id}`}
            name="decision"
            rows={2}
            defaultValue={hearing.decision ?? ''}
            className={controlClass}
          />
        </Field>
        <div className="flex flex-wrap gap-3">
          <Field>
            <Label htmlFor={`h-next-${hearing.id}`}>{t('nextSessionDateLabel')}</Label>
            <input
              id={`h-next-${hearing.id}`}
              name="next_session_date"
              type="date"
              defaultValue={hearing.next_session_date ?? ''}
              className={controlClass}
            />
          </Field>
          <Field>
            <Label htmlFor={`h-attended-${hearing.id}`}>{t('attendedByLabel')}</Label>
            <AttendedBySelect
              id={`h-attended-${hearing.id}`}
              staffOptions={staffOptions}
              defaultValue={hearing.attended_by ?? ''}
              placeholder={t('attendedByPlaceholder')}
            />
          </Field>
          {showNotifiedField && (
            <Field>
              <Label htmlFor={`h-notified-${hearing.id}`}>{t('notifiedAtLabel')}</Label>
              <input
                id={`h-notified-${hearing.id}`}
                name="notified_at"
                type="date"
                defaultValue={hearing.notified_at ?? ''}
                className={controlClass}
              />
            </Field>
          )}
        </div>
        {error && <FieldError>{error}</FieldError>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="secondary" disabled={isSaving}>
            {isSaving ? t('saving') : t('save')}
          </Button>
          <FieldSuccess show={saved}>{t('saved')}</FieldSuccess>
          <div className="grow" />
          <Button type="button" variant="danger" disabled={isRemoving} onClick={() => setConfirmingRemove(true)}>
            {isRemoving ? t('removing') : t('remove')}
          </Button>
        </div>
        {removeError && <FieldError>{removeError}</FieldError>}
      </form>

      {isJudgment &&
        (hearing.notified_at ? (
          <Button
            type="button"
            variant="ghost"
            className="self-start"
            data-testid="create-appeal-deadline-button"
            onClick={() => onCreateAppealDeadline({ trigger_date: hearing.notified_at!, source_hearing_id: hearing.id })}
          >
            {t('createAppealDeadline')}
          </Button>
        ) : (
          <p className="text-xs text-fg-muted">{t('notificationNeededPrompt')}</p>
        ))}

      {hearing.next_session_date && (
        <Button
          type="button"
          variant="ghost"
          className="self-start"
          data-testid="add-next-hearing-button"
          onClick={() => onAddNextHearing(hearing.next_session_date!)}
        >
          {t('addNextHearing')}
        </Button>
      )}

      <DeleteConfirmDialog
        open={confirmingRemove}
        onCancel={() => setConfirmingRemove(false)}
        onConfirm={handleRemove}
        kind="hard"
        itemLabel={formatDate(hearing.session_date, locale)}
        confirmLabel={t('remove')}
      />
    </li>
  )
}

export function HearingsList({
  caseId,
  filingId,
  hearings,
  canManage,
  staffOptions,
  onCreateAppealDeadline,
}: {
  caseId: string
  filingId: string
  hearings: Hearing[]
  canManage: boolean
  staffOptions: StaffOption[]
  onCreateAppealDeadline: (prefill: { trigger_date: string; source_hearing_id: string }) => void
}) {
  const t = useTranslations('dashboard.cases.detail.hearings')
  const tOutcome = useTranslations('dashboard.cases.detail.hearings.outcome')
  const tErrors = useTranslations('dashboard.cases.detail.hearings.errors')
  const formRef = useRef<HTMLFormElement>(null)
  const [sessionDate, setSessionDate] = useState('')
  const [outcome, setOutcome] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function resolveError(code: HearingErrorCode) {
    return (HEARING_ERROR_CODES as string[]).includes(code) ? tErrors(code) : tErrors('generic')
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await addHearing(caseId, filingId, formData)
      if (result.error) {
        setError(resolveError(result.error))
        return
      }
      formRef.current?.reset()
      setSessionDate('')
      setOutcome('')
    })
  }

  const showNotifiedField = OUTCOMES_NEEDING_NOTIFICATION.includes(outcome as HearingOutcome)

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <h3 className="text-sm font-semibold text-fg">{t('heading')}</h3>

      {hearings.length === 0 ? (
        <p className="text-sm text-fg-muted">{t('noneYet')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {hearings.map((h) => (
            <HearingRow
              key={h.id}
              caseId={caseId}
              filingId={filingId}
              hearing={h}
              canManage={canManage}
              staffOptions={staffOptions}
              onCreateAppealDeadline={onCreateAppealDeadline}
              onAddNextHearing={(date) => setSessionDate(date)}
            />
          ))}
        </ul>
      )}

      {canManage && (
        <form ref={formRef} onSubmit={handleAdd} className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <Field>
              <Label htmlFor={`new-h-date-${filingId}`} required>
                {t('sessionDateLabel')}
              </Label>
              <input
                id={`new-h-date-${filingId}`}
                name="session_date"
                type="date"
                required
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className={controlClass}
              />
            </Field>
            <Field>
              <Label htmlFor={`new-h-time-${filingId}`}>{t('sessionTimeLabel')}</Label>
              <input id={`new-h-time-${filingId}`} name="session_time" type="time" className={controlClass} />
            </Field>
            <Field>
              <Label htmlFor={`new-h-outcome-${filingId}`}>{t('outcomeLabel')}</Label>
              <OutcomeSelect
                id={`new-h-outcome-${filingId}`}
                value={outcome}
                onChange={setOutcome}
                tOutcome={tOutcome}
                placeholder={t('outcomeNotYetPlaceholder')}
              />
            </Field>
          </div>
          <Field>
            <Label htmlFor={`new-h-what-${filingId}`}>{t('whatHappenedLabel')}</Label>
            <textarea id={`new-h-what-${filingId}`} name="what_happened" rows={2} className={controlClass} />
          </Field>
          <Field>
            <Label htmlFor={`new-h-decision-${filingId}`}>{t('decisionLabel')}</Label>
            <textarea id={`new-h-decision-${filingId}`} name="decision" rows={2} className={controlClass} />
          </Field>
          <div className="flex flex-wrap gap-3">
            <Field>
              <Label htmlFor={`new-h-next-${filingId}`}>{t('nextSessionDateLabel')}</Label>
              <input id={`new-h-next-${filingId}`} name="next_session_date" type="date" className={controlClass} />
            </Field>
            <Field>
              <Label htmlFor={`new-h-attended-${filingId}`}>{t('attendedByLabel')}</Label>
              <AttendedBySelect
                id={`new-h-attended-${filingId}`}
                staffOptions={staffOptions}
                placeholder={t('attendedByPlaceholder')}
              />
            </Field>
            {showNotifiedField && (
              <Field>
                <Label htmlFor={`new-h-notified-${filingId}`}>{t('notifiedAtLabel')}</Label>
                <input id={`new-h-notified-${filingId}`} name="notified_at" type="date" className={controlClass} />
              </Field>
            )}
          </div>
          {error && <FieldError>{error}</FieldError>}
          <Button type="submit" variant="secondary" data-testid="hearing-add-button" disabled={isPending} className="self-start">
            {isPending ? t('adding') : t('add')}
          </Button>
        </form>
      )}
    </div>
  )
}
