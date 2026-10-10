'use client'

import { useRef, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { createCourt, setCourtActive, updateCourt, type CourtErrorCode, type CourtRow, type CourtType } from './actions'
import { Panel } from '@/components/dashboard/panel'
import { EmptyState } from '@/components/dashboard/empty-state'
import { Button } from '@/components/dashboard/button'
import { Switch } from '@/components/dashboard/switch'
import { Field, Label, FieldError, FieldSuccess, controlClass } from '@/components/dashboard/form'
import { DeleteConfirmDialog } from '@/components/dashboard/delete-confirm-dialog'
import { localizedName } from '@/lib/localized-name'

const COURT_TYPES: CourtType[] = [
  'conciliation',
  'first_instance',
  'appeal',
  'cassation',
  'administrative',
  'sharia',
  'execution',
  'other',
]

// Closed set the server can return - anything else falls back to a generic
// translated message rather than passing an arbitrary value to t() as a key.
const COURT_ERROR_CODES: CourtErrorCode[] = ['selectType', 'noName', 'noPermission', 'createFailed', 'saveFailed']

// The list is rendered straight from the server's rows, in the query's
// order (sort_order, then name). Every action revalidates this page, so a
// created, edited or (de)activated court arrives as fresh props - no
// client-side copy of the list, and no client-side re-sort.
export function CourtsAdmin({ courts }: { courts: CourtRow[] }) {
  const t = useTranslations('dashboard.admin.courts')

  return (
    <div className="flex flex-col gap-8">
      <CreateForm />

      {courts.length === 0 && <EmptyState title={t('noneYet')} />}

      <div className="flex flex-col gap-4">
        {courts.map((c) => (
          <CourtCard key={c.id} court={c} />
        ))}
      </div>
    </div>
  )
}

// The fallback is the caller's - a failed save says "save failed", not
// "create failed".
function resolveError(code: CourtErrorCode, fallback: CourtErrorCode, tErrors: ReturnType<typeof useTranslations>) {
  return tErrors((COURT_ERROR_CODES as string[]).includes(code) ? code : fallback)
}

function CreateForm() {
  const t = useTranslations('dashboard.admin.courts.createForm')
  const tType = useTranslations('dashboard.admin.courts.type')
  const tErrors = useTranslations('dashboard.admin.courts.errors')
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await createCourt(formData)
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
            <Label htmlFor="new-court-name-en">{t('nameLabel')}</Label>
            <input id="new-court-name-en" name="name_en" className={controlClass} />
          </Field>
          <Field>
            <Label htmlFor="new-court-name-ar">{t('nameArLabel')}</Label>
            <input id="new-court-name-ar" name="name_ar" dir="rtl" lang="ar" className={controlClass} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-3">
          <Field>
            <Label htmlFor="new-court-city-en">{t('cityLabel')}</Label>
            <input id="new-court-city-en" name="city_en" className={controlClass} />
          </Field>
          <Field>
            <Label htmlFor="new-court-city-ar">{t('cityArLabel')}</Label>
            <input id="new-court-city-ar" name="city_ar" dir="rtl" lang="ar" className={controlClass} />
          </Field>
        </div>
        <Field>
          <Label htmlFor="new-court-type" required>
            {t('typeLabel')}
          </Label>
          <select id="new-court-type" name="court_type" required defaultValue="" className={controlClass}>
            <option value="" disabled>
              {t('selectTypePlaceholder')}
            </option>
            {COURT_TYPES.map((type) => (
              <option key={type} value={type}>
                {tType(type)}
              </option>
            ))}
          </select>
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" variant="primary" disabled={isPending} className="self-start">
          {isPending ? t('creating') : t('createCourt')}
        </Button>
      </form>
    </Panel>
  )
}

function CourtCard({ court }: { court: CourtRow }) {
  const locale = useLocale()
  const t = useTranslations('dashboard.admin.courts.card')
  const tType = useTranslations('dashboard.admin.courts.type')
  const tErrors = useTranslations('dashboard.admin.courts.errors')
  const formRef = useRef<HTMLFormElement>(null)
  const [nameEn, setNameEn] = useState(court.name_en ?? '')
  const [nameAr, setNameAr] = useState(court.name_ar ?? '')
  const [cityEn, setCityEn] = useState(court.city_en ?? '')
  const [cityAr, setCityAr] = useState(court.city_ar ?? '')
  const [courtType, setCourtType] = useState(court.court_type)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, startSave] = useTransition()

  const [checked, setChecked] = useState(court.is_active)
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false)
  const [activeError, setActiveError] = useState<string | null>(null)
  const [isTogglingActive, startToggleActive] = useTransition()

  const changed =
    nameEn.trim() !== (court.name_en ?? '') ||
    nameAr !== (court.name_ar ?? '') ||
    cityEn.trim() !== (court.city_en ?? '') ||
    cityAr !== (court.city_ar ?? '') ||
    courtType !== court.court_type

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    const formData = new FormData(formRef.current!)
    startSave(async () => {
      const result = await updateCourt(court.id, formData)
      if (result.error || !result.court) {
        setError(resolveError(result.error ?? 'saveFailed', 'saveFailed', tErrors))
        return
      }
      // Show what the database kept, not a re-derivation of its rules.
      setNameEn(result.court.name_en ?? '')
      setNameAr(result.court.name_ar ?? '')
      setCityEn(result.court.city_en ?? '')
      setCityAr(result.court.city_ar ?? '')
      setCourtType(result.court.court_type)
      setSaved(true)
    })
  }

  function applyActive(next: boolean) {
    const previous = checked
    setActiveError(null)
    setChecked(next)
    startToggleActive(async () => {
      const result = await setCourtActive(court.id, next)
      if (result.error || !result.court) {
        setChecked(previous)
        setActiveError(resolveError(result.error ?? 'saveFailed', 'saveFailed', tErrors))
        return
      }
      setChecked(result.court.is_active)
    })
  }

  // Reactivating isn't destructive - only turning a court off needs the
  // extra step, same reasoning as staff ActiveToggle.
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
        <div className="flex flex-wrap gap-2">
          <input
            name="city_en"
            value={cityEn}
            onChange={(e) => {
              setCityEn(e.target.value)
              setSaved(false)
            }}
            aria-label={t('cityEnAriaLabel')}
            className={`flex-1 ${controlClass}`}
          />
          <input
            name="city_ar"
            value={cityAr}
            onChange={(e) => {
              setCityAr(e.target.value)
              setSaved(false)
            }}
            dir="rtl"
            lang="ar"
            aria-label={t('cityArAriaLabel')}
            className={`flex-1 ${controlClass}`}
          />
        </div>
        <select
          name="court_type"
          value={courtType}
          onChange={(e) => {
            setCourtType(e.target.value as CourtType)
            setSaved(false)
          }}
          aria-label={t('typeAriaLabel')}
          className={`w-full sm:w-64 ${controlClass}`}
        >
          {COURT_TYPES.map((type) => (
            <option key={type} value={type}>
              {tType(type)}
            </option>
          ))}
        </select>
        {error && <FieldError>{error}</FieldError>}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="secondary" disabled={isSaving || !changed}>
            {isSaving ? t('saving') : t('save')}
          </Button>
          <FieldSuccess show={saved && !changed}>{t('saved')}</FieldSuccess>
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
        itemLabel={localizedName({ name: court.name_en ?? '', name_ar: court.name_ar }, locale)}
        confirmLabel={t('deactivate')}
      />
    </Panel>
  )
}
