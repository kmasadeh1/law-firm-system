'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createAppointment, updateAppointment } from './actions'
import { ClientPicker } from './client-picker'
import { CasePicker } from './case-picker'
import type { ClientOption } from '../cases/actions'
import type { CaseOption } from './actions'

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
      <div className="flex flex-col gap-1.5">
        <label htmlFor="type" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Type *
        </label>
        <select
          id="type"
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as AppointmentType)}
          className="rounded-md border border-black/10 px-3 py-2 text-sm text-black dark:border-white/10 dark:bg-black dark:text-zinc-50"
        >
          <option value="consultation">Consultation</option>
          <option value="court_date">Court date</option>
        </select>
      </div>

      <ClientPicker initial={initial?.client} />

      <CasePicker required={type === 'court_date'} initial={initial?.case ?? undefined} />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Assigned to</span>
        {canAssignNow ? (
          <select
            name="staff_id"
            defaultValue={assignedStaffId}
            className="rounded-md border border-black/10 px-3 py-2 text-sm text-black dark:border-white/10 dark:bg-black dark:text-zinc-50"
          >
            {staffOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id === currentStaffId ? `${s.full_name} (you)` : s.full_name}
              </option>
            ))}
          </select>
        ) : (
          <>
            <input type="hidden" name="staff_id" value={currentStaffId} />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{currentStaffName} (you)</p>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="starts_at" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Starts *
          </label>
          <input
            id="starts_at"
            name="starts_at"
            type="datetime-local"
            required
            defaultValue={initial ? toLocalInputValue(initial.starts_at) : undefined}
            className="rounded-md border border-black/10 px-3 py-2 text-sm text-black dark:border-white/10 dark:bg-black dark:text-zinc-50"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ends_at" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Ends *
          </label>
          <input
            id="ends_at"
            name="ends_at"
            type="datetime-local"
            required
            defaultValue={initial ? toLocalInputValue(initial.ends_at) : undefined}
            className="rounded-md border border-black/10 px-3 py-2 text-sm text-black dark:border-white/10 dark:bg-black dark:text-zinc-50"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="notes" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={initial?.notes ?? ''}
          className="rounded-md border border-black/10 px-3 py-2 text-sm text-black dark:border-white/10 dark:bg-black dark:text-zinc-50"
        />
      </div>

      {mode === 'edit' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={initial?.status}
            className="rounded-md border border-black/10 px-3 py-2 text-sm text-black dark:border-white/10 dark:bg-black dark:text-zinc-50"
          >
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No-show</option>
          </select>
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {saved && <p className="text-sm text-green-700 dark:text-green-400">Saved.</p>}

      <button
        type="submit"
        disabled={isPending}
        className="mt-2 self-start rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
      >
        {isPending ? 'Saving…' : mode === 'create' ? 'Create appointment' : 'Save changes'}
      </button>
    </form>
  )
}
