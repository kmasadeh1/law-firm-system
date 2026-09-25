'use client'

import { useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { createPeriodType, deletePeriodType, updatePeriodType } from './actions'
import { Panel } from '@/components/dashboard/panel'
import { EmptyState } from '@/components/dashboard/empty-state'
import { Button } from '@/components/dashboard/button'
import { Field, Label, FieldError, FieldSuccess, controlClass } from '@/components/dashboard/form'
import { DeleteConfirmDialog } from '@/components/dashboard/delete-confirm-dialog'

type PeriodType = {
  id: string
  name: string
  name_ar: string | null
  period_days: number
  description: string | null
  description_ar: string | null
}

export function PeriodTypesAdmin({ periodTypes: initial }: { periodTypes: PeriodType[] }) {
  const t = useTranslations('dashboard.admin.periodTypes')
  const [periodTypes, setPeriodTypes] = useState(initial)

  return (
    <div className="flex flex-col gap-8">
      <CreateForm onCreated={(pt) => setPeriodTypes((prev) => [...prev, pt].sort((a, b) => a.name.localeCompare(b.name)))} />

      {periodTypes.length === 0 && (
        <EmptyState title={t('noneYet')} description={t('noneYetDescription')} />
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
  const t = useTranslations('dashboard.admin.periodTypes.createForm')
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
      <h2 className="font-heading text-lg text-fg">{t('heading')}</h2>
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <Field>
            <Label htmlFor="new-pt-name" required>
              {t('nameLabel')}
            </Label>
            <input id="new-pt-name" name="name" required className={controlClass} />
          </Field>
          <Field>
            <Label htmlFor="new-pt-name-ar">{t('nameArLabel')}</Label>
            <input id="new-pt-name-ar" name="name_ar" dir="rtl" lang="ar" className={controlClass} />
          </Field>
        </div>
        <Field>
          <Label htmlFor="new-pt-days" required>
            {t('periodDaysLabel')}
          </Label>
          <input id="new-pt-days" name="period_days" type="number" min="1" step="1" required className={controlClass} />
        </Field>
        <Field>
          <Label htmlFor="new-pt-description">{t('descriptionLabel')}</Label>
          <textarea
            id="new-pt-description"
            name="description"
            rows={2}
            placeholder={t('descriptionPlaceholder')}
            className={controlClass}
          />
        </Field>
        <Field>
          <Label htmlFor="new-pt-description-ar">{t('descriptionArLabel')}</Label>
          <textarea
            id="new-pt-description-ar"
            name="description_ar"
            rows={2}
            dir="rtl"
            lang="ar"
            className={controlClass}
          />
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" variant="primary" disabled={isPending} className="self-start">
          {isPending ? t('creating') : t('createPeriodType')}
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
  const t = useTranslations('dashboard.admin.periodTypes.card')
  const formRef = useRef<HTMLFormElement>(null)
  const [name, setName] = useState(periodType.name)
  const [nameAr, setNameAr] = useState(periodType.name_ar ?? '')
  const [days, setDays] = useState(String(periodType.period_days))
  const [description, setDescription] = useState(periodType.description ?? '')
  const [descriptionAr, setDescriptionAr] = useState(periodType.description_ar ?? '')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, startSave] = useTransition()

  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, startDelete] = useTransition()

  const changed =
    name.trim() !== periodType.name ||
    nameAr !== (periodType.name_ar ?? '') ||
    days !== String(periodType.period_days) ||
    (description.trim() || null) !== periodType.description ||
    descriptionAr !== (periodType.description_ar ?? '')

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
        name_ar: nameAr.trim() ? nameAr : null,
        period_days: Number(days),
        description: description.trim() || null,
        description_ar: descriptionAr.trim() ? descriptionAr : null,
      })
      setSaved(true)
    })
  }

  function handleConfirmDelete() {
    setDeleteError(null)
    startDelete(async () => {
      const result = await deletePeriodType(periodType.id)
      setConfirmingDelete(false)
      if (result.error) {
        setDeleteError(result.error)
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
        <input
          name="name_ar"
          value={nameAr}
          onChange={(e) => {
            setNameAr(e.target.value)
            setSaved(false)
          }}
          dir="rtl"
          lang="ar"
          placeholder={t('nameArAriaLabel')}
          aria-label={t('nameArAriaLabel')}
          className={controlClass}
        />
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
        <textarea
          name="description_ar"
          rows={2}
          value={descriptionAr}
          onChange={(e) => {
            setDescriptionAr(e.target.value)
            setSaved(false)
          }}
          dir="rtl"
          lang="ar"
          placeholder={t('descriptionArAriaLabel')}
          aria-label={t('descriptionArAriaLabel')}
          className={controlClass}
        />
        {error && <FieldError>{error}</FieldError>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="secondary" disabled={isSaving || !changed}>
            {isSaving ? t('saving') : t('save')}
          </Button>
          {saved && !changed && <FieldSuccess>{t('saved')}</FieldSuccess>}
          <div className="grow" />
          <Button type="button" variant="danger" onClick={() => setConfirmingDelete(true)} disabled={isDeleting}>
            {isDeleting ? t('deleting') : t('delete')}
          </Button>
        </div>
        {deleteError && <FieldError>{deleteError}</FieldError>}
      </form>

      <DeleteConfirmDialog
        open={confirmingDelete}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={handleConfirmDelete}
        kind="hard"
        itemLabel={periodType.name}
        confirmLabel={t('delete')}
        pendingLabel={t('deleting')}
        pending={isDeleting}
        note={t('deleteNote')}
      />
    </Panel>
  )
}
