'use client'

import { useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { updateFirmSettings } from '../actions'
import { resolveSiteContentError } from '../error-codes'
import { BilingualField } from '../bilingual-field'
import { Field, Label, FieldError, FieldSuccess, controlClass } from '@/components/dashboard/form'
import { Button } from '@/components/dashboard/button'

type FirmSettings = {
  address_en: string | null
  address_ar: string | null
  phone: string | null
  email: string | null
  hours_en: string | null
  hours_ar: string | null
}

export function FirmDetailsForm({ settings }: { settings: FirmSettings | null }) {
  const t = useTranslations('dashboard.admin.siteContent')
  const tErrors = useTranslations('dashboard.admin.siteContent.errors')
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await updateFirmSettings(formData)
      if (result.error) {
        setError(resolveSiteContentError(result.error, tErrors))
        return
      }
      setSaved(true)
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">
      <BilingualField
        nameEn="address_en"
        nameAr="address_ar"
        labelEn={t('firmDetails.addressEnLabel')}
        labelAr={t('firmDetails.addressArLabel')}
        defaultValueEn={settings?.address_en ?? ''}
        defaultValueAr={settings?.address_ar ?? ''}
        multiline
        warningLabel={t('statusMissingEnglish')}
        warningNote={t('missingEnglishNote')}
      />

      {/* Phone/email are single untranslated values, not a bilingual pair -
          dir="ltr" the same way settings-form.tsx already does for phone. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <Label htmlFor="site-content-phone">{t('firmDetails.phoneLabel')}</Label>
          <input
            id="site-content-phone"
            name="phone"
            type="tel"
            dir="ltr"
            defaultValue={settings?.phone ?? ''}
            onChange={() => setSaved(false)}
            data-testid="phone"
            className={controlClass}
          />
        </Field>
        <Field>
          <Label htmlFor="site-content-email">{t('firmDetails.emailLabel')}</Label>
          <input
            id="site-content-email"
            name="email"
            type="email"
            dir="ltr"
            defaultValue={settings?.email ?? ''}
            onChange={() => setSaved(false)}
            data-testid="email"
            className={controlClass}
          />
        </Field>
      </div>

      <BilingualField
        nameEn="hours_en"
        nameAr="hours_ar"
        labelEn={t('firmDetails.hoursEnLabel')}
        labelAr={t('firmDetails.hoursArLabel')}
        defaultValueEn={settings?.hours_en ?? ''}
        defaultValueAr={settings?.hours_ar ?? ''}
        multiline
        warningLabel={t('statusMissingEnglish')}
        warningNote={t('missingEnglishNote')}
      />

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={isPending} className="self-start" data-testid="site-content-save">
          {isPending ? t('saving') : t('save')}
        </Button>
        {saved && <FieldSuccess data-testid="site-content-saved">{t('saved')}</FieldSuccess>}
      </div>
      {error && (
        <FieldError data-testid="site-content-error">
          <bdi>{error}</bdi>
        </FieldError>
      )}
    </form>
  )
}
