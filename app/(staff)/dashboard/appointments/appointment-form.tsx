'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createAppointment, updateAppointment } from './actions'
import { ClientPicker } from './client-picker'
import { CasePicker } from './case-picker'
import type { ClientOption } from '../cases/actions'
import type { CaseOption } from './actions'
import { Field, Label, FieldError, FieldSuccess, controlClass } from '@/components/dashboard/form'
import { Button } from '@/components/dashboard/button'

type StaffOption = { id: string; full_name: string }

type AppointmentType = 'consultation' | 'court_date'
type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'

function toLocalInputValue(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

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
  const tType = useTranslations('dashboard.appointments.type')
  const tStatus = useTranslations('dashboard.appointments.status')
  const formRef = useRef<HTMLFormElement>(null)
  const [type, setType] = useState<AppointmentType>(initial?.type ?? 'consultation')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const canAssignNow = canAssignAll || (canAssignCourtDates && type === 'court_date')
  const assignedStaffId = initial?.staff_id ?? currentStaffId

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    const formData = new FormData(formRef.current!)

    startTransition(async () => {
      if (mode === 'create') {
        const result = await createAppointment(formData)
        if (result.error) {
          setError(result.error)
          return
        }
        if (result.appointmentId) {
          router.push(`/dashboard/appointments/${result.appointmentId}`)
        }
        return
      }

      const result = await updateAppointment(appointmentId!, formData)
      if (result.error) {
        setError(result.error)
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
            id="starts_at"
            name="starts_at"
            type="datetime-local"
            required
            defaultValue={initial ? toLocalInputValue(initial.starts_at) : undefined}
            className={controlClass}
          />
        </Field>
        <Field>
          <Label htmlFor="ends_at" required>
            {t('endsLabel')}
          </Label>
          <input
            id="ends_at"
            name="ends_at"
            type="datetime-local"
            required
            defaultValue={initial ? toLocalInputValue(initial.ends_at) : undefined}
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
