'use client'

import { useRef, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  createReferralSource,
  setReferralSourceActive,
  updateReferralSource,
  type ReferralSourceErrorCode,
  type ReferralSourceRow,
} from './actions'
import { Panel } from '@/components/dashboard/panel'
import { EmptyState } from '@/components/dashboard/empty-state'
import { Button } from '@/components/dashboard/button'
import { Switch } from '@/components/dashboard/switch'
import { Field, Label, FieldError, FieldSuccess, controlClass } from '@/components/dashboard/form'
import { DeleteConfirmDialog } from '@/components/dashboard/delete-confirm-dialog'
import { localizedName } from '@/lib/localized-name'

// Closed set the server can return - anything else falls back to a generic
// translated message rather than passing an arbitrary value to t() as a key.
const ERROR_CODES: ReferralSourceErrorCode[] = ['noName', 'noPermission', 'createFailed', 'saveFailed']

function resolveError(
  code: ReferralSourceErrorCode,
  fallback: ReferralSourceErrorCode,
  tErrors: ReturnType<typeof useTranslations>
) {
  return tErrors((ERROR_CODES as string[]).includes(code) ? code : fallback)
}

// The list is rendered straight from the server's rows, in the query's
// order. Every action revalidates this page, so a created, renamed or
// (de)activated source arrives as fresh props - no client-side copy of the
// list, and no client-side re-sort.
export function ReferralSourcesAdmin({ sources }: { sources: ReferralSourceRow[] }) {
  const t = useTranslations('dashboard.admin.referralSources')

  return (
    <div className="flex flex-col gap-8" data-testid="referral-sources-admin">
      <CreateForm />

      {sources.length === 0 && <EmptyState title={t('noneYet')} description={t('noneYetDescription')} />}

      <div className="flex flex-col gap-4">
        {sources.map((s) => (
          <SourceCard key={s.id} source={s} />
        ))}
      </div>
    </div>
  )
}

function CreateForm() {
  const t = useTranslations('dashboard.admin.referralSources.createForm')
  const tErrors = useTranslations('dashboard.admin.referralSources.errors')
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await createReferralSource(formData)
      if (result.error) {
        setError(resolveError(result.error, 'createFailed', tErrors))
        return
      }
      formRef.current?.reset()
    })
  }

  return (
    <Panel className="flex flex-col gap-3" data-testid="referral-source-create">
      <h2 className="font-heading text-lg text-fg">{t('heading')}</h2>
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <Field>
            <Label htmlFor="new-referral-source-name-en">{t('nameLabel')}</Label>
            <input id="new-referral-source-name-en" name="name_en" className={controlClass} />
          </Field>
          <Field>
            <Label htmlFor="new-referral-source-name-ar">{t('nameArLabel')}</Label>
            <input id="new-referral-source-name-ar" name="name_ar" dir="rtl" lang="ar" className={controlClass} />
          </Field>
        </div>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" variant="primary" disabled={isPending} className="self-start">
          {isPending ? t('creating') : t('create')}
        </Button>
      </form>
    </Panel>
  )
}

function SourceCard({ source }: { source: ReferralSourceRow }) {
  const locale = useLocale()
  const t = useTranslations('dashboard.admin.referralSources.card')
  const tErrors = useTranslations('dashboard.admin.referralSources.errors')
  const formRef = useRef<HTMLFormElement>(null)
  const [nameEn, setNameEn] = useState(source.name_en ?? '')
  const [nameAr, setNameAr] = useState(source.name_ar ?? '')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, startSave] = useTransition()

  const [checked, setChecked] = useState(source.is_active)
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false)
  const [activeError, setActiveError] = useState<string | null>(null)
  const [isTogglingActive, startToggleActive] = useTransition()

  const changed = nameEn !== (source.name_en ?? '') || nameAr !== (source.name_ar ?? '')

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    const formData = new FormData(formRef.current!)
    startSave(async () => {
      const result = await updateReferralSource(source.id, formData)
      if (result.error || !result.source) {
        setError(resolveError(result.error ?? 'saveFailed', 'saveFailed', tErrors))
        return
      }
      // Show what the database kept (trimmed English, blank Arabic stored
      // as NULL), not what was typed.
      setNameEn(result.source.name_en ?? '')
      setNameAr(result.source.name_ar ?? '')
      setSaved(true)
    })
  }

  function applyActive(next: boolean) {
    const previous = checked
    setActiveError(null)
    setChecked(next)
    startToggleActive(async () => {
      const result = await setReferralSourceActive(source.id, next)
      if (result.error || !result.source) {
        setChecked(previous)
        setActiveError(resolveError(result.error ?? 'saveFailed', 'saveFailed', tErrors))
        return
      }
      setChecked(result.source.is_active)
    })
  }

  // Reactivating isn't destructive - only turning a source off needs the
  // extra step, same as case types and courts.
  function handleActiveChange(next: boolean) {
    if (next) {
      applyActive(next)
    } else {
      setConfirmingDeactivate(true)
    }
  }

  return (
    <Panel className="flex flex-col gap-3" data-testid="referral-source-card">
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
        itemLabel={localizedName({ name: source.name_en ?? source.name_ar ?? '', name_ar: source.name_ar }, locale)}
        confirmLabel={t('deactivate')}
        note={t('deactivateNote')}
      />
    </Panel>
  )
}
