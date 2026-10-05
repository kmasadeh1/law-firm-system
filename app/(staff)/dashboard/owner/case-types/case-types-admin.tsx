'use client'

import { useRef, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { createCaseType, setCaseTypeActive, updateCaseType, type CaseTypeErrorCode, type CaseTypeRow } from './actions'
import { Panel } from '@/components/dashboard/panel'
import { EmptyState } from '@/components/dashboard/empty-state'
import { Button } from '@/components/dashboard/button'
import { Switch } from '@/components/dashboard/switch'
import { Field, Label, FieldError, FieldSuccess, controlClass } from '@/components/dashboard/form'
import { DeleteConfirmDialog } from '@/components/dashboard/delete-confirm-dialog'
import { localizedName } from '@/lib/localized-name'

// Closed set the server can return - anything else falls back to a generic
// translated message rather than passing an arbitrary value to t() as a key.
const CASE_TYPE_ERROR_CODES: CaseTypeErrorCode[] = ['noName', 'noPermission', 'createFailed', 'saveFailed']

// The list is rendered straight from the server's rows, in the query's
// order (sort_order, then name). Every action revalidates this page, so a
// created, renamed or (de)activated case type arrives as fresh props - no
// client-side copy of the list, and no client-side re-sort.
export function CaseTypesAdmin({ caseTypes }: { caseTypes: CaseTypeRow[] }) {
  const t = useTranslations('dashboard.admin.caseTypes')

  return (
    <div className="flex flex-col gap-8">
      <CreateForm />

      {caseTypes.length === 0 && <EmptyState title={t('noneYet')} />}

      <div className="flex flex-col gap-4">
        {caseTypes.map((c) => (
          <CaseTypeCard key={c.id} caseType={c} />
        ))}
      </div>
    </div>
  )
}

// The fallback is the caller's - a failed save says "save failed", not
// "create failed".
function resolveError(
  code: CaseTypeErrorCode,
  fallback: CaseTypeErrorCode,
  tErrors: ReturnType<typeof useTranslations>
) {
  return tErrors((CASE_TYPE_ERROR_CODES as string[]).includes(code) ? code : fallback)
}

function CreateForm() {
  const t = useTranslations('dashboard.admin.caseTypes.createForm')
  const tErrors = useTranslations('dashboard.admin.caseTypes.errors')
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await createCaseType(formData)
      if (result.error) {
        setError(resolveError(result.error, 'createFailed', tErrors))
        return
      }
      formRef.current?.reset()
    })
  }

  return (
    <Panel className="flex flex-col gap-3">
      <h2 className="font-heading text-lg text-fg">{t('heading')}</h2>
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <Field>
            <Label htmlFor="new-case-type-name-en">{t('nameLabel')}</Label>
            <input id="new-case-type-name-en" name="name_en" className={controlClass} />
          </Field>
          <Field>
            <Label htmlFor="new-case-type-name-ar">{t('nameArLabel')}</Label>
            <input id="new-case-type-name-ar" name="name_ar" dir="rtl" lang="ar" className={controlClass} />
          </Field>
        </div>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" variant="primary" disabled={isPending} className="self-start">
          {isPending ? t('creating') : t('createCaseType')}
        </Button>
      </form>
    </Panel>
  )
}

function CaseTypeCard({ caseType }: { caseType: CaseTypeRow }) {
  const locale = useLocale()
  const t = useTranslations('dashboard.admin.caseTypes.card')
  const tErrors = useTranslations('dashboard.admin.caseTypes.errors')
  const formRef = useRef<HTMLFormElement>(null)
  const [nameEn, setNameEn] = useState(caseType.name_en ?? '')
  const [nameAr, setNameAr] = useState(caseType.name_ar ?? '')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, startSave] = useTransition()

  const [checked, setChecked] = useState(caseType.is_active)
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false)
  const [activeError, setActiveError] = useState<string | null>(null)
  const [isTogglingActive, startToggleActive] = useTransition()

  const changed = nameEn.trim() !== (caseType.name_en ?? '') || nameAr !== (caseType.name_ar ?? '')

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    const formData = new FormData(formRef.current!)
    startSave(async () => {
      const result = await updateCaseType(caseType.id, formData)
      if (result.error || !result.caseType) {
        setError(resolveError(result.error ?? 'saveFailed', 'saveFailed', tErrors))
        return
      }
      // Show what the database kept, not a re-derivation of its rules.
      setNameEn(result.caseType.name_en ?? '')
      setNameAr(result.caseType.name_ar ?? '')
      setSaved(true)
    })
  }

  function applyActive(next: boolean) {
    const previous = checked
    setActiveError(null)
    setChecked(next)
    startToggleActive(async () => {
      const result = await setCaseTypeActive(caseType.id, next)
      if (result.error || !result.caseType) {
        setChecked(previous)
        setActiveError(resolveError(result.error ?? 'saveFailed', 'saveFailed', tErrors))
        return
      }
      setChecked(result.caseType.is_active)
    })
  }

  // Reactivating isn't destructive - only turning a case type off needs the
  // extra step, same reasoning as staff ActiveToggle / courts' CourtCard.
  function handleActiveChange(next: boolean) {
    if (next) {
      applyActive(next)
    } else {
      setConfirmingDeactivate(true)
    }
  }

  return (
    <Panel className="flex flex-col gap-3">
      <form ref={formRef} onSubmit={handleSave} className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <input
            name="name_en"
            value={nameEn}
            onChange={(e) => {
              setNameEn(e.target.value)
              setSaved(false)
            }}
            aria-label={t('nameEnAriaLabel')}
            className={`flex-1 font-semibold ${controlClass}`}
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
            aria-label={t('nameArAriaLabel')}
            className={`flex-1 ${controlClass}`}
          />
        </div>
        {error && <FieldError>{error}</FieldError>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="secondary" disabled={isSaving || !changed}>
            {isSaving ? t('saving') : t('save')}
          </Button>
          {saved && !changed && <FieldSuccess>{t('saved')}</FieldSuccess>}
          <div className="grow" />
          <Switch
            checked={checked}
            disabled={isTogglingActive}
            onChange={handleActiveChange}
            label={checked ? t('activeAriaLabel') : t('inactiveAriaLabel')}
          />
          <span className="text-sm text-fg-muted">{checked ? t('activeText') : t('deactivatedText')}</span>
        </div>
        {activeError && <FieldError>{activeError}</FieldError>}
      </form>

      <DeleteConfirmDialog
        open={confirmingDeactivate}
        onCancel={() => setConfirmingDeactivate(false)}
        onConfirm={() => {
          setConfirmingDeactivate(false)
          applyActive(false)
        }}
        kind="deactivate"
        itemLabel={localizedName({ name: caseType.name_en ?? '', name_ar: caseType.name_ar }, locale)}
        confirmLabel={t('deactivate')}
      />
    </Panel>
  )
}
