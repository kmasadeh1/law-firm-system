'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createAppointment, updateAppointment, type AppointmentErrorCode } from './actions'
import { ClientPicker } from './client-picker'
import { CasePicker } from './case-picker'
import type { ClientOption } from '../cases/actions'
import type { CaseOption } from './actions'
import { Field, Label, FieldError, FieldSuccess, controlClass } from '@/components/dashboard/form'
import { Button } from '@/components/dashboard/button'

type StaffOption = { id: string; full_name: string }

type AppointmentType = 'consultation' | 'court_date'
type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'

const ONE_HOUR_MS = 60 * 60 * 1000

function formatLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toLocalInputValue(iso: string) {
  return formatLocalInput(new Date(iso))
}

// datetime-local's value is already "YYYY-MM-DDTHH:mm" in local time, which
// `new Date(...)` parses as local time too - round-trips cleanly without a
// timezone library.
function addOneHour(localValue: string): string {
  const d = new Date(localValue)
  if (Number.isNaN(d.getTime())) return localValue
  return formatLocalInput(new Date(d.getTime() + ONE_HOUR_MS))
}

// Closed set the server can return - anything else falls back to a generic
// translated message rather than passing an arbitrary value to t() as a key.
const APPOINTMENT_ERROR_CODES: AppointmentErrorCode[] = [
  'selectType',
  'selectClient',
  'startRequired',
  'endRequired',
  'selectStatus',
  'courtDateNeedsCase',
  'endBeforeStart',
  'noPermissionCreate',
  'createFailed',
  'noPermissionUpdate',
  'updateFailed',
]

export function AppointmentForm({
  mode,
  appointmentId,
  initial,
  currentStaffId,
  currentStaffName,
  staffOptions,
  canAssignAll,
  canAssignCourtDates,
}: {
  mode: 'create' | 'edit'
  appointmentId?: string
  initial?: {
    type: AppointmentType
    client: ClientOption
    case: CaseOption | null
    staff_id: string | null
    starts_at: string
    ends_at: string
    notes: string | null
    status: AppointmentStatus
  }
  currentStaffId: string
  currentStaffName: string
  staffOptions: StaffOption[]
  canAssignAll: boolean
  canAssignCourtDates: boolean
}) {
  const router = useRouter()
  const t = useTranslations('dashboard.appointments.form')
  const tErrors = useTranslations('dashboard.appointments.form.errors')
  const tType = useTranslations('dashboard.appointments.type')
  const tStatus = useTranslations('dashboard.appointments.status')
  const formRef = useRef<HTMLFormElement>(null)
  const startRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLInputElement>(null)
  const [type, setType] = useState<AppointmentType>(initial?.type ?? 'consultation')
  // Editing an existing appointment never auto-shifts its end time just
  // because the start changed - its existing gap was a deliberate choice.
  // Only a brand-new form's still-untouched end field gets kept in sync.
  const endTouchedRef = useRef(mode === 'edit')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Both datetime fields are uncontrolled (defaultValue, not value) - "now"
  // is only known on the client, and a controlled input fed a client-only
  // computation would make the server-rendered and first client-rendered
  // value disagree. This effect sets the two starting values together, once,
  // straight on the DOM via refs - not React state - right after mount, the
  // same way any "synchronize with a value React doesn't own" effect would.
  useEffect(() => {
    if (mode === 'create' && startRef.current && endRef.current) {
      const now = new Date()
      startRef.current.value = formatLocalInput(now)
      endRef.current.value = formatLocalInput(new Date(now.getTime() + ONE_HOUR_MS))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canAssignNow = canAssignAll || (canAssignCourtDates && type === 'court_date')
  const assignedStaffId = initial?.staff_id ?? currentStaffId

  function resolveError(code: AppointmentErrorCode) {
    if ((APPOINTMENT_ERROR_CODES as string[]).includes(code)) return tErrors(code)
    return mode === 'create' ? tErrors('createFailed') : tErrors('updateFailed')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)

    const formData = new FormData(formRef.current!)

    // Fail-fast UX on top of the database's own ends_after_starts check,
    // never a replacement for it - the server action maps the same
    // violation by constraint name if this ever gets bypassed.
    const startsValue = formData.get('starts_at')
    const endsValue = formData.get('ends_at')
    if (
      typeof startsValue === 'string' &&
      typeof endsValue === 'string' &&
      startsValue &&
      endsValue &&
      new Date(endsValue).getTime() <= new Date(startsValue).getTime()
    ) {
      setError(resolveError('endBeforeStart'))
      return
    }

    startTransition(async () => {
      if (mode === 'create') {
        const result = await createAppointment(formData)
        if (result.error) {
          setError(resolveError(result.error))
          return
        }
        if (result.appointmentId) {
          router.push(`/dashboard/appointments/${result.appointmentId}`)
        }
        return
      }

      const result = await updateAppointment(appointmentId!, formData)
      if (result.error) {
        setError(resolveError(result.error))
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field>
        <Label htmlFor="type" required>
          {t('typeLabel')}
        </Label>
        <select
          id="type"
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as AppointmentType)}
          className={controlClass}
        >
          <option value="consultation">{tType('consultation')}</option>
          <option value="court_date">{tType('court_date')}</option>
        </select>
      </Field>

      <ClientPicker initial={initial?.client} />

      <CasePicker required={type === 'court_date'} initial={initial?.case ?? undefined} />

      <Field>
        <span className="text-sm font-medium text-fg">{t('assignedToLabel')}</span>
        {canAssignNow ? (
          <select name="staff_id" defaultValue={assignedStaffId} className={controlClass}>
            {staffOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id === currentStaffId ? t('assignedYouOption', { name: s.full_name }) : s.full_name}
              </option>
            ))}
          </select>
        ) : (
          <>
            <input type="hidden" name="staff_id" value={currentStaffId} />
            <p className="text-sm text-fg-muted">
              {t.rich('assignedYou', { name: currentStaffName, bdi: (chunks) => <bdi>{chunks}</bdi> })}
            </p>
          </>
        )}
      </Field>

      <div className="flex flex-wrap gap-4">
        <Field>
          <Label htmlFor="starts_at" required>
            {t('startsLabel')}
          </Label>
          <input
            ref={startRef}
            id="starts_at"
            name="starts_at"
            type="datetime-local"
            required
            defaultValue={initial ? toLocalInputValue(initial.starts_at) : undefined}
            onChange={(e) => {
              if (!endTouchedRef.current && endRef.current) {
                endRef.current.value = addOneHour(e.target.value)
              }
            }}
            data-testid="appointment-starts-at"
            className={controlClass}
          />
        </Field>
        <Field>
          <Label htmlFor="ends_at" required>
            {t('endsLabel')}
          </Label>
          <input
            ref={endRef}
            id="ends_at"
            name="ends_at"
            type="datetime-local"
            required
            defaultValue={initial ? toLocalInputValue(initial.ends_at) : undefined}
            onChange={() => {
              endTouchedRef.current = true
            }}
            data-testid="appointment-ends-at"
            className={controlClass}
          />
        </Field>
      </div>

      <Field>
        <Label htmlFor="notes">{t('notesLabel')}</Label>
        <textarea id="notes" name="notes" rows={3} defaultValue={initial?.notes ?? ''} className={controlClass} />
      </Field>

      {mode === 'edit' && (
        <Field>
          <Label htmlFor="status">{t('statusLabel')}</Label>
          <select id="status" name="status" defaultValue={initial?.status} className={controlClass}>
            <option value="scheduled">{tStatus('scheduled')}</option>
            <option value="completed">{tStatus('completed')}</option>
            <option value="cancelled">{tStatus('cancelled')}</option>
            <option value="no_show">{tStatus('no_show')}</option>
          </select>
        </Field>
      )}

      {error && <FieldError>{error}</FieldError>}
      {saved && <FieldSuccess>{t('saved')}</FieldSuccess>}

      <Button type="submit" variant="primary" disabled={isPending} className="mt-2 self-start">
        {isPending ? t('saving') : mode === 'create' ? t('createAppointment') : t('saveChanges')}
      </Button>
    </form>
  )
}
