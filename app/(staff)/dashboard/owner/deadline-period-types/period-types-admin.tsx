'use client'

import { useRef, useState, useTransition } from 'react'
import { createPeriodType, deletePeriodType, updatePeriodType } from './actions'
import { Panel } from '@/components/dashboard/panel'
import { EmptyState } from '@/components/dashboard/empty-state'
import { Button } from '@/components/dashboard/button'
import { Field, Label, FieldError, FieldSuccess, controlClass } from '@/components/dashboard/form'

type PeriodType = { id: string; name: string; period_days: number; description: string | null }

export function PeriodTypesAdmin({ periodTypes: initial }: { periodTypes: PeriodType[] }) {
  const [periodTypes, setPeriodTypes] = useState(initial)

  return (
    <div className="flex flex-col gap-8">
      <CreateForm onCreated={(pt) => setPeriodTypes((prev) => [...prev, pt].sort((a, b) => a.name.localeCompare(b.name)))} />

      {periodTypes.length === 0 && (
        <EmptyState title="No period types yet" description="Create one above to get started." />
      )}

      <div className="flex flex-col gap-4">
        {periodTypes.map((pt) => (
          <PeriodTypeCard
            key={pt.id}
            periodType={pt}
            onUpdated={(updated) =>
              setPeriodTypes((prev) =>
                prev.map((p) => (p.id === updated.id ? updated : p)).sort((a, b) => a.name.localeCompare(b.name))
              )
            }
            onDeleted={() => setPeriodTypes((prev) => prev.filter((p) => p.id !== pt.id))}
          />
        ))}
      </div>
    </div>
  )
}

function CreateForm({ onCreated }: { onCreated: (pt: PeriodType) => void }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await createPeriodType(formData)
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.periodType) {
        onCreated(result.periodType)
        formRef.current?.reset()
      }
    })
  }

  return (
    <Panel className="flex flex-col gap-3">
      <h2 className="font-heading text-lg text-fg">New period type</h2>
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field>
          <Label htmlFor="new-pt-name" required>
            Name
          </Label>
          <input id="new-pt-name" name="name" required className={controlClass} />
        </Field>
        <Field>
          <Label htmlFor="new-pt-days" required>
            Period (days)
          </Label>
          <input id="new-pt-days" name="period_days" type="number" min="1" step="1" required className={controlClass} />
        </Field>
        <Field>
          <Label htmlFor="new-pt-description">Description / source</Label>
          <textarea
            id="new-pt-description"
            name="description"
            rows={2}
            placeholder='e.g. "DRAFT — unverified. Source: ..."'
            className={controlClass}
          />
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" variant="primary" disabled={isPending} className="self-start">
          {isPending ? 'Creating…' : 'Create period type'}
        </Button>
      </form>
    </Panel>
  )
}

function PeriodTypeCard({
  periodType,
  onUpdated,
  onDeleted,
}: {
  periodType: PeriodType
  onUpdated: (pt: PeriodType) => void
  onDeleted: () => void
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [name, setName] = useState(periodType.name)
  const [days, setDays] = useState(String(periodType.period_days))
  const [description, setDescription] = useState(periodType.description ?? '')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, startSave] = useTransition()

  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, startDelete] = useTransition()

  const changed =
    name.trim() !== periodType.name ||
    days !== String(periodType.period_days) ||
    (description.trim() || null) !== periodType.description

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    const formData = new FormData(formRef.current!)
    startSave(async () => {
      const result = await updatePeriodType(periodType.id, formData)
      if (result.error) {
        setError(result.error)
        return
      }
      onUpdated({
        id: periodType.id,
        name: name.trim(),
        period_days: Number(days),
        description: description.trim() || null,
      })
      setSaved(true)
    })
  }

  function handleDeleteClick() {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    setDeleteError(null)
    startDelete(async () => {
      const result = await deletePeriodType(periodType.id)
      if (result.error) {
        setDeleteError(result.error)
        setConfirmingDelete(false)
        return
      }
      onDeleted()
    })
  }

  return (
    <Panel className="flex flex-col gap-3">
      <form ref={formRef} onSubmit={handleSave} className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <input
            name="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setSaved(false)
            }}
            className={`flex-1 font-semibold ${controlClass}`}
          />
          <input
            name="period_days"
            type="number"
            min="1"
            step="1"
            value={days}
            onChange={(e) => {
              setDays(e.target.value)
              setSaved(false)
            }}
            className={`w-28 ${controlClass}`}
          />
        </div>
        <textarea
          name="description"
          rows={2}
          value={description}
          onChange={(e) => {
            setDescription(e.target.value)
            setSaved(false)
          }}
          className={controlClass}
        />
        {error && <FieldError>{error}</FieldError>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="secondary" disabled={isSaving || !changed}>
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
          {saved && !changed && <FieldSuccess>Saved</FieldSuccess>}
          <div className="grow" />
          <Button type="button" variant="danger" onClick={handleDeleteClick} disabled={isDeleting}>
            {isDeleting ? 'Deleting…' : confirmingDelete ? 'Confirm delete?' : 'Delete'}
          </Button>
          {confirmingDelete && !isDeleting && (
            <Button type="button" variant="ghost" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
          )}
        </div>
        {deleteError && <FieldError>{deleteError}</FieldError>}
      </form>
    </Panel>
  )
}
