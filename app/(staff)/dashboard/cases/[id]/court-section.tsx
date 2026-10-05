'use client'

import { useRef, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { addCourtFiling, removeCourtFiling, updateCourtFiling, type CourtFilingErrorCode } from '../actions'
import { Panel } from '@/components/dashboard/panel'
import { Button } from '@/components/dashboard/button'
import { Field, Label, FieldError, FieldSuccess, controlClass } from '@/components/dashboard/form'
import { Badge } from '@/components/dashboard/badge'
import { DeleteConfirmDialog } from '@/components/dashboard/delete-confirm-dialog'
import { localizedName } from '@/lib/localized-name'
import { formatDate } from '@/lib/format-date-time'
import { HearingsList, type Hearing } from './hearings-list'

type StaffOption = { id: string; full_name: string }

export type CourtOption = { id: string; name_en: string | null; name_ar: string | null }

export type CourtFiling = {
  id: string
  court_id: string
  court: CourtOption
  court_case_number: string | null
  chamber: string | null
  judge_name: string | null
  filed_at: string | null
  is_current: boolean
  notes: string | null
  hearings: Hearing[]
}

export type AppealDeadlinePrefill = { trigger_date: string; source_hearing_id: string }

// Closed set the server can return - anything else falls back to a generic
// translated message rather than passing an arbitrary value to t() as a key.
const COURT_FILING_ERROR_CODES: CourtFilingErrorCode[] = [
  'selectCourt',
  'noPermission',
  'addFailed',
  'updateFailed',
  'removeFailed',
]

// The add form's own picker only offers active courts (courts prop); an
// existing filing's court may since have been deactivated, and must still
// appear as its own row's selection rather than silently disappearing from
// that row's dropdown.
function optionsFor(courts: CourtOption[], current: CourtOption) {
  return courts.some((c) => c.id === current.id) ? courts : [...courts, current]
}

function CourtSelect({
  id,
  courts,
  defaultValue,
  locale,
  placeholder,
}: {
  id: string
  courts: CourtOption[]
  defaultValue?: string
  locale: string
  placeholder: string
}) {
  return (
    <select id={id} name="court_id" required defaultValue={defaultValue ?? ''} className={controlClass}>
      <option value="" disabled>
        {placeholder}
      </option>
      {courts.map((c) => (
        <option key={c.id} value={c.id}>
          {localizedName({ name: c.name_en ?? '', name_ar: c.name_ar }, locale)}
        </option>
      ))}
    </select>
  )
}

function FilingRow({
  caseId,
  filing,
  courts,
  canManage,
  staffOptions,
  onCreateAppealDeadline,
}: {
  caseId: string
  filing: CourtFiling
  courts: CourtOption[]
  canManage: boolean
  staffOptions: StaffOption[]
  onCreateAppealDeadline: (prefill: AppealDeadlinePrefill) => void
}) {
  const locale = useLocale()
  const t = useTranslations('dashboard.cases.detail.courtFilings')
  const tErrors = useTranslations('dashboard.cases.detail.courtFilings.errors')
  const formRef = useRef<HTMLFormElement>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, startSave] = useTransition()
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [isRemoving, startRemove] = useTransition()

  function resolveError(code: CourtFilingErrorCode) {
    return (COURT_FILING_ERROR_CODES as string[]).includes(code) ? tErrors(code) : tErrors('generic')
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    const formData = new FormData(formRef.current!)
    startSave(async () => {
      const result = await updateCourtFiling(caseId, filing.id, formData)
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
      const result = await removeCourtFiling(caseId, filing.id)
      if (result.error) {
        setRemoveError(resolveError(result.error))
      }
    })
  }

  const courtName = localizedName({ name: filing.court.name_en ?? '', name_ar: filing.court.name_ar }, locale)

  if (!canManage) {
    return (
      <li className="flex flex-col gap-1 px-3 py-2 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-fg">
            <bdi>{courtName}</bdi>
          </span>
          {filing.court_case_number && (
            <span className="text-fg-muted" dir="ltr">
              {filing.court_case_number}
            </span>
          )}
          {filing.is_current && (
            <Badge variant="accent">
              <bdi>{t('current')}</bdi>
            </Badge>
          )}
        </div>
        <span className="text-fg-muted">
          {filing.chamber && <bdi>{filing.chamber}</bdi>}
          {filing.chamber && filing.judge_name && ' · '}
          {filing.judge_name && <bdi>{filing.judge_name}</bdi>}
        </span>
        {filing.filed_at && (
          <span className="text-xs text-fg-muted">{t('filedOn', { date: formatDate(filing.filed_at, locale) })}</span>
        )}
        {filing.notes && <p className="text-fg-muted">{filing.notes}</p>}

        <HearingsList
          caseId={caseId}
          filingId={filing.id}
          hearings={filing.hearings}
          canManage={false}
          staffOptions={staffOptions}
          onCreateAppealDeadline={onCreateAppealDeadline}
        />
      </li>
    )
  }

  return (
    <li className="flex flex-col gap-3 px-3 py-3 text-sm">
      <form ref={formRef} onSubmit={handleSave} className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <Field>
            <Label htmlFor={`cf-court-${filing.id}`} required>
              {t('courtLabel')}
            </Label>
            <CourtSelect
              id={`cf-court-${filing.id}`}
              courts={optionsFor(courts, filing.court)}
              defaultValue={filing.court_id}
              locale={locale}
              placeholder={t('selectCourtPlaceholder')}
            />
          </Field>
          <Field>
            <Label htmlFor={`cf-number-${filing.id}`}>{t('courtCaseNumberLabel')}</Label>
            <input
              id={`cf-number-${filing.id}`}
              name="court_case_number"
              dir="ltr"
              defaultValue={filing.court_case_number ?? ''}
              className={controlClass}
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-3">
          <Field>
            <Label htmlFor={`cf-chamber-${filing.id}`}>{t('chamberLabel')}</Label>
            <input id={`cf-chamber-${filing.id}`} name="chamber" defaultValue={filing.chamber ?? ''} className={controlClass} />
          </Field>
          <Field>
            <Label htmlFor={`cf-judge-${filing.id}`}>{t('judgeNameLabel')}</Label>
            <input
              id={`cf-judge-${filing.id}`}
              name="judge_name"
              defaultValue={filing.judge_name ?? ''}
              className={controlClass}
            />
          </Field>
          <Field>
            <Label htmlFor={`cf-filed-${filing.id}`}>{t('filedAtLabel')}</Label>
            <input
              id={`cf-filed-${filing.id}`}
              name="filed_at"
              type="date"
              defaultValue={filing.filed_at ?? ''}
              className={controlClass}
            />
          </Field>
        </div>
        <Field>
          <Label htmlFor={`cf-notes-${filing.id}`}>{t('notesLabel')}</Label>
          <textarea id={`cf-notes-${filing.id}`} name="notes" rows={2} defaultValue={filing.notes ?? ''} className={controlClass} />
        </Field>
        <label className="flex items-center gap-1.5 text-sm text-fg-muted">
          <input type="checkbox" name="is_current" defaultChecked={filing.is_current} />
          <bdi>{t('currentLabel')}</bdi>
        </label>
        {error && <FieldError>{error}</FieldError>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="secondary" disabled={isSaving}>
            {isSaving ? t('saving') : t('save')}
          </Button>
          {saved && <FieldSuccess>{t('saved')}</FieldSuccess>}
          <div className="grow" />
          <Button type="button" variant="danger" disabled={isRemoving} onClick={() => setConfirmingRemove(true)}>
            {isRemoving ? t('removing') : t('remove')}
          </Button>
        </div>
        {removeError && <FieldError>{removeError}</FieldError>}
      </form>

      <DeleteConfirmDialog
        open={confirmingRemove}
        onCancel={() => setConfirmingRemove(false)}
        onConfirm={handleRemove}
        kind="hard"
        itemLabel={courtName}
        confirmLabel={t('remove')}
      />

      <HearingsList
        caseId={caseId}
        filingId={filing.id}
        hearings={filing.hearings}
        canManage={canManage}
        staffOptions={staffOptions}
        onCreateAppealDeadline={onCreateAppealDeadline}
      />
    </li>
  )
}

export function CourtSection({
  caseId,
  filings,
  courts,
  canManage,
  staffOptions,
  onCreateAppealDeadline,
}: {
  caseId: string
  filings: CourtFiling[]
  courts: CourtOption[]
  canManage: boolean
  staffOptions: StaffOption[]
  onCreateAppealDeadline: (prefill: AppealDeadlinePrefill) => void
}) {
  const locale = useLocale()
  const t = useTranslations('dashboard.cases.detail.courtFilings')
  const tErrors = useTranslations('dashboard.cases.detail.courtFilings.errors')
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function resolveError(code: CourtFilingErrorCode) {
    return (COURT_FILING_ERROR_CODES as string[]).includes(code) ? tErrors(code) : tErrors('generic')
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await addCourtFiling(caseId, formData)
      if (result.error) {
        setError(resolveError(result.error))
        return
      }
      formRef.current?.reset()
    })
  }

  return (
    <Panel className="flex flex-col gap-3" data-testid="case-court-section">
      <h2 className="font-heading text-lg text-fg">{t('heading')}</h2>

      {filings.length === 0 ? (
        <p className="text-sm text-fg-muted">{t('noneYet')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {filings.map((f) => (
            <FilingRow
              key={f.id}
              caseId={caseId}
              filing={f}
              courts={courts}
              canManage={canManage}
              staffOptions={staffOptions}
              onCreateAppealDeadline={onCreateAppealDeadline}
            />
          ))}
        </ul>
      )}

      {canManage && courts.length > 0 && (
        <form ref={formRef} onSubmit={handleAdd} className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <Field>
              <Label htmlFor="new-cf-court" required>
                {t('courtLabel')}
              </Label>
              <CourtSelect
                id="new-cf-court"
                courts={courts}
                locale={locale}
                placeholder={t('selectCourtPlaceholder')}
              />
            </Field>
            <Field>
              <Label htmlFor="new-cf-number">{t('courtCaseNumberLabel')}</Label>
              <input id="new-cf-number" name="court_case_number" dir="ltr" className={controlClass} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-3">
            <Field>
              <Label htmlFor="new-cf-chamber">{t('chamberLabel')}</Label>
              <input id="new-cf-chamber" name="chamber" className={controlClass} />
            </Field>
            <Field>
              <Label htmlFor="new-cf-judge">{t('judgeNameLabel')}</Label>
              <input id="new-cf-judge" name="judge_name" className={controlClass} />
            </Field>
            <Field>
              <Label htmlFor="new-cf-filed">{t('filedAtLabel')}</Label>
              <input id="new-cf-filed" name="filed_at" type="date" className={controlClass} />
            </Field>
          </div>
          <Field>
            <Label htmlFor="new-cf-notes">{t('notesLabel')}</Label>
            <textarea id="new-cf-notes" name="notes" rows={2} className={controlClass} />
          </Field>
          <label className="flex items-center gap-1.5 text-sm text-fg-muted">
            <input type="checkbox" name="is_current" />
            <bdi>{t('currentLabel')}</bdi>
          </label>
          {error && <FieldError>{error}</FieldError>}
          <Button type="submit" variant="secondary" data-testid="court-filing-add-button" disabled={isPending} className="self-start">
            {isPending ? t('adding') : t('add')}
          </Button>
        </form>
      )}
    </Panel>
  )
}
