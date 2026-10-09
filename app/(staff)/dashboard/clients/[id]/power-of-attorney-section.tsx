'use client'

import { useRef, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  assignPowerOfAttorneyLawyer,
  createPowerOfAttorney,
  revokePowerOfAttorney,
  unassignPowerOfAttorneyLawyer,
  updatePowerOfAttorney,
  type PoaErrorCode,
} from '../actions'
import { Panel } from '@/components/dashboard/panel'
import { Button } from '@/components/dashboard/button'
import { Field, Label, FieldError, FieldSuccess, controlClass } from '@/components/dashboard/form'
import { formatDate, todayInFirmZone } from '@/lib/format-date-time'
import { poaStatusOf, poaStatusClass } from '@/lib/poa-status'

export type CaseOption = { id: string; case_number: string; title: string }
export type StaffOption = { id: string; full_name: string }
export type PoaLawyer = { staff_id: string; full_name: string }

export type Poa = {
  id: string
  case_id: string | null
  case_number: string | null
  case_title: string | null
  poa_number: string | null
  issued_at: string | null
  expires_at: string | null
  scope: string | null
  registered_at_office: string | null
  notes: string | null
  is_revoked: boolean
  revoked_at: string | null
  lawyers: PoaLawyer[]
}

// Closed set the server can return - anything else falls back to a generic
// translated message rather than passing an arbitrary value to t() as a key.
const POA_ERROR_CODES: PoaErrorCode[] = [
  'expiryBeforeIssue',
  'revokedBeforeIssue',
  'revokedDateMismatch',
  'caseMismatch',
  'noPermission',
  'addFailed',
  'updateFailed',
  'revokeFailed',
  'alreadyAssigned',
  'assignFailed',
  'unassignFailed',
]

function LawyersBlock({
  clientId,
  poaId,
  lawyers,
  staffOptions,
  canManage,
}: {
  clientId: string
  poaId: string
  lawyers: PoaLawyer[]
  staffOptions: StaffOption[]
  canManage: boolean
}) {
  const t = useTranslations('dashboard.clients.detail.powerOfAttorney')
  const tErrors = useTranslations('dashboard.clients.detail.powerOfAttorney.errors')
  const [addStaffId, setAddStaffId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const candidates = staffOptions.filter((s) => !lawyers.some((l) => l.staff_id === s.id))

  function resolveError(code: PoaErrorCode) {
    return (POA_ERROR_CODES as string[]).includes(code) ? tErrors(code) : tErrors('generic')
  }

  function runAction(fn: () => Promise<{ error?: PoaErrorCode }>) {
    setError(null)
    startTransition(async () => {
      const result = await fn()
      if (result.error) {
        setError(resolveError(result.error))
      }
    })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-fg">{t('lawyersLabel')}</span>
      {lawyers.length === 0 ? (
        <p className="text-sm text-fg-muted">{t('noLawyersAssigned')}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {lawyers.map((l) => (
            <li key={l.staff_id} className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-sm">
              <bdi>{l.full_name}</bdi>
              {canManage && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => runAction(() => unassignPowerOfAttorneyLawyer(clientId, poaId, l.staff_id))}
                  className="text-fg-muted hover:text-danger-text"
                  aria-label={t('removeLawyer')}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && candidates.length > 0 && (
        <div className="flex items-end gap-2">
          <select value={addStaffId} onChange={(e) => setAddStaffId(e.target.value)} className={controlClass}>
            <option value="">{t('selectLawyerPlaceholder')}</option>
            {candidates.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="ghost"
            disabled={isPending || !addStaffId}
            onClick={() =>
              runAction(async () => {
                const result = await assignPowerOfAttorneyLawyer(clientId, poaId, addStaffId)
                if (!result.error) setAddStaffId('')
                return result
              })
            }
          >
            {t('assignLawyer')}
          </Button>
        </div>
      )}
      {error && <FieldError>{error}</FieldError>}
    </div>
  )
}

function PoaRow({
  clientId,
  poa,
  cases,
  staffOptions,
  canManage,
}: {
  clientId: string
  poa: Poa
  cases: CaseOption[]
  staffOptions: StaffOption[]
  canManage: boolean
}) {
  const locale = useLocale()
  const t = useTranslations('dashboard.clients.detail.powerOfAttorney')
  const tStatus = useTranslations('dashboard.clients.detail.powerOfAttorney.status')
  const tErrors = useTranslations('dashboard.clients.detail.powerOfAttorney.errors')
  const formRef = useRef<HTMLFormElement>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, startSave] = useTransition()
  const [revoking, setRevoking] = useState(false)
  const [revokedAt, setRevokedAt] = useState(todayInFirmZone())
  const [revokeError, setRevokeError] = useState<string | null>(null)
  const [isRevoking, startRevoke] = useTransition()

  function resolveError(code: PoaErrorCode) {
    return (POA_ERROR_CODES as string[]).includes(code) ? tErrors(code) : tErrors('generic')
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    const formData = new FormData(formRef.current!)
    startSave(async () => {
      const result = await updatePowerOfAttorney(clientId, poa.id, formData)
      if (result.error) {
        setError(resolveError(result.error))
        return
      }
      setSaved(true)
    })
  }

  function handleRevoke() {
    setRevokeError(null)
    startRevoke(async () => {
      const result = await revokePowerOfAttorney(clientId, poa.id, revokedAt)
      if (result.error) {
        setRevokeError(resolveError(result.error))
        return
      }
      setRevoking(false)
    })
  }

  const status = poaStatusOf(poa)

  if (!canManage) {
    return (
      <li className="flex flex-col gap-2 px-3 py-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          {poa.poa_number && (
            <span className="font-medium text-fg" dir="ltr">
              {poa.poa_number}
            </span>
          )}
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${poaStatusClass[status]}`}>
            {tStatus(status)}
          </span>
          <span className="text-fg-muted">
            {poa.case_id ? (
              t.rich('caseSpecificFor', {
                caseNumber: poa.case_number ?? '',
                title: poa.case_title ?? '',
                bdi: (chunks) => <bdi>{chunks}</bdi>,
              })
            ) : (
              <bdi>{t('generalLabel')}</bdi>
            )}
          </span>
        </div>
        <div className="flex flex-wrap gap-3 text-fg-muted">
          {poa.issued_at && (
            <span>{t.rich('issuedOn', { date: formatDate(poa.issued_at, locale), bdi: (chunks) => <bdi>{chunks}</bdi> })}</span>
          )}
          {poa.expires_at && (
            <span>{t.rich('expiresOn', { date: formatDate(poa.expires_at, locale), bdi: (chunks) => <bdi>{chunks}</bdi> })}</span>
          )}
          {poa.is_revoked && poa.revoked_at && (
            <span>{t.rich('revokedOn', { date: formatDate(poa.revoked_at, locale), bdi: (chunks) => <bdi>{chunks}</bdi> })}</span>
          )}
        </div>
        {poa.scope && <p className="text-fg-muted">{poa.scope}</p>}
        <LawyersBlock clientId={clientId} poaId={poa.id} lawyers={poa.lawyers} staffOptions={staffOptions} canManage={false} />
      </li>
    )
  }

  return (
    <li className="flex flex-col gap-3 px-3 py-3 text-sm">
      <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ${poaStatusClass[status]}`}>
        {tStatus(status)}
      </span>

      <form ref={formRef} onSubmit={handleSave} className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <Field>
            <Label htmlFor={`poa-case-${poa.id}`}>{t('caseLabel')}</Label>
            <select id={`poa-case-${poa.id}`} name="case_id" defaultValue={poa.case_id ?? ''} className={controlClass}>
              <option value="">{t('generalCaseOption')}</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.case_number} — {c.title}
                </option>
              ))}
            </select>
          </Field>
          <Field>
            <Label htmlFor={`poa-number-${poa.id}`}>{t('numberLabel')}</Label>
            <input
              id={`poa-number-${poa.id}`}
              name="poa_number"
              dir="ltr"
              defaultValue={poa.poa_number ?? ''}
              className={controlClass}
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-3">
          <Field>
            <Label htmlFor={`poa-issued-${poa.id}`}>{t('issuedAtLabel')}</Label>
            <input id={`poa-issued-${poa.id}`} name="issued_at" type="date" defaultValue={poa.issued_at ?? ''} className={controlClass} />
          </Field>
          <Field>
            <Label htmlFor={`poa-expires-${poa.id}`}>{t('expiresAtLabel')}</Label>
            <input id={`poa-expires-${poa.id}`} name="expires_at" type="date" defaultValue={poa.expires_at ?? ''} className={controlClass} />
          </Field>
          <Field>
            <Label htmlFor={`poa-office-${poa.id}`}>{t('registeredAtOfficeLabel')}</Label>
            <input
              id={`poa-office-${poa.id}`}
              name="registered_at_office"
              defaultValue={poa.registered_at_office ?? ''}
              className={controlClass}
            />
          </Field>
        </div>
        <Field>
          <Label htmlFor={`poa-scope-${poa.id}`}>{t('scopeLabel')}</Label>
          <input id={`poa-scope-${poa.id}`} name="scope" defaultValue={poa.scope ?? ''} className={controlClass} />
        </Field>
        <Field>
          <Label htmlFor={`poa-notes-${poa.id}`}>{t('notesLabel')}</Label>
          <textarea id={`poa-notes-${poa.id}`} name="notes" rows={2} defaultValue={poa.notes ?? ''} className={controlClass} />
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="secondary" disabled={isSaving}>
            {isSaving ? t('saving') : t('save')}
          </Button>
          {saved && <FieldSuccess>{t('saved')}</FieldSuccess>}
        </div>
      </form>

      <LawyersBlock clientId={clientId} poaId={poa.id} lawyers={poa.lawyers} staffOptions={staffOptions} canManage />

      {poa.is_revoked ? (
        poa.revoked_at && (
          <p className="text-xs text-fg-muted">
            {t.rich('revokedOn', { date: formatDate(poa.revoked_at, locale), bdi: (chunks) => <bdi>{chunks}</bdi> })}
          </p>
        )
      ) : revoking ? (
        <div className="flex flex-wrap items-end gap-2">
          <Field>
            <Label htmlFor={`poa-revoked-at-${poa.id}`} required>
              {t('revokedAtLabel')}
            </Label>
            <input
              id={`poa-revoked-at-${poa.id}`}
              type="date"
              required
              value={revokedAt}
              onChange={(e) => setRevokedAt(e.target.value)}
              className={controlClass}
            />
          </Field>
          <Button type="button" variant="danger" disabled={isRevoking} onClick={handleRevoke} data-testid="poa-confirm-revoke">
            {isRevoking ? t('revoking') : t('confirmRevoke')}
          </Button>
          <Button type="button" variant="ghost" disabled={isRevoking} onClick={() => setRevoking(false)}>
            {t('cancel')}
          </Button>
          {revokeError && <FieldError>{revokeError}</FieldError>}
        </div>
      ) : (
        <Button
          type="button"
          variant="danger"
          className="self-start"
          onClick={() => setRevoking(true)}
          data-testid="poa-revoke-button"
        >
          {t('revoke')}
        </Button>
      )}
    </li>
  )
}

export function PowerOfAttorneySection({
  clientId,
  poas,
  cases,
  staffOptions,
  canView,
  canManage,
}: {
  clientId: string
  poas: Poa[]
  cases: CaseOption[]
  staffOptions: StaffOption[]
  canView: boolean
  canManage: boolean
}) {
  const t = useTranslations('dashboard.clients.detail.powerOfAttorney')
  const tErrors = useTranslations('dashboard.clients.detail.powerOfAttorney.errors')
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function resolveError(code: PoaErrorCode) {
    return (POA_ERROR_CODES as string[]).includes(code) ? tErrors(code) : tErrors('generic')
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await createPowerOfAttorney(clientId, formData)
      if (result.error) {
        setError(resolveError(result.error))
        return
      }
      formRef.current?.reset()
    })
  }

  if (!canView) return null

  return (
    <Panel className="flex flex-col gap-3" data-testid="client-power-of-attorney-section">
      <h2 className="font-heading text-lg text-fg">{t('heading')}</h2>

      {poas.length === 0 ? (
        <p className="text-sm text-fg-muted">{t('noneYet')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {poas.map((poa) => (
            <PoaRow key={poa.id} clientId={clientId} poa={poa} cases={cases} staffOptions={staffOptions} canManage={canManage} />
          ))}
        </ul>
      )}

      {canManage && (
        <form ref={formRef} onSubmit={handleAdd} className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <Field>
              <Label htmlFor="new-poa-case">{t('caseLabel')}</Label>
              <select id="new-poa-case" name="case_id" defaultValue="" className={controlClass}>
                <option value="">{t('generalCaseOption')}</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.case_number} — {c.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <Label htmlFor="new-poa-number">{t('numberLabel')}</Label>
              <input id="new-poa-number" name="poa_number" dir="ltr" className={controlClass} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-3">
            <Field>
              <Label htmlFor="new-poa-issued">{t('issuedAtLabel')}</Label>
              <input id="new-poa-issued" name="issued_at" type="date" className={controlClass} />
            </Field>
            <Field>
              <Label htmlFor="new-poa-expires">{t('expiresAtLabel')}</Label>
              <input id="new-poa-expires" name="expires_at" type="date" className={controlClass} />
            </Field>
            <Field>
              <Label htmlFor="new-poa-office">{t('registeredAtOfficeLabel')}</Label>
              <input id="new-poa-office" name="registered_at_office" className={controlClass} />
            </Field>
          </div>
          <Field>
            <Label htmlFor="new-poa-scope">{t('scopeLabel')}</Label>
            <input id="new-poa-scope" name="scope" className={controlClass} />
          </Field>
          <Field>
            <Label htmlFor="new-poa-notes">{t('notesLabel')}</Label>
            <textarea id="new-poa-notes" name="notes" rows={2} className={controlClass} />
          </Field>
          {error && <FieldError>{error}</FieldError>}
          <Button type="submit" variant="primary" data-testid="poa-add-button" disabled={isPending} className="self-start">
            {isPending ? t('adding') : t('add')}
          </Button>
        </form>
      )}
    </Panel>
  )
}
