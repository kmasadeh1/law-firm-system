'use client'

import { useRef, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  createChecklistItem,
  moveChecklistItem,
  renameChecklistItem,
  setChecklistItemActive,
  setChecklistItemRequired,
  type ChecklistItemErrorCode,
  type ChecklistItemRow,
} from './actions'
import { Panel } from '@/components/dashboard/panel'
import { Badge } from '@/components/dashboard/badge'
import { Button } from '@/components/dashboard/button'
import { Switch } from '@/components/dashboard/switch'
import { Field, Label, FieldError, FieldSuccess, controlClass } from '@/components/dashboard/form'
import { DeleteConfirmDialog } from '@/components/dashboard/delete-confirm-dialog'
import { ArrowDownIcon, ArrowUpIcon } from '@/components/dashboard/icons'
import { localizedName } from '@/lib/localized-name'

const ERROR_CODES: ChecklistItemErrorCode[] = ['noName', 'noPermission', 'createFailed', 'saveFailed', 'reorderFailed']

function useResolveError() {
  const tErrors = useTranslations('dashboard.admin.checklists.errors')
  return (code: ChecklistItemErrorCode | undefined, fallback: ChecklistItemErrorCode) =>
    tErrors(code && (ERROR_CODES as string[]).includes(code) ? code : fallback)
}

type CaseTypeOption = { id: string; name_en: string | null; name_ar: string | null; is_active: boolean }

// One panel per case type, each holding that type's checklist in the
// query's order. Every action revalidates the page, so changes arrive as
// fresh props - no client-side copy of the list and no re-sort. No delete
// control: an item is deactivated instead, which keeps the statuses
// already recorded against it.
export function ChecklistsAdmin({ groups }: { groups: { caseType: CaseTypeOption; items: ChecklistItemRow[] }[] }) {
  const t = useTranslations('dashboard.admin.checklists')
  const locale = useLocale()

  return (
    <div className="flex flex-col gap-6" data-testid="checklists-admin">
      {groups.length === 0 && <p className="text-sm text-fg-muted">{t('noCaseTypes')}</p>}
      {groups.map(({ caseType, items }) => (
        <Panel key={caseType.id} className="flex flex-col gap-3" data-testid="checklist-case-type">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-lg text-fg">
              {localizedName({ name: caseType.name_en ?? caseType.name_ar ?? '', name_ar: caseType.name_ar }, locale)}
            </h2>
            {!caseType.is_active && <Badge variant="muted">{t('caseTypeInactive')}</Badge>}
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-fg-muted">{t('noItems')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
              {items.map((item, index) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  isFirst={index === 0}
                  isLast={index === items.length - 1}
                />
              ))}
            </ul>
          )}

          <AddItemForm caseTypeId={caseType.id} />
        </Panel>
      ))}
    </div>
  )
}

function AddItemForm({ caseTypeId }: { caseTypeId: string }) {
  const t = useTranslations('dashboard.admin.checklists')
  const resolveError = useResolveError()
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await createChecklistItem(caseTypeId, formData)
      if (result.error) {
        setError(resolveError(result.error, 'createFailed'))
        return
      }
      formRef.current?.reset()
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-2" data-testid="checklist-add-form">
      <div className="flex flex-wrap items-end gap-3">
        <Field>
          <Label htmlFor={`new-item-en-${caseTypeId}`}>{t('nameEnLabel')}</Label>
          <input id={`new-item-en-${caseTypeId}`} name="name_en" className={controlClass} />
        </Field>
        <Field>
          <Label htmlFor={`new-item-ar-${caseTypeId}`}>{t('nameArLabel')}</Label>
          <input id={`new-item-ar-${caseTypeId}`} name="name_ar" dir="rtl" lang="ar" className={controlClass} />
        </Field>
        <label className="flex items-center gap-2 pb-2 text-sm text-fg">
          <input type="checkbox" name="is_required" defaultChecked />
          {t('requiredLabel')}
        </label>
        <Button type="submit" variant="secondary" disabled={isPending} data-testid="checklist-add-submit">
          {isPending ? t('adding') : t('add')}
        </Button>
      </div>
      {error && <FieldError>{error}</FieldError>}
    </form>
  )
}

function ItemRow({ item, isFirst, isLast }: { item: ChecklistItemRow; isFirst: boolean; isLast: boolean }) {
  const t = useTranslations('dashboard.admin.checklists')
  const locale = useLocale()
  const resolveError = useResolveError()
  const formRef = useRef<HTMLFormElement>(null)
  const [nameEn, setNameEn] = useState(item.name_en ?? '')
  const [nameAr, setNameAr] = useState(item.name_ar ?? '')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false)
  const [isPending, startTransition] = useTransition()

  const changed = nameEn !== (item.name_en ?? '') || nameAr !== (item.name_ar ?? '')

  function run(action: () => Promise<{ error?: ChecklistItemErrorCode }>, fallback: ChecklistItemErrorCode) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (result.error) setError(resolveError(result.error, fallback))
    })
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaved(false)
    const formData = new FormData(formRef.current!)
    setError(null)
    startTransition(async () => {
      const result = await renameChecklistItem(item.id, formData)
      if (result.error || !result.item) {
        setError(resolveError(result.error, 'saveFailed'))
        return
      }
      // Show what the database kept (trimmed English, blank Arabic as NULL).
      setNameEn(result.item.name_en ?? '')
      setNameAr(result.item.name_ar ?? '')
      setSaved(true)
    })
  }

  return (
    <li
      className={`flex flex-col gap-2 px-3 py-3 ${item.is_active ? '' : 'bg-line/20'}`}
      data-testid="checklist-item"
      data-active={item.is_active}
    >
      <form ref={formRef} onSubmit={handleSave} className="flex flex-wrap items-center gap-2">
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => run(() => moveChecklistItem(item.case_type_id, item.id, 'up'), 'reorderFailed')}
            disabled={isPending || isFirst}
            aria-label={t('moveUp')}
            className="rounded p-0.5 text-fg-muted hover:bg-line/40 hover:text-fg disabled:opacity-30"
            data-testid="checklist-item-up"
          >
            <ArrowUpIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => run(() => moveChecklistItem(item.case_type_id, item.id, 'down'), 'reorderFailed')}
            disabled={isPending || isLast}
            aria-label={t('moveDown')}
            className="rounded p-0.5 text-fg-muted hover:bg-line/40 hover:text-fg disabled:opacity-30"
            data-testid="checklist-item-down"
          >
            <ArrowDownIcon className="h-4 w-4" />
          </button>
        </div>
        <input
          name="name_en"
          value={nameEn}
          onChange={(e) => {
            setNameEn(e.target.value)
            setSaved(false)
          }}
          aria-label={t('nameEnLabel')}
          className={`min-w-0 flex-1 ${controlClass}`}
        />
        <input
          name="name_ar"
          value={nameAr}
          onChange={(e) => {
            setNameAr(e.target.value)
            setSaved(false)
          }}
          dir="rtl"
          lang="ar"
          aria-label={t('nameArLabel')}
          className={`min-w-0 flex-1 ${controlClass}`}
        />
        <Button type="submit" variant="secondary" disabled={isPending || !changed} data-testid="checklist-item-save">
          {isPending ? t('saving') : t('save')}
        </Button>
        <FieldSuccess show={saved && !changed}>{t('saved')}</FieldSuccess>
      </form>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="flex items-center gap-2">
          <Switch
            checked={item.is_required}
            disabled={isPending}
            onChange={(next) => run(() => setChecklistItemRequired(item.id, next), 'saveFailed')}
            label={t('requiredLabel')}
            data-testid="checklist-item-required"
          />
          <span className="text-fg-muted">{item.is_required ? t('required') : t('optional')}</span>
        </span>
        <span className="flex items-center gap-2">
          <Switch
            checked={item.is_active}
            disabled={isPending}
            onChange={(next) => (next ? run(() => setChecklistItemActive(item.id, true), 'saveFailed') : setConfirmingDeactivate(true))}
            label={t('activeLabel')}
            data-testid="checklist-item-active"
          />
          <span className="text-fg-muted">{item.is_active ? t('active') : t('inactive')}</span>
        </span>
      </div>

      {error && <FieldError>{error}</FieldError>}

      <DeleteConfirmDialog
        open={confirmingDeactivate}
        onCancel={() => setConfirmingDeactivate(false)}
        onConfirm={() => {
          setConfirmingDeactivate(false)
          run(() => setChecklistItemActive(item.id, false), 'saveFailed')
        }}
        kind="deactivate"
        itemLabel={localizedName({ name: item.name_en ?? item.name_ar ?? '', name_ar: item.name_ar }, locale)}
        confirmLabel={t('deactivate')}
        note={t('deactivateNote')}
      />
    </li>
  )
}
